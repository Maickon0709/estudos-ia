"""Testes da migração 005 (consentimento e exclusão de conta) num Postgres real."""
import uuid

import psycopg
import pytest

from tests.integracao.apoio import URL_ADMIN, conectar, mensagem_do_erro, nova_trilha, novo_exercicio, valor


def novo_usuario(url_banco, meta='{}'):
    uid = str(uuid.uuid4())
    with psycopg.connect(url_banco, autocommit=True) as admin:
        admin.execute(
            "insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s::jsonb)",
            (uid, f"{uid[:8]}@x.com", meta),
        )
    return uid


def test_cadastro_grava_versao_e_data_do_aceite(url_banco):
    uid = novo_usuario(url_banco, '{"nome": "Carla", "termos_versao": "2026-10-09"}')
    with conectar(url_banco, uid) as carla:
        nome, versao, aceito = carla.execute(
            "select nome, termos_versao, termos_aceitos_em is not null from profiles").fetchone()
    assert (nome, versao, aceito) == ("Carla", "2026-10-09", True)


def test_cadastro_sem_aceite_fica_sem_registro(url_banco):
    uid = novo_usuario(url_banco)
    with conectar(url_banco, uid) as conn:
        assert conn.execute("select termos_versao, termos_aceitos_em from profiles").fetchone() == (None, None)


def test_excluir_minha_conta_apaga_tudo_em_cascata(url_banco):
    uid = novo_usuario(url_banco, '{"termos_versao": "v1"}')
    with conectar(url_banco, uid) as conn:
        _, _, (etapa, _) = nova_trilha(conn)
        novo_exercicio(conn, etapa)
        conn.execute("insert into flashcards (etapa_id, frente, verso) values (%s, 'a', 'b')", (etapa,))
        conn.execute("insert into metas (dias_por_semana) values (3)")
        conn.execute("select excluir_minha_conta()")

    with psycopg.connect(url_banco, autocommit=True) as admin:
        assert valor(admin, "select count(*) from auth.users where id = %s", (uid,)) == 0
        assert valor(admin, "select count(*) from profiles where id = %s", (uid,)) == 0
        assert valor(admin, "select count(*) from categorias where user_id = %s", (uid,)) == 0
        assert valor(admin, "select count(*) from etapas where id = %s", (etapa,)) == 0
        assert valor(admin, "select count(*) from metas where user_id = %s", (uid,)) == 0


def test_excluir_so_apaga_o_proprio_usuario(url_banco):
    alvo = novo_usuario(url_banco)
    atacante = novo_usuario(url_banco)
    with conectar(url_banco, atacante) as conn:
        conn.execute("select excluir_minha_conta()")
    with psycopg.connect(url_banco, autocommit=True) as admin:
        assert valor(admin, "select count(*) from auth.users where id = %s", (alvo,)) == 1
        assert valor(admin, "select count(*) from auth.users where id = %s", (atacante,)) == 0


def test_excluir_sem_login_e_recusado(url_banco):
    with psycopg.connect(url_banco, autocommit=True) as conn:
        conn.execute("set role authenticated")
        with pytest.raises(psycopg.errors.RaiseException) as erro:
            conn.execute("select excluir_minha_conta()")
        assert mensagem_do_erro(erro.value) == "nao_autenticado"


def test_papel_anonimo_nao_pode_chamar(url_banco):
    with psycopg.connect(url_banco, autocommit=True) as conn:
        conn.execute("do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') "
                     "then create role anon nologin; end if; end $$")
        conn.execute("revoke all on function excluir_minha_conta() from anon")
        conn.execute("set role anon")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("select excluir_minha_conta()")
