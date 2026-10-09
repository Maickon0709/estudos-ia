"""Cliente da IA (Groq, API compatível com OpenAI).

Contrato único usado pelo resto do sistema:
    responder(mensagens) -> str
onde `mensagens` é uma lista de {"role": "system|user|assistant", "content": "..."}.

Trocar de provedor (OpenAI, Gemini, ...) = escrever outra classe com o mesmo
método. O service não muda. Nada aqui vaza chave ou corpo de resposta nos erros.
"""
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

    def _post(self, payload: dict, cabecalhos: dict) -> httpx.Response:
        if self._http is not None:
            return self._http.post(GROQ_URL, json=payload, headers=cabecalhos)
        with httpx.Client(timeout=self._timeout) as cliente:
            return cliente.post(GROQ_URL, json=payload, headers=cabecalhos)
