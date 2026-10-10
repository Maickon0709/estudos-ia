"""Único lugar que conversa com `documentos` e `documento_trechos` (migração 008)."""
from postgrest.exceptions import APIError

from app.core.errors import EstadoInvalidoError, NaoAutenticadoError, NaoEncontradoError, ValidacaoError

COLUNAS = "id, categoria_id, nome, tipo, paginas, caracteres, trechos, truncado, created_at"

_ERROS_SQL = {
    "nao_autenticado": (NaoAutenticadoError, "Sessão expirada. Entre de novo."),
    "categoria_nao_encontrada": (NaoEncontradoError, "Categoria não encontrada."),
    "trechos_invalidos": (ValidacaoError, "Não consegui separar o texto desse arquivo."),
    "documentos_demais": (
        EstadoInvalidoError,
        "Você chegou ao limite de 30 materiais. Apague algum para enviar outro.",
    ),
}


class DocumentoRepository:
    def __init__(self, client):
        self._client = client

    def listar(self, categoria_id: str) -> list[dict]:
        return (
            self._client.table("documentos")
            .select(COLUNAS)
            .eq("categoria_id", categoria_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )

    def criar(self, categoria_id: str, nome: str, tipo: str, paginas: int | None,
              truncado: bool, trechos: list[dict]) -> dict:
        try:
            dados = self._client.rpc("criar_documento", {
                "p_categoria_id": categoria_id,
                "p_nome": nome,
                "p_tipo": tipo,
                "p_paginas": paginas,
                "p_truncado": truncado,
                "p_trechos": trechos,
            }).execute().data
        except APIError as exc:
            mensagem = getattr(exc, "message", "") or ""
            for chave, (erro, texto) in _ERROS_SQL.items():
                if chave in mensagem:
                    raise erro(texto) from exc
            raise
        if isinstance(dados, list):
            dados = dados[0] if dados else None
        if isinstance(dados, dict) and set(dados) == {"criar_documento"}:
            dados = dados["criar_documento"]
        if not isinstance(dados, dict):
            raise ValidacaoError("O banco não confirmou o envio do material.")
        return {chave: dados.get(chave) for chave in COLUNAS.split(", ")}

    def remover(self, documento_id: str) -> bool:
        """Apaga (os trechos vão junto, em cascata). False se não existe ou não é do usuário."""
        return bool(self._client.table("documentos").delete().eq("id", documento_id).execute().data)

    def buscar(self, categoria_id: str, consulta: str, limite: int) -> list[dict]:
        return self._client.rpc("buscar_trechos", {
            "p_categoria_id": categoria_id,
            "p_consulta": consulta,
            "p_limite": limite,
        }).execute().data or []
