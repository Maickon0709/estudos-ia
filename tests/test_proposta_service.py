import json
import uuid

import pytest

from app.core.errors import (
    EstadoInvalidoError,
    IAIndisponivelError,
    NaoEncontradoError,
    SemConteudoError,
    ValidacaoError,
)
from app.services.categoria_service import CategoriaService
from app.services.proposta_service import MAX_RECURSOS_IA, OBJETIVO_MAX, PropostaService
from tests.fakes import LLMFalso, MensagemRepoFalso
from tests.fakes_propostas import PesquisaFalsa, PropostaRepoFalso, rec
from tests.test_categoria_service import RepoFalso

RESPOSTA_OK = json.dumps({
    "titulo": "Crase do zero",
    "etapas": [
        {"titulo": "Conceito", "descricao": "O que é", "recursos": [1, 2]},
        {"titulo": "Prática", "descricao": "Exercite", "recursos": [3]},
    ],
})


@pytest.fixture
def cenario():
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "Português")
    outra = categorias.criar("u1", "Inglês")
    mensagens = MensagemRepoFalso()
    pesquisa = PesquisaFalsa()
    llm = LLMFalso(resposta=RESPOSTA_OK)
    propostas = PropostaRepoFalso()
    servico = PropostaService(CategoriaService(categorias), mensagens, pesquisa, llm, propostas)
    return {
        "servico": servico, "categoria": categoria, "outra": outra, "mensagens": mensagens,
        "pesquisa": pesquisa, "llm": llm, "propostas": propostas,
    }


def prompt_enviado(llm):
    return "\n".join(m["content"] for m in llm.chamadas[-1])


# ---------- gerar ----------
def test_gerar_salva_proposta_pendente_com_recursos_verificados(cenario):
    c = cenario
    proposta = c["servico"].gerar(c["categoria"]["id"], "  aprender   crase ")

    assert proposta["status"] == "pendente"
    assert proposta["categoria_id"] == c["categoria"]["id"]
    payload = proposta["payload"]
    assert payload["titulo"] == "Crase do zero"
    assert payload["objetivo"] == "aprender crase"
    assert payload["youtube_verificado"] is True
    urls = [[r["url"] for r in e["recursos"]] for e in payload["etapas"]]
    assert urls == [["https://site1.com/aula", "https://site2.com/aula"], ["https://site3.com/aula"]]
    assert c["pesquisa"].chamadas == ["aprender crase"]


def test_a_ia_nem_ve_as_urls_so_numeros_e_titulos(cenario):
    c = cenario
    c["servico"].gerar(c["categoria"]["id"], "crase")
    texto = prompt_enviado(c["llm"])
    assert "https://" not in texto
    assert "[1] (link) Material 1" in texto
    assert "[3] (video, 10 min) Material 3" in texto
    assert "JSON" in c["llm"].chamadas[-1][0]["content"]


def test_conversa_do_chat_entra_como_contexto(cenario):
    c = cenario
    c["mensagens"].criar_par(c["categoria"]["id"], "Sou iniciante, tenho 30 min por dia", "Ótimo!")
    c["servico"].gerar(c["categoria"]["id"], "crase")
    texto = prompt_enviado(c["llm"])
    assert "Estudante: Sou iniciante, tenho 30 min por dia" in texto
    assert "Tutor: Ótimo!" in texto


def test_url_inventada_pela_ia_nao_chega_na_proposta(cenario):
    c = cenario
    c["llm"].resposta = json.dumps({
        "etapas": [{"titulo": "A", "recursos": [1, "https://golpe.com", {"url": "https://golpe.com"}]}]
    })
    proposta = c["servico"].gerar(c["categoria"]["id"], "crase")
    assert "golpe" not in json.dumps(proposta)


def test_nova_proposta_substitui_pendentes_da_mesma_categoria(cenario):
    c = cenario
    primeira = c["servico"].gerar(c["categoria"]["id"], "crase")
    de_outra_categoria = c["servico"].gerar(c["outra"]["id"], "verb to be")
    segunda = c["servico"].gerar(c["categoria"]["id"], "crase de novo")

    status = {pid: p["status"] for pid, p in c["propostas"].itens.items()}
    assert status[primeira["id"]] == "rejeitada"
    assert status[segunda["id"]] == "pendente"
    assert status[de_outra_categoria["id"]] == "pendente"


