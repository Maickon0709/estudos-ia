"""Revisão espaçada (inspirada no SM-2, simplificada).

- Errou: o exercício entra (ou volta) para revisão amanhã.
- Acertou um exercício que está em revisão: o intervalo cresce 1 -> 3 -> 7 -> 15 -> 30 dias.
- Acertou 5 revisões seguidas: considerado dominado, sai da revisão.
- Acertou de primeira (sem revisão aberta): nada a revisar.

Devolve exatamente o que a função SQL `registrar_resposta` espera em p_revisao.
"""
from datetime import date, timedelta

INTERVALOS = (1, 3, 7, 15, 30)


def proxima_revisao(atual: dict | None, acertou: bool, hoje: date) -> dict | None:
    if not acertou:
        return _revisao(hoje, intervalo=INTERVALOS[0], acertos=0)
    if atual is None:
        return None
    acertos = int(atual.get("acertos_seguidos", 0)) + 1
    if acertos >= len(INTERVALOS):
        return {"remover": True}
    return _revisao(hoje, intervalo=INTERVALOS[acertos], acertos=acertos)


def _revisao(hoje: date, intervalo: int, acertos: int) -> dict:
    return {
        "proxima_revisao": (hoje + timedelta(days=intervalo)).isoformat(),
        "intervalo_dias": intervalo,
        "acertos_seguidos": acertos,
    }
