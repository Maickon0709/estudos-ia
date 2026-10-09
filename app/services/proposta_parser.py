"""Transforma a resposta da IA numa proposta segura.

Regra central: a IA só escolhe recursos PELO NÚMERO (id) da lista verificada
que o back-end entregou. Qualquer URL que ela escreva é ignorada, porque o
recurso final é sempre a cópia que veio da pesquisa verificada.

Funções puras (sem rede, sem banco): fáceis de testar e de explicar.
"""
import copy
import json

from app.core.errors import IAIndisponivelError

MAX_ETAPAS = 10
TITULO_MAX = 120
DESCRICAO_MAX = 500

_ERRO_FORMATO = "A IA devolveu a proposta num formato inválido. Tente novamente."


def extrair_json(texto) -> dict:
    """Aceita JSON puro, cercado por ```json ... ``` ou com texto em volta."""
    if not isinstance(texto, str):
        raise IAIndisponivelError(_ERRO_FORMATO)
    inicio, fim = texto.find("{"), texto.rfind("}")
    if inicio == -1 or fim <= inicio:
        raise IAIndisponivelError(_ERRO_FORMATO)
    try:
        dados = json.loads(texto[inicio:fim + 1])
    except ValueError as exc:
        raise IAIndisponivelError(_ERRO_FORMATO) from exc
    if not isinstance(dados, dict):
        raise IAIndisponivelError(_ERRO_FORMATO)
    return dados


def montar_payload(dados: dict, recursos_por_id: dict[int, dict], objetivo: str) -> dict:
    etapas_brutas = dados.get("etapas")
    if not isinstance(etapas_brutas, list):
        raise IAIndisponivelError(_ERRO_FORMATO)

    usados: set[int] = set()
    etapas = []
    for bruta in etapas_brutas:
        if len(etapas) == MAX_ETAPAS:
            break
        if not isinstance(bruta, dict):
            continue
        titulo = _texto(bruta.get("titulo"), TITULO_MAX)
        if not titulo:
            continue

        recursos = []
        ids = bruta.get("recursos")
        for bruto in ids if isinstance(ids, list) else []:
            ident = _id(bruto)
            if ident in recursos_por_id and ident not in usados:
                usados.add(ident)
                recursos.append(copy.deepcopy(recursos_por_id[ident]))

        etapas.append({
            "titulo": titulo,
            "descricao": _texto(bruta.get("descricao"), DESCRICAO_MAX) or None,
            "recursos": recursos,
        })

    if not etapas:
        raise IAIndisponivelError("A IA não montou nenhuma etapa válida. Tente novamente.")
    if not usados:
        raise IAIndisponivelError(
            "A IA não usou nenhum material verificado na trilha. Tente novamente."
        )

    return {
        "titulo": _texto(dados.get("titulo"), TITULO_MAX) or _texto(f"Trilha: {objetivo}", TITULO_MAX),
        "objetivo": objetivo,
        "etapas": etapas,
    }


def _texto(valor, limite: int) -> str:
    if not isinstance(valor, str):
        return ""
    return " ".join(valor.split())[:limite]


def _id(valor) -> int | None:
    if isinstance(valor, bool):  # True/False são int em Python; não valem como id
        return None
    if isinstance(valor, int):
        return valor
    if isinstance(valor, str) and valor.strip().isdigit():
        return int(valor.strip())
    return None
