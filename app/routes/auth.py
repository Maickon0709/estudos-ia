"""Cadastro e login via Supabase Auth."""
from flask import Blueprint, jsonify, request
from supabase_auth.errors import AuthApiError

from app.core.errors import NaoAutenticadoError, ValidacaoError
from app.core.supabase_client import anon_client

bp = Blueprint("auth", __name__, url_prefix="/auth")


def _credenciais():
    corpo = request.get_json(silent=True) or {}
    email = (corpo.get("email") or "").strip()
    senha = corpo.get("senha") or ""
    if not email or "@" not in email:
        raise ValidacaoError("Informe um e-mail válido.")
    if len(senha) < 6:
        raise ValidacaoError("A senha precisa ter pelo menos 6 caracteres.")
    return corpo, email, senha


def _sessao_json(sessao):
    return {
        "access_token": sessao.access_token,
        "refresh_token": sessao.refresh_token,
        "expires_at": sessao.expires_at,
    }


@bp.post("/cadastro")
def cadastro():
    corpo, email, senha = _credenciais()
    nome = (corpo.get("nome") or "").strip()
    try:
        resposta = anon_client().auth.sign_up(
            {"email": email, "password": senha, "options": {"data": {"nome": nome}}}
        )
    except AuthApiError as exc:
        raise ValidacaoError(str(exc.message)) from exc

    if resposta.session is None:
        # Projeto com confirmação de e-mail ligada: a sessão só vem após confirmar.
        return jsonify({"mensagem": "Cadastro criado. Confirme seu e-mail para entrar."}), 201
    return jsonify(_sessao_json(resposta.session)), 201


@bp.post("/login")
def login():
    _, email, senha = _credenciais()
    try:
        resposta = anon_client().auth.sign_in_with_password(
            {"email": email, "password": senha}
        )
    except AuthApiError as exc:
        raise NaoAutenticadoError("E-mail ou senha incorretos.") from exc
    return jsonify(_sessao_json(resposta.session))
