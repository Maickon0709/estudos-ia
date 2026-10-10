"""Trilha a partir dos materiais do aluno: partes numeradas, proposta, trilha e exercícios com o texto dos arquivos."""
import json
import uuid
from datetime import date

import pytest

from app.core import auth, dependencies
from app.core.errors import IAIndisponivelError, NaoAutenticadoError, SemConteudoError
from app.repositories.documento_repository import DocumentoRepository
from app.repositories.trilha_repository import EtapaRepository, TrilhaRepository
from app.services.categoria_service import CategoriaService
from app.services.exercicio_service import ExercicioService
from app.services.flashcard_service import FlashcardService
from app.services.materiais_trilha import (
    FONTES_DE_MATERIAL,
    PREVIA_NA_LISTA,
    TEXTO_POR_FONTE,
    fontes_de_material,
    montar_partes,
    rotulo,
)
from app.services.proposta_parser import MAX_PARTES_POR_ETAPA, montar_payload_materiais
from app.services.proposta_service import PropostaService
from app.services.trilha_service import TrilhaService
from tests.fakes import LLMFalso, MensagemRepoFalso
from tests.fakes_estudo import ETAPA, TRILHA, EtapaRepoFalso, ExercicioRepoFalso, RespostaRepoFalso, RevisaoRepoFalso, TrilhaRepoFalso
from tests.fakes_novos import FlashcardRepoFalso
from tests.fakes_propostas import PesquisaFalsa, PropostaRepoFalso
from tests.test_categoria_service import RepoFalso
from tests.test_repositorios_estudo import Cadeia

D1, D2 = "d1", "d2"


def previa(documento_id, nome, n, pagina_por_trecho=True):
    return [{"documento_id": documento_id, "nome": nome, "ordem": i, "pagina": i if pagina_por_trecho else None,
             "previa": f"{nome} trecho {i} " + "x" * 300} for i in range(1, n + 1)]


# ---------- partes ----------
def test_partes_nao_misturam_arquivos_e_guardam_paginas():
    partes = montar_partes(previa(D1, "aula.pdf", 6) + previa(D2, "resumo.docx", 2, pagina_por_trecho=False), max_partes=4)
    assert len(partes) <= 4
    assert {p["documento_id"] for p in partes} == {D1, D2}
    for p in partes:
        assert p["ordem_inicio"] <= p["ordem_fim"]
        if p["documento_id"] == D1:
            assert (p["pagina_inicio"], p["pagina_fim"]) == (p["ordem_inicio"], p["ordem_fim"])
        else:
            assert p["pagina_inicio"] is None
        assert len(p["previa"]) <= PREVIA_NA_LISTA
    # cobre todos os trechos de cada arquivo, sem buraco
    de_d1 = sorted((p["ordem_inicio"], p["ordem_fim"]) for p in partes if p["documento_id"] == D1)
    assert de_d1[0][0] == 1 and de_d1[-1][1] == 6
    assert all(a[1] + 1 == b[0] for a, b in zip(de_d1, de_d1[1:]))


@pytest.mark.parametrize("total,maximo", [(1, 40), (40, 40), (41, 40), (500, 40), (300, 10)])
def test_partes_respeitam_o_teto(total, maximo):
    assert len(montar_partes(previa(D1, "a.pdf", total), max_partes=maximo)) <= maximo


def test_sem_previa_sem_partes():
    assert montar_partes([]) == []


@pytest.mark.parametrize("material,esperado", [
    ({"nome": "aula.pdf", "pagina_inicio": 3, "pagina_fim": 5}, "aula.pdf, p. 3-5"),
    ({"nome": "aula.pdf", "pagina_inicio": 4, "pagina_fim": 4}, "aula.pdf, p. 4"),
    ({"nome": "resumo.docx", "pagina_inicio": None, "pagina_fim": None}, "resumo.docx"),
    ({"nome": None}, "material"),
])
def test_rotulo(material, esperado):
    assert rotulo(material) == esperado


