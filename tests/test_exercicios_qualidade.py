"""Exercícios: 10 por vez, sem repetir pergunta, perguntas mais profundas, bloqueio com progresso e
simulado que completa as questões que faltam."""
import json
from datetime import date

import pytest

from app.core.errors import IAIndisponivelError
from app.repositories.estudo_repository import SimuladoRepository
from app.services.categoria_service import CategoriaService
from app.services.exercicio_parser import remover_repetidos
from app.services.exercicio_service import QUANTIDADE_MAX, QUANTIDADE_PADRAO, ExercicioService, motivo_bloqueio
from app.services.prompts import DESCRICAO_NIVEL, mensagem_exercicios, prompt_exercicios
from app.services.simulado_service import SimuladoService
from tests.fakes import LLMFalso
from tests.fakes_estudo import ETAPA, TRILHA, EtapaRepoFalso, ExercicioRepoFalso, RespostaRepoFalso, RevisaoRepoFalso, TrilhaRepoFalso
from tests.fakes_novos import SimuladoRepoFalso
from tests.test_categoria_service import RepoFalso
from tests.test_repositorios_estudo import Cadeia


def me(enunciado, gabarito="A"):
    return {"tipo": "multipla_escolha", "enunciado": enunciado, "opcoes": ["a", "b", "c", "d"], "gabarito": gabarito}


def cenario(itens, categoria_id="cat", com_uso=True):
    etapas = EtapaRepoFalso()
    etapas.adicionar()
    trilhas = TrilhaRepoFalso(etapas)
    trilhas.adicionar(categoria_id=categoria_id)
    exercicios, revisoes = ExercicioRepoFalso(), RevisaoRepoFalso()
    llm = LLMFalso(json.dumps({"exercicios": itens}))
    gastos = []

    class Uso:
        def consumir(self, tipo):
            gastos.append(tipo)

    servico = ExercicioService(etapas, trilhas, exercicios, RespostaRepoFalso(exercicios, etapas, revisoes),
                               revisoes, llm, hoje=lambda: date(2026, 10, 11), uso=Uso() if com_uso else None)
    return servico, exercicios, llm, gastos, etapas


# ---------- quantidade ----------
def test_gera_dez_por_vez():
    assert QUANTIDADE_PADRAO == QUANTIDADE_MAX == 10
    temas = ["viabilidade", "requisitos", "CRM", "SAD", "ERP", "testes", "implantação", "manutenção",
             "cronograma", "custos", "riscos", "usuários"]
    servico, _, llm, _, _ = cenario([me(f"{t.upper()}: " + " ".join([t] * (i + 3)) + "?") for i, t in enumerate(temas)])
    assert len(servico.gerar(ETAPA, "basico")) == 10
    assert "Quantidade: 10" in "\n".join(m["content"] for m in llm.chamadas[0])


# ---------- sem repetição ----------
def test_ia_recebe_as_perguntas_que_ja_existem_de_todos_os_niveis():
    servico, exercicios, llm, _, etapas = cenario([me("Qual a diferença entre CRM e ERP numa loja?")])
    exercicios.adicionar(nivel="basico")["enunciado"] = "O que é estudo de viabilidade?"
    etapas.niveis_por_etapa[ETAPA] = {"basico": {"total": 20, "acertos": 20}}
    servico.gerar(ETAPA, "intermediario", 1)
    pedido = "\n".join(m["content"] for m in llm.chamadas[0])
    assert "JÁ EXISTEM" in pedido and "- O que é estudo de viabilidade?" in pedido


def test_pergunta_repetida_do_basico_nao_entra_no_intermediario():
    """Foi o que aconteceu de verdade: o intermediário trouxe uma pergunta do básico."""
    servico, exercicios, _, _, etapas = cenario([
        me("O que é o estudo de viabilidade?"),          # igual à do básico, com "o"
        me("Uma empresa quer trocar o ERP: qual fase vem primeiro?"),
        me("uma empresa quer trocar o ERP, qual fase vem primeiro"),  # repetida na própria leva
    ])
    exercicios.adicionar(nivel="basico")["enunciado"] = "O que é estudo de viabilidade?"
    etapas.niveis_por_etapa[ETAPA] = {"basico": {"total": 20, "acertos": 20}}
    criados = servico.gerar(ETAPA, "intermediario", 3)
    assert [c["enunciado"] for c in criados] == ["Uma empresa quer trocar o ERP: qual fase vem primeiro?"]


def test_se_a_ia_so_repetiu_nada_e_gravado():
    servico, exercicios, _, _, _ = cenario([me("Pergunta?")])
    exercicios.adicionar()  # enunciado "Pergunta?"
    antes = len(exercicios.itens)
    with pytest.raises(IAIndisponivelError, match="já tem"):
        servico.gerar(ETAPA, "basico", 1)
    assert len(exercicios.itens) == antes


@pytest.mark.parametrize("nova,repetida", [
    ("O que é estudo de viabilidade?", True),
    ("O QUE É ESTUDO DE VIABILIDADE", True),
    ("O que é o estudo de viabilidade?", True),     # quase igual
    ("Quais custos entram num estudo de viabilidade de um app?", False),
])
def test_remover_repetidos(nova, repetida):
    sobrou = remover_repetidos([{"enunciado": nova}], ["O que é estudo de viabilidade?"])
    assert (sobrou == []) is repetida


