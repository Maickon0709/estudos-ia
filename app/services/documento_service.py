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
from app.services.regras.intencao import pede_visao_geral
from app.services.trechos import dividir

NOME_MAX = 200
TRECHOS_NO_CHAT = 5
# Visão geral ("resuma os materiais"): amostra dos primeiros trechos de cada arquivo.
AMOSTRA_POR_DOCUMENTO = 2
DOCUMENTOS_NA_AMOSTRA = 10


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

    def contexto_para(self, categoria_id: str, pergunta: str) -> dict:
        """O que a tutora precisa saber dos materiais para responder a esta pergunta.

        - `inventario`: TODOS os arquivos da categoria (nome, tipo, páginas). Sem isso a IA só
          enxergava os 5 trechos da busca e achava que eles eram tudo o que o aluno enviou.
        - `trechos`: os mais relevantes para a pergunta; numa pergunta sobre o conjunto
          ("analise os materiais"), também uma amostra do começo de cada arquivo.
        - `visao_geral`: se a amostra entrou.
        Categoria sem materiais: nada (e nenhuma busca à toa no banco).
        """
        inventario = self._documentos.listar(categoria_id)
        if not inventario:
            return {"inventario": [], "trechos": [], "visao_geral": False}
        trechos = self._documentos.buscar(categoria_id, pergunta, TRECHOS_NO_CHAT)
        visao_geral = pede_visao_geral(pergunta) or not trechos
        if visao_geral:
            trechos = _juntar(trechos, self._amostra(categoria_id))
        return {"inventario": inventario, "trechos": trechos, "visao_geral": visao_geral}

    def _amostra(self, categoria_id: str) -> list[dict]:
        amostra, documentos = [], []
        for trecho in self._documentos.primeiros_trechos(categoria_id, AMOSTRA_POR_DOCUMENTO):
            if trecho["documento_id"] not in documentos:
                if len(documentos) == DOCUMENTOS_NA_AMOSTRA:
                    continue
                documentos.append(trecho["documento_id"])
            amostra.append(trecho)
        return amostra


def _juntar(relevantes: list[dict], amostra: list[dict]) -> list[dict]:
    """Relevantes primeiro, depois a amostra, sem repetir o mesmo trecho."""
    vistos = {(t.get("documento_id"), t.get("conteudo")) for t in relevantes}
    return relevantes + [t for t in amostra if (t.get("documento_id"), t.get("conteudo")) not in vistos]
