"""Valida o que a IA devolve ao gerar e ao corrigir exercícios.

Funções puras. Tudo que não passa nas regras é descartado; se nada sobra,
a operação falha sem gravar nada.
"""
import re
import unicodedata
from difflib import SequenceMatcher

from app.core.errors import IAIndisponivelError
from app.services.proposta_parser import extrair_json

TIPOS = ("multipla_escolha", "discursiva")
LETRAS = "ABCDE"
MIN_OPCOES, MAX_OPCOES = 2, 5
ENUNCIADO_MAX = 1000
OPCAO_MAX = 300
GABARITO_MAX = 1000
EXPLICACAO_MAX = 1000
FEEDBACK_MAX = 1000

_PREFIXO_OPCAO = re.compile(r"^\(?[A-Ea-e][\)\.\-:]\s+")
_LETRA = re.compile(r"^\s*(?:letra\s+)?\(?([A-Ea-e])(?:\)|\.|:|\s|$)", re.IGNORECASE)


def letra(valor, quantidade_opcoes: int) -> str | None:
    """'B', 'b', 'B)', '(b)', 'Letra B' -> 'B' (se existir entre as opções)."""
    if not isinstance(valor, str):
        return None
    achou = _LETRA.match(valor)
    if not achou:
        return None
    escolhida = achou.group(1).upper()
    return escolhida if LETRAS.index(escolhida) < quantidade_opcoes else None


def montar_exercicios(dados: dict, nivel: str, quantidade: int, fontes: list[dict]) -> list[dict]:
    itens = dados.get("exercicios")
    if not isinstance(itens, list):
        raise IAIndisponivelError("A IA devolveu os exercícios num formato inválido. Tente novamente.")

    exercicios = []
    for item in itens:
        if len(exercicios) == quantidade:
            break
        convertido = _converter(item, nivel, fontes)
        if convertido is not None:
            exercicios.append(convertido)

    if not exercicios:
        raise IAIndisponivelError("A IA não gerou nenhum exercício válido. Tente novamente.")
    return exercicios


def interpretar_correcao(texto) -> dict:
    dados = extrair_json(texto)
    if not isinstance(dados.get("correta"), bool):
        raise IAIndisponivelError("A IA não conseguiu corrigir a resposta. Tente novamente.")
    return {"correta": dados["correta"], "feedback": _texto(dados.get("feedback"), FEEDBACK_MAX)}


# ---------- internos ----------
def _converter(item, nivel: str, fontes: list[dict]) -> dict | None:
    if not isinstance(item, dict) or item.get("tipo") not in TIPOS:
        return None
    enunciado = _texto(item.get("enunciado"), ENUNCIADO_MAX)
    if not enunciado:
        return None

    opcoes = None
    if item["tipo"] == "multipla_escolha":
        opcoes = _opcoes(item.get("opcoes"))
        if opcoes is None:
            return None
        gabarito = letra(item.get("gabarito"), len(opcoes))
    else:
        gabarito = _texto(item.get("gabarito"), GABARITO_MAX)
    if not gabarito:
        return None

    return {
        "nivel": nivel,
        "tipo": item["tipo"],
        "enunciado": enunciado,
        "opcoes": opcoes,
        "gabarito": gabarito,
        "explicacao": _texto(item.get("explicacao"), EXPLICACAO_MAX) or None,
        "fontes": fontes,
    }


def _opcoes(bruto) -> list[str] | None:
    if not isinstance(bruto, list) or not MIN_OPCOES <= len(bruto) <= MAX_OPCOES:
        return None
    opcoes = [_PREFIXO_OPCAO.sub("", _texto(o, OPCAO_MAX)) for o in bruto]
    if any(not o for o in opcoes):
        return None
    if len({o.casefold() for o in opcoes}) != len(opcoes):
        return None  # alternativas repetidas
    return opcoes


def _texto(valor, limite: int) -> str:
    if not isinstance(valor, str):
        return ""
    return " ".join(valor.split())[:limite]


FRENTE_MAX = 300
VERSO_MAX = 600
REEXPLICACAO_MAX = 2000


def montar_flashcards(dados: dict, quantidade: int) -> list[dict]:
    itens = dados.get("cartoes")
    if not isinstance(itens, list):
        raise IAIndisponivelError("A IA devolveu os flashcards num formato inválido. Tente novamente.")
    cartoes, vistos = [], set()
    for item in itens:
        if len(cartoes) == quantidade:
            break
        if not isinstance(item, dict):
            continue
        frente = _texto(item.get("frente"), FRENTE_MAX)
        verso = _texto(item.get("verso"), VERSO_MAX)
        if frente and verso and frente.lower() not in vistos:
            vistos.add(frente.lower())
            cartoes.append({"frente": frente, "verso": verso})
    if not cartoes:
        raise IAIndisponivelError("A IA não gerou nenhum flashcard válido. Tente novamente.")
    return cartoes


def limpar_reexplicacao(texto) -> str:
    """Texto livre da IA (markdown). Corta o tamanho; o front exibe sem HTML e sem links."""
    if not isinstance(texto, str) or not texto.strip():
        raise IAIndisponivelError("A IA não conseguiu explicar agora. Tente novamente.")
    return texto.strip()[:REEXPLICACAO_MAX]


SIMILARIDADE_REPETIDA = 0.85  # acima disso, é a mesma pergunta com outras palavras


def _normal(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^\w\s]", " ", sem_acento.lower()).split())


def remover_repetidos(itens: list[dict], anteriores: list[str]) -> list[dict]:
    """Tira perguntas iguais ou quase iguais às que a etapa já tem (de qualquer nível) e entre si.

    A IA recebe a lista das anteriores, mas às vezes repete mesmo assim (foi o que aconteceu no
    intermediário, que trouxe uma pergunta do básico). Esta é a garantia no código.
    """
    vistas = [_normal(a) for a in anteriores if a]
    novos = []
    for item in itens:
        atual = _normal(item.get("enunciado", ""))
        if any(atual == v or SequenceMatcher(None, atual, v).ratio() >= SIMILARIDADE_REPETIDA for v in vistas):
            continue
        vistas.append(atual)
        novos.append(item)
    return novos
