"""Trilha adaptativa: o desempenho muda o rumo da etapa.

Regras (todas aqui, sem IA, fáceis de testar e de explicar):
- Básico está sempre liberado.
- Intermediário libera com >= 80% no básico (mínimo de 3 respostas),
  ou direto se o estudante marcou "já sei" na etapa.
- Avançado libera com >= 80% no intermediário (mínimo de 3 respostas).
- Reforço: < 50% num nível com pelo menos 4 respostas. Nesse caso uma etapa
  "concluída" volta para "em andamento", e um "já sei" que não se confirmou
  no básico ou no intermediário é desfeito (volta a exigir o básico).
- Responder a primeira vez tira a etapa de "não iniciada".
- Concluir continua sendo decisão do estudante (checklist manual): quando ele
  domina o avançado, só sugerimos "pode_concluir".

`niveis` vem do banco no formato {"basico": {"total": 5, "acertos": 4}, ...}.
"""

ORDEM_NIVEIS = ("basico", "intermediario", "avancado")
LIMIAR_LIBERAR = 80.0
MIN_RESPOSTAS_LIBERAR = 3
LIMIAR_REFORCO = 50.0
MIN_RESPOSTAS_REFORCO = 4


def taxa(stats: dict | None) -> float | None:
    if not stats or not stats.get("total"):
        return None
    return 100.0 * stats.get("acertos", 0) / stats["total"]


def dominou(stats: dict | None) -> bool:
    t = taxa(stats)
    return t is not None and stats["total"] >= MIN_RESPOSTAS_LIBERAR and t >= LIMIAR_LIBERAR


def precisa_reforco(stats: dict | None) -> bool:
    t = taxa(stats)
    return t is not None and stats["total"] >= MIN_RESPOSTAS_REFORCO and t < LIMIAR_REFORCO


def niveis_liberados(niveis: dict, ja_sabia: bool) -> list[str]:
    liberados = ["basico"]
    if ja_sabia or dominou(niveis.get("basico")):
        liberados.append("intermediario")
        if dominou(niveis.get("intermediario")):
            liberados.append("avancado")
    return liberados


def avaliar(etapa: dict, niveis: dict) -> dict:
    status = etapa["status"]
    ja_sabia = bool(etapa.get("ja_sabia"))
    total = sum((s or {}).get("total", 0) for s in niveis.values())

    if status == "nao_iniciado" and total > 0:
        status = "em_andamento"

    nivel_reforco = next((n for n in ORDEM_NIVEIS if precisa_reforco(niveis.get(n))), None)
    if nivel_reforco:
        if status == "concluido":
            status = "em_andamento"
        if ja_sabia and nivel_reforco in ("basico", "intermediario"):
            ja_sabia = False

    if nivel_reforco:
        recomendacao = "reforco"
    elif status != "concluido" and dominou(niveis.get("avancado")):
        recomendacao = "pode_concluir"
    else:
        recomendacao = None

    return {
        "status": status,
        "ja_sabia": ja_sabia,
        "niveis_liberados": niveis_liberados(niveis, ja_sabia),
        "recomendacao": recomendacao,
        "nivel_reforco": nivel_reforco,
        "mudou": status != etapa["status"] or ja_sabia != bool(etapa.get("ja_sabia")),
    }
