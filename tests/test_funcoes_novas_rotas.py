"""'Não entendi', repositórios da migração 004 e rotas novas."""
from datetime import date

import pytest
from postgrest.exceptions import APIError

from app.core import auth, dependencies
from app.core.errors import (
    EstadoInvalidoError,
    NaoAutenticadoError,
    NaoEncontradoError,
    SemConteudoError,
)
from app.repositories.estudo_repository import EstudoRepository, FlashcardRepository, SimuladoRepository
from app.repositories.exercicio_repository import COLUNAS_PUBLICAS, RespostaRepository
from app.services.exercicio_service import ExercicioService
from tests.fakes import LLMFalso
from tests.fakes_estudo import (
    EtapaRepoFalso,
    ExercicioRepoFalso,
    RespostaRepoFalso,
    RevisaoRepoFalso,
    TrilhaRepoFalso,
)
from tests.test_repositorios_estudo import Cliente, args

ID = "00000000-0000-4000-8000-000000000001"


# =====================================================================
# "Não entendi"
# =====================================================================
@pytest.fixture
def explicar():
    etapas = EtapaRepoFalso()
    etapas.adicionar()
    exercicios = ExercicioRepoFalso()
    revisoes = RevisaoRepoFalso()
    respostas = RespostaRepoFalso(exercicios, etapas, revisoes)
    respostas.ultima = lambda exercicio_id: next(
        (c["resposta"] for c in reversed(respostas.chamadas) if c["exercicio_id"] == exercicio_id), None)
    llm = LLMFalso("Pense assim: **a + a = à**.")
    servico = ExercicioService(etapas, TrilhaRepoFalso(etapas), exercicios, respostas, revisoes, llm,
                               hoje=lambda: date(2026, 10, 9))
    return servico, exercicios, llm


def test_explicar_so_depois_de_responder(explicar):
    servico, exercicios, llm = explicar
    ex = exercicios.adicionar()
    with pytest.raises(EstadoInvalidoError):
        servico.explicar(ex["id"])
    assert llm.chamadas == []  # o gabarito nem chegou à IA

    servico.responder(ex["id"], "A")
    assert servico.explicar(ex["id"]) == {"explicacao": "Pense assim: **a + a = à**."}
    pedido = llm.chamadas[-1][1]["content"]
    assert "Resposta certa: B" in pedido and "<<<\nA\n>>>" in pedido


def test_explicar_exercicio_inexistente(explicar):
    servico, _, _ = explicar
    with pytest.raises(NaoEncontradoError):
        servico.explicar(ID)


def test_ultima_resposta_le_so_a_mais_recente():
    cliente = Cliente(data=[{"resposta": "C"}])
    assert RespostaRepository(cliente).ultima(ID) == "C"
    assert ("created_at",) in args(cliente, "order") and (1,) in args(cliente, "limit")
    assert RespostaRepository(Cliente(data=[])).ultima(ID) is None


# =====================================================================
# Repositórios
# =====================================================================
def test_simulado_em_andamento_nao_seleciona_gabarito():
    cliente = Cliente(data=[])
    SimuladoRepository(cliente).exercicios_publicos([ID])
    assert args(cliente, "select") == [(COLUNAS_PUBLICAS,)]
    assert "gabarito" not in COLUNAS_PUBLICAS


def test_listas_vazias_nao_consultam():
    cliente = Cliente(data=[])
    repo = SimuladoRepository(cliente)
    assert repo.exercicios_publicos([]) == [] and repo.exercicios_completos([]) == []
    assert cliente.tabelas == []


@pytest.mark.parametrize("mensagem,erro", [
    ("exercicios_insuficientes", SemConteudoError),
    ("simulado_ja_finalizado", EstadoInvalidoError),
    ("simulado_nao_encontrado", NaoEncontradoError),
    ("categoria_nao_encontrada", NaoEncontradoError),
    ("nao_autenticado", NaoAutenticadoError),
])
def test_erros_das_funcoes_sql_viram_erros_de_dominio(mensagem, erro):
    cliente = Cliente(erro=APIError({"message": mensagem}))
    with pytest.raises(erro):
        SimuladoRepository(cliente).finalizar(ID, [])


