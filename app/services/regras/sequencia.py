"""Sequência de dias estudados ("streak") para o painel."""
from datetime import date, timedelta
from typing import Iterable


def sequencia_de_dias(dias: Iterable[date], hoje: date) -> int:
    """Dias seguidos até hoje. Se ainda não estudou hoje, a sequência que
    terminou ontem continua valendo (o dia ainda não acabou)."""
    estudados = set(dias)
    atual = hoje if hoje in estudados else hoje - timedelta(days=1)
    total = 0
    while atual in estudados:
        total += 1
        atual -= timedelta(days=1)
    return total
