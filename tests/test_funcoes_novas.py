"""Flashcards, simulado, cronômetro, metas, tela "Hoje" e "não entendi"."""
import json
from datetime import date, datetime, timedelta, timezone

import pytest

from app.core.errors import (
    EstadoInvalidoError,
    IAIndisponivelError,
    NaoEncontradoError,
    ValidacaoError,
)
from app.services.categoria_service import CategoriaService
from app.services.estudo_service import EstudoService
from app.services.exercicio_parser import montar_flashcards
from app.services.flashcard_service import FlashcardService
from app.services.painel_service import PainelService
from app.services.simulado_service import SimuladoService
from tests.fakes import LLMFalso
from tests.fakes_estudo import (
    ETAPA,
    EtapaRepoFalso,
    PainelRepoFalso,
    RevisaoRepoFalso,
    TrilhaRepoFalso,
)
from tests.fakes_novos import EstudoRepoFalso, FlashcardRepoFalso, SimuladoRepoFalso, novo_id
from tests.test_categoria_service import RepoFalso

HOJE = date(2026, 10, 9)  # sexta-feira
AGORA = datetime(2026, 10, 9, 15, 0, tzinfo=timezone.utc)


# =====================================================================
# Flashcards
# =====================================================================
@pytest.fixture
def flash():
    etapas = EtapaRepoFalso()
    etapas.adicionar()
    trilhas = TrilhaRepoFalso(etapas)
    trilhas.adicionar()
    repo = FlashcardRepoFalso()
    llm = LLMFalso(json.dumps({"cartoes": [
        {"frente": "O que é crase?", "verso": "Fusão de a + a."},
        {"frente": "o que é crase?", "verso": "repetido"},
        {"frente": "", "verso": "sem frente"},
        {"frente": "Crase antes de masculino?", "verso": "Não, salvo exceções."},
    ]}))
    return FlashcardService(etapas, trilhas, repo, llm, hoje=lambda: HOJE), repo, llm


def test_gerar_flashcards_valida_e_descarta_repetidos(flash):
    servico, repo, llm = flash
    criados = servico.gerar(ETAPA, 5)
    assert [c["frente"] for c in criados] == ["O que é crase?", "Crase antes de masculino?"]
    assert "Guia de crase" in llm.chamadas[0][1]["content"]  # usa as fontes verificadas da etapa


def test_gerar_flashcards_quantidade_invalida_nao_chama_ia(flash):
    servico, _, llm = flash
    for ruim in (0, 11, "5", True):
        with pytest.raises(ValidacaoError):
            servico.gerar(ETAPA, ruim)
    assert llm.chamadas == []


def test_gerar_flashcards_etapa_inexistente(flash):
    servico, _, _ = flash
    with pytest.raises(NaoEncontradoError):
        servico.gerar(novo_id())


def test_flashcards_ia_sem_cartao_valido():
    with pytest.raises(IAIndisponivelError):
        montar_flashcards({"cartoes": [{"frente": "", "verso": ""}]}, 5)
    with pytest.raises(IAIndisponivelError):
        montar_flashcards({"outra": []}, 5)


def test_revisar_flashcard_segue_a_revisao_espacada(flash):
    servico, repo, _ = flash
    (cartao, *_) = servico.gerar(ETAPA, 1)

    lembrou = servico.revisar(cartao["id"], True)
    assert (lembrou["intervalo_dias"], lembrou["proxima_revisao"]) == (3, "2026-10-12")

    esqueceu = servico.revisar(cartao["id"], False)
    assert (esqueceu["intervalo_dias"], esqueceu["acertos_seguidos"], esqueceu["proxima_revisao"]) == (1, 0, "2026-10-10")


def test_flashcard_dominado_depois_de_cinco_acertos(flash):
    servico, _, _ = flash
    (cartao, *_) = servico.gerar(ETAPA, 1)
    for _ in range(5):
        resultado = servico.revisar(cartao["id"], True)
    assert resultado["dominado"] is True


def test_revisar_flashcard_valida_entrada(flash):
    servico, _, _ = flash
    with pytest.raises(ValidacaoError):
        servico.revisar(novo_id(), "sim")
    with pytest.raises(NaoEncontradoError):
        servico.revisar(novo_id(), True)


