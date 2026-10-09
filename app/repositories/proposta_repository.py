"""Único lugar que conversa com a tabela `propostas` e com a função
`confirmar_proposta` do banco (migrations/002_propostas.sql)."""
from datetime import datetime, timezone

from postgrest.exceptions import APIError

from app.core.errors import (
    EstadoInvalidoError,
    NaoEncontradoError,
    PropostaInvalidaError,
)

LISTAGEM_MAX = 50

# Mensagem do RAISE EXCEPTION no SQL -> erro de domínio
_ERROS_DA_FUNCAO = {
    "proposta_nao_encontrada": (NaoEncontradoError, "Proposta não encontrada."),
    "proposta_ja_decidida": (EstadoInvalidoError, "Esta proposta já foi confirmada ou rejeitada."),
    "proposta_invalida": (PropostaInvalidaError, "A proposta está inválida e não pode ser confirmada."),
}


class PropostaRepository:
    def __init__(self, client):
        self._client = client

    def _tabela(self):
        return self._client.table("propostas")

    def criar(self, categoria_id: str, payload: dict) -> dict:
        resposta = self._tabela().insert({"categoria_id": categoria_id, "payload": payload}).execute()
        return resposta.data[0]

    def obter(self, proposta_id: str) -> dict | None:
        resposta = self._tabela().select("*").eq("id", proposta_id).limit(1).execute()
        return resposta.data[0] if resposta.data else None

    def listar(self, categoria_id: str, status: str | None = None) -> list[dict]:
        consulta = self._tabela().select("*").eq("categoria_id", categoria_id)
        if status:
            consulta = consulta.eq("status", status)
        return consulta.order("created_at", desc=True).limit(LISTAGEM_MAX).execute().data

    def rejeitar(self, proposta_id: str) -> dict | None:
        """Rejeita só se ainda estiver pendente (o filtro de status faz isso atômico)."""
        resposta = (
            self._tabela()
            .update({"status": "rejeitada", "decidida_em": _agora()})
            .eq("id", proposta_id)
            .eq("status", "pendente")
            .execute()
        )
        return resposta.data[0] if resposta.data else None

    def rejeitar_outras_pendentes(self, categoria_id: str, exceto_id: str) -> None:
        """Uma proposta nova substitui as pendentes anteriores da mesma categoria."""
        (
            self._tabela()
            .update({"status": "rejeitada", "decidida_em": _agora()})
            .eq("categoria_id", categoria_id)
            .eq("status", "pendente")
            .neq("id", exceto_id)
            .execute()
        )

    def confirmar(self, proposta_id: str) -> str:
        """Chama a função SQL atômica. Devolve o id da trilha criada."""
        try:
            resposta = self._client.rpc(
                "confirmar_proposta", {"p_proposta_id": proposta_id}
            ).execute()
        except APIError as exc:
            mensagem = getattr(exc, "message", "") or ""
            for chave, (erro, texto) in _ERROS_DA_FUNCAO.items():
                if chave in mensagem:
                    raise erro(texto) from exc
            raise
        return _escalar(resposta.data)


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _escalar(dado):
    """O PostgREST devolve o retorno escalar como valor puro; aceitamos
    também lista/objeto por robustez entre versões."""
    if isinstance(dado, list):
        dado = dado[0] if dado else None
    if isinstance(dado, dict):
        dado = next(iter(dado.values()), None)
    if not isinstance(dado, str) or not dado:
        raise PropostaInvalidaError("O banco não devolveu a trilha criada.")
    return dado
