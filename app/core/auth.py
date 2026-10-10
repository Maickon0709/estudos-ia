"""Autenticação: sessão em cookie HttpOnly (site) ou Bearer token (API/testes).

Por que cookie HttpOnly: o navegador guarda e envia o token sozinho, e o
JavaScript da página NÃO consegue lê-lo. Um eventual XSS não rouba a sessão.

Por que o cabeçalho X-Requested-With: cookies vão junto em qualquer requisição
ao nosso domínio, inclusive as disparadas por outro site (CSRF). Um site de fora
não consegue enviar esse cabeçalho sem a permissão do CORS, então toda escrita
autenticada por cookie exige o cabeçalho. SameSite=Lax é a segunda barreira.
"""
from functools import wraps

from flask import current_app, g, request

from app.core.errors import NaoAutenticadoError, ProibidoError
from app.core.supabase_client import anon_client

COOKIE_ACESSO = "ei_acesso"
COOKIE_RENOVACAO = "ei_renovacao"
CABECALHO_CSRF = "X-Requested-With"
VALOR_CSRF = "estudos-ia"
METODOS_SEGUROS = {"GET", "HEAD", "OPTIONS"}
RENOVACAO_MAX_IDADE = 30 * 24 * 3600  # 30 dias


def obter_user_id(token: str) -> str:
    """Pergunta ao Supabase Auth de quem é o token. Levanta se inválido."""
    try:
        resposta = anon_client().auth.get_user(token)
    except Exception as exc:  # token expirado, malformado, etc.
        raise NaoAutenticadoError("Token inválido ou expirado.") from exc

    if resposta is None or resposta.user is None:
        raise NaoAutenticadoError("Token inválido ou expirado.")
    return str(resposta.user.id)


def exigir_cabecalho_csrf() -> None:
    if request.headers.get(CABECALHO_CSRF) != VALOR_CSRF:
        raise ProibidoError("Requisição recusada: cabeçalho de segurança ausente.")


def _extrair_token() -> str:
    cabecalho = request.headers.get("Authorization", "")
    partes = cabecalho.split()
    if len(partes) == 2 and partes[0].lower() == "bearer":
        return partes[1]  # clientes de API e testes
    token = request.cookies.get(COOKIE_ACESSO)
    if token:
        if request.method not in METODOS_SEGUROS:
            exigir_cabecalho_csrf()
        return token
    raise NaoAutenticadoError("Faça login para continuar.")


def login_required(funcao):
    @wraps(funcao)
    def embrulho(*args, **kwargs):
        token = _extrair_token()
        g.token = token
        g.user_id = obter_user_id(token)
        return funcao(*args, **kwargs)

    return embrulho


# ---------- cookies da sessão ----------
def gravar_sessao(resposta, sessao) -> None:
    seguro = current_app.config.get("COOKIE_SEGURO", True)
    comuns = {"httponly": True, "secure": seguro, "samesite": "Lax", "path": "/"}
    resposta.set_cookie(COOKIE_ACESSO, sessao.access_token, max_age=int(sessao.expires_in or 3600), **comuns)
    resposta.set_cookie(COOKIE_RENOVACAO, sessao.refresh_token, max_age=RENOVACAO_MAX_IDADE, **comuns)


def limpar_sessao(resposta) -> None:
    seguro = current_app.config.get("COOKIE_SEGURO", True)
    for nome in (COOKIE_ACESSO, COOKIE_RENOVACAO):
        resposta.delete_cookie(nome, path="/", httponly=True, secure=seguro, samesite="Lax")
