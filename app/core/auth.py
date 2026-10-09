"""Autenticação: valida o Bearer token e expõe o usuário em flask.g."""
from functools import wraps

from flask import g, request

from app.core.errors import NaoAutenticadoError
from app.core.supabase_client import anon_client


def obter_user_id(token: str) -> str:
    """Pergunta ao Supabase Auth de quem é o token. Levanta se inválido."""
    try:
        resposta = anon_client().auth.get_user(token)
    except Exception as exc:  # token expirado, malformado, etc.
        raise NaoAutenticadoError("Token inválido ou expirado.") from exc

    if resposta is None or resposta.user is None:
        raise NaoAutenticadoError("Token inválido ou expirado.")
    return str(resposta.user.id)


def _extrair_token() -> str:
    cabecalho = request.headers.get("Authorization", "")
    partes = cabecalho.split()
    if len(partes) != 2 or partes[0].lower() != "bearer":
        raise NaoAutenticadoError("Envie o header Authorization: Bearer <token>.")
    return partes[1]


def login_required(funcao):
    @wraps(funcao)
    def embrulho(*args, **kwargs):
        token = _extrair_token()
        g.token = token
        g.user_id = obter_user_id(token)
        return funcao(*args, **kwargs)

    return embrulho
