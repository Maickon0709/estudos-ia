"""Rotas do painel de progresso e das revisões do dia."""
from flask import Blueprint, jsonify, request

from app.core import dependencies
from app.core.auth import login_required

bp = Blueprint("painel", __name__)


@bp.get("/categorias/<categoria_id>/painel")
@login_required
def painel(categoria_id):
    return jsonify(dependencies.get_painel_service().painel(categoria_id))


@bp.get("/revisoes/hoje")
@login_required
def revisoes_de_hoje():
    return jsonify(dependencies.get_painel_service().revisoes_de_hoje(request.args.get("categoria_id")))
