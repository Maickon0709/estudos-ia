"""Infra dos testes de SQL: um banco temporário por execução da suíte.

Rodam só se TEST_DATABASE_URL apontar para um Postgres 15+ onde o usuário pode
criar bancos. Exemplo com Docker:

    docker run --rm -e POSTGRES_PASSWORD=pg -p 5433:5432 postgres:16
    TEST_DATABASE_URL=postgresql://postgres:pg@localhost:5433/postgres pytest tests/integracao

Aplica a imitação do Supabase (supabase_shim.sql), o schema e TODAS as
migrações em ordem, e apaga o banco no final.
"""
import uuid

import pytest

from tests.integracao.apoio import ANA, BRUNO, RAIZ, URL_ADMIN, psycopg

if psycopg is None or not URL_ADMIN:
    collect_ignore_glob = ["test_*.py"]


@pytest.fixture(scope="session")
def url_banco():
    from psycopg.conninfo import make_conninfo

    nome = f"estudos_ia_teste_{uuid.uuid4().hex[:10]}"
    with psycopg.connect(URL_ADMIN, autocommit=True) as admin:
        admin.execute(f'create database "{nome}"')
    url = make_conninfo(URL_ADMIN, dbname=nome)
    try:
        with psycopg.connect(url, autocommit=True) as conn:
            arquivos = [
                RAIZ / "tests" / "integracao" / "supabase_shim.sql",
                RAIZ / "schema_supabase.sql",
                *sorted((RAIZ / "migrations").glob("*.sql")),
            ]
            for arquivo in arquivos:
                conn.execute(arquivo.read_text(encoding="utf-8"))
            conn.execute(
                "insert into auth.users (id, email, raw_user_meta_data) values "
                "(%s, 'ana@x.com', '{\"nome\": \"Ana\"}'), (%s, 'bruno@x.com', '{}')",
                (ANA, BRUNO),
            )
        yield url
    finally:
        with psycopg.connect(URL_ADMIN, autocommit=True) as admin:
            admin.execute(f'drop database if exists "{nome}" with (force)')
