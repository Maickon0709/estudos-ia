"""Propostas de trilha: a IA propõe, o usuário decide, o banco grava.

Fluxo:
  gerar     -> pesquisa verificada + conversa -> IA escolhe recursos por número
               -> proposta 'pendente' salva (nada de trilha ainda)
  gerar_de_materiais -> partes dos arquivos do aluno (numeradas) -> IA escolhe partes por número
               -> proposta 'pendente' com `materiais` em cada etapa
  confirmar -> função SQL atômica cria trilha + etapas + recursos + materiais
  rejeitar  -> marca 'rejeitada'

Custo de `gerar`: 2 créditos do Tavily + 1 chamada à IA (+ YouTube se houver chave).
"""
import uuid

from app.core.errors import (
    EstadoInvalidoError,
    NaoEncontradoError,
    SemConteudoError,
    ValidacaoError,
)
from app.services.materiais_trilha import montar_partes
from app.services.prompts import (
    mensagem_proposta,
    mensagem_proposta_materiais,
    prompt_proposta,
    prompt_proposta_materiais,
)
from app.services.proposta_parser import extrair_json, montar_payload, montar_payload_materiais

OBJETIVO_MIN = 3
OBJETIVO_MAX = 300
MAX_RECURSOS_IA = 12      # materiais oferecidos à IA (controla tamanho do prompt)
CONTEXTO_CONVERSA = 10    # mensagens recentes do chat usadas como contexto
STATUS_VALIDOS = ("pendente", "confirmada", "rejeitada")


class PropostaService:
    def __init__(self, categoria_service, mensagem_repo, pesquisa_service, llm, proposta_repo,
                 documento_repo=None):
        self._categorias = categoria_service
        self._mensagens = mensagem_repo
        self._pesquisa = pesquisa_service
        self._llm = llm
        self._propostas = proposta_repo
        self._documentos = documento_repo  # materiais do aluno (trilha a partir dos arquivos)

    # ---------- gerar ----------
    def gerar(self, categoria_id: str, objetivo) -> dict:
        objetivo = self._validar_objetivo(objetivo)
        categoria = self._categorias.obter(categoria_id)  # 404 antes de gastar crédito

        pesquisa = self._pesquisa.buscar_recursos(objetivo)
        # Verificados primeiro; sorted é estável, então a ordem da busca se mantém.
        recursos = sorted(pesquisa["recursos"], key=lambda r: r["verificacao"] != "verificado")
        recursos = recursos[:MAX_RECURSOS_IA]
        if not recursos:
            raise SemConteudoError(
                "Não encontrei material verificado para esse objetivo. "
                "Tente descrevê-lo de outro jeito."
            )

        numerados = {i: r for i, r in enumerate(recursos, start=1)}
        conversa = self._mensagens.listar_recentes(categoria["id"], CONTEXTO_CONVERSA)
        resposta = self._llm.responder([
            {"role": "system", "content": prompt_proposta()},
            {"role": "user", "content": mensagem_proposta(categoria["nome"], objetivo, numerados, conversa)},
        ])

        payload = montar_payload(extrair_json(resposta), numerados, objetivo)
        payload["youtube_verificado"] = pesquisa["youtube_verificado"]

        proposta = self._propostas.criar(categoria["id"], payload)
        self._propostas.rejeitar_outras_pendentes(categoria["id"], proposta["id"])
        return proposta

    def gerar_de_materiais(self, categoria_id: str, objetivo) -> dict:
        """Trilha com os arquivos que o aluno enviou na categoria. Custo: 1 chamada à IA, 0 pesquisa."""
        objetivo = self._validar_objetivo(objetivo)
        categoria = self._categorias.obter(categoria_id)
        partes = montar_partes(self._documentos.previa(categoria["id"]) if self._documentos else [])
        if not partes:
            raise SemConteudoError(
                "Esta categoria ainda não tem materiais. Envie seus arquivos na aba Materiais "
                "ou monte a trilha com vídeos e sites."
            )

        numeradas = {i: p for i, p in enumerate(partes, start=1)}
        resposta = self._llm.responder([
            {"role": "system", "content": prompt_proposta_materiais()},
            {"role": "user", "content": mensagem_proposta_materiais(categoria["nome"], objetivo, numeradas)},
        ])
        payload = montar_payload_materiais(extrair_json(resposta), numeradas, objetivo)

        proposta = self._propostas.criar(categoria["id"], payload)
        self._propostas.rejeitar_outras_pendentes(categoria["id"], proposta["id"])
        return proposta

    # ---------- consultar ----------
    def listar(self, categoria_id: str, status=None) -> list[dict]:
        if status is not None and status not in STATUS_VALIDOS:
            raise ValidacaoError(f"Status inválido. Use: {', '.join(STATUS_VALIDOS)}.")
        categoria = self._categorias.obter(categoria_id)
        return self._propostas.listar(categoria["id"], status)

    def obter(self, proposta_id: str) -> dict:
        proposta = self._propostas.obter(_validar_uuid(proposta_id))
        if proposta is None:
            raise NaoEncontradoError("Proposta não encontrada.")
        return proposta

    # ---------- decidir ----------
    def confirmar(self, proposta_id: str) -> dict:
        proposta_id = _validar_uuid(proposta_id)
        trilha_id = self._propostas.confirmar(proposta_id)
        return {"trilha_id": trilha_id, "proposta": self.obter(proposta_id)}

    def rejeitar(self, proposta_id: str) -> dict:
        proposta_id = _validar_uuid(proposta_id)
        rejeitada = self._propostas.rejeitar(proposta_id)
        if rejeitada is not None:
            return rejeitada
        if self._propostas.obter(proposta_id) is None:
            raise NaoEncontradoError("Proposta não encontrada.")
        raise EstadoInvalidoError("Esta proposta já foi confirmada ou rejeitada.")

    # ---------- validações ----------
    @staticmethod
    def _validar_objetivo(objetivo) -> str:
        if not isinstance(objetivo, str) or len(objetivo.strip()) < OBJETIVO_MIN:
            raise ValidacaoError(f"Descreva o objetivo (mínimo {OBJETIVO_MIN} caracteres).")
        objetivo = " ".join(objetivo.split())
        if len(objetivo) > OBJETIVO_MAX:
            raise ValidacaoError(f"O objetivo pode ter no máximo {OBJETIVO_MAX} caracteres.")
        return objetivo


def _validar_uuid(valor) -> str:
    try:
        return str(uuid.UUID(str(valor)))
    except ValueError as exc:
        raise ValidacaoError("Identificador de proposta inválido.") from exc
