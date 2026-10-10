"""Flashcards por etapa, gerados pela IA a partir das fontes verificadas.

A revisão reaproveita a mesma regra de revisão espaçada dos exercícios:
lembrou -> intervalo cresce (3, 7, 15, 30 dias); esqueceu -> volta amanhã;
5 acertos seguidos -> dominado.
"""
from app.core.errors import NaoEncontradoError, ValidacaoError
from app.core.validacao import hoje_brasil, validar_uuid
from app.services.exercicio_parser import montar_flashcards
from app.services.materiais_trilha import fontes_de_material
from app.services.prompts import mensagem_flashcards, prompt_flashcards
from app.services.proposta_parser import extrair_json
from app.services.regras.revisao import proxima_revisao

QUANTIDADE_PADRAO = 6
QUANTIDADE_MAX = 10


class FlashcardService:
    def __init__(self, etapa_repo, trilha_repo, flashcard_repo, llm, hoje=hoje_brasil):
        self._etapas = etapa_repo
        self._trilhas = trilha_repo
        self._flashcards = flashcard_repo
        self._llm = llm
        self._hoje = hoje

    def gerar(self, etapa_id: str, quantidade=None) -> list[dict]:
        quantidade = _validar_quantidade(quantidade)
        etapa = self._obter_etapa(etapa_id)
        trilha = self._trilhas.obter(etapa["trilha_id"]) or {}
        fontes = [
            {"titulo": r["titulo"], "trecho": r.get("trecho")}
            for r in self._etapas.recursos(etapa["id"])
        ] + fontes_de_material(self._etapas, etapa["id"])
        resposta = self._llm.responder([
            {"role": "system", "content": prompt_flashcards()},
            {"role": "user", "content": mensagem_flashcards(trilha.get("titulo", ""), etapa, quantidade, fontes)},
        ])
        cartoes = montar_flashcards(extrair_json(resposta), quantidade)
        return self._flashcards.criar_varios(etapa["id"], cartoes)

    def listar(self, etapa_id: str) -> list[dict]:
        return self._flashcards.listar(self._obter_etapa(etapa_id)["id"])

    def pendentes(self) -> list[dict]:
        return self._flashcards.pendentes(self._hoje().isoformat())

    def revisar(self, flashcard_id: str, lembrou) -> dict:
        if not isinstance(lembrou, bool):
            raise ValidacaoError("Informe se você lembrou (true ou false).")
        flashcard_id = validar_uuid(flashcard_id, "flashcard")
        cartao = self._flashcards.obter(flashcard_id)
        if cartao is None:
            raise NaoEncontradoError("Flashcard não encontrado.")
        # O cartão sempre "está em revisão": lembrar faz o intervalo crescer.
        revisao = proxima_revisao(cartao, lembrou, self._hoje())
        return self._flashcards.revisar(flashcard_id, lembrou, revisao)

    def _obter_etapa(self, etapa_id: str) -> dict:
        etapa = self._etapas.obter(validar_uuid(etapa_id, "etapa"))
        if etapa is None:
            raise NaoEncontradoError("Etapa não encontrada.")
        return etapa


def _validar_quantidade(quantidade) -> int:
    if quantidade is None:
        return QUANTIDADE_PADRAO
    if isinstance(quantidade, bool) or not isinstance(quantidade, int) or not 1 <= quantidade <= QUANTIDADE_MAX:
        raise ValidacaoError(f"Quantidade deve ser um número de 1 a {QUANTIDADE_MAX}.")
    return quantidade
