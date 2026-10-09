from datetime import datetime

from app.repositories.mensagem_repository import MensagemRepository


class Resposta:
    def __init__(self, data):
        self.data = data


class QueryFalsa:
    """Registra a cadeia de chamadas do query builder e devolve dados prontos."""

    def __init__(self, data):
        self.chamadas = []
        self._data = data

    def __getattr__(self, nome):
        def registrar(*args, **kwargs):
            self.chamadas.append((nome, args, kwargs))
            return self

        return registrar

    def execute(self):
        return Resposta(self._data)


class ClienteFalso:
    def __init__(self, data):
        self.query = QueryFalsa(data)

    def table(self, nome):
        assert nome == "mensagens"
        return self.query


def test_listar_recentes_pede_as_mais_novas_e_devolve_em_ordem_cronologica():
    # o banco devolve da mais nova para a mais antiga (order desc)
    cliente = ClienteFalso([{"conteudo": "nova"}, {"conteudo": "antiga"}])
    itens = MensagemRepository(cliente).listar_recentes("cat-1", 5)

    assert [m["conteudo"] for m in itens] == ["antiga", "nova"]
    chamadas = {nome: (args, kwargs) for nome, args, kwargs in cliente.query.chamadas}
    assert chamadas["eq"][0] == ("categoria_id", "cat-1")
    assert chamadas["order"] == (("created_at",), {"desc": True})
    assert chamadas["limit"][0] == (5,)


def test_criar_par_usa_um_unico_insert_com_timestamps_distintos():
    cliente = ClienteFalso([{}, {}])
    MensagemRepository(cliente).criar_par("cat-1", "pergunta", "resposta")

    inserts = [c for c in cliente.query.chamadas if c[0] == "insert"]
    assert len(inserts) == 1  # atômico: tudo ou nada

    linhas = inserts[0][1][0]
    assert [l["papel"] for l in linhas] == ["user", "assistant"]
    assert [l["conteudo"] for l in linhas] == ["pergunta", "resposta"]
    assert all(l["categoria_id"] == "cat-1" for l in linhas)

    t_user = datetime.fromisoformat(linhas[0]["created_at"])
    t_ia = datetime.fromisoformat(linhas[1]["created_at"])
    assert t_ia > t_user  # a ordem não fica ambígua
