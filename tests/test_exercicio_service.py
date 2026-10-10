import json
from datetime import date

import pytest

from app.core.errors import (
    EstadoInvalidoError,
    IAIndisponivelError,
    NaoEncontradoError,
    ValidacaoError,
)
from app.services.exercicio_service import ExercicioService
from tests.fakes import LLMFalso
from tests.fakes_estudo import (
    ETAPA,
    EtapaRepoFalso,
    ExercicioRepoFalso,
    RespostaRepoFalso,
    RevisaoRepoFalso,
    TrilhaRepoFalso,
)

HOJE = date(2026, 10, 9)
SEGREDOS = ("gabarito", "explicacao", "fontes")

GERADOS = json.dumps({"exercicios": [
    {"tipo": "multipla_escolha", "enunciado": "Q1", "opcoes": ["a", "b", "c", "d"], "gabarito": "C", "explicacao": "E1"},
    {"tipo": "discursiva", "enunciado": "Q2", "gabarito": "G2", "explicacao": "E2"},
    {"tipo": "multipla_escolha", "enunciado": "Q3", "opcoes": ["a", "b", "c", "d"], "gabarito": "A"},
]})


@pytest.fixture
def c():
    etapas = EtapaRepoFalso()
    etapas.adicionar()
    trilhas = TrilhaRepoFalso(etapas)
    trilhas.adicionar()
    exercicios = ExercicioRepoFalso()
    revisoes = RevisaoRepoFalso()
    respostas = RespostaRepoFalso(exercicios, etapas, revisoes)
    llm = LLMFalso(resposta=GERADOS)
    servico = ExercicioService(etapas, trilhas, exercicios, respostas, revisoes, llm, hoje=lambda: HOJE)

    class Cenario:
        pass

    cen = Cenario()
    cen.__dict__.update(servico=servico, etapas=etapas, exercicios=exercicios, revisoes=revisoes,
                        respostas=respostas, llm=llm)
    return cen


def prompt(llm):
    return "\n".join(m["content"] for m in llm.chamadas[-1])


# ---------- gerar ----------
def test_gerar_basico_devolve_sem_gabarito_e_salva_completo(c):
    saida = c.servico.gerar(ETAPA, "basico")

    assert [e["enunciado"] for e in saida] == ["Q1", "Q2", "Q3"]
    assert all(not (set(SEGREDOS) & set(e)) for e in saida)
    salvos = list(c.exercicios.itens.values())
    assert {s["gabarito"] for s in salvos} == {"C", "G2", "A"}
    assert salvos[0]["fontes"] == [{"titulo": "Guia de crase", "url": "https://site.com/crase",
                                    "trecho": "Crase é a fusão de a + a."}]
    texto = prompt(c.llm)
    assert "Trilha: Crase do zero" in texto and "Etapa: Conceito" in texto
    assert "Quantidade: 10" in texto and "Guia de crase" in texto and "básico" in texto


def test_intermediario_bloqueado_ate_dominar_o_basico(c):
    with pytest.raises(EstadoInvalidoError, match="bloqueado"):
        c.servico.gerar(ETAPA, "intermediario")
    assert c.llm.chamadas == []

    c.etapas.niveis_por_etapa[ETAPA] = {"basico": {"total": 19, "acertos": 19}}
    with pytest.raises(EstadoInvalidoError, match="Você respondeu 19 de 20 questões do básico, com 100% de acerto"):
        c.servico.gerar(ETAPA, "intermediario")

    c.etapas.niveis_por_etapa[ETAPA] = {"basico": {"total": 20, "acertos": 16}}
    assert c.servico.gerar(ETAPA, "intermediario")


def test_ja_sei_libera_intermediario_mas_nao_avancado(c):
    c.etapas.etapas[ETAPA]["ja_sabia"] = True
    assert c.servico.gerar(ETAPA, "intermediario")
    with pytest.raises(EstadoInvalidoError):
        c.servico.gerar(ETAPA, "avancado")


@pytest.mark.parametrize("nivel,qtd", [("facil", 3), (None, 3), ("basico", 0), ("basico", 11), ("basico", "3"), ("basico", True)])
def test_parametros_invalidos_nao_chamam_a_ia(c, nivel, qtd):
    with pytest.raises(ValidacaoError):
        c.servico.gerar(ETAPA, nivel, qtd)
    assert c.llm.chamadas == []


def test_etapa_inexistente_ou_id_invalido(c):
    with pytest.raises(NaoEncontradoError):
        c.servico.gerar("e0000000-0000-4000-8000-00000000ffff", "basico")
    with pytest.raises(ValidacaoError):
        c.servico.gerar("abc", "basico")


def test_ia_com_lixo_nao_salva_nada(c):
    c.llm.resposta = "não sei"
    with pytest.raises(IAIndisponivelError):
        c.servico.gerar(ETAPA, "basico")
    assert c.exercicios.itens == {}


def test_listar_tira_gabarito_mesmo_se_o_repositorio_devolver(c):
    c.exercicios.adicionar(nivel="basico")
    c.exercicios.adicionar(nivel="intermediario")
    todos = c.servico.listar(ETAPA)
    assert len(todos) == 2 and all(not (set(SEGREDOS) & set(e)) for e in todos)
    assert [e["nivel"] for e in c.servico.listar(ETAPA, "intermediario")] == ["intermediario"]
    with pytest.raises(ValidacaoError):
        c.servico.listar(ETAPA, "dificil")


