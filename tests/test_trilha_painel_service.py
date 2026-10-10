import uuid
from datetime import date

import pytest

from app.core.errors import NaoEncontradoError, ValidacaoError
from app.services.categoria_service import CategoriaService
from app.services.painel_service import PainelService
from app.services.trilha_service import TrilhaService
from tests.fakes_estudo import (
    ETAPA,
    TRILHA,
    EtapaRepoFalso,
    PainelRepoFalso,
    RevisaoRepoFalso,
    TrilhaRepoFalso,
)
from tests.test_categoria_service import RepoFalso

HOJE = date(2026, 10, 9)
E2 = "e0000000-0000-4000-8000-000000000002"


@pytest.fixture
def trilha():
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "Português")
    etapas = EtapaRepoFalso()
    etapas.adicionar(E2, ordem=2, titulo="Prática", status="concluido")
    etapas.adicionar(ETAPA, ordem=1, titulo="Conceito")
    trilhas = TrilhaRepoFalso(etapas)
    trilhas.adicionar(categoria_id=categoria["id"])
    return TrilhaService(CategoriaService(categorias), trilhas, etapas), etapas, categoria


# ---------- trilha ----------
def test_obter_ordena_etapas_junta_recursos_e_calcula_progresso(trilha):
    servico, _, _ = trilha
    t = servico.obter(TRILHA)
    assert [e["titulo"] for e in t["etapas"]] == ["Conceito", "Prática"]
    assert t["etapas"][0]["recursos"][0]["url"] == "https://site.com/crase"
    assert t["progresso"] == {"concluidas": 1, "total": 2, "pct": 50.0}


def test_obter_inexistente_ou_invalido(trilha):
    servico, _, _ = trilha
    with pytest.raises(NaoEncontradoError):
        servico.obter(str(uuid.uuid4()))
    with pytest.raises(ValidacaoError):
        servico.obter("abc")


def test_listar_exige_categoria_existente(trilha):
    servico, _, categoria = trilha
    assert [t["id"] for t in servico.listar(categoria["id"])] == [TRILHA]
    with pytest.raises(NaoEncontradoError):
        servico.listar(str(uuid.uuid4()))


def test_marcar_concluida_e_desmarcar(trilha):
    servico, etapas, _ = trilha
    feita = servico.atualizar_etapa(ETAPA, {"status": "concluido"})
    assert feita["status"] == "concluido" and feita["concluida_em"]
    desfeita = servico.atualizar_etapa(ETAPA, {"status": "em_andamento"})
    assert desfeita["concluida_em"] is None


def test_marcar_ja_sei_libera_intermediario(trilha):
    servico, _, _ = trilha
    etapa = servico.atualizar_etapa(ETAPA, {"ja_sabia": True})
    assert etapa["ja_sabia"] is True
    assert etapa["niveis_liberados"] == ["basico", "intermediario"]


@pytest.mark.parametrize(
    "corpo",
    [{}, None, [], {"status": "feito"}, {"ja_sabia": "sim"}, {"ja_sabia": 1}, {"taxa_acerto": 100}, {"status": "concluido", "user_id": "x"}],
)
def test_atualizacao_invalida(trilha, corpo):
    servico, etapas, _ = trilha
    with pytest.raises(ValidacaoError):
        servico.atualizar_etapa(ETAPA, corpo)
    assert etapas.atualizacoes == []


def test_atualizar_etapa_inexistente(trilha):
    servico, _, _ = trilha
    with pytest.raises(NaoEncontradoError):
        servico.atualizar_etapa(str(uuid.uuid4()), {"status": "concluido"})


# ---------- painel ----------
@pytest.fixture
def painel():
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "SQL")
    repo = PainelRepoFalso()
    revisoes = RevisaoRepoFalso()
    servico = PainelService(CategoriaService(categorias), repo, revisoes, hoje=lambda: HOJE)
    return servico, repo, revisoes, categoria


def test_painel_junta_progresso_niveis_fracos_revisoes_e_sequencia(painel):
    servico, repo, revisoes, categoria = painel
    cid = categoria["id"]
    repo.progresso_por_categoria[cid] = {"total_etapas": 4, "etapas_concluidas": 1, "pct_concluido": "25.0"}
    repo.niveis_por_categoria[cid] = [{"nivel": "basico", "total_respostas": 10, "acertos": 8, "taxa_acerto": "80.0"}]
    repo.fracos_por_categoria[cid] = [{"etapa_id": "e1", "etapa": "JOIN", "tentativas": 5, "taxa_acerto": "20.00"}]
    repo.dias = ["2026-10-07", "2026-10-08", "2026-10-09"]
    revisoes.lista_pendentes = [{"categoria_id": cid}, {"categoria_id": cid}, {"categoria_id": "outra"}]

    p = servico.painel(cid)
    assert p["categoria"] == {"id": cid, "nome": "SQL"}
    assert p["progresso"] == {"total_etapas": 4, "etapas_concluidas": 1, "pct_concluido": 25.0}
    assert p["acerto_por_nivel"] == [
        {"nivel": "basico", "total_respostas": 10, "taxa_acerto": 80.0},
        {"nivel": "intermediario", "total_respostas": 0, "taxa_acerto": 0.0},
        {"nivel": "avancado", "total_respostas": 0, "taxa_acerto": 0.0},
    ]
    assert p["pontos_fracos"] == [{"etapa_id": "e1", "etapa": "JOIN", "tentativas": 5, "taxa_acerto": 20.0}]
    assert (p["revisoes_pendentes"], p["sequencia_dias"], p["estudou_hoje"]) == (2, 3, True)
    assert revisoes.pendentes_chamadas[-1] == ("2026-10-09", cid)


def test_pontos_fracos_so_mostra_etapas_abaixo_de_80(painel):
    servico, repo, _, categoria = painel
    cid = categoria["id"]
    repo.fracos_por_categoria[cid] = [
        {"etapa_id": "e1", "etapa": "JOIN", "tentativas": 5, "taxa_acerto": "20.00"},
        {"etapa_id": "e2", "etapa": "GROUP BY", "tentativas": 5, "taxa_acerto": "79.99"},
        {"etapa_id": "e3", "etapa": "SELECT", "tentativas": 5, "taxa_acerto": "80.00"},
        {"etapa_id": "e4", "etapa": "WHERE", "tentativas": 1, "taxa_acerto": "100.00"},
    ]
    assert [p["etapa"] for p in servico.painel(cid)["pontos_fracos"]] == ["JOIN", "GROUP BY"]


def test_painel_de_categoria_sem_atividade(painel):
    servico, _, _, categoria = painel
    p = servico.painel(categoria["id"])
    assert p["progresso"] == {"total_etapas": 0, "etapas_concluidas": 0, "pct_concluido": 0.0}
    assert (p["revisoes_pendentes"], p["sequencia_dias"], p["estudou_hoje"]) == (0, 0, False)


def test_painel_de_categoria_inexistente(painel):
    servico, *_ = painel
    with pytest.raises(NaoEncontradoError):
        servico.painel(str(uuid.uuid4()))


def test_revisoes_de_hoje_com_e_sem_categoria(painel):
    servico, _, revisoes, categoria = painel
    revisoes.lista_pendentes = [{"categoria_id": categoria["id"]}, {"categoria_id": "outra"}]
    assert len(servico.revisoes_de_hoje()) == 2
    assert len(servico.revisoes_de_hoje(categoria["id"])) == 1
    with pytest.raises(NaoEncontradoError):
        servico.revisoes_de_hoje(str(uuid.uuid4()))
