"""Trilha "Tudo junto": arquivos do aluno como base + vídeos e sites verificados para completar."""
import json

import pytest

from app.core import auth, dependencies
from app.core.errors import IAIndisponivelError, NaoAutenticadoError, SemConteudoError
from app.services.categoria_service import CategoriaService
from app.services.proposta_parser import MAX_ITENS_POR_ETAPA, MAX_LINKS_POR_ETAPA, montar_payload_misto
from app.services.proposta_service import MAX_PARTES_MISTO, PropostaService
from tests.fakes import LLMFalso, MensagemRepoFalso
from tests.fakes_propostas import PesquisaFalsa, PropostaRepoFalso, rec
from tests.test_categoria_service import RepoFalso
from tests.test_trilha_materiais import D1, DocumentosFalsos, previa

PARTES = {
    1: {"documento_id": D1, "nome": "aula.pdf", "ordem_inicio": 1, "ordem_fim": 2, "pagina_inicio": 1, "pagina_fim": 2, "previa": "..."},
    2: {"documento_id": D1, "nome": "aula.pdf", "ordem_inicio": 3, "ordem_fim": 4, "pagina_inicio": 3, "pagina_fim": 4, "previa": "..."},
}
LINKS = {3: rec(1), 4: rec(2, "video", duracao_segundos=600), 5: rec(3)}


# ---------- parser ----------
def test_cada_etapa_junta_partes_do_arquivo_e_links_verificados():
    dados = {"titulo": "Ciclo de vida", "etapas": [
        {"titulo": "Viabilidade", "itens": [1, 3, 99, "https://inventado.com"]},
        {"titulo": "Especificação", "itens": [2, 4, 1]},   # o 1 já foi usado
    ]}
    payload = montar_payload_misto(dados, PARTES, LINKS, "prova")
    assert payload["origem"] == "misto"
    primeira, segunda = payload["etapas"]
    assert [m["ordem_inicio"] for m in primeira["materiais"]] == [1]
    assert [r["url"] for r in primeira["recursos"]] == [LINKS[3]["url"]]
    assert [m["ordem_inicio"] for m in segunda["materiais"]] == [3]
    assert [r["url"] for r in segunda["recursos"]] == [LINKS[4]["url"]]
    assert "previa" not in primeira["materiais"][0]


def test_limites_por_etapa():
    muitos_links = {i: rec(i) for i in range(3, 13)}
    payload = montar_payload_misto({"etapas": [{"titulo": "Tudo", "itens": [1, 2, *range(3, 13)]}]},
                                   PARTES, muitos_links, "x")
    etapa = payload["etapas"][0]
    assert len(etapa["recursos"]) <= MAX_LINKS_POR_ETAPA
    assert len(etapa["materiais"]) + len(etapa["recursos"]) <= MAX_ITENS_POR_ETAPA


def test_trilha_sem_nenhum_arquivo_do_aluno_e_recusada():
    """Se a IA ignorou os arquivos, não é a trilha "Tudo junto" que o aluno pediu."""
    with pytest.raises(IAIndisponivelError, match="seus arquivos"):
        montar_payload_misto({"etapas": [{"titulo": "Só internet", "itens": [3, 4]}]}, PARTES, LINKS, "x")


@pytest.mark.parametrize("dados", [{}, {"etapas": None}, {"etapas": [{"titulo": "Nada", "itens": [77]}]}])
def test_resposta_invalida_e_erro(dados):
    with pytest.raises(IAIndisponivelError):
        montar_payload_misto(dados, PARTES, LINKS, "x")


# ---------- service ----------
RESPOSTA = json.dumps({"titulo": "Ciclo de vida de sistemas", "etapas": [
    {"titulo": "Viabilidade", "descricao": "Base", "itens": [1, 3]},
    {"titulo": "Requisitos", "descricao": "Aprofundar", "itens": [2]},
]})


def servico(linhas, resposta=RESPOSTA, recursos=None):
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "Ciclo de vida de sistemas")
    llm, propostas = LLMFalso(resposta=resposta), PropostaRepoFalso()
    pesquisa = PesquisaFalsa(recursos=recursos)
    mensagens = MensagemRepoFalso()
    s = PropostaService(CategoriaService(categorias), mensagens, pesquisa, llm, propostas, DocumentosFalsos(linhas))
    return s, categoria, llm, propostas, pesquisa


