import pytest
from supabase_auth.errors import AuthApiError

from app.routes import auth as rotas_auth

CSRF = {"X-Requested-With": "estudos-ia"}


class AuthFalso:
    def __init__(self, erro):
        self.erro = erro
        self.pedidos = []

    def sign_up(self, dados):
        self.pedidos.append(dados)
        if self.erro is not None:
            raise self.erro

        class Resposta:
            session = None
        return Resposta()


class ClienteFalso:
    def __init__(self, erro):
        self.auth = AuthFalso(erro)


def cadastrar(client, monkeypatch, erro):
    monkeypatch.setattr(rotas_auth, "anon_client", lambda: ClienteFalso(erro))
    return client.post("/auth/cadastro", headers=CSRF, json={"email": "a@b.com", "senha": "123456", "aceite_termos": True})


@pytest.mark.parametrize("codigo,trecho", [
    ("user_already_exists", "Já existe uma conta"),
    ("weak_password", "Senha fraca"),
    ("over_email_send_rate_limit", "Espere alguns minutos"),
])
def test_erro_do_supabase_no_cadastro_vira_portugues(client, monkeypatch, codigo, trecho):
    resposta = cadastrar(client, monkeypatch, AuthApiError("User already registered", 422, codigo))
    assert resposta.status_code == 400
    assert trecho in resposta.get_json()["mensagem"]
    assert "registered" not in resposta.get_json()["mensagem"]


def test_erro_desconhecido_no_cadastro_tem_mensagem_generica(client, monkeypatch):
    resposta = cadastrar(client, monkeypatch, AuthApiError("Something odd", 500, None))
    assert resposta.get_json()["mensagem"] == "Não foi possível criar a conta. Tente novamente."


def test_rota_inexistente_responde_json(client):
    resposta = client.get("/nao-existe")
    assert resposta.status_code == 404
    assert resposta.get_json() == {"erro": "nao_encontrado", "mensagem": "Rota não encontrada."}


def test_metodo_errado_responde_json(client):
    resposta = client.put("/health")
    assert resposta.status_code == 405
    assert resposta.get_json()["erro"] == "metodo_nao_permitido"


def test_cadastro_exige_aceite_dos_termos(client, monkeypatch):
    falso = ClienteFalso(None)
    monkeypatch.setattr(rotas_auth, "anon_client", lambda: falso)
    for aceite in (None, False, "true", 1):
        corpo = {"email": "a@b.com", "senha": "123456"}
        if aceite is not None:
            corpo["aceite_termos"] = aceite
        resposta = client.post("/auth/cadastro", headers=CSRF, json=corpo)
        assert resposta.status_code == 400 and "Termos de Uso" in resposta.get_json()["mensagem"]
    assert falso.auth.pedidos == []  # nem chegou ao Supabase


def test_cadastro_envia_a_versao_dos_termos(client, monkeypatch):
    falso = ClienteFalso(None)
    monkeypatch.setattr(rotas_auth, "anon_client", lambda: falso)
    resposta = client.post("/auth/cadastro", headers=CSRF, json={"email": "a@b.com", "senha": "123456",
                                                    "nome": "Ana", "aceite_termos": True})
    assert resposta.status_code == 201
    assert falso.auth.pedidos[0]["options"]["data"] == {"nome": "Ana", "termos_versao": rotas_auth.TERMOS_VERSAO}