def test_erro_sql_desconhecido_nao_e_mascarado():
    with pytest.raises(APIError):
        SimuladoRepository(Cliente(erro=APIError({"message": "outro"}))).criar(ID, 5, 600)


def test_rpc_aceita_os_formatos_de_retorno():
    assert SimuladoRepository(Cliente(data=ID)).criar(ID, 5, 600) == ID
    assert SimuladoRepository(Cliente(data=[{"criar_simulado": ID}])).criar(ID, 5, 600) == ID
    cliente = Cliente(data={"id": ID, "dominado": True})
    assert FlashcardRepository(cliente).revisar(ID, True, {"remover": True})["dominado"] is True
    assert cliente.rpcs == [("revisar_flashcard", {"p_flashcard_id": ID, "p_lembrou": True,
                                                   "p_revisao": {"remover": True}})]


def test_meta_e_upsert_por_usuario():
    cliente = Cliente(data=[{"dias_por_semana": 4}])
    EstudoRepository(cliente).salvar_meta("u1", 4, None)
    assert cliente.tabelas == ["metas"]
    upsert = [kw for n, _, kw in cliente.cadeia.chamadas if n == "upsert"][0]
    assert upsert == {"on_conflict": "user_id"}


# =====================================================================
# Rotas: todas exigem login e chegam ao service certo
# =====================================================================
class ServicoEco:
    """Responde com o nome do método chamado, para provar a ligação rota -> service."""

    def __getattr__(self, nome):
        return lambda *a, **k: {"metodo": nome, "args": [str(x) for x in a]}


ROTAS = [
    ("post", f"/etapas/{ID}/flashcards", "get_flashcard_service", "gerar", 201),
    ("get", f"/etapas/{ID}/flashcards", "get_flashcard_service", "listar", 200),
    ("get", "/flashcards/hoje", "get_flashcard_service", "pendentes", 200),
    ("post", f"/flashcards/{ID}/revisar", "get_flashcard_service", "revisar", 200),
    ("post", f"/categorias/{ID}/simulados", "get_simulado_service", "criar", 201),
    ("get", f"/categorias/{ID}/simulados", "get_simulado_service", "listar", 200),
    ("get", f"/simulados/{ID}", "get_simulado_service", "obter", 200),
    ("post", f"/simulados/{ID}/finalizar", "get_simulado_service", "finalizar", 200),
    ("post", "/sessoes-estudo", "get_estudo_service", "registrar_sessao", 201),
    ("get", "/metas", "get_estudo_service", "meta", 200),
    ("put", "/metas", "get_estudo_service", "salvar_meta", 200),
    ("get", "/hoje", "get_estudo_service", "hoje", 200),
    ("post", f"/exercicios/{ID}/explicar", "get_exercicio_service", "explicar", 200),
]


@pytest.fixture
def logado(monkeypatch):
    def validar(token):
        if token != "ok":
            raise NaoAutenticadoError("Token inválido.")
        return "u1"

    monkeypatch.setattr(auth, "obter_user_id", validar)
    for fabrica in {r[2] for r in ROTAS}:
        monkeypatch.setattr(dependencies, fabrica, lambda: ServicoEco())


@pytest.mark.parametrize("metodo,url,_fabrica,acao,status", ROTAS)
def test_rotas_novas(client, logado, metodo, url, _fabrica, acao, status):
    chamar = getattr(client, metodo)
    assert chamar(url, json={}).status_code == 401
    resposta = chamar(url, json={}, headers={"Authorization": "Bearer ok"})
    assert resposta.status_code == status
    assert resposta.get_json()["metodo"] == acao
