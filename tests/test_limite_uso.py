"""Limite de uso por usuário: regra do service, decorador nas rotas e correção aberta."""
from datetime import date

import pytest

from app.core import auth, dependencies
from app.core.errors import LimiteUsoError
from app.services.uso_service import UsoService
from tests.test_exercicio_service import c  # noqa: F401  (fixture)

CABECALHO = {"Authorization": "Bearer token-valido"}
LIMITES = {"chat": 2, "ia": 1, "pesquisa": 1}


class UsoRepoFalso:
    """Imita a função SQL consumir_uso: soma até o limite e depois recusa."""

    def __init__(self):
        self.contagem = {}

    def consumir(self, tipo, limite):
        atual = self.contagem.get(tipo, 0)
        if atual >= limite:
            return False
        self.contagem[tipo] = atual + 1
        return True

    def usados(self, dia):
        self.dia_pedido = dia
        return dict(self.contagem)


def test_consumir_ate_o_limite_e_depois_recusar():
    repo = UsoRepoFalso()
    service = UsoService(repo, LIMITES)
    service.consumir("chat")
    service.consumir("chat")
    with pytest.raises(LimiteUsoError) as erro:
        service.consumir("chat")
    assert "2 mensagens" in erro.value.mensagem
    assert "meia-noite" in erro.value.mensagem
    assert erro.value.status_code == 429


def test_tipos_tem_contadores_separados():
    service = UsoService(UsoRepoFalso(), LIMITES)
    service.consumir("ia")
    service.consumir("chat")  # o limite de IA cheio não bloqueia o chat
    with pytest.raises(LimiteUsoError):
        service.consumir("ia")


def test_tipo_desconhecido_e_erro_de_programacao():
    with pytest.raises(ValueError):
        UsoService(UsoRepoFalso(), LIMITES).consumir("video")


def test_resumo_mostra_usado_e_limite_de_hoje():
    repo = UsoRepoFalso()
    service = UsoService(repo, LIMITES, hoje=lambda: date(2026, 10, 10))
    service.consumir("chat")
    assert service.resumo() == {
        "chat": {"usado": 1, "limite": 2},
        "ia": {"usado": 0, "limite": 1},
        "pesquisa": {"usado": 0, "limite": 1},
    }
    assert repo.dia_pedido == "2026-10-10"


# ---------- rotas ----------
@pytest.fixture
def limitado(monkeypatch):
    service = UsoService(UsoRepoFalso(), {"chat": 1, "ia": 1, "pesquisa": 1})
    monkeypatch.setattr(auth, "obter_user_id", lambda token: "user-1")
    monkeypatch.setattr(dependencies, "get_uso_service", lambda: service)
    return service


@pytest.mark.parametrize(
    ("caminho", "tipo"),
    [
        ("/categorias/c1/chat", "chat"),
        ("/categorias/c1/chat/stream", "chat"),
        ("/categorias/c1/pesquisar", "pesquisa"),
        ("/categorias/c1/propostas", "pesquisa"),
        ("/etapas/e1/exercicios", "ia"),
        ("/exercicios/x1/explicar", "ia"),
        ("/etapas/e1/flashcards", "ia"),
    ],
    ids=lambda v: v,
)
def test_rota_com_cota_esgotada_responde_429_sem_chamar_o_service(client, limitado, monkeypatch, caminho, tipo):
    limitado.consumir(tipo)  # gasta a única unidade do dia

    def nao_pode_chamar():
        raise AssertionError("o service não deveria ser montado com a cota esgotada")

    for nome in ("get_chat_service", "get_pesquisa_service", "get_proposta_service",
                 "get_exercicio_service", "get_flashcard_service"):
        monkeypatch.setattr(dependencies, nome, nao_pode_chamar)

    resposta = client.post(caminho, json={}, headers=CABECALHO)
    assert resposta.status_code == 429
    assert resposta.get_json()["erro"] == "limite_uso"


def test_rota_de_cota_exige_login_antes_de_contar(client, limitado):
    # sem login: 401, e o contador não anda
    assert client.post("/categorias/c1/chat", json={"mensagem": "oi"}).status_code == 401
    limitado.consumir("chat")  # a unidade continua disponível


def test_resumo_de_uso_na_conta(client, limitado):
    resposta = client.get("/conta/uso", headers=CABECALHO)
    assert resposta.status_code == 200
    assert resposta.get_json()["chat"] == {"usado": 0, "limite": 1}


# ---------- correção de resposta aberta (gasta IA; múltipla escolha não) ----------
def test_so_a_resposta_aberta_gasta_cota_de_ia(c):
    service = UsoService(UsoRepoFalso(), {"chat": 1, "ia": 1, "pesquisa": 1})
    c.servico._uso = service

    multipla = c.exercicios.adicionar(gabarito="B")
    for _ in range(3):  # corrigida no código: não conta
        c.servico.responder(multipla["id"], "B")

    aberta = c.exercicios.adicionar(tipo="discursiva", gabarito="X")
    c.llm.resposta = '{"correta": true, "feedback": "Ok"}'
    c.servico.responder(aberta["id"], "primeira")
    chamadas_antes = len(c.llm.chamadas)
    gravadas_antes = len(c.respostas.chamadas)
    with pytest.raises(LimiteUsoError):
        c.servico.responder(aberta["id"], "segunda")
    assert len(c.llm.chamadas) == chamadas_antes  # nem chegou na IA
    assert len(c.respostas.chamadas) == gravadas_antes  # e nada foi gravado