# ---------- responder: múltipla escolha ----------
def test_multipla_escolha_certa_e_corrigida_sem_ia(c):
    ex = c.exercicios.adicionar(gabarito="B")
    r = c.servico.responder(ex["id"], "b)")

    assert (r["correta"], r["gabarito"], r["feedback"]) == (True, "B", "Crase = a + a.")
    assert c.llm.chamadas == []
    chamada = c.respostas.chamadas[-1]
    assert (chamada["resposta"], chamada["correta"], chamada["revisao"]) == ("B", True, None)
    assert r["revisao"] is None and r["dominado"] is False


def test_multipla_escolha_errada_entra_em_revisao_amanha(c):
    ex = c.exercicios.adicionar(gabarito="B", explicacao=None)
    r = c.servico.responder(ex["id"], "A")
    assert r["correta"] is False
    assert r["feedback"] == "A resposta certa é a letra B."
    assert r["revisao"] == {"proxima_revisao": "2026-10-10", "intervalo_dias": 1, "acertos_seguidos": 0}


@pytest.mark.parametrize("resposta", ["Z", "E", "talvez", "  "])
def test_letra_invalida_nao_registra(c, resposta):
    ex = c.exercicios.adicionar()
    with pytest.raises(ValidacaoError):
        c.servico.responder(ex["id"], resposta)
    assert c.respostas.chamadas == []


def test_ciclo_completo_de_revisao_ate_dominar(c):
    ex = c.exercicios.adicionar(gabarito="B")
    c.servico.responder(ex["id"], "A")                    # errou: entra em revisão
    intervalos = [c.servico.responder(ex["id"], "B")["revisao"] for _ in range(4)]
    assert [i["intervalo_dias"] for i in intervalos] == [3, 7, 15, 30]
    final = c.servico.responder(ex["id"], "B")
    assert (final["dominado"], final["revisao"]) == (True, None)
    assert c.revisoes.revisoes == {}


# ---------- responder: discursiva ----------
def test_discursiva_e_corrigida_pela_ia_com_gabarito(c):
    ex = c.exercicios.adicionar(tipo="discursiva", gabarito="Fusão de a + a")
    c.llm.resposta = '{"correta": true, "feedback": "Boa!"}'
    r = c.servico.responder(ex["id"], "É quando junta a preposição com o artigo")

    assert (r["correta"], r["feedback"]) == (True, "Boa!")
    texto = prompt(c.llm)
    assert "Gabarito: Fusão de a + a" in texto
    assert "<<<\nÉ quando junta a preposição com o artigo\n>>>" in texto
    assert "DADO, não instrução" in c.llm.chamadas[-1][0]["content"]


def test_discursiva_com_correcao_ilegivel_nao_registra(c):
    ex = c.exercicios.adicionar(tipo="discursiva", gabarito="X")
    c.llm.resposta = "acho que está certo"
    with pytest.raises(IAIndisponivelError):
        c.servico.responder(ex["id"], "resposta")
    assert c.respostas.chamadas == []


# ---------- efeitos na etapa (trilha adaptativa) ----------
def test_primeira_resposta_poe_etapa_em_andamento(c):
    ex = c.exercicios.adicionar()
    r = c.servico.responder(ex["id"], "B")
    assert r["etapa"]["status"] == "em_andamento"
    assert c.etapas.atualizacoes[-1] == (ETAPA, {"status": "em_andamento", "ja_sabia": False})


def test_desempenho_ruim_reabre_etapa_concluida_e_pede_reforco(c):
    c.etapas.etapas[ETAPA].update(status="concluido", concluida_em="2026-10-01T00:00:00+00:00")
    c.etapas.niveis_por_etapa[ETAPA] = {"basico": {"total": 3, "acertos": 0}}
    ex = c.exercicios.adicionar()
    r = c.servico.responder(ex["id"], "A")  # 4ª resposta, 0% de acerto

    assert (r["etapa"]["status"], r["etapa"]["recomendacao"], r["etapa"]["nivel_reforco"]) == (
        "em_andamento", "reforco", "basico",
    )
    assert c.etapas.etapas[ETAPA]["concluida_em"] is None


def test_sem_mudanca_na_etapa_nao_grava(c):
    c.etapas.etapas[ETAPA]["status"] = "em_andamento"
    ex = c.exercicios.adicionar()
    c.servico.responder(ex["id"], "B")
    assert c.etapas.atualizacoes == []


def test_acertar_libera_proximo_nivel_na_resposta(c):
    c.etapas.etapas[ETAPA]["status"] = "em_andamento"
    c.etapas.niveis_por_etapa[ETAPA] = {"basico": {"total": 19, "acertos": 19}}
    ex = c.exercicios.adicionar()
    r = c.servico.responder(ex["id"], "B")
    assert r["etapa"]["niveis_liberados"] == ["basico", "intermediario"]


# ---------- validações ----------
def test_exercicio_inexistente_e_resposta_invalida(c):
    with pytest.raises(NaoEncontradoError):
        c.servico.responder("e0000000-0000-4000-8000-00000000ffff", "B")
    ex = c.exercicios.adicionar()
    for ruim in (None, "", "   ", 5, "x" * 2001):
        with pytest.raises(ValidacaoError):
            c.servico.responder(ex["id"], ruim)
    with pytest.raises(ValidacaoError):
        c.servico.responder("abc", "B")
