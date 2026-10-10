import json

import httpx
import pytest

from app.core import auth, dependencies
from app.core.errors import IAIndisponivelError, NaoAutenticadoError, NaoEncontradoError, ValidacaoError
from app.integrations.llm_client import GroqClient
from app.services.categoria_service import CategoriaService
from app.services.chat_service import ChatService
from tests.fakes import LLMFalso, MensagemRepoFalso
from tests.test_categoria_service import RepoFalso

MENSAGENS = [{"role": "user", "content": "Oi"}]


# ---------- cliente da IA ----------
def sse(*pedacos, fim=True):
    linhas = [f'data: {json.dumps({"choices": [{"delta": {"content": p}}]})}' for p in pedacos]
    if fim:
        linhas.append("data: [DONE]")
    return "\n\n".join(linhas) + "\n\n"


def groq(handler, chave="gsk_x"):
    return GroqClient(chave, "modelo", http_client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_stream_entrega_os_pedacos_e_pede_stream():
    vistos = {}

    def handler(request):
        vistos["corpo"] = json.loads(request.read())
        return httpx.Response(200, text=sse("Olá", ", tudo", " bem?"))

    assert list(groq(handler).responder_stream(MENSAGENS)) == ["Olá", ", tudo", " bem?"]
    assert vistos["corpo"]["stream"] is True


def test_stream_ignora_linhas_vazias_e_pedacos_sem_conteudo():
    corpo = 'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n: ping\n\n' + sse("A")
    assert list(groq(lambda r: httpx.Response(200, text=corpo)).responder_stream(MENSAGENS)) == ["A"]


@pytest.mark.parametrize("resposta,trecho", [
    (httpx.Response(429), "Limite"),
    (httpx.Response(500), "erro"),
    (httpx.Response(200, text="data: {lixo}\n\n"), "inesperada"),
    (httpx.Response(200, text="data: [DONE]\n\n"), "vazia"),
])
def test_stream_erros_viram_ia_indisponivel(resposta, trecho):
    with pytest.raises(IAIndisponivelError, match=trecho):
        list(groq(lambda r: resposta).responder_stream(MENSAGENS))


def test_stream_sem_chave_nao_chama():
    chamou = []
    with pytest.raises(IAIndisponivelError):
        list(groq(lambda r: chamou.append(1), chave=None).responder_stream(MENSAGENS))
    assert chamou == []


# ---------- service ----------
@pytest.fixture
def servico():
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "Inglês")
    mensagens = MensagemRepoFalso()
    llm = LLMFalso("Resposta completa da IA.")
    return ChatService(CategoriaService(categorias), mensagens, llm), categoria, mensagens, llm


def test_service_transmite_e_grava_so_no_fim(servico):
    chat, categoria, mensagens, _ = servico
    eventos = chat.enviar_stream(categoria["id"], "  Oi  ")
    primeiro = next(eventos)
    assert primeiro == {"tipo": "delta", "texto": "Respo"}
    assert mensagens.itens == []  # nada gravado enquanto a IA escreve

    resto = list(eventos)
    fim = resto[-1]
    assert fim["tipo"] == "fim"
    assert fim["resposta"]["conteudo"] == "Resposta completa da IA."
    assert fim["pergunta"]["conteudo"] == "Oi"
    assert "".join(e["texto"] for e in [primeiro, *resto] if e["tipo"] == "delta") == "Resposta completa da IA."


def test_service_falha_no_meio_nao_grava_nada(servico):
    chat, categoria, mensagens, llm = servico
    llm.erro = IAIndisponivelError("caiu")
    eventos = list(chat.enviar_stream(categoria["id"], "Oi"))
    assert eventos[0]["tipo"] == "delta"  # chegou a escrever um pedaço
    assert eventos[-1] == {"tipo": "erro", "erro": "ia_indisponivel", "mensagem": "caiu"}
    assert mensagens.itens == []


def test_service_valida_antes_de_transmitir(servico):
    chat, categoria, _, llm = servico
    with pytest.raises(ValidacaoError):
        chat.enviar_stream(categoria["id"], "   ")
    with pytest.raises(NaoEncontradoError):
        chat.enviar_stream("00000000-0000-4000-8000-000000000000", "Oi")
    assert llm.chamadas == []


# ---------- rota ----------
def test_rota_stream_responde_sse(client, monkeypatch, servico):
    chat, categoria, _, _ = servico

    def validar(token):
        if token != "ok":
            raise NaoAutenticadoError("Token inválido.")
        return "u1"

    monkeypatch.setattr(auth, "obter_user_id", validar)
    monkeypatch.setattr(dependencies, "get_chat_service", lambda: chat)

    url = f"/categorias/{categoria['id']}/chat/stream"
    assert client.post(url, json={"mensagem": "Oi"}).status_code == 401

    resposta = client.post(url, json={"mensagem": "Oi"}, headers={"Authorization": "Bearer ok"})
    assert resposta.status_code == 200
    assert resposta.mimetype == "text/event-stream"
    eventos = [json.loads(l[6:]) for l in resposta.get_data(as_text=True).split("\n\n") if l.startswith("data: ")]
    assert eventos[-1]["tipo"] == "fim"

    vazia = client.post(url, json={"mensagem": ""}, headers={"Authorization": "Bearer ok"})
    assert vazia.status_code == 400 and vazia.get_json()["erro"] == "validacao"
