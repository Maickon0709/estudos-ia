import uuid

import pytest

from app.core.errors import IAIndisponivelError, NaoEncontradoError, ValidacaoError
from app.services.categoria_service import CategoriaService
from app.services.chat_service import HISTORICO_MAX, MENSAGEM_MAX, ChatService
from tests.fakes import LLMFalso, MensagemRepoFalso
from tests.test_categoria_service import RepoFalso


@pytest.fixture
def cenario():
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "Português")
    mensagens = MensagemRepoFalso()
    llm = LLMFalso()
    service = ChatService(CategoriaService(categorias), mensagens, llm)
    return service, categoria, mensagens, llm


def test_enviar_grava_o_par_e_devolve(cenario):
    service, categoria, mensagens, _ = cenario
    resultado = service.enviar(categoria["id"], "  Quero aprender crase  ")

    assert resultado["pergunta"]["conteudo"] == "Quero aprender crase"
    assert resultado["resposta"]["conteudo"] == "Resposta da IA."
    assert [m["papel"] for m in mensagens.itens] == ["user", "assistant"]


def test_contexto_tem_system_com_nome_da_categoria_e_a_pergunta_no_fim(cenario):
    service, categoria, _, llm = cenario
    service.enviar(categoria["id"], "Oi")

    contexto = llm.chamadas[0]
    assert contexto[0]["role"] == "system"
    assert "Português" in contexto[0]["content"]
    assert contexto[-1] == {"role": "user", "content": "Oi"}


def test_historico_anterior_entra_no_contexto_em_ordem(cenario):
    service, categoria, _, llm = cenario
    service.enviar(categoria["id"], "primeira")
    service.enviar(categoria["id"], "segunda")

    contexto = llm.chamadas[1]
    papeis = [m["role"] for m in contexto]
    assert papeis == ["system", "user", "assistant", "user"]
    assert contexto[1]["content"] == "primeira"
    assert contexto[-1]["content"] == "segunda"


def test_historico_enviado_a_ia_e_limitado(cenario):
    service, categoria, mensagens, llm = cenario
    for i in range(30):
        mensagens.criar_par(categoria["id"], f"p{i}", f"r{i}")

    service.enviar(categoria["id"], "nova")

    # system + HISTORICO_MAX anteriores + a nova pergunta
    assert len(llm.chamadas[0]) == 1 + HISTORICO_MAX + 1


def test_falha_da_ia_nao_grava_nada(cenario):
    service, categoria, mensagens, llm = cenario
    llm.erro = IAIndisponivelError("fora do ar")

    with pytest.raises(IAIndisponivelError):
        service.enviar(categoria["id"], "Oi")
    assert mensagens.itens == []


def test_categoria_inexistente_nao_chama_a_ia(cenario):
    service, _, _, llm = cenario
    with pytest.raises(NaoEncontradoError):
        service.enviar(str(uuid.uuid4()), "Oi")
    assert llm.chamadas == []


def test_id_invalido(cenario):
    service, *_ = cenario
    with pytest.raises(ValidacaoError):
        service.enviar("abc", "Oi")


@pytest.mark.parametrize("texto", [None, "", "   ", 42, ["oi"]])
def test_mensagem_invalida(cenario, texto):
    service, categoria, _, llm = cenario
    with pytest.raises(ValidacaoError):
        service.enviar(categoria["id"], texto)
    assert llm.chamadas == []


def test_mensagem_no_limite_passa_e_acima_falha(cenario):
    service, categoria, *_ = cenario
    service.enviar(categoria["id"], "a" * MENSAGEM_MAX)
    with pytest.raises(ValidacaoError):
        service.enviar(categoria["id"], "a" * (MENSAGEM_MAX + 1))


def test_historico_lista_as_mensagens(cenario):
    service, categoria, *_ = cenario
    service.enviar(categoria["id"], "Oi")
    assert [m["papel"] for m in service.historico(categoria["id"])] == ["user", "assistant"]


def test_historico_de_categoria_inexistente(cenario):
    service, *_ = cenario
    with pytest.raises(NaoEncontradoError):
        service.historico(str(uuid.uuid4()))
