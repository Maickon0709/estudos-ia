import httpx
import pytest

from app.core.errors import IAIndisponivelError
from app.integrations.llm_client import GROQ_URL, GroqClient

MENSAGENS = [{"role": "user", "content": "Oi"}]
CHAVE = "gsk_chave_secreta_123"


def cliente(handler, api_key=CHAVE):
    http = httpx.Client(transport=httpx.MockTransport(handler))
    return GroqClient(api_key, "modelo-x", http_client=http)


def resposta_ok(texto="Olá!"):
    return httpx.Response(200, json={"choices": [{"message": {"content": texto}}]})


def test_sucesso_envia_modelo_mensagens_e_chave():
    vistos = {}

    def handler(request: httpx.Request):
        vistos["url"] = str(request.url)
        vistos["auth"] = request.headers["Authorization"]
        vistos["corpo"] = request.read()
        return resposta_ok("  Olá!  ")

    assert cliente(handler).responder(MENSAGENS) == "Olá!"
    assert vistos["url"] == GROQ_URL
    assert vistos["auth"] == f"Bearer {CHAVE}"
    assert b'"modelo-x"' in vistos["corpo"]


def test_sem_chave_nao_faz_chamada():
    chamou = []

    def handler(request):
        chamou.append(1)
        return resposta_ok()

    with pytest.raises(IAIndisponivelError):
        cliente(handler, api_key=None).responder(MENSAGENS)
    assert chamou == []


def test_limite_de_uso_429():
    with pytest.raises(IAIndisponivelError, match="Limite"):
        cliente(lambda r: httpx.Response(429)).responder(MENSAGENS)


def test_erro_do_servidor_500():
    with pytest.raises(IAIndisponivelError):
        cliente(lambda r: httpx.Response(500, text="boom")).responder(MENSAGENS)


def test_corpo_que_nao_e_json():
    with pytest.raises(IAIndisponivelError, match="inesperada"):
        cliente(lambda r: httpx.Response(200, text="<html>")).responder(MENSAGENS)


def test_json_sem_choices():
    with pytest.raises(IAIndisponivelError, match="inesperada"):
        cliente(lambda r: httpx.Response(200, json={"x": 1})).responder(MENSAGENS)


def test_resposta_vazia():
    with pytest.raises(IAIndisponivelError, match="vazia"):
        cliente(lambda r: resposta_ok("   ")).responder(MENSAGENS)


def test_timeout_vira_erro_de_dominio():
    def handler(request):
        raise httpx.ConnectTimeout("lento", request=request)

    with pytest.raises(IAIndisponivelError):
        cliente(handler).responder(MENSAGENS)


def test_erros_nunca_vazam_a_chave():
    with pytest.raises(IAIndisponivelError) as info:
        cliente(lambda r: httpx.Response(500, text=CHAVE)).responder(MENSAGENS)
    assert CHAVE not in str(info.value)
