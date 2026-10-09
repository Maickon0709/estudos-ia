"""Rotas da trilha e do checklist de etapas."""
from flask import Blueprint, jsonify, request

from app.core import dependencies
from app.core.auth import login_required

bp = Blueprint("trilhas", __name__)


@bp.get("/categorias/<categoria_id>/trilhas")
@login_required
def listar(categoria_id):
    return jsonify(dependencies.get_trilha_service().listar(categoria_id))


@bp.get("/trilhas/<trilha_id>")
@login_required
def obter(trilha_id):
    return jsonify(dependencies.get_trilha_service().obter(trilha_id))


@bp.patch("/etapas/<etapa_id>")
@login_required
def atualizar_etapa(etapa_id):
    corpo = request.get_json(silent=True)
    return jsonify(dependencies.get_trilha_service().atualizar_etapa(etapa_id, corpo))