def test_gera_trilha_mista_pesquisando_com_o_assunto_da_categoria():
    s, categoria, llm, _, pesquisa = servico(previa(D1, "aula.pdf", 2))
    proposta = s.gerar_misto(categoria["id"], "do básico ao avançado")
    assert pesquisa.chamadas == ["Ciclo de vida de sistemas: do básico ao avançado"]
    etapas = proposta["payload"]["etapas"]
    assert proposta["payload"]["origem"] == "misto"
    assert etapas[0]["materiais"] and etapas[0]["recursos"]
    pedido = "\n".join(m["content"] for m in llm.chamadas[0])
    assert "PARTES DOS ARQUIVOS DO ESTUDANTE" in pedido and "VÍDEOS E SITES VERIFICADOS" in pedido
    assert "https://" not in pedido  # a IA não vê URL nenhuma


def test_numeracao_unica_partes_depois_links():
    s, categoria, llm, _, _ = servico(previa(D1, "aula.pdf", 2))
    s.gerar_misto(categoria["id"], "prova")
    pedido = "\n".join(m["content"] for m in llm.chamadas[0])
    # 2 trechos viram 2 partes no máximo; os links começam logo depois
    numeros = [int(l.split("]")[0][1:]) for l in pedido.splitlines() if l.startswith("[")]
    assert numeros == list(range(1, len(numeros) + 1))


def test_sem_arquivos_nem_pesquisa_nem_ia():
    s, categoria, llm, _, pesquisa = servico([])
    with pytest.raises(SemConteudoError, match="só com vídeos e sites"):
        s.gerar_misto(categoria["id"], "prova")
    assert pesquisa.chamadas == [] and llm.chamadas == []  # nada de crédito gasto à toa


def test_pesquisa_vazia_ainda_monta_com_os_arquivos():
    resposta = json.dumps({"etapas": [{"titulo": "Base", "itens": [1]}]})
    s, categoria, llm, _, _ = servico(previa(D1, "aula.pdf", 2), resposta=resposta, recursos=[])
    proposta = s.gerar_misto(categoria["id"], "prova")
    assert proposta["payload"]["etapas"][0]["recursos"] == []
    assert "(nenhum encontrado)" in "\n".join(m["content"] for m in llm.chamadas[0])


def test_partes_limitadas_na_trilha_mista():
    s, categoria, llm, _, _ = servico(previa(D1, "aula.pdf", 300))
    s.gerar_misto(categoria["id"], "prova")
    linhas = "\n".join(m["content"] for m in llm.chamadas[0]).splitlines()
    inicio = linhas.index("PARTES DOS ARQUIVOS DO ESTUDANTE (número, arquivo e páginas, começo do texto):")
    fim = linhas.index("VÍDEOS E SITES VERIFICADOS:")
    assert len([l for l in linhas[inicio:fim] if l.startswith("[")]) <= MAX_PARTES_MISTO


# ---------- rota ----------
@pytest.fixture
def rota(monkeypatch):
    s, categoria, _, _, _ = servico(previa(D1, "aula.pdf", 2))
    gastos = []

    class Uso:
        def consumir(self, tipo):
            gastos.append(tipo)

    def validar(token):
        if token != "token-valido":
            raise NaoAutenticadoError("Token inválido ou expirado.")
        return "user-1"

    monkeypatch.setattr(auth, "obter_user_id", validar)
    monkeypatch.setattr(dependencies, "get_proposta_service", lambda: s)
    monkeypatch.setattr(dependencies, "get_uso_service", lambda: Uso())
    return categoria, gastos


def test_rota_mista_gasta_credito_de_pesquisa(client, rota):
    categoria, gastos = rota
    resposta = client.post(f"/categorias/{categoria['id']}/propostas/misto", json={"objetivo": "prova"},
                           headers={"Authorization": "Bearer token-valido"})
    assert resposta.status_code == 201 and resposta.get_json()["payload"]["origem"] == "misto"
    assert gastos == ["pesquisa"]


def test_rota_mista_exige_login(client, rota):
    categoria, gastos = rota
    assert client.post(f"/categorias/{categoria['id']}/propostas/misto", json={"objetivo": "x"}).status_code == 401
    assert gastos == []
