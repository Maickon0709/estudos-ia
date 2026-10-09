"""Testes do SQL base e da confirmação de propostas num Postgres DE VERDADE.
A infraestrutura (banco temporário) está em conftest.py.
"""
import threading
import uuid

import pytest

from tests.integracao.apoio import (
    ANA,
    BRUNO,
    contagem_da_categoria,
    conectar,
    mensagem_do_erro,
    nova_proposta,
    payload,
    psycopg,
    recurso,
    valor,
)


# ---------------------------------------------------------------------------
# Schema base e RLS
# ---------------------------------------------------------------------------
def test_trigger_cria_profiles(url_banco):
    with psycopg.connect(url_banco) as conn:
        nomes = [r[0] for r in conn.execute("select nome from profiles order by nome")]
    assert nomes == ["Ana", "bruno"]  # sem nome nos metadados: usa o início do e-mail


def test_rls_isola_categorias_e_mensagens(url_banco):
    with conectar(url_banco, ANA) as ana:
        cat = valor(ana, "insert into categorias (user_id, nome) values (auth.uid(), 'Privada') returning id")
        ana.execute("insert into mensagens (categoria_id, papel, conteudo) values (%s, 'user', 'oi')", (cat,))

    with conectar(url_banco, BRUNO) as bruno:
        assert valor(bruno, "select count(*) from categorias where id = %s", (cat,)) == 0
        assert valor(bruno, "select count(*) from mensagens where categoria_id = %s", (cat,)) == 0
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            bruno.execute("insert into categorias (user_id, nome) values (%s, 'Invasão')", (ANA,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            bruno.execute(
                "insert into mensagens (categoria_id, papel, conteudo) values (%s, 'user', 'x')", (cat,)
            )


# ---------------------------------------------------------------------------
# confirmar_proposta
# ---------------------------------------------------------------------------
def test_confirmar_cria_trilha_etapas_recursos_e_fecha_a_proposta(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria_id, proposta_id = nova_proposta(ana, payload())
        trilha_id = valor(ana, "select confirmar_proposta(%s)", (proposta_id,))

        assert valor(ana, "select titulo from trilhas where id = %s", (trilha_id,)) == "Crase do zero"
        assert valor(ana, "select proposta_id from trilhas where id = %s", (trilha_id,)) == proposta_id
        etapas = ana.execute(
            "select ordem, titulo, status from etapas where trilha_id = %s order by ordem", (trilha_id,)
        ).fetchall()
        assert etapas == [(1, "Conceito", "nao_iniciado"), (2, "Prática", "nao_iniciado")]

        video = ana.execute(
            "select r.tipo, r.canal, r.duracao_segundos, r.verificacao, r.validado_em is not null "
            "from recursos r join etapas e on e.id = r.etapa_id "
            "where e.trilha_id = %s and r.tipo = 'video'",
            (trilha_id,),
        ).fetchone()
        assert video == ("video", "Prof. Ana", 600, "verificado", True)
        assert contagem_da_categoria(ana, categoria_id) == {"trilhas": 1, "etapas": 2, "recursos": 3}

        status, decidida = ana.execute(
            "select status, decidida_em is not null from propostas where id = %s", (proposta_id,)
        ).fetchone()
        assert (status, decidida) == ("confirmada", True)


def test_confirmar_duas_vezes_e_recusado(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria_id, proposta_id = nova_proposta(ana, payload())
        ana.execute("select confirmar_proposta(%s)", (proposta_id,))
        with pytest.raises(psycopg.Error) as erro:
            ana.execute("select confirmar_proposta(%s)", (proposta_id,))
        assert mensagem_do_erro(erro.value) == "proposta_ja_decidida"
        assert contagem_da_categoria(ana, categoria_id)["trilhas"] == 1


def test_proposta_de_outro_usuario_e_nao_encontrada(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, proposta_id = nova_proposta(ana, payload())

    with conectar(url_banco, BRUNO) as bruno:
        with pytest.raises(psycopg.Error) as erro:
            bruno.execute("select confirmar_proposta(%s)", (proposta_id,))
        assert mensagem_do_erro(erro.value) == "proposta_nao_encontrada"

    with conectar(url_banco, ANA) as ana:
        assert valor(ana, "select status from propostas where id = %s", (proposta_id,)) == "pendente"


@pytest.mark.parametrize(
    "corpo",
    [
        # 2ª etapa com tipo inexistente: a 1ª etapa NÃO pode ficar gravada
        payload([
            {"titulo": "Ok", "recursos": [recurso()]},
            {"titulo": "Quebra", "recursos": [recurso(tipo="podcast")]},
        ]),
        # link com esquema perigoso no meio da trilha
        payload([
            {"titulo": "Ok", "recursos": [recurso()]},
            {"titulo": "XSS", "recursos": [recurso("javascript:alert(1)")]},
        ]),
        payload([{"titulo": "Ok", "recursos": [recurso("data:text/html,oi")]}]),
        payload([]),
        payload([{"titulo": "   ", "recursos": []}]),
        payload([{"titulo": "Recursos não é lista", "recursos": {"url": "https://x.com"}}]),
        payload([f"etapa-que-e-texto"]),
        {"titulo": "sem etapas"},
        {"titulo": "etapas objeto", "etapas": {"a": 1}},
        payload([{"titulo": f"E{i}", "recursos": []} for i in range(21)]),
    ],
    ids=[
        "tipo-invalido-no-meio", "javascript-url", "data-url", "lista-vazia", "titulo-em-branco",
        "recursos-nao-lista", "etapa-texto", "sem-etapas", "etapas-objeto", "etapas-demais",
    ],
)
def test_proposta_invalida_nao_grava_nada(url_banco, corpo):
    with conectar(url_banco, ANA) as ana:
        categoria_id, proposta_id = nova_proposta(ana, corpo)
        with pytest.raises(psycopg.Error):
            ana.execute("select confirmar_proposta(%s)", (proposta_id,))

        assert contagem_da_categoria(ana, categoria_id) == {"trilhas": 0, "etapas": 0, "recursos": 0}
        assert valor(ana, "select status from propostas where id = %s", (proposta_id,)) == "pendente"


def test_url_em_maiusculas_tambem_e_aceita(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, proposta_id = nova_proposta(ana, payload([{"titulo": "A", "recursos": [recurso("HTTPS://SITE.COM/A")]}]))
        assert valor(ana, "select confirmar_proposta(%s)", (proposta_id,)) is not None


def test_cliques_simultaneos_viram_uma_trilha_so(url_banco):
    """A trava (FOR UPDATE) faz o 2º clique esperar o 1º e depois ser recusado."""
    with conectar(url_banco, ANA) as ana:
        categoria_id, proposta_id = nova_proposta(ana, payload())

    primeiro = conectar(url_banco, ANA, autocommit=False)
    segundo = conectar(url_banco, ANA, autocommit=False)
    try:
        primeiro.execute("select confirmar_proposta(%s)", (proposta_id,))  # ainda sem commit

        resultado = {}

        def segundo_clique():
            try:
                segundo.execute("select confirmar_proposta(%s)", (proposta_id,))
                segundo.commit()
                resultado["ok"] = True
            except psycopg.Error as exc:
                segundo.rollback()
                resultado["erro"] = mensagem_do_erro(exc)

        t = threading.Thread(target=segundo_clique)
        t.start()
        t.join(timeout=1.0)
        assert t.is_alive(), "o 2º clique deveria estar esperando a trava"

        primeiro.commit()
        t.join(timeout=10)
        assert resultado == {"erro": "proposta_ja_decidida"}
    finally:
        primeiro.close()
        segundo.close()

    with conectar(url_banco, ANA) as ana:
        assert contagem_da_categoria(ana, categoria_id)["trilhas"] == 1


def test_usuario_sem_login_nao_executa_a_funcao(url_banco):
    with psycopg.connect(url_banco, autocommit=True) as conn:
        conn.execute("set role authenticated")  # papel certo, mas sem JWT (sem usuário)
        with pytest.raises(psycopg.Error) as erro:
            conn.execute("select confirmar_proposta(%s)", (str(uuid.uuid4()),))
        assert mensagem_do_erro(erro.value) == "proposta_nao_encontrada"


# ---------------------------------------------------------------------------
# Views do painel
# ---------------------------------------------------------------------------
def test_view_de_progresso_depois_de_confirmar(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria_id, proposta_id = nova_proposta(ana, payload())
        trilha_id = valor(ana, "select confirmar_proposta(%s)", (proposta_id,))
        ana.execute(
            "update etapas set status = 'concluido', concluida_em = now() "
            "where trilha_id = %s and ordem = 1",
            (trilha_id,),
        )
        linha = ana.execute(
            "select total_etapas, etapas_concluidas, pct_concluido from v_progresso_categoria "
            "where categoria_id = %s",
            (categoria_id,),
        ).fetchone()
        assert linha == (2, 1, 50.0)
