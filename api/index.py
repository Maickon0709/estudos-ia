"""Ponto de entrada na Vercel (função Python).

Site e API ficam no MESMO domínio (exigência dos cookies HttpOnly da sessão):
o site estático é servido na raiz e a API em /api/*. A Vercel entrega o caminho
completo (/api/categorias); as rotas do Flask não têm o prefixo, então ele é
retirado aqui. Localmente o proxy do Vite já faz isso, e sem prefixo nada muda.
"""
from app import create_app

PREFIXO = "/api"


class SemPrefixoApi:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        caminho = environ.get("PATH_INFO", "")
        if caminho == PREFIXO or caminho.startswith(PREFIXO + "/"):
            environ["PATH_INFO"] = caminho[len(PREFIXO):] or "/"
            environ["SCRIPT_NAME"] = environ.get("SCRIPT_NAME", "") + PREFIXO
        return self.wsgi_app(environ, start_response)


app = create_app()
app.wsgi_app = SemPrefixoApi(app.wsgi_app)
