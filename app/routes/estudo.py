"""Rotas do cronômetro de estudo, das metas semanais e da tela "Hoje"."""
from flask import Blueprint, g, jsonify, request

from app.core import dependencies
from app.core.auth import login_required

bp = Blueprint("estudo", __name__)


@bp.post("/sessoes-estudo")
@login_required
def registrar_sessao():
    return jsonify(dependencies.get_estudo_service().registrar_sessao(request.get_json(silent=True))), 201


@bp.get("/metas")
@login_required
def meta():
    return jsonify(dependencies.get_estudo_service().meta())


@bp.put("/metas")
@login_required
def salvar_meta():
    return jsonify(dependencies.get_estudo_service().salvar_meta(g.user_id, request.get_json(silent=True)))


@bp.get("/hoje")
@login_required
def hoje():
    return jsonify(dependencies.get_estudo_service().hoje())
