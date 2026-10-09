"""Rotas HTTP das categorias. Só recebe, delega ao service e responde."""
from flask import Blueprint, g, jsonify, request

from app.core import dependencies
from app.core.auth import login_required

bp = Blueprint("categorias", __name__, url_prefix="/categorias")


def _nome_do_corpo():
    corpo = request.get_json(silent=True) or {}
    return corpo.get("nome")


@bp.get("")
@login_required
def listar():
    return jsonify(dependencies.get_categoria_service().listar())


@bp.post("")
@login_required
def criar():
    categoria = dependencies.get_categoria_service().criar(g.user_id, _nome_do_corpo())
    return jsonify(categoria), 201


@bp.get("/<categoria_id>")
@login_required
def obter(categoria_id):
    return jsonify(dependencies.get_categoria_service().obter(categoria_id))


@bp.patch("/<categoria_id>")
@login_required
def renomear(categoria_id):
    categoria = dependencies.get_categoria_service().renomear(
        categoria_id, _nome_do_corpo()
    )
    return jsonify(categoria)


@bp.delete("/<categoria_id>")
@login_required
def remover(categoria_id):
    dependencies.get_categoria_service().remover(categoria_id)
    return "", 204
