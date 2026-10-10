"""Sessão em cookie HttpOnly + proteção contra CSRF."""
import pytest
from supabase_auth.errors import AuthApiError

from app.core import auth, dependencies
from app.core.errors import NaoAutenticadoError
from app.routes import auth as rotas_auth

CSRF = {"X-Requested-With": "estudos-ia"}


class Sessao:
    def __init__(self, acesso="tk-acesso", renovacao="tk-renovacao"):
        self.access_token = acesso
        self.refresh_token = renovacao
        self.expires_in = 3600
        self.expires_at = 1791600000


class Resposta:
    def __init__(self, sessao):
        self.session = sessao


class AuthFalso:
    def __init__(self):
        self.renovacoes = []
        self.renovacao_falha = False

    def sign_in_with_password(self, dados):
        if dados["password"] != "senha-certa":
            raise AuthApiError("Invalid login credentials", 400, "invalid_credentials")
        return Resposta(Sessao())

    def refresh_session(self, token):
        self.renovacoes.append(token)
        if self.renovacao_falha:
            raise AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found")
        return Resposta(Sessao("tk-novo", "tk-renovacao-nova"))


class ClienteFalso:
    def __init__(self):
        self.auth = AuthFalso()


@pytest.fixture
def supabase(monkeypatch):
    falso = ClienteFalso()
    monkeypatch.setattr(rotas_auth, "anon_client", lambda: falso)

    def validar(token):
        if token not in ("tk-acesso", "tk-novo"):
            raise NaoAutenticadoError("Token inválido ou expirado.")
        return "u1"

    monkeypatch.setattr(auth, "obter_user_id", validar)
    return falso


def cookies(resposta):
    return {c.split("=", 1)[0]: c for c in resposta.headers.getlist("Set-Cookie")}


def entrar(client):
    return client.post("/auth/login", headers=CSRF, json={"email": "a@b.com", "senha": "senha-certa"})


def test_login_grava_cookies_httponly_e_nao_devolve_token(client, supabase):
    resposta = entrar(client)
    assert resposta.status_code == 200
    corpo = resposta.get_data(as_text=True)
    assert "tk-acesso" not in corpo and "tk-renovacao" not in corpo  # o JS da página nunca vê o token
    for nome in ("ei_acesso", "ei_renovacao"):
        c = cookies(resposta)[nome]
        assert "HttpOnly" in c and "Secure" in c and "SameSite=Lax" in c and "Path=/" in c


def test_login_sem_cabecalho_e_recusado(client, supabase):
    resposta = client.post("/auth/login", json={"email": "a@b.com", "senha": "senha-certa"})
    assert resposta.status_code == 403 and resposta.get_json()["erro"] == "proibido"


def test_cookie_autentica_leituras(client, supabase):
    entrar(client)
    resposta = client.get("/auth/sessao")
    assert resposta.status_code == 200 and resposta.get_json() == {"logado": True, "user_id": "u1"}


def test_escrita_por_cookie_exige_cabecalho_anti_csrf(client, supabase, monkeypatch):
    class Eco:
        def criar(self, user_id, nome):
            return {"id": "c1", "nome": nome}

    monkeypatch.setattr(dependencies, "get_categoria_service", lambda: Eco())
    entrar(client)
    # Um site de fora consegue mandar o cookie, mas não o cabeçalho: recusado.
    ataque = client.post("/categorias", json={"nome": "Invasão"})
    assert ataque.status_code == 403
    legitimo = client.post("/categorias", json={"nome": "SQL"}, headers=CSRF)
    assert legitimo.status_code == 201


def test_bearer_continua_valendo_para_clientes_de_api(client, supabase):
    assert client.get("/auth/sessao", headers={"Authorization": "Bearer tk-acesso"}).status_code == 200


def test_sem_sessao_responde_401(client, supabase):
    resposta = client.get("/auth/sessao")
    assert resposta.status_code == 401 and resposta.get_json()["mensagem"] == "Faça login para continuar."


def test_renovar_troca_os_cookies(client, supabase):
    entrar(client)
    resposta = client.post("/auth/renovar", headers=CSRF)
    assert resposta.status_code == 200 and supabase.auth.renovacoes == ["tk-renovacao"]
    assert "tk-novo" in cookies(resposta)["ei_acesso"] and "tk-novo" not in resposta.get_data(as_text=True)


def test_renovar_sem_cookie_ou_invalido(client, supabase):
    assert client.post("/auth/renovar", headers=CSRF).status_code == 401
    entrar(client)
    supabase.auth.renovacao_falha = True
    resposta = client.post("/auth/renovar", headers=CSRF)
    assert resposta.status_code == 401
    assert "Max-Age=0" in cookies(resposta)["ei_acesso"] or "Expires=Thu, 01 Jan 1970" in cookies(resposta)["ei_acesso"]


def test_renovar_e_sair_exigem_cabecalho(client, supabase):
    entrar(client)
    assert client.post("/auth/renovar").status_code == 403
    assert client.post("/auth/sair").status_code == 403


def test_sair_apaga_os_cookies(client, supabase):
    entrar(client)
    resposta = client.post("/auth/sair", headers=CSRF)
    assert resposta.status_code == 200
    for nome in ("ei_acesso", "ei_renovacao"):
        c = cookies(resposta)[nome]
        assert "Max-Age=0" in c or "Expires=Thu, 01 Jan 1970" in c
    assert client.get("/auth/sessao").status_code == 401


def test_cookie_sem_secure_so_quando_configurado(client, supabase, app):
    app.config["COOKIE_SEGURO"] = False
    assert "Secure" not in cookies(entrar(client))["ei_acesso"]
