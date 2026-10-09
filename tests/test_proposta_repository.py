import pytest
from postgrest.exceptions import APIError

from app.core.errors import EstadoInvalidoError, NaoEncontradoError, PropostaInvalidaError
from app.repositories.proposta_repository import PropostaRepository

TRILHA = "9b2f1c3e-0000-4000-8000-000000000001"


class Resposta:
    def __init__(self, data):
        self.data = data


class Cadeia:
    """Registra a cadeia de chamadas do query builder."""

    def __init__(self, data=None, erro=None):
        self.chamadas = []
        self._data = data
        self._erro = erro

    def __getattr__(self, nome):
        def registrar(*args, **kwargs):
            self.chamadas.append((nome, args, kwargs))
            return self

        return registrar

    def execute(self):
        if self._erro is not None:
            raise self._erro
        return Resposta(self._data)


class ClienteFalso:
    def __init__(self, data=None, erro=None):
        self.cadeia = Cadeia(data, erro)
        self.rpcs = []

    def table(self, nome):
        assert nome == "propostas"
        return self.cadeia

    def rpc(self, nome, params):
        self.rpcs.append((nome, params))
        return self.cadeia


def chamadas(cliente, nome):
    return [(a, k) for n, a, k in cliente.cadeia.chamadas if n == nome]


# ---------- confirmar ----------
@pytest.mark.parametrize(
    "dado", [TRILHA, [TRILHA], {"confirmar_proposta": TRILHA}, [{"confirmar_proposta": TRILHA}]]
)
def test_confirmar_chama_a_funcao_e_aceita_formatos_de_retorno(dado):
    cliente = ClienteFalso(data=dado)
    assert PropostaRepository(cliente).confirmar("p-1") == TRILHA
    assert cliente.rpcs == [("confirmar_proposta", {"p_proposta_id": "p-1"})]


@pytest.mark.parametrize("dado", [None, [], {}, "", [None]])
def test_confirmar_sem_retorno_util_e_erro(dado):
    with pytest.raises(PropostaInvalidaError):
        PropostaRepository(ClienteFalso(data=dado)).confirmar("p-1")


@pytest.mark.parametrize(
    "mensagem,erro",
    [
        ("proposta_nao_encontrada", NaoEncontradoError),
        ("proposta_ja_decidida", EstadoInvalidoError),
        ("proposta_invalida", PropostaInvalidaError),
    ],
)
def test_erros_da_funcao_sql_viram_erros_de_dominio(mensagem, erro):
    api = APIError({"message": mensagem, "code": "P0001", "hint": None, "details": None})
    with pytest.raises(erro):
        PropostaRepository(ClienteFalso(erro=api)).confirmar("p-1")


def test_erro_desconhecido_do_banco_nao_e_mascarado():
    api = APIError({"message": "connection reset", "code": "08006", "hint": None, "details": None})
    with pytest.raises(APIError):
        PropostaRepository(ClienteFalso(erro=api)).confirmar("p-1")


# ---------- rejeitar ----------
def test_rejeitar_so_atinge_proposta_pendente():
    cliente = ClienteFalso(data=[{"id": "p-1", "status": "rejeitada"}])
    assert PropostaRepository(cliente).rejeitar("p-1")["status"] == "rejeitada"

    (corpo,), _ = chamadas(cliente, "update")[0]
    assert corpo["status"] == "rejeitada" and corpo["decidida_em"]
    assert [a for a, _ in chamadas(cliente, "eq")] == [("id", "p-1"), ("status", "pendente")]


def test_rejeitar_sem_linha_afetada_devolve_none():
    assert PropostaRepository(ClienteFalso(data=[])).rejeitar("p-1") is None


def test_rejeitar_outras_pendentes_preserva_a_nova():
    cliente = ClienteFalso(data=[])
    PropostaRepository(cliente).rejeitar_outras_pendentes("cat-1", "nova")
    assert [a for a, _ in chamadas(cliente, "eq")] == [("categoria_id", "cat-1"), ("status", "pendente")]
    assert [a for a, _ in chamadas(cliente, "neq")] == [("id", "nova")]


# ---------- criar / listar ----------
def test_criar_insere_categoria_e_payload():
    cliente = ClienteFalso(data=[{"id": "p-1"}])
    assert PropostaRepository(cliente).criar("cat-1", {"etapas": []}) == {"id": "p-1"}
    (linha,), _ = chamadas(cliente, "insert")[0]
    assert linha == {"categoria_id": "cat-1", "payload": {"etapas": []}}


@pytest.mark.parametrize("status,eqs", [(None, [("categoria_id", "c")]), ("pendente", [("categoria_id", "c"), ("status", "pendente")])])
def test_listar_com_e_sem_filtro(status, eqs):
    cliente = ClienteFalso(data=[])
    PropostaRepository(cliente).listar("c", status)
    assert [a for a, _ in chamadas(cliente, "eq")] == eqs
    assert chamadas(cliente, "order")[0] == (("created_at",), {"desc": True})
