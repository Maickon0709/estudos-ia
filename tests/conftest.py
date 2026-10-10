import pytest

from app import create_app


@pytest.fixture
def app():
    return create_app(
        {
            "TESTING": True,
            "SUPABASE_URL": "https://teste.supabase.co",
            "SUPABASE_ANON_KEY": "chave-falsa",
        }
    )


@pytest.fixture
def client(app):
    return app.test_client()


class UsoLivre:
    """Dublê do limite de uso que libera tudo (os testes de limite usam o de verdade)."""

    def consumir(self, tipo):
        pass

    def resumo(self):
        return {}


@pytest.fixture(autouse=True)
def _limite_liberado(monkeypatch):
    from app.core import dependencies

    monkeypatch.setattr(dependencies, "get_uso_service", lambda: UsoLivre())
