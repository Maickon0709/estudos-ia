"""Testes da migração 009 (trilha a partir dos materiais do aluno) num Postgres real."""
import uuid

import psycopg
import pytest

from tests.integracao.apoio import (
    ANA, BRUNO, Jsonb, conectar, mensagem_do_erro, nova_proposta, nova_trilha, payload, recurso, valor,
)


def novo_documento(conn, categoria_id, trechos=3, nome="aula.pdf"):
    lista = [{"ordem": i, "pagina": i, "conteudo": f"Trecho {i} sobre ciclo de vida de sistemas."} for i in range(1, trechos + 1)]
    return valor(conn, "select criar_documento(%s, %s, 'pdf', %s, false, %s)",
                 (categoria_id, nome, trechos, Jsonb(lista)))["id"]


def proposta_com(conn, categoria_id, etapas, titulo="Do meu material"):
    return valor(conn, "insert into propostas (categoria_id, payload) values (%s, %s) returning id",
                 (categoria_id, Jsonb({"titulo": titulo, "etapas": etapas})))


def test_previa_traz_o_comeco_de_cada_trecho_em_ordem(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria_id, _ = nova_proposta(ana, payload())
        doc = novo_documento(ana, categoria_id, trechos=3)
        linhas = ana.execute("select documento_id, nome, ordem, pagina, previa from previa_trechos(%s)",
                             (categoria_id,)).fetchall()
        assert [(str(d), n, o, p) for d, n, o, p, _ in linhas] == [(str(doc), "aula.pdf", i, i) for i in (1, 2, 3)]
        assert linhas[0][4].startswith("Trecho 1")


def test_previa_nao_mostra_arquivo_de_outra_pessoa(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria_id, _ = nova_proposta(ana, payload())
        novo_documento(ana, categoria_id)
    with conectar(url_banco, BRUNO) as bruno:
        assert bruno.execute("select count(*) from previa_trechos(%s)", (categoria_id,)).fetchone()[0] == 0


def test_confirmar_cria_etapas_ligadas_as_partes_do_arquivo(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria_id, _ = nova_proposta(ana, payload())
        doc = str(novo_documento(ana, categoria_id, trechos=6))
        etapas = [
            {"titulo": "Básico", "descricao": "Estudar", "recursos": [], "materiais": [
                {"documento_id": doc, "ordem_inicio": 1, "ordem_fim": 3, "pagina_inicio": 1, "pagina_fim": 3}]},
            {"titulo": "Avançado", "descricao": "Estudar", "materiais": [
                {"documento_id": doc, "ordem_inicio": 4, "ordem_fim": 6, "pagina_inicio": 4, "pagina_fim": 6}]},
        ]
        proposta_id = proposta_com(ana, categoria_id, etapas)
        trilha_id = valor(ana, "select confirmar_proposta(%s)", (proposta_id,))
        ligacoes = ana.execute(
            "select e.ordem, m.ordem_inicio, m.ordem_fim, m.pagina_inicio, m.user_id from etapa_materiais m "
            "join etapas e on e.id = m.etapa_id where e.trilha_id = %s order by e.ordem", (trilha_id,)).fetchall()
        assert [(o, i, f, p) for o, i, f, p, _ in ligacoes] == [(1, 1, 3, 1), (2, 4, 6, 4)]
        assert all(str(u) == ANA for *_, u in ligacoes)
        assert valor(ana, "select status from propostas where id = %s", (proposta_id,)) == "confirmada"


def test_trilha_mista_com_links_e_materiais(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria_id, _ = nova_proposta(ana, payload())
        doc = novo_documento(ana, categoria_id)
        etapas = [{"titulo": "Mista", "recursos": [recurso()],
                   "materiais": [{"documento_id": str(doc), "ordem_inicio": 1, "ordem_fim": 2}]}]
        proposta_id = proposta_com(ana, categoria_id, etapas, "Mista")
        trilha_id = valor(ana, "select confirmar_proposta(%s)", (proposta_id,))
        etapa_id = valor(ana, "select id from etapas where trilha_id = %s", (trilha_id,))
        assert valor(ana, "select count(*) from recursos where etapa_id = %s", (etapa_id,)) == 1
        assert valor(ana, "select count(*) from etapa_materiais where etapa_id = %s", (etapa_id,)) == 1


@pytest.mark.parametrize("material", [
    {"documento_id": "nao-e-uuid", "ordem_inicio": 1, "ordem_fim": 2},
    {"documento_id": None, "ordem_inicio": 1, "ordem_fim": 2},
    {"documento_id": "DOC", "ordem_inicio": 3, "ordem_fim": 1},   # intervalo invertido
    {"documento_id": "DOC", "ordem_inicio": 0, "ordem_fim": 1},   # ordem começa em 1
    {"documento_id": str(uuid.uuid4()), "ordem_inicio": 1, "ordem_fim": 1},  # arquivo que não existe
], ids=["id-invalido", "sem-id", "invertido", "ordem-zero", "inexistente"])
def test_material_invalido_nao_cria_nada(url_banco, material):
    with conectar(url_banco, ANA) as ana:
        categoria_id, _ = nova_proposta(ana, payload())
        doc = novo_documento(ana, categoria_id)
        if material["documento_id"] == "DOC":
            material = {**material, "documento_id": str(doc)}
        etapas = [{"titulo": "Etapa", "recursos": [], "materiais": [material]}]
        proposta_id = proposta_com(ana, categoria_id, etapas)
        with pytest.raises(psycopg.errors.RaiseException) as erro:
            ana.execute("select confirmar_proposta(%s)", (proposta_id,))
        assert mensagem_do_erro(erro.value) == "material_indisponivel"
        assert valor(ana, "select count(*) from trilhas where proposta_id = %s", (proposta_id,)) == 0
        assert valor(ana, "select status from propostas where id = %s", (proposta_id,)) == "pendente"


def test_materiais_que_nao_sao_lista_sao_recusados(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria_id, _ = nova_proposta(ana, payload())
        etapas = [{"titulo": "Etapa", "recursos": [], "materiais": {"nao": "lista"}}]
        proposta_id = proposta_com(ana, categoria_id, etapas)
        with pytest.raises(psycopg.errors.RaiseException) as erro:
            ana.execute("select confirmar_proposta(%s)", (proposta_id,))
        assert mensagem_do_erro(erro.value) == "proposta_invalida"


def test_nao_da_para_ligar_arquivo_de_outra_pessoa(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria_ana, _ = nova_proposta(ana, payload())
        doc_da_ana = novo_documento(ana, categoria_ana)
    with conectar(url_banco, BRUNO) as bruno:
        categoria_id, _ = nova_proposta(bruno, payload())
        etapas = [{"titulo": "Intrusa", "recursos": [],
                   "materiais": [{"documento_id": str(doc_da_ana), "ordem_inicio": 1, "ordem_fim": 3}]}]
        proposta_id = proposta_com(bruno, categoria_id, etapas)
        with pytest.raises(psycopg.errors.RaiseException) as erro:
            bruno.execute("select confirmar_proposta(%s)", (proposta_id,))
        assert mensagem_do_erro(erro.value) == "material_indisponivel"
        # nem direto na tabela, numa etapa que é dele
        _, _, etapas_do_bruno = nova_trilha(bruno)
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            bruno.execute("insert into etapa_materiais (etapa_id, documento_id, ordem_inicio, ordem_fim) "
                          "values (%s, %s, 1, 1)", (etapas_do_bruno[0], doc_da_ana))


def test_apagar_o_arquivo_tira_a_ligacao_mas_mantem_a_etapa(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria_id, _ = nova_proposta(ana, payload())
        doc = novo_documento(ana, categoria_id)
        etapas = [{"titulo": "Etapa", "recursos": [],
                   "materiais": [{"documento_id": str(doc), "ordem_inicio": 1, "ordem_fim": 3}]}]
        proposta_id = proposta_com(ana, categoria_id, etapas)
        trilha_id = valor(ana, "select confirmar_proposta(%s)", (proposta_id,))
        ana.execute("delete from documentos where id = %s", (doc,))
        assert valor(ana, "select count(*) from etapas where trilha_id = %s", (trilha_id,)) == 1
        assert valor(ana, "select count(*) from etapa_materiais where documento_id = %s", (doc,)) == 0


def test_proposta_antiga_so_com_links_continua_funcionando(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, proposta_id = nova_proposta(ana, payload())
        trilha_id = valor(ana, "select confirmar_proposta(%s)", (proposta_id,))
        assert valor(ana, "select count(*) from etapas where trilha_id = %s", (trilha_id,)) == 2
