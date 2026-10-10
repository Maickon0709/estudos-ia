"""Divide o texto de um material em trechos para a busca (função pura).

Por que trechos: a IA não recebe o livro inteiro (custo e limite de contexto), só
os pedaços que mais combinam com a pergunta. O trecho precisa ser grande o bastante
para ter sentido sozinho e pequeno o bastante para caberem vários no prompt.

- Um trecho nunca atravessa páginas: assim a citação "p. 12" é sempre verdadeira.
- Quebra preferencialmente entre parágrafos; parágrafo enorme é quebrado entre palavras.
- Cada trecho repete o finalzinho do anterior (sobreposição), para uma frase cortada
  ao meio ainda ser achada inteira em algum deles.
"""
TAMANHO = 1200
SOBREPOSICAO = 150


def dividir(paginas: list[tuple[int | None, str]], tamanho: int = TAMANHO,
            sobreposicao: int = SOBREPOSICAO) -> list[dict]:
    trechos: list[dict] = []
    for pagina, texto in paginas:
        for conteudo in _dividir_texto(texto, tamanho, sobreposicao):
            trechos.append({"ordem": len(trechos) + 1, "pagina": pagina, "conteudo": conteudo})
    return trechos


def _dividir_texto(texto: str, tamanho: int, sobreposicao: int) -> list[str]:
    pedacos = []
    for paragrafo in texto.split("\n"):
        paragrafo = paragrafo.strip()
        if not paragrafo:
            continue
        pedacos.extend(_quebrar_por_palavras(paragrafo, tamanho) if len(paragrafo) > tamanho else [paragrafo])

    saida: list[str] = []
    atual = ""
    for pedaco in pedacos:
        if atual and len(atual) + 1 + len(pedaco) > tamanho:
            saida.append(atual)
            atual = _final(atual, sobreposicao)
            atual = f"{atual} {pedaco}".strip() if atual else pedaco
        else:
            atual = f"{atual}\n{pedaco}" if atual else pedaco
    if atual:
        saida.append(atual)
    return saida


def _quebrar_por_palavras(texto: str, tamanho: int) -> list[str]:
    partes, atual = [], ""
    for palavra in texto.split(" "):
        while len(palavra) > tamanho:  # "palavra" gigante (ex.: sequência sem espaço)
            if atual:
                partes.append(atual)
                atual = ""
            partes.append(palavra[:tamanho])
            palavra = palavra[tamanho:]
        if atual and len(atual) + 1 + len(palavra) > tamanho:
            partes.append(atual)
            atual = palavra
        else:
            atual = f"{atual} {palavra}" if atual else palavra
    if atual:
        partes.append(atual)
    return partes


def _final(texto: str, quantos: int) -> str:
    """Últimos `quantos` caracteres, começando numa palavra inteira."""
    if quantos <= 0 or len(texto) <= quantos:
        return ""
    corte = texto[-quantos:]
    espaco = corte.find(" ")
    return corte[espaco + 1:] if espaco != -1 else ""
