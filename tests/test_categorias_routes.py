import uuid

import pytest

from app.core import auth, dependencies
from app.core.errors import DuplicadoError
from app.services.categoria_service import CategoriaService
from tests.test_categoria_service import RepoFalso

CABECALHO = {"Authorization": "Bearer token-valido"}


@pytest.fixture
def repo():
    return RepoFalso()


@pytest.fixture(autouse=True)
def usuario_logado(monkeypatch, repo):
    """Troca o Supabase por falsos: token válido e repositório em memória."""

    def validar(token):
        if token != "token-valido":
            from app.core.errors import NaoAutenticadoError

            raise NaoAutenticadoError("Token inválido ou expirado.")
        return "user-1"

    monkeypatch.setattr(auth, "obter_user_id", validar)
    monkeypatch.setattr(
        dependencies, "get_categoria_service", lambda: CategoriaService(repo)
    )


def test_health(client):
    assert client.get("/health").get_json() == {"status": "ok"}


def test_sem_token_retorna_401(client):
    resposta = client.get("/categorias")
    assert resposta.status_code == 401
    assert resposta.get_json()["erro"] == "nao_autenticado"


def test_token_invalido_retorna_401(client):
    resposta = client.get("/categorias", headers={"Authorization": "Bearer errado"})
    assert resposta.status_code == 401


def test_criar_e_listar(client):
    criada = client.post("/categorias", json={"nome": "Português"}, headers=CABECALHO)
    assert criada.status_code == 201
    assert criada.get_json()["user_id"] == "user-1"

    lista = client.get("/categorias", headers=CABECALHO).get_json()
    assert [c["nome"] for c in lista] == ["Português"]


def test_criar_sem_nome_retorna_400(client):
    resposta = client.post("/categorias", json={}, headers=CABECALHO)
    assert resposta.status_code == 400
    assert resposta.get_json()["erro"] == "validacao"


def test_criar_duplicada_retorna_409(client, repo, monkeypatch):
    def criar_duplicada(user_id, nome):
        raise DuplicadoError("Você já tem uma categoria com esse nome.")

    monkeypatch.setattr(repo, "criar", criar_duplicada)
    resposta = client.post("/categorias", json={"nome": "SQL"}, headers=CABECALHO)
    assert resposta.status_code == 409


def test_obter_inexistente_retorna_404(client):
    resposta = client.get(f"/categorias/{uuid.uuid4()}", headers=CABECALHO)
    assert resposta.status_code == 404


def test_id_invalido_retorna_400(client):
    assert client.get("/categorias/abc", headers=CABECALHO).status_code == 400


def test_renomear_e_remover(client):
    criada = client.post("/categorias", json={"nome": "SQL"}, headers=CABECALHO).get_json()

    renomeada = client.patch(
        f"/categorias/{criada['id']}", json={"nome": "MySQL"}, headers=CABECALHO
    )
    assert renomeada.get_json()["nome"] == "MySQL"

    assert client.delete(f"/categorias/{criada['id']}", headers=CABECALHO).status_code == 204
    assert client.get(f"/categorias/{criada['id']}", headers=CABECALHO).status_code == 404
