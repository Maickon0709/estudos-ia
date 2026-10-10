"""Cliente do Supabase Storage (API REST), sempre com o JWT do usuário.

Contrato:
    enviar(caminho, conteudo, tipo) / baixar(caminho) -> bytes | None / apagar(caminho)

Usa a mesma regra do resto do projeto: chave anon + token do usuário, e quem
protege os arquivos são as políticas do banco (migração 006).
"""
import httpx

from app.core.errors import ArmazenamentoIndisponivelError


class StorageClient:
    def __init__(self, url: str, chave_anon: str, token: str, bucket: str = "avatares",
                 timeout: float = 15.0, http_client: httpx.Client | None = None):
        self._base = f"{url.rstrip('/')}/storage/v1/object"
        self._bucket = bucket
        self._cabecalhos = {"apikey": chave_anon, "Authorization": f"Bearer {token}"}
        self._timeout = timeout
        self._http = http_client  # injetável nos testes

    def enviar(self, caminho: str, conteudo: bytes, tipo: str) -> None:
        resposta = self._pedir("POST", f"{self._base}/{self._bucket}/{caminho}", content=conteudo,
                               headers={"Content-Type": tipo, "x-upsert": "true", "Cache-Control": "no-cache"})
        if resposta.status_code >= 400:
            raise ArmazenamentoIndisponivelError("Não consegui salvar a imagem agora. Tente de novo.")

    def baixar(self, caminho: str) -> bytes | None:
        resposta = self._pedir("GET", f"{self._base}/authenticated/{self._bucket}/{caminho}")
        if _nao_existe(resposta):
            return None
        if resposta.status_code >= 400:
            raise ArmazenamentoIndisponivelError("Não consegui carregar a imagem agora.")
        return resposta.content

    def apagar(self, caminho: str) -> None:
        resposta = self._pedir("DELETE", f"{self._base}/{self._bucket}/{caminho}")
        if resposta.status_code >= 400 and not _nao_existe(resposta):
            raise ArmazenamentoIndisponivelError("Não consegui apagar a imagem agora. Tente de novo.")

    def _pedir(self, metodo: str, url: str, **kwargs) -> httpx.Response:
        kwargs["headers"] = {**self._cabecalhos, **kwargs.get("headers", {})}
        try:
            if self._http is not None:
                return self._http.request(metodo, url, **kwargs)
            with httpx.Client(timeout=self._timeout) as cliente:
                return cliente.request(metodo, url, **kwargs)
        except httpx.HTTPError as exc:
            raise ArmazenamentoIndisponivelError("O armazenamento de arquivos não respondeu.") from exc


def _nao_existe(resposta: httpx.Response) -> bool:
    """O Storage às vezes responde 400 com statusCode "404" no corpo para arquivo inexistente."""
    if resposta.status_code == 404:
        return True
    if resposta.status_code == 400:
        try:
            corpo = resposta.json()
        except ValueError:
            return False
        return str(corpo.get("statusCode")) == "404" or "not found" in str(corpo.get("error", "")).lower()
    return False
