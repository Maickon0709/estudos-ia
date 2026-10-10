"""Testes da migração 004 (flashcards, simulados, sessões, metas, atividade) num Postgres real."""
import threading

import pytest
from psycopg.types.json import Jsonb

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


def novo_flashcard(conn, etapa_id):
    return valor(
        conn,
        "insert into flashcards (etapa_id, frente, verso) values (%s, 'O que é crase?', 'Fusão a + a') returning id",
        (etapa_id,),
    )


def categoria_com_exercicios(conn, quantidade=4, tipo="multipla_escolha"):
    categoria, _, (etapa, _) = nova_trilha(conn)
    ids = [novo_exercicio(conn, etapa, tipo=tipo) for _ in range(quantidade)]
    return categoria, etapa, ids


# ---------- flashcards ----------
def test_flashcard_novo_vence_hoje_e_rls_isola(url_banco):
    with conectar(url_banco, ANA) as ana, conectar(url_banco, BRUNO) as bruno:
        _, _, (etapa, _) = nova_trilha(ana)
        card = novo_flashcard(ana, etapa)
        hoje = valor(ana, "select (now() at time zone 'America/Sao_Paulo')::date")
        assert valor(ana, "select proxima_revisao from flashcards where id = %s", (card,)) == hoje
        assert valor(bruno, "select count(*) from flashcards") == 0
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            novo_flashcard(bruno, etapa)  # etapa da Ana


