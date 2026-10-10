"""O que o estudante está pedindo no chat, por palavras-chave (sem IA, sem custo, testável).

Serve para duas coisas:
- `acao_sugerida`: quando ele pede algo que SÓ a plataforma cria (trilha, exercícios salvos), a tela
  mostra o botão certo. A tutora não cria nada sozinha; sem isso, o pedido "faça uma trilha" morria
  no chat e a aba Trilha continuava vazia.
- `pede_visao_geral`: perguntas sobre o conjunto dos materiais ("analise", "resuma", "sobre o que é")
  não têm palavras do conteúdo, então a busca por relevância acharia trechos ao acaso.
"""
import re
import unicodedata


def _normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


_TRILHA = re.compile(
    r"\btrilhas?\b"
    r"|\b(plano|roteiro|cronograma|cronogramas|planejamento) de estudos?\b"
    r"|\bmont(a|e|ar|ando)\b.{0,30}\b(plano|roteiro|cronograma|curso|caminho)\b"
)
_PRATICAR = re.compile(
    r"\b(exercicios?|questao|questoes|simulados?|flashcards?|lista de exercicios|provas? para treinar)\b"
)
_VISAO_GERAL = re.compile(
    r"\b(analis\w*|resum\w*|sintetiz\w*|panorama|visao geral)\b"
    r"|\bsobre o que\b|\bdo que (se )?trat\w*\b|\bqual (e )?o assunto\b|\bque assunto\b"
    r"|\b(materiais|arquivos|pdfs|documentos|apostilas|slides|conteudos) que (eu )?(ja )?(te |lhe )?"
    r"(mandei|enviei|dei|passei|subi|carreguei)\b"
    r"|\btodos? os (materiais|arquivos|pdfs|documentos|conteudos)\b"
    r"|\b(meus|os) (materiais|arquivos|pdfs|documentos)\b"
)


def acao_sugerida(texto: str) -> str | None:
    """'trilha', 'praticar' ou None. Trilha vem primeiro: "trilha com exercícios" é pedido de trilha."""
    normal = _normalizar(texto)
    if _TRILHA.search(normal):
        return "trilha"
    if _PRATICAR.search(normal):
        return "praticar"
    return None


def pede_visao_geral(texto: str) -> bool:
    return bool(_VISAO_GERAL.search(_normalizar(texto)))
