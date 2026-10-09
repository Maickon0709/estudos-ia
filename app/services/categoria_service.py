"""Regras de negócio das categorias. Não sabe nada de HTTP nem de Supabase."""
import re
import uuid

from app.core.errors import NaoEncontradoError, ValidacaoError

NOME_MAX = 80


class CategoriaService:
    def __init__(self, repositorio):
        self._repo = repositorio

    def listar(self) -> list[dict]:
        return self._repo.listar()

    def obter(self, categoria_id: str) -> dict:
        categoria = self._repo.obter(self._validar_id(categoria_id))
        if categoria is None:
            raise NaoEncontradoError("Categoria não encontrada.")
        return categoria

    def criar(self, user_id: str, nome) -> dict:
        return self._repo.criar(user_id, self._normalizar_nome(nome))

    def renomear(self, categoria_id: str, nome) -> dict:
        categoria = self._repo.renomear(
            self._validar_id(categoria_id), self._normalizar_nome(nome)
        )
        if categoria is None:
            raise NaoEncontradoError("Categoria não encontrada.")
        return categoria

    def remover(self, categoria_id: str) -> None:
        if not self._repo.remover(self._validar_id(categoria_id)):
            raise NaoEncontradoError("Categoria não encontrada.")

    # ---------- validações ----------
    @staticmethod
    def _normalizar_nome(nome) -> str:
        if not isinstance(nome, str):
            raise ValidacaoError("O nome da categoria é obrigatório.")
        limpo = re.sub(r"\s+", " ", nome).strip()
        if not limpo:
            raise ValidacaoError("O nome da categoria é obrigatório.")
        if len(limpo) > NOME_MAX:
            raise ValidacaoError(f"O nome pode ter no máximo {NOME_MAX} caracteres.")
        return limpo

    @staticmethod
    def _validar_id(categoria_id: str) -> str:
        try:
            return str(uuid.UUID(str(categoria_id)))
        except ValueError as exc:
            raise ValidacaoError("Identificador de categoria inválido.") from exc
