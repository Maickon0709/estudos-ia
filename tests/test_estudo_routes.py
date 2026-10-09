"""Rotas de trilha, exercícios, painel e revisões."""
import json
import uuid
from datetime import date

import pytest
from flask import g

from app.core import auth, dependencies
from app.core.errors import NaoAutenticadoError
from app.services.categoria_service import CategoriaService
from app.services.exercicio_service import ExercicioService
from app.services.painel_service import PainelService
from app.services.trilha_service import TrilhaService
from tests.fakes import LLMFalso
from tests.fakes_estudo import (
    ETAPA,
    TRILHA,
    EtapaRepoFalso,
    ExercicioRepoFalso,
    PainelRepoFalso,
    RespostaRepoFalso,
    RevisaoRepoFalso,
    TrilhaRepoFalso,
)
from tests.test_categoria_service import RepoFalso

H = {"Authorization": "Bearer token-valido"}
GERADOS = json.dumps({"exercicios": [
    {"tipo": "multipla_escolha", "enunciado": "Q1", "opcoes": ["a", "b", "c", "d"], "gabarito": "C", "explicacao": "Porque C"},
]})


@pytest.fixture
def amb(monkeypatch):
    categorias = RepoFalso()
    categoria = categorias.criar("user-1", "Português")
    etapas = EtapaRepoFalso()
    etapas.adicionar()
    trilhas = TrilhaRepoFalso(etapas)
    trilhas.adicionar(categoria_id=categoria["id"])
    exercicios = ExercicioRepoFalso()
    revisoes = RevisaoRepoFalso()
    hoje = lambda: date(2026, 10, 9)  # noqa: E731

    trilha_srv = TrilhaService(CategoriaService(categorias), trilhas, etapas)
    exercicio_srv = ExercicioService(
        etapas, trilhas, exercicios, RespostaRepoFalso(exercicios, etapas, revisoes), revisoes,
        LLMFalso(resposta=GERADOS), hoje=hoje,
    )
    painel_srv = PainelService(CategoriaService(categorias), PainelRepoFalso(), revisoes, hoje=hoje)

    def validar(token):
        if token != "token-valido":
            raise NaoAutenticadoError("Token inválido ou expirado.")
        return "user-1"

    monkeypatch.setattr(auth, "obter_user_id", validar)
    monkeypatch.setattr(dependencies, "get_trilha_service", lambda: trilha_srv)
    monkeypatch.setattr(dependencies, "get_exercicio_service", lambda: exercicio_srv)
    monkeypatch.setattr(dependencies, "get_painel_service", lambda: painel_srv)
    return categoria


def test_tudo_exige_login(client, amb):
    x = str(uuid.uuid4())
    respostas = [
        client.get(f"/categorias/{amb['id']}/trilhas"),
        client.get(f"/trilhas/{TRILHA}"),
        client.patch(f"/etapas/{ETAPA}", json={"status": "concluido"}),
        client.post(f"/etapas/{ETAPA}/exercicios", json={"nivel": "basico"}),
        client.get(f"/etapas/{ETAPA}/exercicios"),
        client.post(f"/exercicios/{x}/responder", json={"resposta": "A"}),
        client.get(f"/categorias/{amb['id']}/painel"),
        client.get("/revisoes/hoje"),
    ]
    assert [r.status_code for r in respostas] == [401] * 8


def test_fluxo_de_estudo_completo(client, amb):
    # trilha
    trilha = client.get(f"/trilhas/{TRILHA}", headers=H).get_json()
    assert trilha["etapas"][0]["id"] == ETAPA

    # gerar exercícios: sem gabarito na saída
    gerados = client.post(f"/etapas/{ETAPA}/exercicios", json={"nivel": "basico", "quantidade": 1}, headers=H)
    assert gerados.status_code == 201
    (ex,) = gerados.get_json()
    assert "gabarito" not in ex and "explicacao" not in ex

    # listar: também sem gabarito
    listados = client.get(f"/etapas/{ETAPA}/exercicios?nivel=basico", headers=H).get_json()
    assert "gabarito" not in json.dumps(listados)

    # responder: AGORA o gabarito aparece
    r = client.post(f"/exercicios/{ex['id']}/responder", json={"resposta": "C"}, headers=H).get_json()
    assert (r["correta"], r["gabarito"], r["feedback"]) == (True, "C", "Porque C")
    assert r["etapa"]["status"] == "em_andamento"

    # checklist manual
    etapa = client.patch(f"/etapas/{ETAPA}", json={"status": "concluido"}, headers=H)
    assert etapa.status_code == 200 and etapa.get_json()["status"] == "concluido"

    # painel e revisões
    painel = client.get(f"/categorias/{amb['id']}/painel", headers=H)
    assert painel.status_code == 200
    assert client.get("/revisoes/hoje", headers=H).status_code == 200


def test_nivel_bloqueado_409(client, amb):
    r = client.post(f"/etapas/{ETAPA}/exercicios", json={"nivel": "avancado"}, headers=H)
    assert r.status_code == 409 and r.get_json()["erro"] == "estado_invalido"


def test_validacoes_400_e_404(client, amb):
    assert client.patch(f"/etapas/{ETAPA}", json={"status": "xyz"}, headers=H).status_code == 400
    assert client.patch(f"/etapas/{ETAPA}", headers=H).status_code == 400
    assert client.post(f"/etapas/{ETAPA}/exercicios", json={}, headers=H).status_code == 400
    assert client.get(f"/trilhas/{uuid.uuid4()}", headers=H).status_code == 404
    assert client.post(f"/exercicios/{uuid.uuid4()}/responder", json={"resposta": "A"}, headers=H).status_code == 404
    assert client.get(f"/revisoes/hoje?categoria_id={uuid.uuid4()}", headers=H).status_code == 404
    assert client.get("/revisoes/hoje?categoria_id=abc", headers=H).status_code == 400


@pytest.mark.parametrize("fabrica,classe", [
    ("get_trilha_service", TrilhaService),
    ("get_exercicio_service", ExercicioService),
    ("get_painel_service", PainelService),
])
def test_dependencias_montam_as_camadas(app, monkeypatch, fabrica, classe):
    monkeypatch.setattr(dependencies, "user_client", lambda token: object())
    with app.test_request_context():
        g.token = "t"
        assert isinstance(getattr(dependencies, fabrica)(), classe)