def test_verificados_primeiro_e_no_maximo_12_materiais(cenario):
    c = cenario
    c["pesquisa"].recursos = (
        [rec(n, "video", verificacao="nao_verificado") for n in range(100, 105)]
        + [rec(n) for n in range(1, 11)]
    )
    c["llm"].resposta = json.dumps({"etapas": [{"titulo": "A", "recursos": [1]}]})
    proposta = c["servico"].gerar(c["categoria"]["id"], "crase")

    texto = prompt_enviado(c["llm"])
    assert "[1] (link) Material 1 " in texto            # verificado vem primeiro
    assert f"[{MAX_RECURSOS_IA}]" in texto
    assert f"[{MAX_RECURSOS_IA + 1}]" not in texto
    assert proposta["payload"]["etapas"][0]["recursos"][0]["url"] == "https://site1.com/aula"


def test_sem_material_verificado_nao_chama_a_ia_nem_salva(cenario):
    c = cenario
    c["pesquisa"].recursos = []
    with pytest.raises(SemConteudoError):
        c["servico"].gerar(c["categoria"]["id"], "crase")
    assert c["llm"].chamadas == []
    assert c["propostas"].itens == {}


@pytest.mark.parametrize(
    "resposta",
    ["isso não é json", json.dumps({"etapas": [{"titulo": "A", "recursos": [77]}]}), json.dumps({"x": 1})],
)
def test_resposta_ruim_da_ia_nao_salva_nada(cenario, resposta):
    c = cenario
    c["llm"].resposta = resposta
    with pytest.raises(IAIndisponivelError):
        c["servico"].gerar(c["categoria"]["id"], "crase")
    assert c["propostas"].itens == {}


def test_ia_fora_do_ar_nao_salva_nada(cenario):
    c = cenario
    c["llm"].erro = IAIndisponivelError("fora")
    with pytest.raises(IAIndisponivelError):
        c["servico"].gerar(c["categoria"]["id"], "crase")
    assert c["propostas"].itens == {}


@pytest.mark.parametrize("objetivo", [None, "", "  ", "ab", 5, "a" * (OBJETIVO_MAX + 1)])
def test_objetivo_invalido_nao_gasta_credito(cenario, objetivo):
    c = cenario
    with pytest.raises(ValidacaoError):
        c["servico"].gerar(c["categoria"]["id"], objetivo)
    assert c["pesquisa"].chamadas == []


def test_categoria_inexistente_nao_gasta_credito(cenario):
    c = cenario
    with pytest.raises(NaoEncontradoError):
        c["servico"].gerar(str(uuid.uuid4()), "crase")
    assert c["pesquisa"].chamadas == []


# ---------- listar / obter ----------
def test_listar_filtra_por_status(cenario):
    c = cenario
    c["servico"].gerar(c["categoria"]["id"], "crase")
    c["servico"].gerar(c["categoria"]["id"], "crase 2")
    cat = c["categoria"]["id"]
    assert len(c["servico"].listar(cat)) == 2
    assert len(c["servico"].listar(cat, "pendente")) == 1
    assert len(c["servico"].listar(cat, "rejeitada")) == 1


def test_listar_status_invalido(cenario):
    with pytest.raises(ValidacaoError):
        cenario["servico"].listar(cenario["categoria"]["id"], "aprovada")


def test_obter(cenario):
    c = cenario
    criada = c["servico"].gerar(c["categoria"]["id"], "crase")
    assert c["servico"].obter(criada["id"])["id"] == criada["id"]
    with pytest.raises(NaoEncontradoError):
        c["servico"].obter(str(uuid.uuid4()))
    with pytest.raises(ValidacaoError):
        c["servico"].obter("abc")


# ---------- confirmar / rejeitar ----------
def test_confirmar_devolve_trilha_e_proposta_atualizada(cenario):
    c = cenario
    criada = c["servico"].gerar(c["categoria"]["id"], "crase")
    resultado = c["servico"].confirmar(criada["id"])
    assert resultado["trilha_id"].startswith("trilha-de-")
    assert resultado["proposta"]["status"] == "confirmada"

    with pytest.raises(EstadoInvalidoError):
        c["servico"].confirmar(criada["id"])


def test_confirmar_id_invalido(cenario):
    with pytest.raises(ValidacaoError):
        cenario["servico"].confirmar("nao-e-uuid")


def test_rejeitar(cenario):
    c = cenario
    criada = c["servico"].gerar(c["categoria"]["id"], "crase")
    assert c["servico"].rejeitar(criada["id"])["status"] == "rejeitada"
    with pytest.raises(EstadoInvalidoError):
        c["servico"].rejeitar(criada["id"])
    with pytest.raises(EstadoInvalidoError):
        c["servico"].confirmar(criada["id"])  # rejeitada não pode ser confirmada
    with pytest.raises(NaoEncontradoError):
        c["servico"].rejeitar(str(uuid.uuid4()))
