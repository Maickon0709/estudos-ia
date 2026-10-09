"""Cliente da busca na web (Tavily).

Contrato usado pelo resto do sistema:
    buscar(consulta, dominios=None, excluir=None, max_resultados=5) -> list[ResultadoBusca]

Cada busca básica custa 1 crédito do plano (o gratuito tem 1.000 por mês),
então o service chama poucas vezes. Trocar de provedor = nova classe com o
mesmo método. Nenhum erro vaza chave ou corpo de resposta.
"""
from dataclasses import dataclass

import httpx

from app.core.errors import BuscaIndisponivelError

TAVILY_URL = "https://api.tavily.com/search"
TRECHO_MAX = 300


@dataclass(frozen=True)
class ResultadoBusca:
    titulo: str
    url: str
    trecho: str


class TavilyClient:
    def __init__(
        self,
        api_key: str | None,
        timeout: float = 20.0,
        http_client: httpx.Client | None = None,
    ):
        self._api_key = api_key
        self._timeout = timeout
        self._http = http_client  # injetável nos testes

    def buscar(
        self,
        consulta: str,
        dominios: list[str] | None = None,
        excluir: list[str] | None = None,
        max_resultados: int = 5,
    ) -> list[ResultadoBusca]:
        if not self._api_key:
            raise BuscaIndisponivelError("A busca não está configurada neste servidor.")

        corpo = {
            "query": consulta,
            "search_depth": "basic",
            "max_results": max_resultados,
            "include_answer": False,
            "include_raw_content": False,
            "include_images": False,
        }
        if dominios:
            corpo["include_domains"] = dominios
        if excluir:
            corpo["exclude_domains"] = excluir

        cabecalhos = {"Authorization": f"Bearer {self._api_key}"}
        try:
            resposta = self._post(corpo, cabecalhos)
        except httpx.HTTPError as exc:
            raise BuscaIndisponivelError("Não foi possível falar com a busca agora.") from exc

        if resposta.status_code == 429:
            raise BuscaIndisponivelError("Limite de uso da busca atingido. Tente mais tarde.")
        if resposta.status_code in (401, 403):
            raise BuscaIndisponivelError("A busca recusou a chave configurada neste servidor.")
        if resposta.status_code >= 400:
            raise BuscaIndisponivelError("A busca retornou um erro. Tente novamente.")

        try:
            itens = resposta.json()["results"]
            if not isinstance(itens, list):
                raise TypeError
        except (ValueError, KeyError, TypeError) as exc:
            raise BuscaIndisponivelError("Resposta inesperada da busca.") from exc

        return [r for r in (self._converter(i) for i in itens) if r is not None]

    @staticmethod
    def _converter(item) -> ResultadoBusca | None:
        if not isinstance(item, dict):
            return None
        url = item.get("url")
        if not isinstance(url, str) or not url.strip():
            return None
        titulo = item.get("title")
        trecho = item.get("content")
        return ResultadoBusca(
            titulo=titulo.strip() if isinstance(titulo, str) and titulo.strip() else url,
            url=url.strip(),
            trecho=(trecho.strip()[:TRECHO_MAX] if isinstance(trecho, str) else ""),
        )

    def _post(self, corpo: dict, cabecalhos: dict) -> httpx.Response:
        if self._http is not None:
            return self._http.post(TAVILY_URL, json=corpo, headers=cabecalhos)
        with httpx.Client(timeout=self._timeout) as cliente:
            return cliente.post(TAVILY_URL, json=corpo, headers=cabecalhos)
