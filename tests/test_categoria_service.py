import uuid

import pytest

from app.core.errors import NaoEncontradoError, ValidacaoError
from app.services.categoria_service import NOME_MAX, CategoriaService


class RepoFalso:
    """Repositório em memória: permite testar o service sem banco."""

    def __init__(self):
        self.dados = {}

    def listar(self):
        return list(self.dados.values())

    def obter(self, categoria_id):
        return self.dados.get(categoria_id)

    def criar(self, user_id, nome):
        item = {"id": str(uuid.uuid4()), "user_id": user_id, "nome": nome}
        self.dados[item["id"]] = item
        return item

    def renomear(self, categoria_id, nome):
        if categoria_id not in self.dados:
            return None
        self.dados[categoria_id]["nome"] = nome
        return self.dados[categoria_id]

    def remover(self, categoria_id):
        return self.dados.pop(categoria_id, None) is not None


@pytest.fixture
def service():
    return CategoriaService(RepoFalso())


def test_criar_normaliza_espacos(service):
    categoria = service.criar("u1", "   Língua    Portuguesa  ")
    assert categoria["nome"] == "Língua Portuguesa"


@pytest.mark.parametrize("nome", [None, "", "    ", 123, ["x"]])
def test_criar_rejeita_nome_invalido(service, nome):
    with pytest.raises(ValidacaoError):
        service.criar("u1", nome)


def test_criar_rejeita_nome_muito_longo(service):
    with pytest.raises(ValidacaoError):
        service.criar("u1", "a" * (NOME_MAX + 1))


def test_criar_aceita_nome_no_limite(service):
    assert service.criar("u1", "a" * NOME_MAX)["nome"] == "a" * NOME_MAX


def test_obter_id_invalido(service):
    with pytest.raises(ValidacaoError):
        service.obter("nao-e-uuid")


def test_obter_inexistente(service):
    with pytest.raises(NaoEncontradoError):
        service.obter(str(uuid.uuid4()))


def test_renomear(service):
    criada = service.criar("u1", "SQL")
    assert service.renomear(criada["id"], "  Banco de Dados ")["nome"] == "Banco de Dados"


def test_renomear_inexistente(service):
    with pytest.raises(NaoEncontradoError):
        service.renomear(str(uuid.uuid4()), "X")


def test_remover(service):
    criada = service.criar("u1", "Inglês")
    service.remover(criada["id"])
    assert service.listar() == []


def test_remover_inexistente(service):
    with pytest.raises(NaoEncontradoError):
        service.remover(str(uuid.uuid4()))
