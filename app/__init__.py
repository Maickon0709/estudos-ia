"""Application factory."""
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from app.config import Config
from app.core.errors import AppError


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    # Teto de qualquer requisição (as maiores: foto de perfil até 5 MB, material até 4 MB). Acima: 413.
    app.config["MAX_CONTENT_LENGTH"] = 6 * 1024 * 1024
    if config:
        app.config.update(config)
    else:
        Config.validar()

    from app.routes import (
        auth,
        categorias,
        chat,
        conta,
        documentos,
        estudo,
        exercicios,
        flashcards,
        painel,
        pesquisa,
        propostas,
        simulados,
        trilhas,
    )

    for modulo in (auth, categorias, chat, pesquisa, propostas, trilhas, exercicios, painel,
                   flashcards, simulados, estudo, conta, documentos):
        app.register_blueprint(modulo.bp)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    @app.errorhandler(AppError)
    def tratar_erro_de_dominio(erro: AppError):
        return jsonify({"erro": erro.codigo, "mensagem": erro.mensagem}), erro.status_code

    # 404/405 etc. também saem no formato {erro, mensagem}, nunca como página HTML.
    _MENSAGENS_HTTP = {
        404: ("nao_encontrado", "Rota não encontrada."),
        405: ("metodo_nao_permitido", "Método não permitido nesta rota."),
        413: ("muito_grande", "O arquivo enviado é grande demais."),
    }

    @app.errorhandler(HTTPException)
    def tratar_erro_http(erro: HTTPException):
        codigo, mensagem = _MENSAGENS_HTTP.get(erro.code, ("erro_http", "Requisição inválida."))
        return jsonify({"erro": codigo, "mensagem": mensagem}), erro.code

    return app
