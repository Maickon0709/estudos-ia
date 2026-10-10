"""Contador de uso diário (tabela uso_diario, migração 007).

O usuário só LÊ a tabela; quem soma é a função SQL consumir_uso(), que faz
a checagem e o incremento num único comando (sem corrida entre requisições).
"""
from postgrest.exceptions import APIError


class UsoRepository:
    def __init__(self, client):
        self._client = client

    def consumir(self, tipo: str, limite: int) -> bool:
        """Soma 1 ao uso de hoje. Devolve False se o limite já foi atingido."""
        try:
            self._client.rpc("consumir_uso", {"p_tipo": tipo, "p_limite": limite}).execute()
        except APIError as exc:
            if "limite_atingido" in (getattr(exc, "message", "") or ""):
                return False
            raise
        return True

    def usados(self, dia: str) -> dict[str, int]:
        dados = (
            self._client.table("uso_diario").select("tipo, quantidade").eq("dia", dia).execute().data
        )
        return {linha["tipo"]: linha["quantidade"] for linha in dados or []}
