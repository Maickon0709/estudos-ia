"""Ponto de entrada na Vercel (função Python): a API responde em /api/*."""
from app import create_app
from app.core.prefixo_api import SemPrefixoApi

app = create_app()
app.wsgi_app = SemPrefixoApi(app.wsgi_app)