def test_revisar_flashcard_reagenda_e_registra_historico(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, _, (etapa, _) = nova_trilha(ana)
        card = novo_flashcard(ana, etapa)
        revisao = Jsonb({"proxima_revisao": "2026-12-01", "intervalo_dias": 3, "acertos_seguidos": 1})

        retorno = valor(ana, "select revisar_flashcard(%s, true, %s)", (card, revisao))

        assert (retorno["proxima_revisao"], retorno["intervalo_dias"], retorno["acertos_seguidos"]) == ("2026-12-01", 3, 1)
        assert valor(ana, "select count(*) from flashcard_revisoes where flashcard_id = %s and lembrou", (card,)) == 1
        assert valor(ana, "select flashcards from v_atividade_diaria order by dia desc limit 1") >= 1


def test_revisar_flashcard_dominado(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, _, (etapa, _) = nova_trilha(ana)
        card = novo_flashcard(ana, etapa)
        retorno = valor(ana, "select revisar_flashcard(%s, true, %s)", (card, Jsonb({"remover": True})))
        assert retorno["dominado"] is True
        assert valor(ana, "select count(*) from v_flashcards_pendentes where id = %s", (card,)) == 0


def test_revisar_flashcard_de_outro_usuario_nao_encontra(url_banco):
    with conectar(url_banco, ANA) as ana, conectar(url_banco, BRUNO) as bruno:
        _, _, (etapa, _) = nova_trilha(ana)
        card = novo_flashcard(ana, etapa)
        with pytest.raises(psycopg.errors.NoDataFound) as erro:
            bruno.execute("select revisar_flashcard(%s, true, %s)", (card, Jsonb({"remover": True})))
        assert mensagem_do_erro(erro.value) == "flashcard_nao_encontrado"
        assert valor(ana, "select dominado from flashcards where id = %s", (card,)) is False


# ---------- simulados ----------
def test_criar_simulado_sorteia_so_multipla_escolha_da_categoria(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria, etapa, multipla = categoria_com_exercicios(ana, 4)
        novo_exercicio(ana, etapa, tipo="discursiva")
        _, _, outros = categoria_com_exercicios(ana, 3)  # outra categoria

        simulado = valor(ana, "select criar_simulado(%s, 10, 600)", (categoria,))

        questoes = [r[0] for r in ana.execute(
            "select exercicio_id from simulado_questoes where simulado_id = %s order by ordem", (simulado,))]
        assert sorted(map(str, questoes)) == sorted(map(str, multipla))
        assert not set(map(str, questoes)) & set(map(str, outros))
        assert ana.execute("select total, user_id::text from simulados where id = %s", (simulado,)).fetchone() == (4, ANA)


def test_criar_simulado_exige_tres_exercicios(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria, _, _ = categoria_com_exercicios(ana, 2)
        with pytest.raises(psycopg.errors.RaiseException) as erro:
            ana.execute("select criar_simulado(%s, 10, 600)", (categoria,))
        assert mensagem_do_erro(erro.value) == "exercicios_insuficientes"


def test_criar_simulado_em_categoria_alheia_nao_encontra(url_banco):
    with conectar(url_banco, ANA) as ana, conectar(url_banco, BRUNO) as bruno:
        categoria, _, _ = categoria_com_exercicios(ana, 4)
        with pytest.raises(psycopg.errors.NoDataFound):
            bruno.execute("select criar_simulado(%s, 10, 600)", (categoria,))


def test_finalizar_simulado_conta_acertos_e_nao_finaliza_duas_vezes(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria, _, _ = categoria_com_exercicios(ana, 3)
        simulado = valor(ana, "select criar_simulado(%s, 3, 600)", (categoria,))
        itens = Jsonb([{"ordem": 1, "resposta": "B", "correta": True},
                       {"ordem": 2, "resposta": "A", "correta": False}])  # a 3 ficou sem resposta

        retorno = valor(ana, "select finalizar_simulado(%s, %s)", (simulado, itens))

        assert (retorno["acertos"], retorno["total"], retorno["dentro_do_prazo"]) == (1, 3, True)
        assert [r[0] for r in ana.execute(
            "select correta from simulado_questoes where simulado_id = %s order by ordem", (simulado,))] == [True, False, False]
        with pytest.raises(psycopg.errors.RaiseException) as erro:
            ana.execute("select finalizar_simulado(%s, %s)", (simulado, itens))
        assert mensagem_do_erro(erro.value) == "simulado_ja_finalizado"


def test_finalizar_simulado_fora_do_prazo(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria, _, _ = categoria_com_exercicios(ana, 3)
        simulado = valor(ana, "select criar_simulado(%s, 3, 60)", (categoria,))
        ana.execute("update simulados set iniciado_em = now() - interval '5 minutes' where id = %s", (simulado,))
        retorno = valor(ana, "select finalizar_simulado(%s, '[]')", (simulado,))
        assert retorno["dentro_do_prazo"] is False
        assert retorno["acertos"] == 0


def test_finalizar_simultaneo_so_um_vence(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria, _, _ = categoria_com_exercicios(ana, 3)
        simulado = valor(ana, "select criar_simulado(%s, 3, 600)", (categoria,))

    resultados = []

    def enviar():
        with conectar(url_banco, ANA) as conn:
            try:
                conn.execute("select finalizar_simulado(%s, '[]')", (simulado,))
                resultados.append("ok")
            except psycopg.errors.RaiseException:
                resultados.append("recusado")

    threads = [threading.Thread(target=enviar) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(resultados) == ["ok", "recusado"]


def test_simulado_de_outro_usuario_e_invisivel(url_banco):
    with conectar(url_banco, ANA) as ana, conectar(url_banco, BRUNO) as bruno:
        categoria, _, _ = categoria_com_exercicios(ana, 3)
        simulado = valor(ana, "select criar_simulado(%s, 3, 600)", (categoria,))
        assert valor(bruno, "select count(*) from simulado_questoes where simulado_id = %s", (simulado,)) == 0
        with pytest.raises(psycopg.errors.NoDataFound):
            bruno.execute("select finalizar_simulado(%s, '[]')", (simulado,))


# ---------- sessões, metas e atividade ----------
def test_sessao_de_estudo_entra_na_atividade_e_na_semana(url_banco):
    with conectar(url_banco, ANA) as ana:
        categoria, _, _ = nova_trilha(ana)
        ana.execute(
            "insert into sessoes_estudo (categoria_id, tipo, duracao_segundos, iniciada_em) "
            "values (%s, 'foco', 1500, now() - interval '30 minutes')", (categoria,))
        assert valor(ana, "select user_id::text from sessoes_estudo limit 1") == ANA
        assert valor(ana, "select minutos from v_estudo_semanal where categoria_id = %s", (categoria,)) == 25
        hoje = valor(ana, "select (now() at time zone 'America/Sao_Paulo')::date")
        assert valor(ana, "select count(*) from v_dias_estudo where dia = %s", (hoje,)) == 1


def test_sessao_valida_duracao_e_categoria_alheia(url_banco):
    with conectar(url_banco, ANA) as ana, conectar(url_banco, BRUNO) as bruno:
        categoria, _, _ = nova_trilha(ana)
        with pytest.raises(psycopg.errors.CheckViolation):
            ana.execute("insert into sessoes_estudo (tipo, duracao_segundos, iniciada_em) values ('foco', 10, now())")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            bruno.execute(
                "insert into sessoes_estudo (categoria_id, tipo, duracao_segundos, iniciada_em) "
                "values (%s, 'foco', 600, now())", (categoria,))


def test_metas_uma_por_usuario_e_isoladas(url_banco):
    with conectar(url_banco, ANA) as ana, conectar(url_banco, BRUNO) as bruno:
        upsert = ("insert into metas (dias_por_semana, minutos_por_semana) values (%s, %s) "
                  "on conflict (user_id) do update set dias_por_semana = excluded.dias_por_semana, "
                  "minutos_por_semana = excluded.minutos_por_semana")
        ana.execute(upsert, (4, 120))
        ana.execute(upsert, (5, 200))
        assert ana.execute("select dias_por_semana, minutos_por_semana from metas").fetchall() == [(5, 200)]
        assert valor(bruno, "select count(*) from metas") == 0
        with pytest.raises(psycopg.errors.CheckViolation):
            ana.execute(upsert, (8, 100))
