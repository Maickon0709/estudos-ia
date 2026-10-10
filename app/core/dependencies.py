"""Montagem das dependências por requisição (repository -> service).

Fica isolado aqui para os testes poderem trocar por versões falsas.
"""
from flask import current_app, g

from app.core.supabase_client import anon_client, user_client
from app.integrations.link_validator import LinkValidator
from app.integrations.llm_client import GroqClient
from app.integrations.search_client import TavilyClient
from app.integrations.storage_client import StorageClient
from app.integrations.youtube_client import YouTubeClient
from app.repositories.categoria_repository import CategoriaRepository
from app.repositories.conta_repository import ContaRepository
from app.repositories.documento_repository import DocumentoRepository
from app.repositories.estudo_repository import EstudoRepository, FlashcardRepository, SimuladoRepository
from app.repositories.exercicio_repository import (
    ExercicioRepository,
    RespostaRepository,
    RevisaoRepository,
)
from app.repositories.mensagem_repository import MensagemRepository
from app.repositories.painel_repository import PainelRepository
from app.repositories.proposta_repository import PropostaRepository
from app.repositories.trilha_repository import EtapaRepository, TrilhaRepository
from app.repositories.uso_repository import UsoRepository
from app.services.categoria_service import CategoriaService
from app.services.chat_service import ChatService
from app.services.conta_service import ContaService
from app.services.documento_service import DocumentoService
from app.services.estudo_service import EstudoService
from app.services.exercicio_service import ExercicioService
from app.services.flashcard_service import FlashcardService
from app.services.painel_service import PainelService
from app.services.pesquisa_service import PesquisaService
from app.services.proposta_service import PropostaService
from app.services.simulado_service import SimuladoService
from app.services.trilha_service import TrilhaService
from app.services.uso_service import UsoService


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


def get_uso_service() -> UsoService:
    return UsoService(UsoRepository(user_client(g.token)), {
        "chat": current_app.config["LIMITE_CHAT_DIA"],
        "ia": current_app.config["LIMITE_IA_DIA"],
        "pesquisa": current_app.config["LIMITE_PESQUISA_DIA"],
    })


def get_categoria_service() -> CategoriaService:
    return CategoriaService(CategoriaRepository(user_client(g.token)))


def get_chat_service() -> ChatService:
    client = user_client(g.token)
    categorias = CategoriaService(CategoriaRepository(client))
    return ChatService(
        categorias,
        MensagemRepository(client),
        _llm(),
        documentos=DocumentoService(categorias, DocumentoRepository(client)),
    )


def get_documento_service() -> DocumentoService:
    client = user_client(g.token)
    return DocumentoService(CategoriaService(CategoriaRepository(client)), DocumentoRepository(client))


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
        DocumentoRepository(client),
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
        uso=get_uso_service(),
    )


def get_painel_service() -> PainelService:
    client = user_client(g.token)
    return PainelService(
        CategoriaService(CategoriaRepository(client)),
        PainelRepository(client),
        RevisaoRepository(client),
        estudo_repo=EstudoRepository(client),
    )


def get_flashcard_service() -> FlashcardService:
    client = user_client(g.token)
    return FlashcardService(EtapaRepository(client), TrilhaRepository(client), FlashcardRepository(client), _llm())


def get_simulado_service() -> SimuladoService:
    client = user_client(g.token)
    return SimuladoService(CategoriaService(CategoriaRepository(client)), SimuladoRepository(client))


def get_estudo_service() -> EstudoService:
    client = user_client(g.token)
    return EstudoService(
        CategoriaService(CategoriaRepository(client)),
        EstudoRepository(client),
        RevisaoRepository(client),
        FlashcardRepository(client),
    )


def get_conta_service() -> ContaService:
    storage = StorageClient(current_app.config["SUPABASE_URL"], current_app.config["SUPABASE_ANON_KEY"], g.token)
    return ContaService(ContaRepository(user_client(g.token), anon_client(), g.token), storage)
