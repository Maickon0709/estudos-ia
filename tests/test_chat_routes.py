import uuid

import pytest
from flask import g

from app.core import auth, dependencies
from app.core.errors import IAIndisponivelError, NaoAutenticadoError
from app.services.categoria_service import CategoriaService
from app.services.chat_service import ChatService
from tests.fakes import LLMFalso, MensagemRepoFalso
from tests.test_categoria_service import RepoFalso

CABECALHO = {"Authorization": "Bearer token-valido"}


@pytest.fixture
def ambiente(monkeypatch):
    categorias = RepoFalso()
    categoria = categorias.criar("user-1", "Inglês")
    llm = LLMFalso()
    service = ChatService(CategoriaService(categorias), MensagemRepoFalso(), llm)

    def validar(token):
        if token != "token-valido":
            raise NaoAutenticadoError("Token inválido ou expirado.")
        return "user-1"

    monkeypatch.setattr(auth, "obter_user_id", validar)
    monkeypatch.setattr(dependencies, "get_chat_service", lambda: service)
    return categoria, llm


def test_chat_exige_login(client, ambiente):
    categoria, _ = ambiente
    assert client.post(f"/categorias/{categoria['id']}/chat", json={"mensagem": "Oi"}).status_code == 401
    assert client.get(f"/categorias/{categoria['id']}/mensagens").status_code == 401


def test_enviar_e_ler_historico(client, ambiente):
    categoria, _ = ambiente
    enviada = client.post(
        f"/categorias/{categoria['id']}/chat", json={"mensagem": "Quero fluência"}, headers=CABECALHO
    )
    assert enviada.status_code == 201
    corpo = enviada.get_json()
    assert corpo["pergunta"]["conteudo"] == "Quero fluência"
    assert corpo["resposta"]["conteudo"] == "Resposta da IA."

    historico = client.get(f"/categorias/{categoria['id']}/mensagens", headers=CABECALHO).get_json()
    assert [m["papel"] for m in historico] == ["user", "assistant"]


def test_mensagem_ausente_retorna_400(client, ambiente):
    categoria, _ = ambiente
    resposta = client.post(f"/categorias/{categoria['id']}/chat", json={}, headers=CABECALHO)
    assert resposta.status_code == 400
    assert resposta.get_json()["erro"] == "validacao"


def test_categoria_inexistente_retorna_404(client, ambiente):
    resposta = client.post(
        f"/categorias/{uuid.uuid4()}/chat", json={"mensagem": "Oi"}, headers=CABECALHO
    )
    assert resposta.status_code == 404


def test_ia_fora_do_ar_retorna_502(client, ambiente):
    categoria, llm = ambiente
    llm.erro = IAIndisponivelError("A IA não está configurada neste servidor.")

    resposta = client.post(
        f"/categorias/{categoria['id']}/chat", json={"mensagem": "Oi"}, headers=CABECALHO
    )
    assert resposta.status_code == 502
    assert resposta.get_json()["erro"] == "ia_indisponivel"

    # nada foi gravado
    historico = client.get(f"/categorias/{categoria['id']}/mensagens", headers=CABECALHO)
    assert historico.get_json() == []


def test_get_chat_service_monta_as_camadas(app, monkeypatch):
    monkeypatch.setattr(dependencies, "user_client", lambda token: object())
    with app.test_request_context():
        g.token = "t"
        assert isinstance(dependencies.get_chat_service(), ChatService)
