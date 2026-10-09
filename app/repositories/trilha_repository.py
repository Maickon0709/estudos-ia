"""Leitura de trilhas, etapas e recursos; atualização de etapas."""


class TrilhaRepository:
    def __init__(self, client):
        self._client = client

    def listar(self, categoria_id: str) -> list[dict]:
        return (
            self._client.table("trilhas").select("*")
            .eq("categoria_id", categoria_id)
            .order("created_at", desc=True)
            .execute().data
        )

    def obter(self, trilha_id: str) -> dict | None:
        dados = self._client.table("trilhas").select("*").eq("id", trilha_id).limit(1).execute().data
        return dados[0] if dados else None

    def etapas(self, trilha_id: str) -> list[dict]:
        return (
            self._client.table("etapas").select("*")
            .eq("trilha_id", trilha_id)
            .order("ordem")
            .execute().data
        )

    def recursos_das_etapas(self, etapa_ids: list[str]) -> list[dict]:
        if not etapa_ids:
            return []
        return self._client.table("recursos").select("*").in_("etapa_id", etapa_ids).execute().data


class EtapaRepository:
    def __init__(self, client):
        self._client = client

    def obter(self, etapa_id: str) -> dict | None:
        dados = self._client.table("etapas").select("*").eq("id", etapa_id).limit(1).execute().data
        return dados[0] if dados else None

    def atualizar(self, etapa_id: str, campos: dict) -> dict | None:
        dados = self._client.table("etapas").update(campos).eq("id", etapa_id).execute().data
        return dados[0] if dados else None

    def recursos(self, etapa_id: str) -> list[dict]:
        return self._client.table("recursos").select("*").eq("etapa_id", etapa_id).execute().data

    def niveis(self, etapa_id: str) -> dict:
        """{"basico": {"total": 5, "acertos": 4}, ...} a partir da view do banco."""
        linhas = (
            self._client.table("v_acerto_etapa_nivel")
            .select("nivel, total, acertos")
            .eq("etapa_id", etapa_id)
            .execute().data
        )
        return {l["nivel"]: {"total": int(l["total"]), "acertos": int(l["acertos"])} for l in linhas}
