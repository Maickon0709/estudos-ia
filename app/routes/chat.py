"""Rotas HTTP do chat. Só recebe, delega ao service e responde."""
from flask import Blueprint, jsonify, request

from app.core import dependencies
from app.core.auth import login_required

bp = Blueprint("chat", __name__, url_prefix="/categorias")


@bp.get("/<categoria_id>/mensagens")
@login_required
def historico(categoria_id):
    return jsonify(dependencies.get_chat_service().historico(categoria_id))


@bp.post("/<categoria_id>/chat")
@login_required
def enviar(categoria_id):
    corpo = request.get_json(silent=True) or {}
    resultado = dependencies.get_chat_service().enviar(categoria_id, corpo.get("mensagem"))
    return jsonify(resultado), 201
