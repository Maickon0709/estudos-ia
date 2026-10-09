"""Application factory."""
from flask import Flask, jsonify

from app.config import Config
from app.core.errors import AppError


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    if config:
        app.config.update(config)
    else:
        Config.validar()

    from app.routes import (
        auth,
        categorias,
        chat,
        exercicios,
        painel,
        pesquisa,
        propostas,
        trilhas,
    )

    for modulo in (auth, categorias, chat, pesquisa, propostas, trilhas, exercicios, painel):
        app.register_blueprint(modulo.bp)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    @app.errorhandler(AppError)
    def tratar_erro_de_dominio(erro: AppError):
        return jsonify({"erro": erro.codigo, "mensagem": erro.mensagem}), erro.status_code

    return app
