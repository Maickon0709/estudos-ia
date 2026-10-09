import json

import pytest

from app.core.errors import IAIndisponivelError
from app.services.exercicio_parser import interpretar_correcao, letra, montar_exercicios

FONTES = [{"titulo": "Aula", "url": "https://site.com"}]


def mc(**extra):
    base = {
        "tipo": "multipla_escolha",
        "enunciado": "Quando usar crase?",
        "opcoes": ["Antes de verbo", "Antes de palavra feminina", "Sempre", "Nunca"],
        "gabarito": "B",
        "explicacao": "Crase = a + a.",
    }
    base.update(extra)
    return base


def disc(**extra):
    base = {"tipo": "discursiva", "enunciado": "Explique a crase.", "gabarito": "Fusão de a + a."}
    base.update(extra)
    return base


# ---------- letra ----------
@pytest.mark.parametrize(
    "valor,n,esperado",
    [("B", 4, "B"), ("b", 4, "B"), ("B)", 4, "B"), ("(c)", 4, "C"), ("Letra D", 4, "D"), ("d. porque", 4, "D"),
     ("E", 4, None), ("Z", 4, None), ("", 4, None), (None, 4, None), (2, 4, None), ("Bola", 4, None)],
)
def test_letra(valor, n, esperado):
    assert letra(valor, n) == esperado


# ---------- montar_exercicios ----------
def test_monta_multipla_escolha_e_discursiva():
    exercicios = montar_exercicios({"exercicios": [mc(), disc()]}, "basico", 5, FONTES)
    assert [e["tipo"] for e in exercicios] == ["multipla_escolha", "discursiva"]
    assert exercicios[0]["gabarito"] == "B"
    assert exercicios[0]["nivel"] == "basico"
    assert exercicios[0]["fontes"] == FONTES
    assert exercicios[1]["opcoes"] is None
    assert exercicios[1]["gabarito"] == "Fusão de a + a."


def test_remove_prefixo_de_letra_das_opcoes():
    item = mc(opcoes=["A) Um", "B. Dois", "(C) Três", "D: Quatro"])
    assert montar_exercicios({"exercicios": [item]}, "basico", 1, [])[0]["opcoes"] == ["Um", "Dois", "Três", "Quatro"]


@pytest.mark.parametrize(
    "item",
    [
        mc(gabarito="E"),                          # letra fora das opções
        mc(gabarito=None),
        mc(opcoes=["Só uma"]),
        mc(opcoes=["a", "b", "c", "d", "e", "f"]),
        mc(opcoes=["Igual", "igual", "Outra"]),    # repetidas
        mc(opcoes=["Boa", "  "]),                  # vazia
        mc(opcoes="não é lista"),
        mc(enunciado="   "),
        disc(gabarito=""),
        {"tipo": "verdadeiro_falso", "enunciado": "x", "gabarito": "V"},
        "texto solto",
    ],
)
def test_itens_invalidos_sao_descartados(item):
    exercicios = montar_exercicios({"exercicios": [item, disc()]}, "basico", 5, [])
    assert [e["tipo"] for e in exercicios] == ["discursiva"]


def test_respeita_a_quantidade_pedida():
    assert len(montar_exercicios({"exercicios": [mc()] * 8}, "basico", 3, [])) == 3


@pytest.mark.parametrize("dados", [{}, {"exercicios": "x"}, {"exercicios": []}, {"exercicios": [mc(gabarito="Z")]}])
def test_sem_nada_valido_falha(dados):
    with pytest.raises(IAIndisponivelError):
        montar_exercicios(dados, "basico", 3, [])


# ---------- interpretar_correcao ----------
def test_correcao_valida():
    texto = 'Segue:\n```json\n{"correta": true, "feedback": "  Muito   bem! "}\n```'
    assert interpretar_correcao(texto) == {"correta": True, "feedback": "Muito bem!"}


@pytest.mark.parametrize(
    "texto",
    ["sem json", json.dumps({"correta": "sim"}), json.dumps({"correta": 1}), json.dumps({"feedback": "x"})],
)
def test_correcao_invalida(texto):
    with pytest.raises(IAIndisponivelError):
        interpretar_correcao(texto)


def test_correcao_sem_feedback_vira_texto_vazio():
    assert interpretar_correcao('{"correta": false}') == {"correta": False, "feedback": ""}
