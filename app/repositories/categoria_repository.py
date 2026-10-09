"""Único lugar que conversa com a tabela `categorias`.

Não tem regra de negócio: só traduz chamadas em queries e erros do
Postgres em erros de domínio.
"""
from postgrest.exceptions import APIError

from app.core.errors import DuplicadoError

_UNIQUE_VIOLATION = "23505"


class CategoriaRepository:
    def __init__(self, client):
        self._client = client

    def _tabela(self):
        return self._client.table("categorias")

    def listar(self) -> list[dict]:
        resposta = self._tabela().select("*").order("created_at", desc=True).execute()
        return resposta.data

    def obter(self, categoria_id: str) -> dict | None:
        resposta = (
            self._tabela().select("*").eq("id", categoria_id).limit(1).execute()
        )
        return resposta.data[0] if resposta.data else None

    def criar(self, user_id: str, nome: str) -> dict:
        try:
            resposta = self._tabela().insert({"user_id": user_id, "nome": nome}).execute()
        except APIError as exc:
            self._traduzir(exc)
            raise
        return resposta.data[0]

    def renomear(self, categoria_id: str, nome: str) -> dict | None:
        try:
            resposta = (
                self._tabela().update({"nome": nome}).eq("id", categoria_id).execute()
            )
        except APIError as exc:
            self._traduzir(exc)
            raise
        return resposta.data[0] if resposta.data else None

    def remover(self, categoria_id: str) -> bool:
        resposta = self._tabela().delete().eq("id", categoria_id).execute()
        return bool(resposta.data)

    @staticmethod
    def _traduzir(exc: APIError) -> None:
        if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
            raise DuplicadoError("Você já tem uma categoria com esse nome.") from exc
