"""Partes dos arquivos do aluno para montar trilha, exercícios e flashcards. Não sabe de HTTP nem de Supabase.

Um PDF grande tem centenas de trechos; a IA não precisa (nem cabe) ver tudo. Então o arquivo é
dividido em PARTES (intervalos de trechos seguidos do mesmo arquivo), cada uma com um número e o
começo do texto. A IA organiza as etapas escolhendo partes SÓ PELO NÚMERO, como já faz com os links.
"""
import math

MAX_PARTES = 40           # partes oferecidas à IA (controla o tamanho do pedido)
PREVIA_NA_LISTA = 160     # caracteres do começo de cada parte mostrados à IA
FONTES_DE_MATERIAL = 3    # partes usadas para gerar exercícios/flashcards de uma etapa
TEXTO_POR_FONTE = 3500    # caracteres de cada parte enviados para gerar exercícios


def montar_partes(previa: list[dict], max_partes: int = MAX_PARTES) -> list[dict]:
    """Agrupa os trechos (já em ordem) em no máximo `max_partes` partes, sem misturar arquivos.

    Cada parte: documento_id, nome, ordem_inicio, ordem_fim, pagina_inicio, pagina_fim, previa.
    """
    if not previa or max_partes < 1:
        return []
    por_documento: dict[str, list[dict]] = {}
    for trecho in previa:
        por_documento.setdefault(str(trecho["documento_id"]), []).append(trecho)

    # Tamanho da parte para caber no teto. Cada arquivo arredonda para cima (+1 parte, no máximo),
    # então: partes <= N/tamanho + arquivos <= max_partes quando tamanho >= N / (max_partes - arquivos).
    tamanho = max(1, math.ceil(len(previa) / max(1, max_partes - len(por_documento))))
    partes = []
    for documento_id, trechos in por_documento.items():
        for i in range(0, len(trechos), tamanho):
            grupo = trechos[i:i + tamanho]
            paginas = [t["pagina"] for t in grupo if t.get("pagina")]
            partes.append({
                "documento_id": documento_id,
                "nome": grupo[0].get("nome") or "material",
                "ordem_inicio": grupo[0]["ordem"],
                "ordem_fim": grupo[-1]["ordem"],
                "pagina_inicio": min(paginas) if paginas else None,
                "pagina_fim": max(paginas) if paginas else None,
                "previa": " ".join(" ".join(t.get("previa") or "" for t in grupo).split())[:PREVIA_NA_LISTA],
            })
    return partes[:max_partes]


def rotulo(material: dict) -> str:
    """'aula.pdf, p. 3-5', 'aula.pdf, p. 4' ou só 'resumo.docx' (texto sem páginas)."""
    nome = material.get("nome") or "material"
    inicio, fim = material.get("pagina_inicio"), material.get("pagina_fim")
    if inicio and fim and fim != inicio:
        return f"{nome}, p. {inicio}-{fim}"
    if inicio:
        return f"{nome}, p. {inicio}"
    return nome


def fontes_de_material(etapa_repo, etapa_id: str) -> list[dict]:
    """O texto das partes de arquivo ligadas à etapa, para a IA gerar exercícios e flashcards.

    Cada fonte: {"titulo": "aula.pdf, p. 3-5", "conteudo": "..."}. Arquivo apagado = sem fonte.
    """
    fontes = []
    for material in etapa_repo.materiais(etapa_id)[:FONTES_DE_MATERIAL]:
        trechos = etapa_repo.texto_material(material["documento_id"], material["ordem_inicio"], material["ordem_fim"])
        texto = "\n".join(t.get("conteudo") or "" for t in trechos).strip()
        if texto:
            fontes.append({"titulo": rotulo(material), "conteudo": texto[:TEXTO_POR_FONTE]})
    return fontes
