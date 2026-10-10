"""Testes da migração 006 (políticas do bucket de fotos de perfil) num Postgres real."""
import psycopg
import pytest

from tests.integracao.apoio import ANA, BRUNO, conectar, valor

INSERIR = "insert into storage.objects (bucket_id, name) values ('avatares', %s)"


def test_bucket_privado_so_aceita_webp(url_banco):
    with psycopg.connect(url_banco) as admin:
        publico, limite, tipos = admin.execute(
            "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatares'").fetchone()
    assert (publico, limite, tipos) == (False, 1048576, ["image/webp"])


def test_usuario_grava_e_le_so_a_propria_pasta(url_banco):
    with conectar(url_banco, ANA) as ana, conectar(url_banco, BRUNO) as bruno:
        ana.execute(INSERIR, (f"{ANA}/avatar.webp",))
        assert valor(ana, "select count(*) from storage.objects where name = %s", (f"{ANA}/avatar.webp",)) == 1
        assert valor(bruno, "select count(*) from storage.objects where name = %s", (f"{ANA}/avatar.webp",)) == 0

        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            bruno.execute(INSERIR, (f"{ANA}/outra.webp",))      # pasta da Ana
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            bruno.execute(INSERIR, ("avatar.webp",))             # fora de qualquer pasta

        apagou = bruno.execute("delete from storage.objects where name = %s", (f"{ANA}/avatar.webp",)).rowcount
        assert apagou == 0
        assert ana.execute("delete from storage.objects where name = %s", (f"{ANA}/avatar.webp",)).rowcount == 1


def test_politicas_nao_valem_para_outros_buckets(url_banco):
    with psycopg.connect(url_banco, autocommit=True) as admin:
        admin.execute("insert into storage.buckets (id, name) values ('outro', 'outro') on conflict do nothing")
    with conectar(url_banco, ANA) as ana:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            ana.execute("insert into storage.objects (bucket_id, name) values ('outro', %s)", (f"{ANA}/x.webp",))