# =====================================================================
# Simulado
# =====================================================================
def exercicio(gabarito="B", tipo="multipla_escolha"):
    return {"id": novo_id(), "etapa_id": ETAPA, "nivel": "basico", "tipo": tipo, "enunciado": "Pergunta?",
            "opcoes": ["um", "dois", "três", "quatro"], "gabarito": gabarito, "explicacao": "Porque sim.",
            "fontes": [], "created_at": "2026-10-09T12:00:00+00:00"}


@pytest.fixture
def simulado():
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "Português")
    exs = [exercicio("B"), exercicio("C"), exercicio("A"), exercicio(tipo="discursiva")]
    repo = SimuladoRepoFalso({e["id"]: e for e in exs})
    return SimuladoService(CategoriaService(categorias), repo), repo, categoria


def test_criar_simulado_nao_expoe_gabarito(simulado):
    servico, repo, categoria = simulado
    s = servico.criar(categoria["id"], 5, 10)
    assert s["limite_segundos"] == 600
    assert s["prazo_em"] == "2026-10-09T12:10:00+00:00"
    assert len(s["questoes"]) == 3
    for q in s["questoes"]:
        assert "gabarito" not in q["exercicio"] and "explicacao" not in q["exercicio"]
        assert "resposta" not in q and "correta" not in q
    assert repo.pediu_completos == []  # nem leu o gabarito do banco


def test_finalizar_corrige_no_codigo_e_revela_gabarito(simulado):
    servico, repo, categoria = simulado
    s = servico.criar(categoria["id"], 3, 10)
    resultado = servico.finalizar(s["id"], {"1": "b", "2": "A", "3": ""})  # 3 em branco

    _, itens = repo.finalizacoes[0]
    assert itens == [{"ordem": 1, "resposta": "B", "correta": True},
                     {"ordem": 2, "resposta": "A", "correta": False}]
    assert resultado["acertos"] == 1
    assert [q["correta"] for q in resultado["questoes"]] == [True, False, False]
    assert resultado["questoes"][0]["exercicio"]["gabarito"] == "B"


def test_finalizar_letra_inexistente_conta_como_errada(simulado):
    servico, repo, categoria = simulado
    s = servico.criar(categoria["id"], 3, 10)
    servico.finalizar(s["id"], {"1": "Z"})
    assert repo.finalizacoes[0][1] == [{"ordem": 1, "resposta": None, "correta": False}]


def test_finalizar_duas_vezes_recusa(simulado):
    servico, _, categoria = simulado
    s = servico.criar(categoria["id"], 3, 10)
    servico.finalizar(s["id"], {})
    with pytest.raises(EstadoInvalidoError):
        servico.finalizar(s["id"], {})


@pytest.mark.parametrize("respostas", [None, [], {"x": "A"}, {"1": 3}, {"1": "A" * 11}])
def test_finalizar_valida_formato(simulado, respostas):
    servico, _, categoria = simulado
    s = servico.criar(categoria["id"], 3, 10)
    with pytest.raises(ValidacaoError):
        servico.finalizar(s["id"], respostas)


@pytest.mark.parametrize("quantidade,minutos", [(2, 10), (21, 10), (5, 0), (5, 121), ("5", 10), (True, 10)])
def test_criar_simulado_valida_limites(simulado, quantidade, minutos):
    servico, _, categoria = simulado
    with pytest.raises(ValidacaoError):
        servico.criar(categoria["id"], quantidade, minutos)


def test_simulado_de_categoria_inexistente(simulado):
    servico, _, _ = simulado
    with pytest.raises(NaoEncontradoError):
        servico.criar(novo_id(), 5, 10)
    with pytest.raises(NaoEncontradoError):
        servico.obter(novo_id())


# =====================================================================
# Cronômetro, metas e "Hoje"
# =====================================================================
@pytest.fixture
def estudo():
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "SQL")
    repo = EstudoRepoFalso()
    revisoes = RevisaoRepoFalso()
    flashcards = FlashcardRepoFalso()
    servico = EstudoService(CategoriaService(categorias), repo, revisoes, flashcards,
                            hoje=lambda: HOJE, agora=lambda: AGORA)
    return servico, repo, revisoes, flashcards, categoria


def sessao(**extra):
    return {"tipo": "foco", "duracao_segundos": 1500,
            "iniciada_em": (AGORA - timedelta(minutes=30)).isoformat(), **extra}


def test_registrar_sessao(estudo):
    servico, repo, _, _, categoria = estudo
    salva = servico.registrar_sessao(sessao(categoria_id=categoria["id"]))
    assert salva["categoria_id"] == categoria["id"] and salva["duracao_segundos"] == 1500
    assert servico.registrar_sessao(sessao())["categoria_id"] is None  # sem categoria vale


