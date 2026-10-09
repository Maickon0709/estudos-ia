"""Montagem das dependências por requisição (repository -> service).

Fica isolado aqui para os testes poderem trocar por versões falsas.
"""
from flask import current_app, g

from app.core.supabase_client import user_client
from app.integrations.link_validator import LinkValidator
from app.integrations.llm_client import GroqClient
from app.integrations.search_client import TavilyClient
from app.integrations.youtube_client import YouTubeClient
from app.repositories.categoria_repository import CategoriaRepository
from app.repositories.exercicio_repository import (
    ExercicioRepository,
    RespostaRepository,
    RevisaoRepository,
)
from app.repositories.mensagem_repository import MensagemRepository
from app.repositories.painel_repository import PainelRepository
from app.repositories.proposta_repository import PropostaRepository
from app.repositories.trilha_repository import EtapaRepository, TrilhaRepository
from app.services.categoria_service import CategoriaService
from app.services.chat_service import ChatService
from app.services.exercicio_service import ExercicioService
from app.services.painel_service import PainelService
from app.services.pesquisa_service import PesquisaService
from app.services.proposta_service import PropostaService
from app.services.trilha_service import TrilhaService


def _llm() -> GroqClient:
    return GroqClient(
        current_app.config.get("GROQ_API_KEY"),
        current_app.config["GROQ_MODEL"],
    )


def _pesquisa(categorias: CategoriaService) -> PesquisaService:
    return PesquisaService(
        categorias,
        TavilyClient(current_app.config.get("TAVILY_API_KEY")),
        YouTubeClient(current_app.config.get("YOUTUBE_API_KEY")),
        LinkValidator(),
    )


def get_categoria_service() -> CategoriaService:
    return CategoriaService(CategoriaRepository(user_client(g.token)))


def get_chat_service() -> ChatService:
    client = user_client(g.token)
    return ChatService(
        CategoriaService(CategoriaRepository(client)),
        MensagemRepository(client),
        _llm(),
    )


def get_pesquisa_service() -> PesquisaService:
    return _pesquisa(CategoriaService(CategoriaRepository(user_client(g.token))))


def get_proposta_service() -> PropostaService:
    client = user_client(g.token)
    categorias = CategoriaService(CategoriaRepository(client))
    return PropostaService(
        categorias,
        MensagemRepository(client),
        _pesquisa(categorias),
        _llm(),
        PropostaRepository(client),
    )


def get_trilha_service() -> TrilhaService:
    client = user_client(g.token)
    return TrilhaService(
        CategoriaService(CategoriaRepository(client)),
        TrilhaRepository(client),
        EtapaRepository(client),
    )


def get_exercicio_service() -> ExercicioService:
    client = user_client(g.token)
    return ExercicioService(
        EtapaRepository(client),
        TrilhaRepository(client),
        ExercicioRepository(client),
        RespostaRepository(client),
        RevisaoRepository(client),
        _llm(),
    )


def get_painel_service() -> PainelService:
    client = user_client(g.token)
    return PainelService(
        CategoriaService(CategoriaRepository(client)),
        PainelRepository(client),
        RevisaoRepository(client),
    )
