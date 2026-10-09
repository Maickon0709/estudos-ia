import uuid

import pytest
from flask import g

from app.core import auth, dependencies
from app.core.errors import BuscaIndisponivelError, NaoAutenticadoError
from app.services.categoria_service import CategoriaService
from app.services.pesquisa_service import PesquisaService
from tests.fakes_busca import BuscaFalsa, ValidadorFalso, YouTubeFalso, res
from tests.test_categoria_service import RepoFalso

CABECALHO = {"Authorization": "Bearer token-valido"}


@pytest.fixture
def ambiente(monkeypatch):
    categorias = RepoFalso()
    categoria = categorias.criar("user-1", "SQL")
    busca = BuscaFalsa(web=[res("https://bom.com", "Guia de SQL")])
    servico = PesquisaService(
        CategoriaService(categorias), busca, YouTubeFalso(disponivel=False),
        ValidadorFalso(validos={"https://bom.com"}),
    )

    def validar(token):
        if token != "token-valido":
            raise NaoAutenticadoError("Token inválido ou expirado.")
        return "user-1"

    monkeypatch.setattr(auth, "obter_user_id", validar)
    monkeypatch.setattr(dependencies, "get_pesquisa_service", lambda: servico)
    return categoria, busca


def test_exige_login(client, ambiente):
    categoria, busca = ambiente
    resposta = client.post(f"/categorias/{categoria['id']}/pesquisar", json={"consulta": "joins"})
    assert resposta.status_code == 401
    assert busca.chamadas == []


def test_pesquisar_devolve_recursos(client, ambiente):
    categoria, _ = ambiente
    resposta = client.post(
        f"/categorias/{categoria['id']}/pesquisar", json={"consulta": "joins em SQL"}, headers=CABECALHO
    )
    assert resposta.status_code == 200
    corpo = resposta.get_json()
    assert corpo["consulta"] == "joins em SQL"
    assert corpo["recursos"][0]["url"] == "https://bom.com"
    assert corpo["recursos"][0]["verificacao"] == "verificado"
    assert set(corpo) == {"consulta", "recursos", "descartados", "youtube_verificado"}


def test_consulta_ausente_retorna_400(client, ambiente):
    categoria, busca = ambiente
    resposta = client.post(f"/categorias/{categoria['id']}/pesquisar", json={}, headers=CABECALHO)
    assert resposta.status_code == 400
    assert busca.chamadas == []


def test_categoria_inexistente_retorna_404(client, ambiente):
    resposta = client.post(
        f"/categorias/{uuid.uuid4()}/pesquisar", json={"consulta": "joins"}, headers=CABECALHO
    )
    assert resposta.status_code == 404


def test_busca_fora_do_ar_retorna_502(client, ambiente):
    categoria, busca = ambiente
    busca.erro = BuscaIndisponivelError("A busca não está configurada neste servidor.")
    resposta = client.post(
        f"/categorias/{categoria['id']}/pesquisar", json={"consulta": "joins"}, headers=CABECALHO
    )
    assert resposta.status_code == 502
    assert resposta.get_json()["erro"] == "busca_indisponivel"


def test_get_pesquisa_service_monta_as_camadas(app, monkeypatch):
    monkeypatch.setattr(dependencies, "user_client", lambda token: object())
    with app.test_request_context():
        g.token = "t"
        assert isinstance(dependencies.get_pesquisa_service(), PesquisaService)
