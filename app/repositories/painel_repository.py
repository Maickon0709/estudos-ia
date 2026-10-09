"""Leitura das views do painel (todas com security_invoker: o RLS vale)."""

PONTOS_FRACOS_MAX = 5


class PainelRepository:
    def __init__(self, client):
        self._client = client

    def progresso(self, categoria_id: str) -> dict | None:
        dados = (
            self._client.table("v_progresso_categoria").select("*")
            .eq("categoria_id", categoria_id).limit(1).execute().data
        )
        return dados[0] if dados else None

    def acerto_por_nivel(self, categoria_id: str) -> list[dict]:
        return (
            self._client.table("v_acerto_por_nivel").select("*")
            .eq("categoria_id", categoria_id).execute().data
        )

    def pontos_fracos(self, categoria_id: str) -> list[dict]:
        return (
            self._client.table("v_pontos_fracos").select("*")
            .eq("categoria_id", categoria_id)
            .order("taxa_acerto")
            .limit(PONTOS_FRACOS_MAX)
            .execute().data
        )

    def dias_estudo(self) -> list[str]:
        return [l["dia"] for l in self._client.table("v_dias_estudo").select("dia").execute().data]
