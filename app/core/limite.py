"""Decorador que gasta 1 do limite diário antes de a rota chamar IA ou busca."""
from functools import wraps

from app.core import dependencies


def consome(tipo: str):
    """Use DEPOIS de @login_required (precisa do usuário logado)."""

    def decorador(funcao):
        @wraps(funcao)
        def embrulho(*args, **kwargs):
            dependencies.get_uso_service().consumir(tipo)
            return funcao(*args, **kwargs)

        return embrulho

    return decorador
