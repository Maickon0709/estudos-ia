"""Único lugar que conversa com a tabela `mensagens`."""
from datetime import datetime, timedelta, timezone


class MensagemRepository:
    def __init__(self, client):
        self._client = client

    def _tabela(self):
        return self._client.table("mensagens")

    def listar_recentes(self, categoria_id: str, limite: int) -> list[dict]:
        """Últimas `limite` mensagens, devolvidas da mais antiga para a mais nova."""
        resposta = (
            self._tabela()
            .select("*")
            .eq("categoria_id", categoria_id)
            .order("created_at", desc=True)
            .limit(limite)
            .execute()
        )
        return list(reversed(resposta.data))

    def criar_par(self, categoria_id: str, pergunta: str, resposta: str) -> list[dict]:
        """Grava pergunta e resposta num único INSERT (tudo ou nada).

        O default now() do Postgres é o início da transação, então duas linhas
        do mesmo INSERT teriam o MESMO created_at e a ordem ficaria ambígua.
        Por isso definimos created_at explicitamente, com 1 ms de diferença.
        """
        agora = datetime.now(timezone.utc)
        linhas = [
            {
                "categoria_id": categoria_id,
                "papel": "user",
                "conteudo": pergunta,
                "created_at": agora.isoformat(),
            },
            {
                "categoria_id": categoria_id,
                "papel": "assistant",
                "conteudo": resposta,
                "created_at": (agora + timedelta(milliseconds=1)).isoformat(),
            },
        ]
        return self._tabela().insert(linhas).execute().data
