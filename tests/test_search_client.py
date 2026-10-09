import json

import httpx
import pytest

from app.core.errors import BuscaIndisponivelError
from app.integrations.search_client import TAVILY_URL, TRECHO_MAX, ResultadoBusca, TavilyClient

CHAVE = "tvly-chave-secreta-123"


def cliente(handler, api_key=CHAVE):
    http = httpx.Client(transport=httpx.MockTransport(handler))
    return TavilyClient(api_key, http_client=http)


def corpo_ok(*itens):
    return httpx.Response(200, json={"results": list(itens)})


def test_sucesso_converte_resultados():
    def handler(request):
        return corpo_ok(
            {"title": " Crase ", "url": "https://a.com/crase", "content": " Explica a crase ", "score": 0.9},
            {"title": "Outro", "url": "https://b.com", "content": "x"},
        )

    resultados = cliente(handler).buscar("crase")
    assert resultados == [
        ResultadoBusca("Crase", "https://a.com/crase", "Explica a crase"),
        ResultadoBusca("Outro", "https://b.com", "x"),
    ]


def test_envia_url_chave_e_parametros_basicos():
    visto = {}

    def handler(request):
        visto["url"] = str(request.url)
        visto["auth"] = request.headers["Authorization"]
        visto["corpo"] = json.loads(request.read())
        return corpo_ok()

    cliente(handler).buscar("crase", max_resultados=7)
    assert visto["url"] == TAVILY_URL
    assert visto["auth"] == f"Bearer {CHAVE}"
    assert visto["corpo"]["query"] == "crase"
    assert visto["corpo"]["max_results"] == 7
    assert visto["corpo"]["search_depth"] == "basic"  # 1 crédito, não 2
    assert visto["corpo"]["include_answer"] is False
    assert "include_domains" not in visto["corpo"]
    assert "exclude_domains" not in visto["corpo"]


def test_filtros_de_dominio_so_vao_quando_informados():
    visto = {}

    def handler(request):
        visto["corpo"] = json.loads(request.read())
        return corpo_ok()

    cliente(handler).buscar("x", dominios=["youtube.com"], excluir=["spam.com"])
    assert visto["corpo"]["include_domains"] == ["youtube.com"]
    assert visto["corpo"]["exclude_domains"] == ["spam.com"]


def test_ignora_itens_sem_url_ou_malformados_e_limita_trecho():
    def handler(request):
        return corpo_ok(
            "texto solto",
            {"title": "sem url", "content": "x"},
            {"title": "vazio", "url": "   "},
            {"url": "https://ok.com", "content": "a" * 1000},
        )

    resultados = cliente(handler).buscar("x")
    assert len(resultados) == 1
    assert resultados[0].titulo == "https://ok.com"  # sem título: usa a URL
    assert len(resultados[0].trecho) == TRECHO_MAX


def test_sem_chave_nao_faz_chamada():
    chamou = []

    def handler(request):
        chamou.append(1)
        return corpo_ok()

    with pytest.raises(BuscaIndisponivelError):
        cliente(handler, api_key=None).buscar("x")
    assert chamou == []


@pytest.mark.parametrize("status,trecho", [(429, "Limite"), (401, "recusou"), (403, "recusou"), (500, "erro")])
def test_status_de_erro(status, trecho):
    with pytest.raises(BuscaIndisponivelError, match=trecho):
        cliente(lambda r: httpx.Response(status)).buscar("x")


@pytest.mark.parametrize(
    "resposta",
    [
        httpx.Response(200, text="<html>"),
        httpx.Response(200, json={"x": 1}),
        httpx.Response(200, json={"results": "nao-e-lista"}),
    ],
)
def test_resposta_inesperada(resposta):
    with pytest.raises(BuscaIndisponivelError, match="inesperada"):
        cliente(lambda r: resposta).buscar("x")


def test_timeout_vira_erro_de_dominio():
    def handler(request):
        raise httpx.ConnectTimeout("lento", request=request)

    with pytest.raises(BuscaIndisponivelError):
        cliente(handler).buscar("x")


def test_erros_nunca_vazam_a_chave():
    with pytest.raises(BuscaIndisponivelError) as info:
        cliente(lambda r: httpx.Response(500, text=CHAVE)).buscar("x")
    assert CHAVE not in str(info.value)