# ---------- texto das partes para exercícios ----------
def etapas_com_material(textos):
    etapas = EtapaRepoFalso()
    etapas.adicionar()
    etapas.materiais_por_etapa[ETAPA] = [
        {"documento_id": f"d{i}", "nome": f"aula{i}.pdf", "ordem_inicio": 1, "ordem_fim": 2, "pagina_inicio": 1, "pagina_fim": 2}
        for i in range(len(textos))
    ]
    for i, texto in enumerate(textos):
        etapas.textos[(f"d{i}", 1, 2)] = [{"ordem": 1, "pagina": 1, "conteudo": texto}] if texto else []
    return etapas


def test_fontes_de_material_trazem_o_texto_com_rotulo_e_teto():
    fontes = fontes_de_material(etapas_com_material(["Viabilidade técnica.", "", "y" * 9000, "a", "b"]), ETAPA)
    assert len(fontes) <= FONTES_DE_MATERIAL
    assert fontes[0] == {"titulo": "aula0.pdf, p. 1-2", "conteudo": "Viabilidade técnica."}
    assert all(len(f["conteudo"]) <= TEXTO_POR_FONTE for f in fontes)
    assert "aula1.pdf, p. 1-2" not in [f["titulo"] for f in fontes]  # arquivo apagado (sem texto) fica de fora


# ---------- parser ----------
PARTES = {
    1: {"documento_id": D1, "nome": "aula.pdf", "ordem_inicio": 1, "ordem_fim": 3, "pagina_inicio": 1, "pagina_fim": 3, "previa": "..."},
    2: {"documento_id": D1, "nome": "aula.pdf", "ordem_inicio": 4, "ordem_fim": 6, "pagina_inicio": 4, "pagina_fim": 6, "previa": "..."},
    3: {"documento_id": D2, "nome": "sad.pdf", "ordem_inicio": 1, "ordem_fim": 2, "pagina_inicio": 1, "pagina_fim": 2, "previa": "..."},
}


def test_parser_usa_so_partes_numeradas_e_cada_uma_uma_vez():
    dados = {"titulo": "Ciclo de vida", "etapas": [
        {"titulo": "Viabilidade", "descricao": "Base", "materiais": [1, "2", 99, True, "https://x.com"]},
        {"titulo": "Repetida", "materiais": [1]},           # parte já usada: etapa fica vazia e sai
        {"titulo": "SAD", "materiais": [3], "recursos": [{"url": "https://inventado.com"}]},
    ]}
    payload = montar_payload_materiais(dados, PARTES, "prova")
    assert payload["origem"] == "materiais" and payload["objetivo"] == "prova"
    assert [e["titulo"] for e in payload["etapas"]] == ["Viabilidade", "SAD"]
    assert [(m["documento_id"], m["ordem_inicio"]) for m in payload["etapas"][0]["materiais"]] == [(D1, 1), (D1, 4)]
    assert all(e["recursos"] == [] for e in payload["etapas"])  # link inventado não entra
    assert "previa" not in payload["etapas"][0]["materiais"][0]


def test_parser_limita_partes_por_etapa():
    muitas = {i: {**PARTES[1], "ordem_inicio": i, "ordem_fim": i} for i in range(1, 10)}
    payload = montar_payload_materiais({"etapas": [{"titulo": "Tudo", "materiais": list(range(1, 10))}]}, muitas, "x")
    assert len(payload["etapas"][0]["materiais"]) == MAX_PARTES_POR_ETAPA


@pytest.mark.parametrize("dados", [{}, {"etapas": "x"}, {"etapas": [{"titulo": "Sem parte", "materiais": [42]}]}])
def test_parser_sem_etapa_valida_e_erro(dados):
    with pytest.raises(IAIndisponivelError):
        montar_payload_materiais(dados, PARTES, "x")


# ---------- service de proposta ----------
class DocumentosFalsos:
    def __init__(self, linhas):
        self.linhas = linhas

    def previa(self, categoria_id):
        return self.linhas


RESPOSTA_IA = json.dumps({"titulo": "Ciclo de vida de sistemas", "etapas": [
    {"titulo": "Viabilidade", "descricao": "Base", "materiais": [1]},
    {"titulo": "Especificação", "descricao": "Requisitos", "materiais": [2]},
]})


