import json

import pytest

from app.core.errors import IAIndisponivelError
from app.services.proposta_parser import (
    DESCRICAO_MAX,
    MAX_ETAPAS,
    TITULO_MAX,
    extrair_json,
    montar_payload,
)
from tests.fakes_propostas import rec

RECURSOS = {1: rec(1), 2: rec(2), 3: rec(3, "video")}


# ---------- extrair_json ----------
@pytest.mark.parametrize(
    "texto",
    [
        '{"etapas": []}',
        '```json\n{"etapas": []}\n```',
        'Claro! Aqui está:\n{"etapas": []}\nBons estudos.',
        '  \n{"etapas": []}  ',
    ],
)
def test_extrair_json_aceita_formatos_comuns(texto):
    assert extrair_json(texto) == {"etapas": []}


@pytest.mark.parametrize("texto", ["", "sem json", "{quebrado", '["lista"]', "}{", None, 42])
def test_extrair_json_rejeita_lixo(texto):
    with pytest.raises(IAIndisponivelError):
        extrair_json(texto)


# ---------- montar_payload ----------
def test_monta_etapas_com_copias_dos_recursos_verificados():
    dados = {
        "titulo": "Crase do zero",
        "etapas": [
            {"titulo": "Conceito", "descricao": "O que é crase", "recursos": [1, 2]},
            {"titulo": "Prática", "descricao": "Exercícios", "recursos": [3]},
        ],
    }
    payload = montar_payload(dados, RECURSOS, "aprender crase")

    assert payload["titulo"] == "Crase do zero"
    assert payload["objetivo"] == "aprender crase"
    assert [e["titulo"] for e in payload["etapas"]] == ["Conceito", "Prática"]
    assert payload["etapas"][0]["recursos"] == [RECURSOS[1], RECURSOS[2]]
    assert payload["etapas"][1]["recursos"] == [RECURSOS[3]]
    # cópia, não a mesma referência
    assert payload["etapas"][0]["recursos"][0] is not RECURSOS[1]


def test_url_escrita_pela_ia_e_ignorada():
    dados = {
        "etapas": [{
            "titulo": "Etapa",
            "url": "https://etapa-maliciosa.com",
            "recursos": [1, "https://malicioso.com", {"url": "https://evil.com", "id": 2}, 99],
        }]
    }
    payload = montar_payload(dados, RECURSOS, "x")
    texto = json.dumps(payload)
    assert payload["etapas"][0]["recursos"] == [RECURSOS[1]]
    for proibido in ("malicioso", "evil", "etapa-maliciosa"):
        assert proibido not in texto


def test_cada_recurso_entra_uma_vez_so():
    dados = {"etapas": [{"titulo": "A", "recursos": [1, 1, 2]}, {"titulo": "B", "recursos": [2, 3]}]}
    payload = montar_payload(dados, RECURSOS, "x")
    assert [len(e["recursos"]) for e in payload["etapas"]] == [2, 1]


def test_ids_em_texto_numerico_valem_mas_booleanos_nao():
    dados = {"etapas": [{"titulo": "A", "recursos": [" 2 ", True, False, 1.0, "um"]}]}
    payload = montar_payload(dados, RECURSOS, "x")
    assert payload["etapas"][0]["recursos"] == [RECURSOS[2]]


def test_etapas_sem_titulo_ou_malformadas_sao_puladas():
    dados = {"etapas": ["texto", None, {"titulo": "   "}, {"descricao": "sem título"}, {"titulo": "Ok", "recursos": [1]}]}
    payload = montar_payload(dados, RECURSOS, "x")
    assert [e["titulo"] for e in payload["etapas"]] == ["Ok"]


def test_etapa_sem_recursos_e_permitida_se_a_trilha_usa_algum():
    dados = {"etapas": [{"titulo": "Revisão", "recursos": "nao-e-lista"}, {"titulo": "Aula", "recursos": [1]}]}
    payload = montar_payload(dados, RECURSOS, "x")
    assert payload["etapas"][0]["recursos"] == []


def test_limita_numero_de_etapas_e_tamanho_dos_textos():
    dados = {
        "titulo": "T" * 500,
        "etapas": [
            {"titulo": f"  Etapa   {i}  " + "x" * 300, "descricao": "d" * 2000, "recursos": [1] if i == 0 else []}
            for i in range(MAX_ETAPAS + 5)
        ],
    }
    payload = montar_payload(dados, RECURSOS, "x")
    assert len(payload["etapas"]) == MAX_ETAPAS
    assert len(payload["titulo"]) == TITULO_MAX
    assert all(len(e["titulo"]) <= TITULO_MAX for e in payload["etapas"])
    assert payload["etapas"][0]["titulo"].startswith("Etapa 0")  # espaços normalizados
    assert len(payload["etapas"][0]["descricao"]) == DESCRICAO_MAX


def test_titulo_ausente_usa_o_objetivo():
    payload = montar_payload({"etapas": [{"titulo": "A", "recursos": [1]}]}, RECURSOS, "aprender SQL")
    assert payload["titulo"] == "Trilha: aprender SQL"


def test_descricao_vazia_vira_none():
    payload = montar_payload({"etapas": [{"titulo": "A", "descricao": "  ", "recursos": [1]}]}, RECURSOS, "x")
    assert payload["etapas"][0]["descricao"] is None


@pytest.mark.parametrize(
    "dados",
    [
        {},
        {"etapas": "texto"},
        {"etapas": []},
        {"etapas": [{"titulo": "A", "recursos": [99, 100]}]},  # nenhum recurso válido
        {"etapas": [{"titulo": "A"}]},
    ],
)
def test_proposta_sem_etapa_ou_sem_material_verificado_e_recusada(dados):
    with pytest.raises(IAIndisponivelError):
        montar_payload(dados, RECURSOS, "x")
