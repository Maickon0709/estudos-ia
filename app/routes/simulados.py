"""Rotas do simulado cronometrado."""
from flask import Blueprint, jsonify, request

from app.core import dependencies
from app.core.auth import login_required

bp = Blueprint("simulados", __name__)


@bp.post("/categorias/<categoria_id>/simulados")
@login_required
def criar(categoria_id):
    corpo = request.get_json(silent=True) or {}
    simulado = dependencies.get_simulado_service().criar(
        categoria_id, corpo.get("quantidade"), corpo.get("minutos")
    )
    return jsonify(simulado), 201


@bp.get("/categorias/<categoria_id>/simulados")
@login_required
def listar(categoria_id):
    return jsonify(dependencies.get_simulado_service().listar(categoria_id))


@bp.get("/simulados/<simulado_id>")
@login_required
def obter(simulado_id):
    return jsonify(dependencies.get_simulado_service().obter(simulado_id))


@bp.post("/simulados/<simulado_id>/finalizar")
@login_required
def finalizar(simulado_id):
    corpo = request.get_json(silent=True) or {}
    return jsonify(dependencies.get_simulado_service().finalizar(simulado_id, corpo.get("respostas")))