def servico_de_proposta(linhas, resposta=RESPOSTA_IA):
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "Ciclo de vida de sistemas")
    llm, propostas, pesquisa = LLMFalso(resposta=resposta), PropostaRepoFalso(), PesquisaFalsa()
    servico = PropostaService(CategoriaService(categorias), MensagemRepoFalso(), pesquisa, llm, propostas,
                              DocumentosFalsos(linhas))
    return servico, categoria, llm, propostas, pesquisa


def test_gera_proposta_com_os_materiais_sem_pesquisar_na_internet():
    servico, categoria, llm, propostas, pesquisa = servico_de_proposta(previa(D1, "aula.pdf", 2))
    proposta = servico.gerar_de_materiais(categoria["id"], "do básico ao avançado")
    assert proposta["status"] == "pendente" and proposta["payload"]["origem"] == "materiais"
    assert [e["titulo"] for e in proposta["payload"]["etapas"]] == ["Viabilidade", "Especificação"]
    assert pesquisa.chamadas == []  # nada de Tavily
    pedido = "\n".join(m["content"] for m in llm.chamadas[0])
    assert "[1] (aula.pdf, p. 1)" in pedido and "Ciclo de vida de sistemas" in pedido
    assert "x" * (PREVIA_NA_LISTA + 1) not in pedido  # só o começo de cada parte


def test_sem_materiais_avisa_e_nem_chama_a_ia():
    servico, categoria, llm, propostas, _ = servico_de_proposta([])
    with pytest.raises(SemConteudoError, match="aba Materiais"):
        servico.gerar_de_materiais(categoria["id"], "qualquer coisa")
    assert llm.chamadas == []


def test_nova_proposta_de_materiais_substitui_a_pendente():
    servico, categoria, _, propostas, _ = servico_de_proposta(previa(D1, "aula.pdf", 2))
    primeira = servico.gerar_de_materiais(categoria["id"], "primeira")
    servico.gerar_de_materiais(categoria["id"], "segunda")
    assert propostas.obter(primeira["id"])["status"] == "rejeitada"


# ---------- trilha, exercícios e flashcards ----------
def test_trilha_mostra_os_materiais_de_cada_etapa():
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "Ciclo")
    etapas = etapas_com_material(["texto"])
    trilhas = TrilhaRepoFalso(etapas)
    trilhas.adicionar(categoria_id=categoria["id"])
    t = TrilhaService(CategoriaService(categorias), trilhas, etapas).obter(TRILHA)
    assert t["etapas"][0]["materiais"][0]["nome"] == "aula0.pdf"


def test_exercicios_usam_o_texto_do_material_mas_nao_guardam_o_texto():
    etapas = etapas_com_material(["O estudo de viabilidade analisa custos e benefícios."])
    trilhas = TrilhaRepoFalso(etapas)
    trilhas.adicionar()
    exercicios, revisoes = ExercicioRepoFalso(), RevisaoRepoFalso()
    llm = LLMFalso(json.dumps({"exercicios": [
        {"tipo": "multipla_escolha", "enunciado": "Q1", "opcoes": ["a", "b", "c", "d"], "gabarito": "A"}]}))
    servico = ExercicioService(etapas, trilhas, exercicios, RespostaRepoFalso(exercicios, etapas, revisoes),
                               revisoes, llm, hoje=lambda: date(2026, 10, 10))
    servico.gerar(ETAPA, "basico", 1)
    pedido = "\n".join(m["content"] for m in llm.chamadas[0])
    assert "MATERIAL DO ESTUDANTE (aula0.pdf, p. 1-2)" in pedido and "custos e benefícios" in pedido
    salvo = next(iter(exercicios.itens.values()))
    assert {"titulo": "aula0.pdf, p. 1-2"} in salvo["fontes"]
    assert all("conteudo" not in f for f in salvo["fontes"])


