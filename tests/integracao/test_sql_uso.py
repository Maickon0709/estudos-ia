"""Testes da migração 007 (limite de uso por usuário) num Postgres real."""
import psycopg
import pytest

from tests.integracao.apoio import ANA, BRUNO, conectar, mensagem_do_erro, valor


def limpar(url_banco):
    with psycopg.connect(url_banco, autocommit=True) as admin:
        admin.execute("delete from uso_diario")


def test_soma_ate_o_limite_e_depois_recusa_sem_somar(url_banco):
    limpar(url_banco)
    with conectar(url_banco, ANA) as ana:
        assert [valor(ana, "select consumir_uso('chat', 3)") for _ in range(3)] == [1, 2, 3]
        with pytest.raises(psycopg.errors.RaiseException) as erro:
            ana.execute("select consumir_uso('chat', 3)")
        assert mensagem_do_erro(erro.value) == "limite_atingido"
        assert valor(ana, "select quantidade from uso_diario where tipo = 'chat'") == 3


def test_cada_usuario_e_cada_tipo_tem_seu_contador(url_banco):
    limpar(url_banco)
    with conectar(url_banco, ANA) as ana:
        ana.execute("select consumir_uso('pesquisa', 1)")
        assert valor(ana, "select consumir_uso('ia', 1)") == 1
    with conectar(url_banco, BRUNO) as bruno:
        assert valor(bruno, "select consumir_uso('pesquisa', 1)") == 1
        # e o Bruno não enxerga o contador da Ana
        assert valor(bruno, "select count(*) from uso_diario") == 1


def test_usuario_nao_consegue_zerar_o_proprio_contador(url_banco):
    limpar(url_banco)
    with conectar(url_banco, ANA) as ana:
        ana.execute("select consumir_uso('chat', 1)")
        for sql in (
            "update uso_diario set quantidade = 0",
            "delete from uso_diario",
            "insert into uso_diario (user_id, dia, tipo, quantidade) "
            f"values ('{ANA}', current_date + 1, 'chat', 0)",
        ):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                ana.execute(sql)
        assert valor(ana, "select quantidade from uso_diario") == 1


@pytest.mark.parametrize(
    ("tipo", "limite", "esperado"),
    [("video", 5, "tipo_invalido"), ("chat", 0, "limite_invalido"), ("chat", None, "limite_invalido")],
    ids=["tipo", "limite-zero", "limite-nulo"],
)
def test_parametros_invalidos_sao_recusados(url_banco, tipo, limite, esperado):
    with conectar(url_banco, ANA) as ana:
        with pytest.raises(psycopg.errors.RaiseException) as erro:
            ana.execute("select consumir_uso(%s, %s)", (tipo, limite))
    assert mensagem_do_erro(erro.value) == esperado


def test_sem_login_nao_conta(url_banco):
    with psycopg.connect(url_banco, autocommit=True) as conn:
        conn.execute("set role authenticated")
        with pytest.raises(psycopg.errors.RaiseException) as erro:
            conn.execute("select consumir_uso('chat', 5)")
    assert mensagem_do_erro(erro.value) == "nao_autenticado"


def test_conta_no_dia_de_brasilia(url_banco):
    limpar(url_banco)
    with conectar(url_banco, ANA) as ana:
        ana.execute("select consumir_uso('chat', 5)")
        assert valor(ana, "select dia = (now() at time zone 'America/Sao_Paulo')::date from uso_diario")
