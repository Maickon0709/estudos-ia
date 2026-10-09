"""Regras puras: adaptação da trilha, revisão espaçada e sequência de dias."""
from datetime import date

import pytest

from app.services.regras.adaptacao import avaliar, dominou, niveis_liberados, precisa_reforco
from app.services.regras.revisao import INTERVALOS, proxima_revisao
from app.services.regras.sequencia import sequencia_de_dias


def s(total, acertos):
    return {"total": total, "acertos": acertos}


# ---------- dominou / reforço: limites exatos ----------
@pytest.mark.parametrize(
    "stats,esperado",
    [(None, False), (s(0, 0), False), (s(2, 2), False), (s(3, 3), True), (s(5, 4), True), (s(5, 3), False), (s(10, 8), True)],
)
def test_dominou(stats, esperado):
    assert dominou(stats) is esperado


@pytest.mark.parametrize(
    "stats,esperado",
    [(None, False), (s(3, 0), False), (s(4, 1), True), (s(4, 2), False), (s(10, 4), True), (s(10, 5), False)],
)
def test_precisa_reforco(stats, esperado):
    assert precisa_reforco(stats) is esperado


# ---------- níveis liberados ----------
@pytest.mark.parametrize(
    "niveis,ja_sabia,esperado",
    [
        ({}, False, ["basico"]),
        ({"basico": s(3, 2)}, False, ["basico"]),
        ({"basico": s(3, 3)}, False, ["basico", "intermediario"]),
        ({}, True, ["basico", "intermediario"]),  # "já sei" pula o básico
        ({"basico": s(3, 3), "intermediario": s(3, 3)}, False, ["basico", "intermediario", "avancado"]),
        # avançado não abre sem o intermediário estar liberado
        ({"intermediario": s(3, 3)}, False, ["basico"]),
    ],
)
def test_niveis_liberados(niveis, ja_sabia, esperado):
    assert niveis_liberados(niveis, ja_sabia) == esperado


# ---------- avaliar ----------
def etapa(status="nao_iniciado", ja_sabia=False):
    return {"status": status, "ja_sabia": ja_sabia}


def test_primeira_resposta_tira_de_nao_iniciado():
    r = avaliar(etapa(), {"basico": s(1, 1)})
    assert (r["status"], r["mudou"], r["recomendacao"]) == ("em_andamento", True, None)


def test_sem_respostas_nao_muda_nada():
    r = avaliar(etapa(), {})
    assert (r["status"], r["mudou"], r["niveis_liberados"]) == ("nao_iniciado", False, ["basico"])


def test_reforco_reabre_etapa_concluida():
    r = avaliar(etapa("concluido"), {"basico": s(4, 1)})
    assert (r["status"], r["recomendacao"], r["nivel_reforco"], r["mudou"]) == (
        "em_andamento", "reforco", "basico", True,
    )


def test_ja_sei_que_nao_se_confirma_e_desfeito():
    r = avaliar(etapa("em_andamento", ja_sabia=True), {"intermediario": s(4, 1)})
    assert r["ja_sabia"] is False
    assert r["niveis_liberados"] == ["basico"]  # volta a exigir o básico
    assert r["mudou"] is True


def test_ja_sei_se_mantem_com_bom_desempenho():
    r = avaliar(etapa("em_andamento", ja_sabia=True), {"intermediario": s(4, 4)})
    assert r["ja_sabia"] is True
    assert r["niveis_liberados"] == ["basico", "intermediario", "avancado"]


def test_reforco_no_avancado_nao_desfaz_ja_sei():
    r = avaliar(etapa("em_andamento", ja_sabia=True), {"intermediario": s(3, 3), "avancado": s(4, 0)})
    assert (r["ja_sabia"], r["nivel_reforco"]) == (True, "avancado")


def test_reforco_aponta_o_nivel_mais_basico_com_problema():
    r = avaliar(etapa("em_andamento"), {"basico": s(4, 1), "intermediario": s(4, 0)})
    assert r["nivel_reforco"] == "basico"


def test_dominar_avancado_so_sugere_concluir():
    niveis = {"basico": s(3, 3), "intermediario": s(3, 3), "avancado": s(3, 3)}
    r = avaliar(etapa("em_andamento"), niveis)
    assert (r["status"], r["recomendacao"]) == ("em_andamento", "pode_concluir")
    assert avaliar(etapa("concluido"), niveis)["recomendacao"] is None


# ---------- revisão espaçada ----------
HOJE = date(2026, 10, 9)


def test_errou_entra_em_revisao_amanha():
    assert proxima_revisao(None, False, HOJE) == {
        "proxima_revisao": "2026-10-10", "intervalo_dias": 1, "acertos_seguidos": 0,
    }


def test_acertou_de_primeira_nao_entra_em_revisao():
    assert proxima_revisao(None, True, HOJE) is None


def test_intervalos_crescem_e_depois_sai_da_revisao():
    atual = proxima_revisao(None, False, HOJE)
    vistos = []
    for _ in range(len(INTERVALOS) - 1):
        atual = proxima_revisao(atual, True, HOJE)
        vistos.append(atual["intervalo_dias"])
    assert vistos == [3, 7, 15, 30]
    assert proxima_revisao(atual, True, HOJE) == {"remover": True}


def test_errar_no_meio_volta_para_um_dia():
    atual = {"proxima_revisao": "2026-10-20", "intervalo_dias": 15, "acertos_seguidos": 3}
    assert proxima_revisao(atual, False, HOJE)["intervalo_dias"] == 1
    assert proxima_revisao(atual, False, HOJE)["acertos_seguidos"] == 0


def test_data_calculada_a_partir_de_hoje():
    atual = {"acertos_seguidos": 0}
    assert proxima_revisao(atual, True, date(2026, 12, 30))["proxima_revisao"] == "2027-01-02"


# ---------- sequência de dias ----------
def d(dia):
    return date(2026, 10, dia)


@pytest.mark.parametrize(
    "dias,esperado",
    [
        ([], 0),
        ([d(9)], 1),
        ([d(7), d(8), d(9)], 3),
        ([d(7), d(8)], 2),          # ainda não estudou hoje: a sequência de ontem vale
        ([d(6), d(7)], 0),          # pulou ontem: zerou
        ([d(5), d(7), d(8), d(9)], 3),
        ([d(9), d(9), d(8)], 2),    # repetidos não contam em dobro
    ],
)
def test_sequencia_de_dias(dias, esperado):
    assert sequencia_de_dias(dias, d(9)) == esperado


def test_sequencia_atravessa_virada_de_mes():
    assert sequencia_de_dias([date(2026, 9, 30), date(2026, 10, 1)], date(2026, 10, 1)) == 2
