"""Leitura de trilhas, etapas e recursos; atualização de etapas."""

COLUNAS_MATERIAL = "etapa_id, documento_id, ordem_inicio, ordem_fim, pagina_inicio, pagina_fim, documentos(nome)"


def _material(linha: dict) -> dict:
    """Achata o nome do arquivo que vem aninhado no join (documentos(nome))."""
    return {
        "etapa_id": linha.get("etapa_id"),
        "documento_id": linha.get("documento_id"),
        "nome": (linha.get("documentos") or {}).get("nome"),
        "ordem_inicio": linha.get("ordem_inicio"),
        "ordem_fim": linha.get("ordem_fim"),
        "pagina_inicio": linha.get("pagina_inicio"),
        "pagina_fim": linha.get("pagina_fim"),
    }


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

    def materiais_das_etapas(self, etapa_ids: list[str]) -> list[dict]:
        """Partes dos arquivos do aluno ligadas às etapas (migração 009)."""
        if not etapa_ids:
            return []
        linhas = self._client.table("etapa_materiais").select(COLUNAS_MATERIAL).in_("etapa_id", etapa_ids).execute().data
        return [_material(l) for l in linhas or []]


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

    def materiais(self, etapa_id: str) -> list[dict]:
        linhas = (
            self._client.table("etapa_materiais").select(COLUNAS_MATERIAL)
            .eq("etapa_id", etapa_id).order("ordem_inicio").execute().data
        )
        return [_material(l) for l in linhas or []]

    def texto_material(self, documento_id: str, ordem_inicio: int, ordem_fim: int) -> list[dict]:
        """Os trechos de um intervalo do arquivo, em ordem (o RLS só deixa ler os do dono)."""
        return (
            self._client.table("documento_trechos").select("ordem, pagina, conteudo")
            .eq("documento_id", documento_id)
            .gte("ordem", ordem_inicio).lte("ordem", ordem_fim)
            .order("ordem").execute().data
        ) or []

    def niveis(self, etapa_id: str) -> dict:
        """{"basico": {"total": 5, "acertos": 4}, ...} a partir da view do banco."""
        linhas = (
            self._client.table("v_acerto_etapa_nivel")
            .select("nivel, total, acertos")
            .eq("etapa_id", etapa_id)
            .execute().data
        )
        return {l["nivel"]: {"total": int(l["total"]), "acertos": int(l["acertos"])} for l in linhas}
