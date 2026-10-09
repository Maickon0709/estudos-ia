"""Rota HTTP da pesquisa de conteúdo. Só recebe, delega e responde."""
from flask import Blueprint, jsonify, request

from app.core import dependencies
from app.core.auth import login_required

bp = Blueprint("pesquisa", __name__, url_prefix="/categorias")


@bp.post("/<categoria_id>/pesquisar")
@login_required
def pesquisar(categoria_id):
    corpo = request.get_json(silent=True) or {}
    resultado = dependencies.get_pesquisa_service().pesquisar(
        categoria_id, corpo.get("consulta")
    )
    return jsonify(resultado)
