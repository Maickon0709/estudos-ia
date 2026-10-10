"""Rotas da conta: resumo, nome, foto de perfil, exportação dos dados e exclusão."""
import json

from flask import Blueprint, Response, g, jsonify, request

from app.core import dependencies
from app.core.auth import login_required
from app.core.errors import NaoEncontradoError, ValidacaoError

bp = Blueprint("conta", __name__, url_prefix="/conta")


@bp.get("")
@login_required
def resumo():
    return jsonify(dependencies.get_conta_service().resumo())


@bp.get("/uso")
@login_required
def uso():
    return jsonify(dependencies.get_uso_service().resumo())


@bp.patch("")
@login_required
def renomear():
    return jsonify(dependencies.get_conta_service().renomear(g.user_id, request.get_json(silent=True)))


@bp.put("/avatar")
@login_required
def enviar_avatar():
    arquivo = request.files.get("foto")
    if arquivo is None:
        raise ValidacaoError("Envie a imagem no campo 'foto'.")
    return jsonify(dependencies.get_conta_service().enviar_avatar(g.user_id, arquivo.read()))


@bp.get("/avatar")
@login_required
def avatar():
    conteudo = dependencies.get_conta_service().avatar(g.user_id)
    if conteudo is None:
        raise NaoEncontradoError("Você ainda não tem foto de perfil.")
    return Response(conteudo, mimetype="image/webp", headers={
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
    })


@bp.delete("/avatar")
@login_required
def remover_avatar():
    dependencies.get_conta_service().remover_avatar(g.user_id)
    return "", 204


@bp.get("/dados")
@login_required
def exportar():
    conteudo = json.dumps(dependencies.get_conta_service().exportar(), ensure_ascii=False, indent=2, default=str)
    return Response(
        conteudo,
        mimetype="application/json",
        headers={"Content-Disposition": 'attachment; filename="meus-dados-estudos-ia.json"'},
    )


@bp.delete("")
@login_required
def excluir():
    dependencies.get_conta_service().excluir(g.user_id, request.get_json(silent=True))
    return "", 204
