"""Testes da migração 008 (materiais do aluno e busca textual) num Postgres real."""
import uuid

import psycopg
import pytest

from tests.integracao.apoio import ANA, BRUNO, Jsonb, conectar, mensagem_do_erro, valor


def nova_categoria(conn):
    return valor(conn, "insert into categorias (user_id, nome) values (auth.uid(), %s) returning id",
                 (f"cat-{uuid.uuid4().hex[:8]}",))


def criar(conn, categoria_id, trechos, nome="aula.pdf", tipo="pdf", paginas=2):
    return valor(conn, "select criar_documento(%s, %s, %s, %s, false, %s)",
                 (categoria_id, nome, tipo, paginas, Jsonb(trechos)))


def trecho(ordem, conteudo, pagina=1):
    return {"ordem": ordem, "pagina": pagina, "conteudo": conteudo}


def buscar(conn, categoria_id, consulta, limite=5):
    return conn.execute("select nome, pagina, conteudo from buscar_trechos(%s, %s, %s)",
                        (categoria_id, consulta, limite)).fetchall()


def test_grava_documento_e_trechos_juntos(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria = nova_categoria(ana)
        doc = criar(ana, categoria, [trecho(1, "Crase é a fusão de duas vogais."), trecho(2, "Vou à escola.", 2)])
        assert doc["nome"] == "aula.pdf" and doc["trechos"] == 2 and doc["user_id"] == ANA
        assert doc["caracteres"] == len("Crase é a fusão de duas vogais.") + len("Vou à escola.")
        assert valor(ana, "select count(*) from documento_trechos where documento_id = %s", (doc["id"],)) == 2


def test_trecho_invalido_nao_deixa_documento_pela_metade(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria = nova_categoria(ana)
        with pytest.raises(psycopg.errors.CheckViolation):
            criar(ana, categoria, [trecho(1, "ok"), trecho(2, "")])  # conteúdo vazio viola o check
        assert valor(ana, "select count(*) from documentos where categoria_id = %s", (categoria,)) == 0


@pytest.mark.parametrize("trechos", [[], {"nao": "lista"}], ids=["vazio", "objeto"])
def test_recusa_lista_de_trechos_invalida(url_banco, trechos):
    with conectar(url_banco, ANA) as ana:
        with pytest.raises(psycopg.errors.RaiseException) as erro:
            criar(ana, nova_categoria(ana), trechos)
        assert mensagem_do_erro(erro.value) == "trechos_invalidos"


def test_busca_entende_portugues_e_nao_exige_todas_as_palavras(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria = nova_categoria(ana)
        criar(ana, categoria, [
            trecho(1, "A mitocôndria produz energia para a célula.", 3),
            trecho(2, "O ribossomo fabrica proteínas.", 4),
            trecho(3, "Estudar todos os dias ajuda a memorizar.", 5),
        ])
        # "estudando" acha "Estudar" (radical em português); palavras vazias são ignoradas
        assert [p for _, p, _ in buscar(ana, categoria, "estudando")] == [5]
        # pergunta longa com palavras que NÃO estão em trecho nenhum ainda acha o certo
        resultado = buscar(ana, categoria, "o que a mitocôndria faz com a energia na prova de amanhã?")
        assert resultado[0][1] == 3
        # acento não importa, para nenhum dos lados
        assert [p for _, p, _ in buscar(ana, categoria, "mitocondria")] == [3]
        assert [p for _, p, _ in buscar(ana, categoria, "RIBOSSÓMO proteinas")] == [4]
        assert buscar(ana, categoria, "o que é") == []  # só palavras vazias
        assert buscar(ana, categoria, "") == []


def test_busca_ordena_pela_relevancia_e_respeita_o_limite(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria = nova_categoria(ana)
        criar(ana, categoria, [
            trecho(1, "Fotossíntese ocorre na folha.", 1),
            trecho(2, "Fotossíntese usa luz. A fotossíntese libera oxigênio. Clorofila e fotossíntese.", 2),
            trecho(3, "Raiz absorve água.", 3),
        ])
        resultado = buscar(ana, categoria, "fotossíntese clorofila")
        assert [p for _, p, _ in resultado] == [2, 1]
        assert len(buscar(ana, categoria, "fotossíntese", limite=1)) == 1


def test_busca_fica_na_categoria_pedida(url_banco):
    with conectar(url_banco, ANA) as ana:
        biologia, quimica = nova_categoria(ana), nova_categoria(ana)
        criar(ana, biologia, [trecho(1, "Átomo de carbono na célula.")])
        criar(ana, quimica, [trecho(1, "Átomo de carbono faz quatro ligações.")])
        assert [c for _, _, c in buscar(ana, quimica, "carbono")] == ["Átomo de carbono faz quatro ligações."]


def test_outro_usuario_nao_ve_nem_usa_os_materiais(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria = nova_categoria(ana)
        doc = criar(ana, categoria, [trecho(1, "Segredo da Ana sobre genética.")])
    with conectar(url_banco, BRUNO) as bruno:
        assert valor(bruno, "select count(*) from documentos where id = %s", (doc["id"],)) == 0
        assert valor(bruno, "select count(*) from documento_trechos where documento_id = %s", (doc["id"],)) == 0
        assert buscar(bruno, categoria, "genética") == []
        with pytest.raises(psycopg.errors.NoDataFound) as erro:  # errcode P0002
            criar(bruno, categoria, [trecho(1, "intruso")])
        assert mensagem_do_erro(erro.value) == "categoria_nao_encontrada"
        # nem pendurando um trecho direto no documento da Ana
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            bruno.execute(
                "insert into documento_trechos (documento_id, user_id, categoria_id, ordem, conteudo) "
                "values (%s, auth.uid(), %s, 99, 'intruso')", (doc["id"], categoria))
        assert bruno.execute("delete from documentos where id = %s", (doc["id"],)).rowcount == 0


def test_apagar_documento_ou_categoria_leva_os_trechos(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria = nova_categoria(ana)
        doc = criar(ana, categoria, [trecho(1, "um"), trecho(2, "dois")])
        ana.execute("delete from documentos where id = %s", (doc["id"],))
        assert valor(ana, "select count(*) from documento_trechos where documento_id = %s", (doc["id"],)) == 0

        doc = criar(ana, categoria, [trecho(1, "três")])
        ana.execute("delete from categorias where id = %s", (categoria,))
        assert valor(ana, "select count(*) from documentos where id = %s", (doc["id"],)) == 0
        assert valor(ana, "select count(*) from documento_trechos where documento_id = %s", (doc["id"],)) == 0


def test_limite_de_30_materiais_por_usuario(url_banco):
    with conectar(url_banco, BRUNO) as bruno:
        bruno.execute("delete from documentos")
        categoria = nova_categoria(bruno)
        for i in range(30):
            criar(bruno, categoria, [trecho(1, f"material {i}")])
        with pytest.raises(psycopg.errors.RaiseException) as erro:
            criar(bruno, categoria, [trecho(1, "o trigésimo primeiro")])
        assert mensagem_do_erro(erro.value) == "documentos_demais"
        assert valor(bruno, "select count(*) from documentos") == 30
        bruno.execute("delete from documentos")
