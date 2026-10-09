"""Rotas de exercícios e respostas."""
from flask import Blueprint, jsonify, request

from app.core import dependencies
from app.core.auth import login_required

bp = Blueprint("exercicios", __name__)


@bp.post("/etapas/<etapa_id>/exercicios")
@login_required
def gerar(etapa_id):
    corpo = request.get_json(silent=True) or {}
    exercicios = dependencies.get_exercicio_service().gerar(
        etapa_id, corpo.get("nivel"), corpo.get("quantidade")
    )
    return jsonify(exercicios), 201


@bp.get("/etapas/<etapa_id>/exercicios")
@login_required
def listar(etapa_id):
    return jsonify(dependencies.get_exercicio_service().listar(etapa_id, request.args.get("nivel")))


@bp.post("/exercicios/<exercicio_id>/responder")
@login_required
def responder(exercicio_id):
    corpo = request.get_json(silent=True) or {}
    return jsonify(dependencies.get_exercicio_service().responder(exercicio_id, corpo.get("resposta")))
