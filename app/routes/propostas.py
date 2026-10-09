"""Rotas HTTP das propostas. Só recebem, delegam ao service e respondem."""
from flask import Blueprint, jsonify, request

from app.core import dependencies
from app.core.auth import login_required

bp = Blueprint("propostas", __name__)


@bp.post("/categorias/<categoria_id>/propostas")
@login_required
def gerar(categoria_id):
    corpo = request.get_json(silent=True) or {}
    proposta = dependencies.get_proposta_service().gerar(categoria_id, corpo.get("objetivo"))
    return jsonify(proposta), 201


@bp.get("/categorias/<categoria_id>/propostas")
@login_required
def listar(categoria_id):
    status = request.args.get("status")
    return jsonify(dependencies.get_proposta_service().listar(categoria_id, status))


@bp.get("/propostas/<proposta_id>")
@login_required
def obter(proposta_id):
    return jsonify(dependencies.get_proposta_service().obter(proposta_id))


@bp.post("/propostas/<proposta_id>/confirmar")
@login_required
def confirmar(proposta_id):
    return jsonify(dependencies.get_proposta_service().confirmar(proposta_id)), 201


@bp.post("/propostas/<proposta_id>/rejeitar")
@login_required
def rejeitar(proposta_id):
    return jsonify(dependencies.get_proposta_service().rejeitar(proposta_id))
