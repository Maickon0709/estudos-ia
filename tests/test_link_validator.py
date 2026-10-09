import socket

import httpx
import pytest

from app.integrations.link_validator import LinkValidator

PUBLICO = "93.184.216.34"


def resolver_padrao(host):
    """Nomes de teste -> IP. 'interno.exemplo' simula um host que aponta para a rede privada."""
    tabela = {
        "localhost": ["127.0.0.1"],
        "interno.exemplo": ["10.0.0.7"],
        "misto.exemplo": [PUBLICO, "192.168.1.10"],
    }
    return tabela.get(host, [PUBLICO])


def validador(handler, resolver=resolver_padrao):
    http = httpx.Client(transport=httpx.MockTransport(handler))
    return LinkValidator(http_client=http, resolver=resolver)


class Registro:
    """Handler que registra (método, url) e responde conforme uma função."""

    def __init__(self, responder):
        self.chamadas = []
        self._responder = responder

    def __call__(self, request: httpx.Request):
        self.chamadas.append((request.method, str(request.url)))
        return self._responder(request)


def test_2xx_e_valido():
    reg = Registro(lambda r: httpx.Response(200))
    assert validador(reg).validar("https://site.com/aula") is True
    assert reg.chamadas == [("HEAD", "https://site.com/aula")]


def test_head_recusado_cai_para_get():
    def responder(request):
        return httpx.Response(405 if request.method == "HEAD" else 200)

    reg = Registro(responder)
    assert validador(reg).validar("https://site.com/") is True
    assert [m for m, _ in reg.chamadas] == ["HEAD", "GET"]


@pytest.mark.parametrize("status", [404, 410, 500, 502, 503])
def test_status_de_pagina_morta_e_invalido(status):
    assert validador(Registro(lambda r: httpx.Response(status))).validar("https://site.com/") is False


@pytest.mark.parametrize("status", [401, 403, 429])
def test_site_que_barra_robo_conta_como_existente(status):
    assert validador(Registro(lambda r: httpx.Response(status))).validar("https://site.com/") is True


def test_segue_redirecionamento_relativo_e_absoluto():
    def responder(request):
        caminho = request.url.path
        if caminho == "/velho":
            return httpx.Response(301, headers={"location": "/novo"})
        if caminho == "/novo":
            return httpx.Response(302, headers={"location": "https://outro.com/final"})
        return httpx.Response(200)

    reg = Registro(responder)
    assert validador(reg).validar("https://site.com/velho") is True
    assert [u for _, u in reg.chamadas] == [
        "https://site.com/velho",
        "https://site.com/novo",
        "https://outro.com/final",
    ]


def test_redirecionamento_para_ip_interno_e_bloqueado_sem_requisitar():
    def responder(request):
        return httpx.Response(302, headers={"location": "http://169.254.169.254/latest/meta-data"})

    reg = Registro(responder)
    assert validador(reg).validar("https://site.com/") is False
    assert all("169.254.169.254" not in u for _, u in reg.chamadas)


def test_redirecionamento_para_host_que_resolve_para_rede_privada_e_bloqueado():
    reg = Registro(lambda r: httpx.Response(302, headers={"location": "https://interno.exemplo/admin"}))
    assert validador(reg).validar("https://site.com/") is False
    assert all("interno.exemplo" not in u for _, u in reg.chamadas)


def test_loop_de_redirecionamento_e_invalido():
    reg = Registro(lambda r: httpx.Response(302, headers={"location": "/de-novo"}))
    assert validador(reg).validar("https://site.com/") is False
    assert len(reg.chamadas) == 4  # 1 inicial + 3 saltos permitidos


def test_redirecionamento_sem_location_e_invalido():
    assert validador(Registro(lambda r: httpx.Response(301))).validar("https://site.com/") is False


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost/",
        "http://127.0.0.1/",
        "http://127.0.0.1:80/",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.5/",
        "http://192.168.0.1/",
        "http://172.16.0.1/",
        "http://[::1]/",
        "http://0.0.0.0/",
        "http://interno.exemplo/",
        "http://misto.exemplo/",  # resolve para um IP público E um privado
        "ftp://site.com/",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "https://site.com:8080/",
        "https://site.com:22/",
        "https:///sem-host",
        "",
        "nao e url",
    ],
)
def test_destinos_proibidos_nunca_sao_requisitados(url):
    reg = Registro(lambda r: httpx.Response(200))
    assert validador(reg).validar(url) is False
    assert reg.chamadas == []


def test_portas_padrao_explicitas_sao_aceitas():
    assert validador(Registro(lambda r: httpx.Response(200))).validar("https://site.com:443/x") is True
    assert validador(Registro(lambda r: httpx.Response(200))).validar("http://site.com:80/x") is True


def test_dns_inexistente_e_invalido():
    def sem_dns(host):
        raise socket.gaierror("nome desconhecido")

    reg = Registro(lambda r: httpx.Response(200))
    assert validador(reg, resolver=sem_dns).validar("https://nao-existe.example/") is False
    assert reg.chamadas == []


def test_timeout_e_invalido():
    def responder(request):
        raise httpx.ConnectTimeout("lento", request=request)

    assert validador(Registro(responder)).validar("https://site.com/") is False


def test_validar_varios_devolve_veredito_por_url_e_remove_repetidas():
    def responder(request):
        return httpx.Response(200 if request.url.host == "bom.com" else 404)

    reg = Registro(responder)
    resultado = validador(reg).validar_varios(
        ["https://bom.com/a", "https://ruim.com/b", "https://bom.com/a"]
    )
    assert resultado == {"https://bom.com/a": True, "https://ruim.com/b": False}
    assert len(reg.chamadas) == 2


def test_validar_varios_lista_vazia():
    assert validador(Registro(lambda r: httpx.Response(200))).validar_varios([]) == {}
