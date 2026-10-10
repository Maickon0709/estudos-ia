"""Exercícios, respostas e revisões.

Segurança: as leituras "públicas" selecionam colunas explícitas e NUNCA
incluem `gabarito` nem `explicacao`. Só `obter_completo` (usado na correção,
dentro do back-end) lê o gabarito.
"""
from postgrest.exceptions import APIError

from app.core.errors import NaoAutenticadoError, NaoEncontradoError, PropostaInvalidaError

COLUNAS_PUBLICAS = "id, etapa_id, nivel, tipo, enunciado, opcoes, created_at"


class ExercicioRepository:
    def __init__(self, client):
        self._client = client

    def _tabela(self):
        return self._client.table("exercicios")

    def criar_varios(self, etapa_id: str, itens: list[dict]) -> list[dict]:
        linhas = [{"etapa_id": etapa_id, **item} for item in itens]
        return self._tabela().insert(linhas).execute().data

    def listar(self, etapa_id: str, nivel: str | None = None) -> list[dict]:
        consulta = self._tabela().select(COLUNAS_PUBLICAS).eq("etapa_id", etapa_id)
        if nivel:
            consulta = consulta.eq("nivel", nivel)
        return consulta.order("created_at").execute().data

    def obter_completo(self, exercicio_id: str) -> dict | None:
        dados = self._tabela().select("*").eq("id", exercicio_id).limit(1).execute().data
        return dados[0] if dados else None


class RespostaRepository:
    """Grava a resposta pela função SQL atômica `registrar_resposta`."""

    def __init__(self, client):
        self._client = client

    def registrar(self, exercicio_id: str, resposta: str, correta: bool,
                  feedback: str | None, revisao: dict | None) -> dict:
        try:
            dados = self._client.rpc("registrar_resposta", {
                "p_exercicio_id": exercicio_id,
                "p_resposta": resposta,
                "p_correta": correta,
                "p_feedback": feedback,
                "p_revisao": revisao,
            }).execute().data
        except APIError as exc:
            mensagem = getattr(exc, "message", "") or ""
            if "exercicio_nao_encontrado" in mensagem:
                raise NaoEncontradoError("Exercício não encontrado.") from exc
            if "nao_autenticado" in mensagem:
                raise NaoAutenticadoError("Sessão expirada. Entre de novo.") from exc
            raise
        if isinstance(dados, list):
            dados = dados[0] if dados else None
        if isinstance(dados, dict) and "registrar_resposta" in dados and len(dados) == 1:
            dados = dados["registrar_resposta"]
        if not isinstance(dados, dict) or "etapa_id" not in dados:
            raise PropostaInvalidaError("O banco não confirmou o registro da resposta.")
        dados.setdefault("niveis", {})
        return dados

    def ultima(self, exercicio_id: str) -> str | None:
        """Última resposta do usuário logado a este exercício (o RLS filtra o dono)."""
        dados = (
            self._client.table("respostas").select("resposta")
            .eq("exercicio_id", exercicio_id).order("created_at", desc=True).limit(1).execute().data
        )
        return dados[0]["resposta"] if dados else None


class RevisaoRepository:
    def __init__(self, client):
        self._client = client

    def obter(self, exercicio_id: str) -> dict | None:
        """Revisão aberta do usuário logado (o RLS filtra pelo dono)."""
        dados = (
            self._client.table("revisoes").select("*")
            .eq("exercicio_id", exercicio_id).limit(1).execute().data
        )
        return dados[0] if dados else None

    def pendentes(self, hoje: str, categoria_id: str | None = None) -> list[dict]:
        consulta = self._client.table("v_revisoes_pendentes").select("*").lte("proxima_revisao", hoje)
        if categoria_id:
            consulta = consulta.eq("categoria_id", categoria_id)
        return consulta.order("proxima_revisao").execute().data
