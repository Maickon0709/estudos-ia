"""Cliente da IA (Groq, API compatível com OpenAI).

Contrato usado pelo resto do sistema:
    responder(mensagens) -> str
    responder_stream(mensagens) -> Iterator[str]   (pedaços do texto, na ordem)
onde `mensagens` é uma lista de {"role": "system|user|assistant", "content": "..."}.

Trocar de provedor (OpenAI, Gemini, ...) = escrever outra classe com o mesmo
método. O service não muda. Nada aqui vaza chave ou corpo de resposta nos erros.
"""
import json
from collections.abc import Iterator

import httpx

from app.core.errors import IAIndisponivelError

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqClient:
    def __init__(
        self,
        api_key: str | None,
        model: str,
        timeout: float = 30.0,
        http_client: httpx.Client | None = None,
    ):
        self._api_key = api_key
        self._model = model
        self._timeout = timeout
        self._http = http_client  # injetável nos testes

    def responder(self, mensagens: list[dict]) -> str:
        if not self._api_key:
            raise IAIndisponivelError("A IA não está configurada neste servidor.")

        payload = {"model": self._model, "messages": mensagens, "temperature": 0.4}
        cabecalhos = {"Authorization": f"Bearer {self._api_key}"}

        try:
            resposta = self._post(payload, cabecalhos)
        except httpx.HTTPError as exc:
            raise IAIndisponivelError("Não foi possível falar com a IA agora.") from exc

        if resposta.status_code == 429:
            raise IAIndisponivelError("Limite de uso da IA atingido. Tente em instantes.")
        if resposta.status_code >= 400:
            raise IAIndisponivelError("A IA retornou um erro. Tente novamente.")

        try:
            texto = resposta.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise IAIndisponivelError("Resposta inesperada da IA.") from exc

        texto = (texto or "").strip()
        if not texto:
            raise IAIndisponivelError("A IA devolveu uma resposta vazia.")
        return texto

    def responder_stream(self, mensagens: list[dict]) -> Iterator[str]:
        """Devolve o texto aos pedaços, conforme a IA escreve (SSE da API da Groq).

        É um gerador: os erros aparecem durante a iteração, e quem consome
        decide o que fazer (o chat só grava depois que o texto chegou inteiro).
        """
        if not self._api_key:
            raise IAIndisponivelError("A IA não está configurada neste servidor.")

        payload = {"model": self._model, "messages": mensagens, "temperature": 0.4, "stream": True}
        cabecalhos = {"Authorization": f"Bearer {self._api_key}"}
        cliente = self._http or httpx.Client(timeout=self._timeout)
        try:
            with cliente.stream("POST", GROQ_URL, json=payload, headers=cabecalhos) as resposta:
                if resposta.status_code == 429:
                    raise IAIndisponivelError("Limite de uso da IA atingido. Tente em instantes.")
                if resposta.status_code >= 400:
                    raise IAIndisponivelError("A IA retornou um erro. Tente novamente.")
                recebeu = False
                for linha in resposta.iter_lines():
                    if not linha.startswith("data:"):
                        continue
                    dado = linha[5:].strip()
                    if dado == "[DONE]":
                        break
                    pedaco = _pedaco(dado)
                    if pedaco:
                        recebeu = True
                        yield pedaco
                if not recebeu:
                    raise IAIndisponivelError("A IA devolveu uma resposta vazia.")
        except httpx.HTTPError as exc:
            raise IAIndisponivelError("Não foi possível falar com a IA agora.") from exc
        finally:
            if self._http is None:
                cliente.close()

    def _post(self, payload: dict, cabecalhos: dict) -> httpx.Response:
        if self._http is not None:
            return self._http.post(GROQ_URL, json=payload, headers=cabecalhos)
        with httpx.Client(timeout=self._timeout) as cliente:
            return cliente.post(GROQ_URL, json=payload, headers=cabecalhos)


def _pedaco(dado: str) -> str:
    try:
        return json.loads(dado)["choices"][0]["delta"].get("content") or ""
    except (ValueError, KeyError, IndexError, TypeError, AttributeError) as exc:
        raise IAIndisponivelError("Resposta inesperada da IA.") from exc
