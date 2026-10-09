"""Funções de apoio dos testes de SQL (conexão 'logada', inserts prontos)."""
import os
import uuid
from pathlib import Path

try:
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError:  # sem o driver, a suíte de integração é ignorada
    psycopg = None
    Jsonb = None

URL_ADMIN = os.environ.get("TEST_DATABASE_URL")
RAIZ = Path(__file__).resolve().parents[2]
ANA = "11111111-1111-1111-1111-111111111111"
BRUNO = "22222222-2222-2222-2222-222222222222"


def conectar(url, usuario, autocommit=True):
    """Conexão 'logada' como o usuário: papel authenticated + sub do JWT."""
    conn = psycopg.connect(url, autocommit=autocommit)
    conn.execute("set role authenticated")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (usuario,))
    return conn


def valor(conn, sql, params=()):
    return conn.execute(sql, params).fetchone()[0]


def mensagem_do_erro(exc):
    return exc.diag.message_primary


def recurso(url="https://site.com/aula", tipo="link", **extra):
    return {"tipo": tipo, "titulo": "Aula", "url": url, "verificacao": "verificado", **extra}


def payload(etapas=None, titulo="Crase do zero"):
    if etapas is None:
        etapas = [
            {"titulo": "Conceito", "descricao": "O que é", "recursos": [recurso()]},
            {
                "titulo": "Prática",
                "descricao": None,
                "recursos": [
                    recurso(
                        "https://www.youtube.com/watch?v=aaaaaaaaaaa",
                        "video",
                        canal="Prof. Ana",
                        duracao_segundos=600,
                        validado_em="2026-10-09T12:00:00+00:00",
                    ),
                    recurso("https://www.youtube.com/playlist?list=PLabc1234567", "playlist", total_videos=12),
                ],
            },
        ]
    return {"titulo": titulo, "etapas": etapas}


def nova_proposta(conn, corpo):
    categoria_id = valor(
        conn,
        "insert into categorias (user_id, nome) values (auth.uid(), %s) returning id",
        (f"cat-{uuid.uuid4().hex[:8]}",),
    )
    proposta_id = valor(
        conn,
        "insert into propostas (categoria_id, payload) values (%s, %s) returning id",
        (categoria_id, Jsonb(corpo)),
    )
    return categoria_id, proposta_id


def nova_trilha(conn):
    """Categoria + proposta confirmada. Devolve (categoria_id, trilha_id, [etapa_ids])."""
    categoria_id, proposta_id = nova_proposta(conn, payload())
    trilha_id = valor(conn, "select confirmar_proposta(%s)", (proposta_id,))
    etapas = [r[0] for r in conn.execute(
        "select id from etapas where trilha_id = %s order by ordem", (trilha_id,)
    )]
    return categoria_id, trilha_id, etapas


def novo_exercicio(conn, etapa_id, nivel="basico", tipo="multipla_escolha", gabarito="B"):
    return valor(
        conn,
        "insert into exercicios (etapa_id, nivel, tipo, enunciado, opcoes, gabarito, explicacao) "
        "values (%s, %s, %s, 'Pergunta?', %s, %s, 'Porque sim') returning id",
        (etapa_id, nivel, tipo, Jsonb(["um", "dois", "três", "quatro"]), gabarito),
    )


def contagem_da_categoria(conn, categoria_id):
    return {
        "trilhas": valor(conn, "select count(*) from trilhas where categoria_id = %s", (categoria_id,)),
        "etapas": valor(
            conn,
            "select count(*) from etapas e join trilhas t on t.id = e.trilha_id where t.categoria_id = %s",
            (categoria_id,),
        ),
        "recursos": valor(
            conn,
            "select count(*) from recursos r join etapas e on e.id = r.etapa_id "
            "join trilhas t on t.id = e.trilha_id where t.categoria_id = %s",
            (categoria_id,),
        ),
    }
