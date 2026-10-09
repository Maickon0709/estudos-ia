import json
import uuid

import pytest
from flask import g

from app.core import auth, dependencies
from app.core.errors import NaoAutenticadoError
from app.services.categoria_service import CategoriaService
from app.services.proposta_service import PropostaService
from tests.fakes import LLMFalso, MensagemRepoFalso
from tests.fakes_propostas import PesquisaFalsa, PropostaRepoFalso
from tests.test_categoria_service import RepoFalso

CABECALHO = {"Authorization": "Bearer token-valido"}
RESPOSTA_IA = json.dumps({"titulo": "SQL", "etapas": [{"titulo": "SELECT", "recursos": [1]}]})


@pytest.fixture
def ambiente(monkeypatch):
    categorias = RepoFalso()
    categoria = categorias.criar("user-1", "SQL")
    pesquisa = PesquisaFalsa()
    servico = PropostaService(
        CategoriaService(categorias), MensagemRepoFalso(), pesquisa,
        LLMFalso(resposta=RESPOSTA_IA), PropostaRepoFalso(),
    )

    def validar(token):
        if token != "token-valido":
            raise NaoAutenticadoError("Token inválido ou expirado.")
        return "user-1"

    monkeypatch.setattr(auth, "obter_user_id", validar)
    monkeypatch.setattr(dependencies, "get_proposta_service", lambda: servico)
    return categoria, pesquisa


def gerar(client, categoria_id, objetivo="SELECT e JOIN"):
    return client.post(f"/categorias/{categoria_id}/propostas", json={"objetivo": objetivo}, headers=CABECALHO)


def test_tudo_exige_login(client, ambiente):
    categoria, pesquisa = ambiente
    pid = str(uuid.uuid4())
    respostas = [
        client.post(f"/categorias/{categoria['id']}/propostas", json={"objetivo": "SQL"}),
        client.get(f"/categorias/{categoria['id']}/propostas"),
        client.get(f"/propostas/{pid}"),
        client.post(f"/propostas/{pid}/confirmar"),
        client.post(f"/propostas/{pid}/rejeitar"),
    ]
    assert [r.status_code for r in respostas] == [401] * 5
    assert pesquisa.chamadas == []


def test_fluxo_gerar_listar_confirmar(client, ambiente):
    categoria, _ = ambiente
    criada = gerar(client, categoria["id"])
    assert criada.status_code == 201
    proposta = criada.get_json()
    assert proposta["status"] == "pendente"
    assert proposta["payload"]["etapas"][0]["recursos"][0]["url"].startswith("https://")

    pendentes = client.get(f"/categorias/{categoria['id']}/propostas?status=pendente", headers=CABECALHO)
    assert [p["id"] for p in pendentes.get_json()] == [proposta["id"]]

    assert client.get(f"/propostas/{proposta['id']}", headers=CABECALHO).status_code == 200

    confirmada = client.post(f"/propostas/{proposta['id']}/confirmar", headers=CABECALHO)
    assert confirmada.status_code == 201
    assert confirmada.get_json()["trilha_id"]
    assert confirmada.get_json()["proposta"]["status"] == "confirmada"

    de_novo = client.post(f"/propostas/{proposta['id']}/confirmar", headers=CABECALHO)
    assert de_novo.status_code == 409
    assert de_novo.get_json()["erro"] == "estado_invalido"


def test_rejeitar(client, ambiente):
    categoria, _ = ambiente
    proposta = gerar(client, categoria["id"]).get_json()
    resposta = client.post(f"/propostas/{proposta['id']}/rejeitar", headers=CABECALHO)
    assert resposta.status_code == 200
    assert resposta.get_json()["status"] == "rejeitada"


def test_objetivo_ausente_400(client, ambiente):
    categoria, pesquisa = ambiente
    resposta = client.post(f"/categorias/{categoria['id']}/propostas", json={}, headers=CABECALHO)
    assert resposta.status_code == 400
    assert pesquisa.chamadas == []


def test_sem_conteudo_422(client, ambiente):
    categoria, pesquisa = ambiente
    pesquisa.recursos = []
    resposta = gerar(client, categoria["id"])
    assert resposta.status_code == 422
    assert resposta.get_json()["erro"] == "sem_conteudo"


def test_status_invalido_400_e_ids_inexistentes_404(client, ambiente):
    categoria, _ = ambiente
    assert client.get(f"/categorias/{categoria['id']}/propostas?status=xyz", headers=CABECALHO).status_code == 400
    assert client.get(f"/propostas/{uuid.uuid4()}", headers=CABECALHO).status_code == 404
    assert client.post(f"/propostas/{uuid.uuid4()}/rejeitar", headers=CABECALHO).status_code == 404
    assert gerar(client, str(uuid.uuid4())).status_code == 404
    assert client.get("/propostas/abc", headers=CABECALHO).status_code == 400


def test_get_proposta_service_monta_as_camadas(app, monkeypatch):
    monkeypatch.setattr(dependencies, "user_client", lambda token: object())
    with app.test_request_context():
        g.token = "t"
        assert isinstance(dependencies.get_proposta_service(), PropostaService)
