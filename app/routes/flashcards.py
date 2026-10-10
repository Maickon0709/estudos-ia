"""Rotas dos flashcards."""
from flask import Blueprint, jsonify, request

from app.core import dependencies
from app.core.auth import login_required
from app.core.limite import consome

bp = Blueprint("flashcards", __name__)


@bp.post("/etapas/<etapa_id>/flashcards")
@login_required
@consome("ia")
def gerar(etapa_id):
    corpo = request.get_json(silent=True) or {}
    return jsonify(dependencies.get_flashcard_service().gerar(etapa_id, corpo.get("quantidade"))), 201


@bp.get("/etapas/<etapa_id>/flashcards")
@login_required
def listar(etapa_id):
    return jsonify(dependencies.get_flashcard_service().listar(etapa_id))


@bp.get("/flashcards/hoje")
@login_required
def pendentes():
    return jsonify(dependencies.get_flashcard_service().pendentes())


@bp.post("/flashcards/<flashcard_id>/revisar")
@login_required
def revisar(flashcard_id):
    corpo = request.get_json(silent=True) or {}
    return jsonify(dependencies.get_flashcard_service().revisar(flashcard_id, corpo.get("lembrei")))
