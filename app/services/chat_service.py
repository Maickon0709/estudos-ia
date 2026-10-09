"""Regras do chat por categoria. Não sabe de HTTP, de Supabase nem de Groq."""
from app.core.errors import ValidacaoError
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

        historico = self._mensagens.listar_recentes(categoria["id"], HISTORICO_MAX)
        contexto = [{"role": "system", "content": prompt_tutor(categoria["nome"])}]
        contexto += [{"role": m["papel"], "content": m["conteudo"]} for m in historico]
        contexto.append({"role": "user", "content": texto})

        # Se a IA falhar, levanta erro AQUI e nada é gravado: o histórico nunca
        # fica com uma pergunta órfã, sem resposta.
        resposta = self._llm.responder(contexto)

        pergunta_salva, resposta_salva = self._mensagens.criar_par(
            categoria["id"], texto, resposta
        )
        return {"pergunta": pergunta_salva, "resposta": resposta_salva}

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
