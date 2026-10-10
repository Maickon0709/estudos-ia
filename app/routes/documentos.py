"""Rotas dos materiais do aluno (PDF, Word, PowerPoint, texto)."""
from flask import Blueprint, jsonify, request

from app.core import dependencies
from app.core.auth import login_required
from app.core.errors import ValidacaoError

bp = Blueprint("documentos", __name__)


@bp.get("/categorias/<categoria_id>/documentos")
@login_required
def listar(categoria_id):
    return jsonify(dependencies.get_documento_service().listar(categoria_id))


@bp.post("/categorias/<categoria_id>/documentos")
@login_required
def enviar(categoria_id):
    arquivo = request.files.get("arquivo")
    if arquivo is None:
        raise ValidacaoError("Envie o arquivo no campo 'arquivo'.")
    documento = dependencies.get_documento_service().enviar(categoria_id, arquivo.filename, arquivo.read())
    return jsonify(documento), 201


@bp.delete("/documentos/<documento_id>")
@login_required
def remover(documento_id):
    dependencies.get_documento_service().remover(documento_id)
    return "", 204