def test_flashcards_usam_o_texto_do_material():
    etapas = etapas_com_material(["CRM apoia vendas, marketing e atendimento."])
    trilhas = TrilhaRepoFalso(etapas)
    trilhas.adicionar()
    llm = LLMFalso(json.dumps({"cartoes": [{"frente": "O que é CRM?", "verso": "Gestão do relacionamento."}]}))
    FlashcardService(etapas, trilhas, FlashcardRepoFalso(), llm, hoje=lambda: date(2026, 10, 10)).gerar(ETAPA, 1)
    assert "CRM apoia vendas" in "\n".join(m["content"] for m in llm.chamadas[0])


# ---------- repositories ----------
class Cliente:
    def __init__(self, cadeia):
        self.cadeia, self.tabelas, self.rpcs = cadeia, [], []

    def table(self, nome):
        self.tabelas.append(nome)
        return self.cadeia

    def rpc(self, nome, params):
        self.rpcs.append((nome, params))
        return self.cadeia


LINHA = {"etapa_id": "e1", "documento_id": D1, "ordem_inicio": 1, "ordem_fim": 3,
         "pagina_inicio": 1, "pagina_fim": 3, "documentos": {"nome": "aula.pdf"}}


def test_repositories_leem_os_materiais_com_o_nome_do_arquivo():
    cliente = Cliente(Cadeia(data=[LINHA]))
    assert TrilhaRepository(cliente).materiais_das_etapas(["e1"])[0]["nome"] == "aula.pdf"
    assert TrilhaRepository(cliente).materiais_das_etapas([]) == []
    assert EtapaRepository(cliente).materiais("e1")[0] == {k: v for k, v in LINHA.items() if k != "documentos"} | {"nome": "aula.pdf"}
    assert set(cliente.tabelas) == {"etapa_materiais"}


def test_texto_material_le_o_intervalo_em_ordem():
    cadeia = Cadeia(data=[{"ordem": 2, "pagina": 2, "conteudo": "b"}])
    EtapaRepository(Cliente(cadeia)).texto_material(D1, 2, 4)
    chamadas = [(n, a) for n, a, _ in cadeia.chamadas]
    assert ("eq", ("documento_id", D1)) in chamadas and ("gte", ("ordem", 2)) in chamadas and ("lte", ("ordem", 4)) in chamadas


def test_previa_chama_a_funcao_do_banco():
    cliente = Cliente(Cadeia(data=[{"documento_id": D1}]))
    assert DocumentoRepository(cliente).previa("cat") == [{"documento_id": D1}]
    assert cliente.rpcs == [("previa_trechos", {"p_categoria_id": "cat"})]


# ---------- rota ----------
@pytest.fixture
def rota(monkeypatch):
    servico, categoria, llm, _, _ = servico_de_proposta(previa(D1, "aula.pdf", 2))

    def validar(token):
        if token != "token-valido":
            raise NaoAutenticadoError("Token inválido ou expirado.")
        return "user-1"

    gastos = []

    class Uso:
        def consumir(self, tipo):
            gastos.append(tipo)

    monkeypatch.setattr(auth, "obter_user_id", validar)
    monkeypatch.setattr(dependencies, "get_proposta_service", lambda: servico)
    monkeypatch.setattr(dependencies, "get_uso_service", lambda: Uso())
    return categoria, gastos


def test_rota_gera_proposta_de_materiais_e_gasta_credito_de_ia(client, rota):
    categoria, gastos = rota
    resposta = client.post(f"/categorias/{categoria['id']}/propostas/materiais", json={"objetivo": "prova"},
                           headers={"Authorization": "Bearer token-valido"})
    assert resposta.status_code == 201 and resposta.get_json()["payload"]["origem"] == "materiais"
    assert gastos == ["ia"]  # não gasta pesquisa (não usa a internet)


def test_rota_exige_login(client, rota):
    categoria, gastos = rota
    resposta = client.post(f"/categorias/{categoria['id']}/propostas/materiais", json={"objetivo": "prova"})
    assert resposta.status_code == 401 and gastos == []


def test_id_de_categoria_invalido(client, rota):
    resposta = client.post(f"/categorias/{uuid.uuid4()}/propostas/materiais", json={"objetivo": "prova"},
                           headers={"Authorization": "Bearer token-valido"})
    assert resposta.status_code == 404
