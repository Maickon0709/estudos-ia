"""Limite de uso por usuário: quantas vezes por dia cada um pode usar o que custa cota.

Tipos:
- chat: mensagens para a tutora (Groq);
- ia: gerar exercícios ou flashcards, "Não entendi" e correção de resposta aberta (Groq);
- pesquisa: pesquisar materiais ou montar trilha (Tavily, 2 créditos cada).

A tentativa conta mesmo se a IA falhar depois: o limite também segura quem
fica repetindo a chamada em loop.
"""
from app.core.errors import LimiteUsoError
from app.core.validacao import hoje_brasil

TIPOS = ("chat", "ia", "pesquisa")

_O_QUE = {
    "chat": "mensagens para a tutora",
    "ia": "gerações com IA (exercícios, flashcards, explicações e correções)",
    "pesquisa": "pesquisas de materiais",
}


class UsoService:
    def __init__(self, uso_repo, limites: dict[str, int], hoje=hoje_brasil):
        self._uso = uso_repo
        self._limites = limites
        self._hoje = hoje

    def consumir(self, tipo: str) -> None:
        if tipo not in TIPOS:
            raise ValueError(f"Tipo de uso desconhecido: {tipo}")
        limite = self._limites[tipo]
        if not self._uso.consumir(tipo, limite):
            raise LimiteUsoError(
                f"Você chegou ao limite de hoje: {limite} {_O_QUE[tipo]}. "
                "O contador volta a zero à meia-noite (horário de Brasília)."
            )

    def resumo(self) -> dict:
        usados = self._uso.usados(self._hoje().isoformat())
        return {
            tipo: {"usado": usados.get(tipo, 0), "limite": self._limites[tipo]}
            for tipo in TIPOS
        }
