"""Validador de links: a URL responde de verdade?

SEGURANÇA (SSRF): as URLs vêm de uma busca na web, ou seja, de terceiros.
Sem cuidado, o servidor poderia ser induzido a acessar endereços internos
(localhost, rede privada, metadados de nuvem em 169.254.169.254). Por isso:
- só http/https, e só portas 80/443;
- o host precisa resolver SOMENTE para IPs públicos (ip.is_global);
- redirecionamentos são seguidos manualmente, validando CADA salto;
- nunca baixamos o corpo da página (HEAD, ou GET em streaming fechado já no
  cabeçalho).
Limite conhecido: o DNS é resolvido uma vez para validar e de novo pelo httpx
ao conectar (janela de "DNS rebinding"). Para o risco deste projeto é aceitável;
o endurecimento seria conectar direto no IP validado.

Critério: 2xx = ok. 401/403/429 = o site existe mas barra robôs, então aceitamos.
404, 410, 5xx, DNS inexistente, timeout ou destino não público = inválido.
"""
import ipaddress
import socket
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlsplit

import httpx

PORTAS_OK = (None, 80, 443)
STATUS_BARRA_ROBO = (401, 403, 429)
CABECALHOS = {"User-Agent": "EstudosIA-LinkCheck/1.0 (+validador de links)"}


def _resolver_padrao(host: str) -> list[str]:
    infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    return sorted({info[4][0] for info in infos})


class LinkValidator:
    def __init__(
        self,
        timeout: float = 6.0,
        max_redirecionamentos: int = 3,
        max_workers: int = 5,
        http_client: httpx.Client | None = None,
        resolver=None,
    ):
        self._timeout = timeout
        self._max_redir = max_redirecionamentos
        self._max_workers = max_workers
        self._http = http_client  # injetável nos testes
        self._resolver = resolver or _resolver_padrao

    def validar(self, url: str) -> bool:
        try:
            return self._validar(url)
        except (httpx.HTTPError, ValueError, OSError):
            return False

    def validar_varios(self, urls: list[str]) -> dict[str, bool]:
        unicas = list(dict.fromkeys(urls))
        if not unicas:
            return {}
        with ThreadPoolExecutor(max_workers=self._max_workers) as pool:
            resultados = list(pool.map(self.validar, unicas))
        return dict(zip(unicas, resultados))

    # ---------- internos ----------
    def _validar(self, url: str) -> bool:
        cliente = self._http or httpx.Client(
            timeout=self._timeout, headers=CABECALHOS, follow_redirects=False
        )
        try:
            atual = url
            for _ in range(self._max_redir + 1):
                partes = urlsplit(atual)
                if partes.scheme not in ("http", "https") or not partes.hostname:
                    return False
                if partes.port not in PORTAS_OK:  # .port pode levantar ValueError
                    return False
                if not self._host_publico(partes.hostname):
                    return False

                status, destino = self._requisitar(cliente, atual)
                if 300 <= status < 400:
                    if not destino:
                        return False
                    atual = urljoin(atual, destino)
                    continue
                return 200 <= status < 300 or status in STATUS_BARRA_ROBO
            return False  # redirecionamentos demais
        finally:
            if self._http is None:
                cliente.close()

    def _host_publico(self, host: str) -> bool:
        try:
            return ipaddress.ip_address(host).is_global
        except ValueError:
            pass  # não é IP literal: resolve o nome
        try:
            ips = self._resolver(host)
        except OSError:
            return False
        if not ips:
            return False
        try:
            return all(ipaddress.ip_address(ip.split("%")[0]).is_global for ip in ips)
        except ValueError:
            return False

    @staticmethod
    def _requisitar(cliente: httpx.Client, url: str) -> tuple[int, str | None]:
        """HEAD primeiro; se o site não aceitar HEAD, GET em streaming (sem corpo)."""
        resposta = cliente.head(url, follow_redirects=False)
        if resposta.status_code in (400, 403, 405, 501):
            with cliente.stream("GET", url, follow_redirects=False) as r:
                return r.status_code, r.headers.get("location")
        return resposta.status_code, resposta.headers.get("location")
