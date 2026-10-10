"""Esqueci a senha: pedido do e-mail de recuperação e troca da senha pelo link."""
import pytest
from supabase_auth.errors import AuthApiError

from app.core.auth import COOKIE_ACESSO, COOKIE_RENOVACAO
from app.routes import auth as rotas_auth

CSRF = {"X-Requested-With": "estudos-ia"}


class Sessao:
    access_token = "token-de-acesso"
    refresh_token = "token-de-renovacao"
    expires_in = 3600
    expires_at = 1_900_000_000


class AuthFalso:
    def __init__(self, erro_envio=None, erro_verificar=None, erro_trocar=None, sem_sessao=False):
        self.erro_envio, self.erro_verificar, self.erro_trocar = erro_envio, erro_verificar, erro_trocar
        self.sem_sessao = sem_sessao
        self.enviados, self.verificados, self.trocas = [], [], []
        self.sessao_guardada = None

    def reset_password_for_email(self, email, options=None):
        self.enviados.append(email)
        if self.erro_envio:
            raise self.erro_envio

    def verify_otp(self, params):
        self.verificados.append(params)
        if self.erro_verificar:
            raise self.erro_verificar
        sessao = None if self.sem_sessao else Sessao()
        self.sessao_guardada = sessao

        class Resposta:
            pass
        Resposta.session = sessao
        return Resposta()

    def update_user(self, atributos):
        assert self.sessao_guardada is not None, "trocou a senha sem a sessão do link"
        if self.erro_trocar:
            raise self.erro_trocar
        self.trocas.append(atributos)


class ClienteFalso:
    def __init__(self, **kwargs):
        self.auth = AuthFalso(**kwargs)


@pytest.fixture
def falso(monkeypatch):
    def instalar(**kwargs):
        cliente = ClienteFalso(**kwargs)
        monkeypatch.setattr(rotas_auth, "anon_client", lambda: cliente)
        return cliente.auth
    return instalar


# ---------- /auth/esqueci ----------

def test_esqueci_pede_o_email_ao_supabase(client, falso):
    auth = falso()
    resposta = client.post("/auth/esqueci", headers=CSRF, json={"email": "  ana@exemplo.com "})
    assert resposta.status_code == 200
    assert resposta.get_json()["mensagem"] == rotas_auth.AVISO_RECUPERACAO
    assert auth.enviados == ["ana@exemplo.com"]


@pytest.mark.parametrize("erro", [
    AuthApiError("User not found", 400, "user_not_found"),
    AuthApiError("For security purposes, you can only request this after 60 seconds.", 429, "over_email_send_rate_limit"),
    AuthApiError("Error sending recovery email", 500, "unexpected_failure"),
])
def test_esqueci_responde_igual_para_nao_revelar_quem_tem_conta(client, falso, caplog, erro):
    falso(erro_envio=erro)
    with caplog.at_level("WARNING"):
        resposta = client.post("/auth/esqueci", headers=CSRF, json={"email": "ana@exemplo.com"})
    assert resposta.status_code == 200
    assert resposta.get_json() == {"mensagem": rotas_auth.AVISO_RECUPERACAO}
    assert "ana@exemplo.com" not in caplog.text  # o motivo vai para o log, o e-mail não


@pytest.mark.parametrize("email", ["", "sem-arroba", None, "a@" + "b" * 260])
def test_esqueci_recusa_email_invalido_sem_chamar_o_supabase(client, falso, email):
    auth = falso()
    resposta = client.post("/auth/esqueci", headers=CSRF, json={"email": email})
    assert resposta.status_code == 400
    assert auth.enviados == []


def test_esqueci_exige_o_cabecalho_anti_csrf(client, falso):
    auth = falso()
    resposta = client.post("/auth/esqueci", json={"email": "ana@exemplo.com"})
    assert resposta.status_code == 403
    assert auth.enviados == []


# ---------- /auth/redefinir ----------

def test_redefinir_confere_o_link_troca_a_senha_e_entra(client, falso):
    auth = falso()
    resposta = client.post("/auth/redefinir", headers=CSRF, json={"token_hash": "hash-do-link-123", "senha": "novaSenha9"})
    assert resposta.status_code == 200
    assert resposta.get_json()["logado"] is True
    assert auth.verificados == [{"token_hash": "hash-do-link-123", "type": "recovery"}]
    assert auth.trocas == [{"password": "novaSenha9"}]
    cookies = resposta.headers.getlist("Set-Cookie")
    assert any(c.startswith(f"{COOKIE_ACESSO}=") and "HttpOnly" in c for c in cookies)
    assert any(c.startswith(f"{COOKIE_RENOVACAO}=") and "HttpOnly" in c for c in cookies)
    assert "token-de-acesso" not in resposta.get_data(as_text=True)  # token só no cookie


@pytest.mark.parametrize("kwargs", [
    {"erro_verificar": AuthApiError("Token has expired or is invalid", 403, "otp_expired")},
    {"sem_sessao": True},
])
def test_link_vencido_ou_usado_nao_troca_a_senha(client, falso, kwargs):
    auth = falso(**kwargs)
    resposta = client.post("/auth/redefinir", headers=CSRF, json={"token_hash": "hash-vencido-123", "senha": "novaSenha9"})
    assert resposta.status_code == 400
    assert "expirou ou já foi usado" in resposta.get_json()["mensagem"]
    assert auth.trocas == []
    assert not resposta.headers.getlist("Set-Cookie")


@pytest.mark.parametrize("codigo,trecho", [
    ("same_password", "diferente da antiga"),
    ("weak_password", "Senha fraca"),
    (None, "Não foi possível trocar a senha"),
])
def test_erro_ao_trocar_vira_portugues_e_nao_loga(client, falso, codigo, trecho):
    falso(erro_trocar=AuthApiError("New password should be different", 422, codigo))
    resposta = client.post("/auth/redefinir", headers=CSRF, json={"token_hash": "hash-do-link-123", "senha": "novaSenha9"})
    assert resposta.status_code == 400
    assert trecho in resposta.get_json()["mensagem"]
    assert not resposta.headers.getlist("Set-Cookie")


@pytest.mark.parametrize("corpo", [
    {"token_hash": "hash-do-link-123", "senha": "12345"},  # senha curta
    {"token_hash": "curto", "senha": "novaSenha9"},
    {"token_hash": "x" * 300, "senha": "novaSenha9"},
    {"token_hash": ["lista"], "senha": "novaSenha9"},
    {"senha": "novaSenha9"},
])
def test_redefinir_valida_antes_de_falar_com_o_supabase(client, falso, corpo):
    auth = falso()
    resposta = client.post("/auth/redefinir", headers=CSRF, json=corpo)
    assert resposta.status_code == 400
    assert auth.verificados == [] and auth.trocas == []


def test_redefinir_exige_o_cabecalho_anti_csrf(client, falso):
    auth = falso()
    resposta = client.post("/auth/redefinir", json={"token_hash": "hash-do-link-123", "senha": "novaSenha9"})
    assert resposta.status_code == 403
    assert auth.verificados == []
