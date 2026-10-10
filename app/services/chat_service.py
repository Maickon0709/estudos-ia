"""Regras do chat por categoria. Não sabe de HTTP, de Supabase nem de Groq."""
from collections.abc import Iterator

from app.core.errors import AppError, IAIndisponivelError, ValidacaoError
from app.services.prompts import prompt_tutor

HISTORICO_MAX = 20   # mensagens anteriores enviadas à IA (controla custo e contexto)
MENSAGEM_MAX = 4000  # caracteres por mensagem do usuário
LISTAGEM_MAX = 100   # mensagens devolvidas em GET /mensagens


class ChatService:
    def __init__(self, categoria_service, mensagem_repo, llm):
        self._categorias = categoria_service
        self._mensagens = mensagem_repo
        self._llm = llm

    def enviar(self, categoria_id: str, texto) -> dict:
        texto = self._validar_texto(texto)
        # Valida o id e garante que a categoria existe e é do usuário (RLS).
        categoria = self._categorias.obter(categoria_id)

        contexto = self._contexto(categoria, texto)

        # Se a IA falhar, levanta erro AQUI e nada é gravado: o histórico nunca
        # fica com uma pergunta órfã, sem resposta.
        resposta = self._llm.responder(contexto)

        pergunta_salva, resposta_salva = self._mensagens.criar_par(
            categoria["id"], texto, resposta
        )
        return {"pergunta": pergunta_salva, "resposta": resposta_salva}

    def enviar_stream(self, categoria_id: str, texto) -> Iterator[dict]:
        """Como `enviar`, mas devolve eventos conforme a IA escreve:
        {"tipo": "delta", "texto"}... e no fim {"tipo": "fim", "pergunta", "resposta"}
        ou {"tipo": "erro", "erro", "mensagem"}.

        Validação e categoria são checadas AGORA (antes do primeiro byte), para
        erros 400/404 saírem como resposta HTTP normal. A gravação só acontece
        depois que o texto chegou inteiro: falha no meio não deixa nada pela metade.
        """
        texto = self._validar_texto(texto)
        categoria = self._categorias.obter(categoria_id)
        return self._transmitir(categoria["id"], texto, self._contexto(categoria, texto))

    def _transmitir(self, categoria_id: str, texto: str, contexto: list[dict]) -> Iterator[dict]:
        partes: list[str] = []
        try:
            for pedaco in self._llm.responder_stream(contexto):
                partes.append(pedaco)
                yield {"tipo": "delta", "texto": pedaco}
            resposta = "".join(partes).strip()
            if not resposta:
                raise IAIndisponivelError("A IA devolveu uma resposta vazia.")
            pergunta_salva, resposta_salva = self._mensagens.criar_par(categoria_id, texto, resposta)
        except AppError as erro:
            yield {"tipo": "erro", "erro": erro.codigo, "mensagem": erro.mensagem}
            return
        yield {"tipo": "fim", "pergunta": pergunta_salva, "resposta": resposta_salva}

    def _contexto(self, categoria: dict, texto: str) -> list[dict]:
        historico = self._mensagens.listar_recentes(categoria["id"], HISTORICO_MAX)
        contexto = [{"role": "system", "content": prompt_tutor(categoria["nome"])}]
        contexto += [{"role": m["papel"], "content": m["conteudo"]} for m in historico]
        contexto.append({"role": "user", "content": texto})
        return contexto

    def historico(self, categoria_id: str) -> list[dict]:
        categoria = self._categorias.obter(categoria_id)
        return self._mensagens.listar_recentes(categoria["id"], LISTAGEM_MAX)

    @staticmethod
    def _validar_texto(texto) -> str:
        if not isinstance(texto, str) or not texto.strip():
            raise ValidacaoError("A mensagem é obrigatória.")
        texto = texto.strip()
        if len(texto) > MENSAGEM_MAX:
            raise ValidacaoError(f"A mensagem pode ter no máximo {MENSAGEM_MAX} caracteres.")
        return texto
