"""Validações e utilidades compartilhadas pelos services."""
import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.errors import ValidacaoError

FUSO = ZoneInfo("America/Sao_Paulo")


def validar_uuid(valor, nome: str = "registro") -> str:
    try:
        return str(uuid.UUID(str(valor)))
    except ValueError as exc:
        raise ValidacaoError(f"Identificador de {nome} inválido.") from exc


def hoje_brasil() -> date:
    """'Hoje' no relógio do estudante (o servidor da Vercel roda em UTC)."""
    return datetime.now(FUSO).date()
