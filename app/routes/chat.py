"""Rotas HTTP do chat. Só recebe, delega ao service e responde."""
import json

from flask import Blueprint, Response, jsonify, request, stream_with_context

from app.core import dependencies
from app.core.auth import login_required
from app.core.limite import consome

bp = Blueprint("chat", __name__, url_prefix="/categorias")


@bp.get("/<categoria_id>/mensagens")
@login_required
def historico(categoria_id):
    return jsonify(dependencies.get_chat_service().historico(categoria_id))


@bp.post("/<categoria_id>/chat")
@login_required
@consome("chat")
def enviar(categoria_id):
    corpo = request.get_json(silent=True) or {}
    resultado = dependencies.get_chat_service().enviar(categoria_id, corpo.get("mensagem"))
    return jsonify(resultado), 201


@bp.post("/<categoria_id>/chat/stream")
@login_required
@consome("chat")
def enviar_stream(categoria_id):
    """Server-Sent Events: o texto da IA chega aos pedaços, como num chat ao vivo."""
    corpo = request.get_json(silent=True) or {}
    eventos = dependencies.get_chat_service().enviar_stream(categoria_id, corpo.get("mensagem"))

    def gerar():
        for evento in eventos:
            yield f"data: {json.dumps(evento, ensure_ascii=False, default=str)}\n\n"

    return Response(
        stream_with_context(gerar()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
