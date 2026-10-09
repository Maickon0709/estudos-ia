"""Teste manual com as chaves REAIS (sem banco e sem login).

Uso:
    python -m scripts.smoke_busca "crase na língua portuguesa"

Mostra o que a pesquisa devolve, o que foi descartado e se o YouTube foi
verificado. Gasta 2 créditos do Tavily e 1-2 unidades de cota do YouTube.
"""
import json
import sys

from app.config import Config
from app.core.errors import AppError
from app.integrations.link_validator import LinkValidator
from app.integrations.search_client import TavilyClient
from app.integrations.youtube_client import YouTubeClient
from app.services.pesquisa_service import PesquisaService


def main() -> int:
    if len(sys.argv) < 2:
        print('Uso: python -m scripts.smoke_busca "o que estudar"')
        return 2
    if not Config.TAVILY_API_KEY:
        print("Falta TAVILY_API_KEY no .env.")
        return 1
    if not Config.YOUTUBE_API_KEY:
        print("Aviso: sem YOUTUBE_API_KEY, os vídeos sairão como 'nao_verificado'.\n")

    servico = PesquisaService(
        None,
        TavilyClient(Config.TAVILY_API_KEY),
        YouTubeClient(Config.YOUTUBE_API_KEY),
        LinkValidator(),
    )
    try:
        resultado = servico.buscar_recursos(" ".join(sys.argv[1:]))
    except AppError as erro:
        print(f"Erro ({erro.codigo}): {erro.mensagem}")
        return 1
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    print(f"\n{len(resultado['recursos'])} recursos | "
          f"{resultado['descartados']} descartados | "
          f"youtube verificado: {resultado['youtube_verificado']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
