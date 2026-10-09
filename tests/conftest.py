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
