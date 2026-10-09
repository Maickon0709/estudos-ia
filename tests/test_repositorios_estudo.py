"""Repositories de trilha, exercícios, respostas, revisões e painel,
verificados pela cadeia de chamadas ao query builder."""
import pytest
from postgrest.exceptions import APIError

from app.core.errors import NaoAutenticadoError, NaoEncontradoError, PropostaInvalidaError
from app.repositories.exercicio_repository import (
    COLUNAS_PUBLICAS,
    ExercicioRepository,
    RespostaRepository,
    RevisaoRepository,
)
from app.repositories.painel_repository import PainelRepository
from app.repositories.trilha_repository import EtapaRepository, TrilhaRepository


class Resposta:
    def __init__(self, data):
        self.data = data


class Cadeia:
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


class Cliente:
    def __init__(self, data=None, erro=None):
        self.cadeia = Cadeia(data, erro)
        self.tabelas = []
        self.rpcs = []

    def table(self, nome):
        self.tabelas.append(nome)
        return self.cadeia

    def rpc(self, nome, params):
        self.rpcs.append((nome, params))
        return self.cadeia


def args(cliente, metodo):
    return [a for n, a, _ in cliente.cadeia.chamadas if n == metodo]


# ---------- exercícios: o gabarito nunca é selecionado na listagem ----------
def test_listagem_seleciona_so_colunas_publicas():
    cliente = Cliente(data=[])
    ExercicioRepository(cliente).listar("e1", "basico")
    (selecao,) = args(cliente, "select")[0]
    assert selecao == COLUNAS_PUBLICAS
    assert "gabarito" not in selecao and "explicacao" not in selecao and "*" not in selecao
    assert args(cliente, "eq") == [("etapa_id", "e1"), ("nivel", "basico")]


def test_obter_completo_le_tudo_para_corrigir():
    cliente = Cliente(data=[{"id": "x", "gabarito": "B"}])
    assert ExercicioRepository(cliente).obter_completo("x")["gabarito"] == "B"


def test_criar_varios_insere_com_a_etapa():
    cliente = Cliente(data=[{"id": "1"}])
    ExercicioRepository(cliente).criar_varios("e1", [{"nivel": "basico"}, {"nivel": "basico"}])
    (linhas,) = args(cliente, "insert")[0]
    assert linhas == [{"etapa_id": "e1", "nivel": "basico"}, {"etapa_id": "e1", "nivel": "basico"}]


# ---------- respostas (função SQL) ----------
RETORNO = {"resposta_id": "r1", "etapa_id": "e1", "niveis": {"basico": {"total": 1, "acertos": 1}}}


@pytest.mark.parametrize("dado", [RETORNO, [RETORNO], {"registrar_resposta": RETORNO}])
def test_registrar_chama_a_funcao_e_aceita_formatos(dado):
    cliente = Cliente(data=dado)
    assert RespostaRepository(cliente).registrar("x", "B", True, "ok", None)["etapa_id"] == "e1"
    assert cliente.rpcs == [("registrar_resposta", {
        "p_exercicio_id": "x", "p_resposta": "B", "p_correta": True, "p_feedback": "ok", "p_revisao": None,
    })]


def test_registrar_completa_niveis_ausentes():
    assert RespostaRepository(Cliente(data={"etapa_id": "e1"})).registrar("x", "B", True, None, None)["niveis"] == {}


@pytest.mark.parametrize("dado", [None, [], "texto", {"sem": "etapa"}])
def test_registrar_sem_retorno_util(dado):
    with pytest.raises(PropostaInvalidaError):
        RespostaRepository(Cliente(data=dado)).registrar("x", "B", True, None, None)


@pytest.mark.parametrize(
    "mensagem,erro", [("exercicio_nao_encontrado", NaoEncontradoError), ("nao_autenticado", NaoAutenticadoError)]
)
def test_registrar_traduz_erros_da_funcao(mensagem, erro):
    api = APIError({"message": mensagem, "code": "P0001", "hint": None, "details": None})
    with pytest.raises(erro):
        RespostaRepository(Cliente(erro=api)).registrar("x", "B", True, None, None)


def test_registrar_nao_mascara_erro_desconhecido():
    api = APIError({"message": "timeout", "code": "57014", "hint": None, "details": None})
    with pytest.raises(APIError):
        RespostaRepository(Cliente(erro=api)).registrar("x", "B", True, None, None)


# ---------- revisões ----------
def test_pendentes_filtra_por_data_e_categoria():
    cliente = Cliente(data=[])
    RevisaoRepository(cliente).pendentes("2026-10-09", "cat")
    assert cliente.tabelas == ["v_revisoes_pendentes"]
    assert args(cliente, "lte") == [("proxima_revisao", "2026-10-09")]
    assert args(cliente, "eq") == [("categoria_id", "cat")]


def test_pendentes_sem_categoria():
    cliente = Cliente(data=[])
    RevisaoRepository(cliente).pendentes("2026-10-09")
    assert args(cliente, "eq") == []


# ---------- etapas e trilhas ----------
def test_niveis_convertem_a_view_em_dicionario():
    cliente = Cliente(data=[{"nivel": "basico", "total": "3", "acertos": 2}])
    assert EtapaRepository(cliente).niveis("e1") == {"basico": {"total": 3, "acertos": 2}}
    assert cliente.tabelas == ["v_acerto_etapa_nivel"]


def test_recursos_das_etapas_sem_ids_nao_consulta():
    cliente = Cliente(data=[])
    assert TrilhaRepository(cliente).recursos_das_etapas([]) == []
    assert cliente.tabelas == []


def test_recursos_das_etapas_usa_in():
    cliente = Cliente(data=[])
    TrilhaRepository(cliente).recursos_das_etapas(["a", "b"])
    assert args(cliente, "in_") == [("etapa_id", ["a", "b"])]


def test_atualizar_etapa_sem_linha_devolve_none():
    assert EtapaRepository(Cliente(data=[])).atualizar("e1", {"status": "concluido"}) is None


# ---------- painel ----------
def test_dias_estudo_devolve_lista_de_datas():
    cliente = Cliente(data=[{"dia": "2026-10-08"}, {"dia": "2026-10-09"}])
    assert PainelRepository(cliente).dias_estudo() == ["2026-10-08", "2026-10-09"]


def test_pontos_fracos_ordena_e_limita():
    cliente = Cliente(data=[])
    PainelRepository(cliente).pontos_fracos("cat")
    assert args(cliente, "order") == [("taxa_acerto",)]
    assert args(cliente, "limit") == [(5,)]
