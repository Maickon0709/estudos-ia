"""Materiais do aluno (PDF, Word, PowerPoint, texto) que a tutora usa no chat.

Fluxo do envio: confere a categoria -> tira o texto -> divide em trechos -> grava
tudo numa função SQL atômica. Se qualquer passo falhar, nada é gravado.
Não sabe de HTTP nem de Supabase.
"""
import re
import unicodedata

from app.core.errors import NaoEncontradoError, ValidacaoError
from app.core.validacao import validar_uuid
from app.services.extrator import extrair_texto
from app.services.trechos import dividir

NOME_MAX = 200
TRECHOS_NO_CHAT = 5


def nome_limpo(nome_arquivo) -> str:
    """Só o nome do arquivo, sem pasta e sem caracteres de controle (vai aparecer na tela)."""
    nome = str(nome_arquivo or "").replace("\\", "/").rsplit("/", 1)[-1]
    nome = "".join(c for c in nome if unicodedata.category(c)[0] != "C")
    nome = re.sub(r"\s+", " ", nome).strip()
    if len(nome) > NOME_MAX:
        base, ponto, extensao = nome.rpartition(".")
        nome = (base[: NOME_MAX - len(extensao) - 1] + ponto + extensao) if ponto and len(extensao) <= 10 \
            else nome[:NOME_MAX]
    return nome or "material"


class DocumentoService:
    def __init__(self, categoria_service, documento_repo):
        self._categorias = categoria_service
        self._documentos = documento_repo

    def listar(self, categoria_id: str) -> list[dict]:
        categoria = self._categorias.obter(categoria_id)
        return self._documentos.listar(categoria["id"])

    def enviar(self, categoria_id: str, nome_arquivo, conteudo: bytes) -> dict:
        categoria = self._categorias.obter(categoria_id)  # 404 antes de gastar CPU lendo o arquivo
        nome = nome_limpo(nome_arquivo)
        extraido = extrair_texto(nome, conteudo)
        trechos = dividir(extraido.paginas)
        if not trechos:
            raise ValidacaoError("Esse arquivo está vazio.")
        return self._documentos.criar(
            categoria["id"], nome, extraido.tipo, extraido.total_paginas, extraido.truncado, trechos
        )

    def remover(self, documento_id: str) -> None:
        if not self._documentos.remover(validar_uuid(documento_id, "material")):
            raise NaoEncontradoError("Material não encontrado.")

    def trechos_para(self, categoria_id: str, pergunta: str, limite: int = TRECHOS_NO_CHAT) -> list[dict]:
        """Os trechos dos materiais da categoria que mais combinam com a pergunta."""
        return self._documentos.buscar(categoria_id, pergunta, limite)
