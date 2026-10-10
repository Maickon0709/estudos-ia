"""Migração 010: a view de acerto por nível conta questões diferentes, pela primeira tentativa."""
from tests.integracao.apoio import ANA, BRUNO, conectar, nova_trilha, novo_exercicio


def responder(conn, exercicio_id, correta):
    conn.execute(
        "insert into respostas (exercicio_id, user_id, resposta, correta) values (%s, auth.uid(), 'x', %s)",
        (exercicio_id, correta),
    )


def niveis(conn, etapa_id):
    return {n: (t, a) for n, t, a in conn.execute(
        "select nivel, total, acertos from v_acerto_etapa_nivel where etapa_id = %s", (etapa_id,))}


def test_responder_de_novo_nao_infla_o_total_nem_o_acerto(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, _, etapas = nova_trilha(ana)
        q1, q2 = novo_exercicio(ana, etapas[0]), novo_exercicio(ana, etapas[0])
        responder(ana, q1, False)   # primeira tentativa: errou
        responder(ana, q1, True)    # acertou depois de ver o gabarito: não conta
        responder(ana, q1, True)
        responder(ana, q2, True)
        assert niveis(ana, etapas[0]) == {"basico": (2, 1)}


def test_niveis_separados_e_por_etapa(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, _, etapas = nova_trilha(ana)
        responder(ana, novo_exercicio(ana, etapas[0], nivel="basico"), True)
        responder(ana, novo_exercicio(ana, etapas[0], nivel="intermediario"), False)
        responder(ana, novo_exercicio(ana, etapas[1], nivel="basico"), True)
        assert niveis(ana, etapas[0]) == {"basico": (1, 1), "intermediario": (1, 0)}
        assert niveis(ana, etapas[1]) == {"basico": (1, 1)}


def test_outro_usuario_nao_ve_os_numeros(url_banco):
    with conectar(url_banco, ANA) as ana:
        _, _, etapas = nova_trilha(ana)
        responder(ana, novo_exercicio(ana, etapas[0]), True)
    with conectar(url_banco, BRUNO) as bruno:
        assert niveis(bruno, etapas[0]) == {}


def test_registrar_resposta_devolve_os_niveis_da_view_nova(url_banco):
    """A função atômica da 003 lê a view: a segunda resposta da mesma questão não muda o total."""
    with conectar(url_banco, ANA) as ana:
        _, _, etapas = nova_trilha(ana)
        q = novo_exercicio(ana, etapas[0])
        args = (q, "B", True, None)
        primeira = ana.execute("select registrar_resposta(%s, %s, %s, %s)", args).fetchone()[0]
        segunda = ana.execute("select registrar_resposta(%s, %s, %s, %s)", args).fetchone()[0]
        assert primeira["niveis"] == segunda["niveis"]