@pytest.mark.parametrize("ruim", [
    {"duracao_segundos": 30}, {"duracao_segundos": 4 * 3600 + 1}, {"duracao_segundos": "1500"},
    {"tipo": "outro"}, {"iniciada_em": "ontem"}, {"iniciada_em": "2026-10-09T12:00:00"},
    {"iniciada_em": (AGORA + timedelta(hours=1)).isoformat()},
    {"iniciada_em": (AGORA - timedelta(days=3)).isoformat()},
])
def test_registrar_sessao_valida(estudo, ruim):
    servico, repo, _, _, _ = estudo
    with pytest.raises(ValidacaoError):
        servico.registrar_sessao(sessao(**ruim))
    assert repo.sessoes == []


def test_sessao_em_categoria_alheia(estudo):
    servico, _, _, _, _ = estudo
    with pytest.raises(NaoEncontradoError):
        servico.registrar_sessao(sessao(categoria_id=novo_id()))


def test_metas(estudo):
    servico, _, _, _, _ = estudo
    assert servico.meta() == {"dias_por_semana": None, "minutos_por_semana": None}
    servico.salvar_meta("u1", {"dias_por_semana": 4, "minutos_por_semana": 180})
    assert servico.meta()["dias_por_semana"] == 4
    for ruim in ({"dias_por_semana": 0}, {"dias_por_semana": 8}, {"dias_por_semana": 3, "minutos_por_semana": -1},
                 {"dias_por_semana": "3"}, None):
        with pytest.raises(ValidacaoError):
            servico.salvar_meta("u1", ruim)


def test_hoje_junta_tudo(estudo):
    servico, repo, revisoes, flashcards, categoria = estudo
    repo.linhas_atividade = [
        {"dia": "2026-10-05", "respostas": 3, "flashcards": 0, "minutos": 0, "simulados": 0},   # segunda
        {"dia": "2026-10-08", "respostas": 0, "flashcards": 2, "minutos": 25, "simulados": 0},  # quinta
        {"dia": "2026-10-09", "respostas": 1, "flashcards": 0, "minutos": 50, "simulados": 1},  # hoje
        {"dia": "2026-10-01", "respostas": 1, "flashcards": 0, "minutos": 0, "simulados": 0},   # semana passada
    ]
    repo.progresso = [{"categoria_id": categoria["id"], "categoria": "SQL",
                       "total_etapas": 4, "etapas_concluidas": 1, "pct_concluido": "25.0"}]
    repo.meta = {"dias_por_semana": 4, "minutos_por_semana": 120}
    revisoes.lista_pendentes = [{"categoria_id": categoria["id"]}]
    flashcards.lista_pendentes = [{}, {}]

    h = servico.hoje()
    assert h["hoje"] == "2026-10-09"
    assert (h["revisoes_pendentes"], h["flashcards_pendentes"]) == (1, 2)
    assert h["categorias"] == [{"id": categoria["id"], "nome": "SQL", "total_etapas": 4,
                                "etapas_concluidas": 1, "pct_concluido": 25.0}]
    assert h["semana"] == {"inicio": "2026-10-05", "dias_estudados": 3, "minutos": 75}
    assert (h["sequencia_dias"], h["estudou_hoje"]) == (2, True)
    hoje_dia = next(a for a in h["atividade"] if a["dia"] == "2026-10-09")
    assert hoje_dia["total"] == 1 + 1 + 50 // 10
    assert repo.atividade_desde == "2026-04-11"  # 26 semanas
    assert h["meta"]["dias_por_semana"] == 4


def test_painel_tem_minutos_das_ultimas_8_semanas():
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "SQL")
    estudo_repo = EstudoRepoFalso()
    estudo_repo.semanais = [{"semana": "2026-10-05", "minutos": 75}, {"semana": "2026-09-21", "minutos": 30}]
    servico = PainelService(CategoriaService(categorias), PainelRepoFalso(), RevisaoRepoFalso(),
                            hoje=lambda: HOJE, estudo_repo=estudo_repo)
    semanas = servico.painel(categoria["id"])["minutos_por_semana"]
    assert len(semanas) == 8
    assert semanas[0]["semana"] == "2026-08-17" and semanas[-1] == {"semana": "2026-10-05", "minutos": 75}
    assert {"semana": "2026-09-21", "minutos": 30} in semanas
    assert sum(s["minutos"] for s in semanas) == 105