# ---------- profundidade ----------
def test_prompt_pede_perguntas_profundas_e_variadas():
    regras = prompt_exercicios()
    assert "ponto DIFERENTE" in regras and "mini-caso" in regras
    assert "todas as anteriores" in regras and "armadilha principal" in regras
    assert "Nada de perguntas de definição" in DESCRICAO_NIVEL["intermediario"]
    assert "combinar dois ou mais conceitos" in DESCRICAO_NIVEL["avancado"]


def test_resumo_dos_links_vai_maior_para_os_exercicios():
    texto = mensagem_exercicios("T", {"titulo": "E"}, "basico", 10, [{"titulo": "Site", "trecho": "a" * 1000}])
    assert "a" * 800 in texto and "a" * 801 not in texto


# ---------- bloqueio com progresso ----------
def test_bloqueio_diz_quanto_falta():
    msg = motivo_bloqueio("intermediario", {"basico": {"total": 12, "acertos": 9}})
    assert "20 questões" in msg and "12 de 20" in msg and "75% de acerto" in msg and "já sei" in msg
    msg = motivo_bloqueio("avancado", {})
    assert "0 de 20 questões do intermediário." in msg and "já sei" not in msg


# ---------- simulado completa o que falta ----------
def test_completar_gera_so_multipla_escolha_e_gasta_uma_ia():
    servico, exercicios, llm, gastos, _ = cenario([
        me("Caso: a loja quer um CRM; o que medir primeiro?"),
        {"tipo": "discursiva", "enunciado": "Explique o SAD.", "gabarito": "x"},
    ])
    criadas = servico.completar_para_simulado("cat", 5)
    assert criadas == 1 and gastos == ["ia"]
    assert all(e["tipo"] == "multipla_escolha" for e in exercicios.itens.values())
    assert "SOMENTE múltipla escolha" in "\n".join(m["content"] for m in llm.chamadas[0])


def test_completar_sem_trilha_nao_gasta_nada():
    servico, _, llm, gastos, _ = cenario([me("x")], categoria_id="outra")
    assert servico.completar_para_simulado("cat", 5) == 0
    assert llm.chamadas == [] and gastos == []


def test_completar_usa_o_nivel_mais_alto_liberado():
    servico, exercicios, _, _, etapas = cenario([me("Cenário avançado com dois conceitos combinados")])
    etapas.niveis_por_etapa[ETAPA] = {"basico": {"total": 20, "acertos": 20}, "intermediario": {"total": 20, "acertos": 18}}
    servico.completar_para_simulado("cat", 1)
    assert next(iter(exercicios.itens.values()))["nivel"] == "avancado"


def test_completar_falha_da_ia_nao_derruba():
    servico, _, llm, _, _ = cenario([me("x")])
    llm.erro = IAIndisponivelError("fora do ar")
    assert servico.completar_para_simulado("cat", 5) == 0


def simulado_com(exercicios_mc, completar):
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "Ciclo")
    exs = {}
    for i in range(exercicios_mc):
        e = {"id": f"e{i}", "tipo": "multipla_escolha", "enunciado": f"Q{i}", "opcoes": ["a", "b", "c", "d"],
             "gabarito": "A", "explicacao": "x", "nivel": "basico", "etapa_id": ETAPA,
             "created_at": "2026-10-11T12:00:00+00:00"}
        exs[e["id"]] = e
    repo = SimuladoRepoFalso(exs)
    return SimuladoService(CategoriaService(categorias), repo, completar=completar), repo, categoria


def test_simulado_de_10_completa_as_que_faltam():
    pedidos = []

    def completar(categoria_id, faltam):
        pedidos.append(faltam)
        for i in range(faltam):
            repo.exercicios[f"novo{i}"] = {"id": f"novo{i}", "tipo": "multipla_escolha", "enunciado": f"N{i}",
                                          "opcoes": ["a", "b", "c", "d"], "gabarito": "B", "explicacao": "y",
                                          "nivel": "basico", "etapa_id": ETAPA,
                                          "created_at": "2026-10-11T12:00:00+00:00"}
        return faltam

    servico, repo, categoria = simulado_com(5, completar)
    s = servico.criar(categoria["id"], 10, 15)
    assert pedidos == [5] and len(s["questoes"]) == 10 and "aviso" not in s


def test_simulado_com_questoes_suficientes_nao_chama_a_ia():
    pedidos = []
    servico, _, categoria = simulado_com(12, lambda c, f: pedidos.append(f))
    assert len(servico.criar(categoria["id"], 10, 15)["questoes"]) == 10 and pedidos == []


def test_simulado_avisa_quando_nao_deu_para_completar():
    servico, _, categoria = simulado_com(5, lambda c, f: 0)
    s = servico.criar(categoria["id"], 10, 15)
    assert len(s["questoes"]) == 5 and "Só havia 5 questões" in s["aviso"]


# ---------- repository ----------
def test_contar_multipla_escolha_consulta_trilhas_etapas_e_exercicios():
    class Resposta:
        def __init__(self, data, count=None):
            self.data, self.count = data, count

    class Tabela(Cadeia):
        def __init__(self, data, count=None):
            super().__init__(data)
            self._count = count

        def execute(self):
            return Resposta(self._data, self._count)

    tabelas = {"trilhas": Tabela([{"id": TRILHA}]), "etapas": Tabela([{"id": ETAPA}]), "exercicios": Tabela([], 7)}

    class Cliente:
        def table(self, nome):
            return tabelas[nome]

    assert SimuladoRepository(Cliente()).contar_multipla_escolha("cat") == 7
    chamadas = [(n, a) for n, a, _ in tabelas["exercicios"].chamadas]
    assert ("eq", ("tipo", "multipla_escolha")) in chamadas and ("in_", ("etapa_id", [ETAPA])) in chamadas
