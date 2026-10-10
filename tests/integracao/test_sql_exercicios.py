"""Testes da migração 003 (respostas, revisões e views) num Postgres real."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from tests.integracao.apoio import (
    ANA,
    BRUNO,
    conectar,
    mensagem_do_erro,
    nova_trilha,
    novo_exercicio,
    psycopg,
    valor,
)
from psycopg.types.json import Jsonb

REGISTRAR = "select registrar_resposta(%s, %s, %s, %s, %s)"


def revisao(proxima="2026-10-10", intervalo=1, acertos=0):
    return Jsonb({"proxima_revisao": proxima, "intervalo_dias": intervalo, "acertos_seguidos": acertos})


def etapa_stats(conn, etapa_id):
    return conn.execute(
        "select tentativas, taxa_acerto::float from etapas where id = %s", (etapa_id,)
    ).fetchone()


def test_registrar_grava_resposta_e_atualiza_a_etapa(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, _, (etapa, _) = nova_trilha(ana)
        ex = novo_exercicio(ana, etapa)

        retorno = valor(ana, REGISTRAR, (ex, "B", True, "Isso!", None))

        assert retorno["etapa_id"] == str(etapa)
        assert retorno["niveis"] == {"basico": {"total": 1, "acertos": 1}}
        assert etapa_stats(ana, etapa) == (1, 100.0)
        dono, correta = ana.execute(
            "select user_id::text, correta from respostas where id = %s", (retorno["resposta_id"],)
        ).fetchone()
        assert (dono, correta) == (ANA, True)


def test_taxa_e_niveis_acumulam(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, _, (etapa, _) = nova_trilha(ana)
        basico = novo_exercicio(ana, etapa, "basico")
        inter = novo_exercicio(ana, etapa, "intermediario")
        ana.execute(REGISTRAR, (basico, "B", True, None, None))
        ana.execute(REGISTRAR, (basico, "A", False, None, None))
        retorno = valor(ana, REGISTRAR, (inter, "B", True, None, None))

        # Níveis (migração 010): cada questão conta uma vez, pela PRIMEIRA tentativa (acertou o básico).
        assert retorno["niveis"] == {
            "basico": {"total": 1, "acertos": 1},
            "intermediario": {"total": 1, "acertos": 1},
        }
        # Já as estatísticas da etapa contam todas as tentativas.
        assert etapa_stats(ana, etapa) == (3, 66.67)


def test_revisao_cria_atualiza_e_remove(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, _, (etapa, _) = nova_trilha(ana)
        ex = novo_exercicio(ana, etapa)

        ana.execute(REGISTRAR, (ex, "A", False, None, revisao("2026-10-10", 1, 0)))
        linha = "select proxima_revisao, intervalo_dias, acertos_seguidos from revisoes where exercicio_id = %s"
        assert ana.execute(linha, (ex,)).fetchone() == (date(2026, 10, 10), 1, 0)

        ana.execute(REGISTRAR, (ex, "B", True, None, revisao("2026-10-13", 3, 1)))
        assert ana.execute(linha, (ex,)).fetchone() == (date(2026, 10, 13), 3, 1)  # upsert, sem duplicar
        assert valor(ana, "select count(*) from revisoes where exercicio_id = %s", (ex,)) == 1

        ana.execute(REGISTRAR, (ex, "B", True, None, Jsonb({"remover": True})))
        assert valor(ana, "select count(*) from revisoes where exercicio_id = %s", (ex,)) == 0


def test_revisao_nula_nao_mexe_na_revisao_existente(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, _, (etapa, _) = nova_trilha(ana)
        ex = novo_exercicio(ana, etapa)
        ana.execute(REGISTRAR, (ex, "A", False, None, revisao()))
        ana.execute(REGISTRAR, (ex, "B", True, None, None))
        assert valor(ana, "select count(*) from revisoes where exercicio_id = %s", (ex,)) == 1


def test_outro_usuario_nao_responde_exercicio_alheio(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, _, (etapa, _) = nova_trilha(ana)
        ex = novo_exercicio(ana, etapa)

    with conectar(url_banco, BRUNO) as bruno:
        with pytest.raises(psycopg.Error) as erro:
            bruno.execute(REGISTRAR, (ex, "B", True, None, revisao()))
        assert mensagem_do_erro(erro.value) == "exercicio_nao_encontrado"

    with conectar(url_banco, ANA) as ana:
        assert valor(ana, "select count(*) from respostas where exercicio_id = %s", (ex,)) == 0
        assert etapa_stats(ana, etapa) == (0, 0.0)


def test_sem_login_e_recusado(url_banco):
    with psycopg.connect(url_banco, autocommit=True) as conn:
        conn.execute("set role authenticated")
        with pytest.raises(psycopg.Error) as erro:
            conn.execute(REGISTRAR, ("00000000-0000-0000-0000-000000000000", "x", True, None, None))
        assert mensagem_do_erro(erro.value) == "nao_autenticado"


def test_revisao_invalida_desfaz_tudo(url_banco):
    """Erro na última parte (revisão) não pode deixar a resposta gravada."""
    with conectar(url_banco, ANA) as ana:
        _, _, (etapa, _) = nova_trilha(ana)
        ex = novo_exercicio(ana, etapa)
        with pytest.raises(psycopg.Error):
            ana.execute(REGISTRAR, (ex, "A", False, None, Jsonb({"proxima_revisao": "lixo"})))
        assert valor(ana, "select count(*) from respostas where exercicio_id = %s", (ex,)) == 0
        assert etapa_stats(ana, etapa) == (0, 0.0)


def test_view_de_revisoes_pendentes_nao_expoe_gabarito_e_isola_usuarios(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria, _, (etapa, _) = nova_trilha(ana)
        ex = novo_exercicio(ana, etapa)
        ana.execute(REGISTRAR, (ex, "A", False, None, revisao("2026-10-01")))

        colunas = [c.name for c in ana.execute("select * from v_revisoes_pendentes limit 0").description]
        assert "gabarito" not in colunas and "explicacao" not in colunas
        linha = ana.execute(
            "select enunciado, categoria_id from v_revisoes_pendentes where exercicio_id = %s", (ex,)
        ).fetchone()
        assert linha == ("Pergunta?", categoria)

    with conectar(url_banco, BRUNO) as bruno:
        assert valor(bruno, "select count(*) from v_revisoes_pendentes where exercicio_id = %s", (ex,)) == 0
        assert valor(bruno, "select count(*) from v_acerto_etapa_nivel where etapa_id = %s", (etapa,)) == 0


def test_view_de_dias_de_estudo_usa_o_fuso_de_brasilia(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, _, (etapa, _) = nova_trilha(ana)
        ana.execute(REGISTRAR, (novo_exercicio(ana, etapa), "B", True, None, None))
        hoje_sp = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
        dias = {r[0] for r in ana.execute("select dia from v_dias_estudo")}
        assert hoje_sp in dias

    with conectar(url_banco, BRUNO) as bruno:
        assert valor(bruno, "select count(*) from v_dias_estudo") == 0
