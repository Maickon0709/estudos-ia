"""Entrada da Vercel: a API responde em /api/* (mesmo domínio do site) e também sem o prefixo."""
import pytest

from app.core.prefixo_api import SemPrefixoApi
from app import create_app


@pytest.fixture
def cliente():
    app = create_app({"TESTING": True, "SUPABASE_URL": "https://x.supabase.co", "SUPABASE_ANON_KEY": "k"})
    app.wsgi_app = SemPrefixoApi(app.wsgi_app)
    return app.test_client()


def test_rota_com_prefixo_api(cliente):
    assert cliente.get("/api/health").get_json() == {"status": "ok"}


def test_rota_sem_prefixo_continua_valendo(cliente):
    assert cliente.get("/health").status_code == 200


def test_prefixo_parecido_nao_e_cortado(cliente):
    # "/apiX" não é a API: não pode virar "X".
    assert cliente.get("/apihealth").status_code == 404


def test_rota_inexistente_com_prefixo_responde_json(cliente):
    resposta = cliente.get("/api/nao-existe")
    assert resposta.status_code == 404 and resposta.get_json()["erro"] == "nao_encontrado"
