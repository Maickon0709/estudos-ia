"""Flashcards, simulados, sessões de estudo, metas e atividade (migração 004).

Como no resto do projeto, tudo passa pelo cliente com o JWT do usuário:
quem filtra as linhas é o RLS do Postgres.
"""
from postgrest.exceptions import APIError

from app.core.errors import (
    EstadoInvalidoError,
    NaoAutenticadoError,
    NaoEncontradoError,
    PropostaInvalidaError,
    SemConteudoError,
)
from app.repositories.exercicio_repository import COLUNAS_PUBLICAS


def _rpc(client, funcao: str, parametros: dict):
    """Chama uma função SQL e traduz as exceções levantadas nela."""
    try:
        dados = client.rpc(funcao, parametros).execute().data
    except APIError as exc:
        mensagem = getattr(exc, "message", "") or ""
        for chave, erro in _ERROS_SQL.items():
            if chave in mensagem:
                raise erro[0](erro[1]) from exc
        raise
    if isinstance(dados, list):
        dados = dados[0] if dados else None
    if isinstance(dados, dict) and funcao in dados and len(dados) == 1:
        dados = dados[funcao]
    if dados is None:
        raise PropostaInvalidaError("O banco não confirmou a operação.")
    return dados


_ERROS_SQL = {
    "nao_autenticado": (NaoAutenticadoError, "Sessão expirada. Entre de novo."),
    "flashcard_nao_encontrado": (NaoEncontradoError, "Flashcard não encontrado."),
    "categoria_nao_encontrada": (NaoEncontradoError, "Categoria não encontrada."),
    "simulado_nao_encontrado": (NaoEncontradoError, "Simulado não encontrado."),
    "simulado_ja_finalizado": (EstadoInvalidoError, "Este simulado já foi finalizado."),
    "exercicios_insuficientes": (
        SemConteudoError,
        "Gere pelo menos 3 exercícios de múltipla escolha nesta categoria antes de fazer um simulado.",
    ),
}


class FlashcardRepository:
    def __init__(self, client):
        self._client = client

    def criar_varios(self, etapa_id: str, cartoes: list[dict]) -> list[dict]:
        linhas = [{"etapa_id": etapa_id, "frente": c["frente"], "verso": c["verso"]} for c in cartoes]
        return self._client.table("flashcards").insert(linhas).execute().data

    def listar(self, etapa_id: str) -> list[dict]:
        return (
            self._client.table("flashcards").select("*")
            .eq("etapa_id", etapa_id).order("created_at").execute().data
        )

    def obter(self, flashcard_id: str) -> dict | None:
        dados = self._client.table("flashcards").select("*").eq("id", flashcard_id).limit(1).execute().data
        return dados[0] if dados else None

    def pendentes(self, hoje: str) -> list[dict]:
        return (
            self._client.table("v_flashcards_pendentes").select("*")
            .lte("proxima_revisao", hoje).order("proxima_revisao").execute().data
        )

    def revisar(self, flashcard_id: str, lembrou: bool, revisao: dict) -> dict:
        return _rpc(self._client, "revisar_flashcard", {
            "p_flashcard_id": flashcard_id, "p_lembrou": lembrou, "p_revisao": revisao,
        })


class SimuladoRepository:
    def __init__(self, client):
        self._client = client

    def criar(self, categoria_id: str, quantidade: int, limite_segundos: int) -> str:
        return str(_rpc(self._client, "criar_simulado", {
            "p_categoria_id": categoria_id, "p_quantidade": quantidade, "p_limite_segundos": limite_segundos,
        }))

    def obter(self, simulado_id: str) -> dict | None:
        dados = self._client.table("simulados").select("*").eq("id", simulado_id).limit(1).execute().data
        return dados[0] if dados else None

    def listar(self, categoria_id: str, limite: int = 10) -> list[dict]:
        return (
            self._client.table("simulados").select("*")
            .eq("categoria_id", categoria_id).order("iniciado_em", desc=True).limit(limite).execute().data
        )

    def questoes(self, simulado_id: str) -> list[dict]:
        return (
            self._client.table("simulado_questoes").select("ordem, exercicio_id, resposta, correta")
            .eq("simulado_id", simulado_id).order("ordem").execute().data
        )

    def exercicios_publicos(self, ids: list[str]) -> list[dict]:
        """Sem gabarito nem explicação: é o que vai para a prova em andamento."""
        if not ids:
            return []
        return self._client.table("exercicios").select(COLUNAS_PUBLICAS).in_("id", ids).execute().data

    def exercicios_completos(self, ids: list[str]) -> list[dict]:
        """Com gabarito: só para corrigir no back-end ou depois de finalizado."""
        if not ids:
            return []
        return self._client.table("exercicios").select("*").in_("id", ids).execute().data

    def finalizar(self, simulado_id: str, itens: list[dict]) -> dict:
        return _rpc(self._client, "finalizar_simulado", {"p_simulado_id": simulado_id, "p_itens": itens})


class EstudoRepository:
    """Sessões do cronômetro, metas semanais e atividade diária."""

    def __init__(self, client):
        self._client = client

    def registrar_sessao(self, sessao: dict) -> dict:
        return self._client.table("sessoes_estudo").insert(sessao).execute().data[0]

    def obter_meta(self) -> dict | None:
        dados = self._client.table("metas").select("*").limit(1).execute().data
        return dados[0] if dados else None

    def salvar_meta(self, user_id: str, dias: int, minutos: int | None) -> dict:
        linha = {"user_id": user_id, "dias_por_semana": dias, "minutos_por_semana": minutos}
        return self._client.table("metas").upsert(linha, on_conflict="user_id").execute().data[0]

    def atividade(self, desde: str) -> list[dict]:
        return (
            self._client.table("v_atividade_diaria").select("*")
            .gte("dia", desde).order("dia").execute().data
        )

    def minutos_por_semana(self, categoria_id: str, desde: str) -> list[dict]:
        return (
            self._client.table("v_estudo_semanal").select("semana, minutos")
            .eq("categoria_id", categoria_id).gte("semana", desde).order("semana").execute().data
        )

    def progresso_categorias(self) -> list[dict]:
        return self._client.table("v_progresso_categoria").select("*").execute().data
