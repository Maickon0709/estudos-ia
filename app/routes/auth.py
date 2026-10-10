"""Cadastro, login, renovação e saída via Supabase Auth.

O token NUNCA vai no corpo da resposta: ele é gravado em cookies HttpOnly
(veja app/core/auth.py), que o JavaScript da página não consegue ler.
"""
from flask import Blueprint, g, jsonify, request
from supabase_auth.errors import AuthApiError

from app.core.auth import (
    COOKIE_RENOVACAO,
    exigir_cabecalho_csrf,
    gravar_sessao,
    limpar_sessao,
    login_required,
)
from app.core.errors import NaoAutenticadoError, ValidacaoError
from app.core.supabase_client import anon_client

bp = Blueprint("auth", __name__, url_prefix="/auth")

# Mude esta data sempre que os Termos de Uso ou a Política de Privacidade mudarem.
TERMOS_VERSAO = "2026-10-10"

# O Supabase responde em inglês; o usuário do site lê em português.
_MENSAGENS_CADASTRO = {
    "user_already_exists": "Já existe uma conta com esse e-mail. Tente entrar.",
    "email_exists": "Já existe uma conta com esse e-mail. Tente entrar.",
    "weak_password": "Senha fraca. Use pelo menos 6 caracteres, misturando letras e números.",
    "email_address_invalid": "Esse e-mail não foi aceito. Confira se está correto.",
    "over_email_send_rate_limit": "Muitas tentativas de cadastro agora. Espere alguns minutos.",
    "over_request_rate_limit": "Muitas tentativas agora. Espere alguns minutos.",
    "signup_disabled": "Novos cadastros estão desativados no momento.",
}


def _credenciais():
    corpo = request.get_json(silent=True) or {}
    email = (corpo.get("email") or "").strip()
    senha = corpo.get("senha") or ""
    if not email or "@" not in email:
        raise ValidacaoError("Informe um e-mail válido.")
    if len(senha) < 6:
        raise ValidacaoError("A senha precisa ter pelo menos 6 caracteres.")
    return corpo, email, senha


def _resposta_logada(sessao, status=200):
    resposta = jsonify({"logado": True, "expira_em": sessao.expires_at})
    gravar_sessao(resposta, sessao)
    return resposta, status


@bp.post("/cadastro")
def cadastro():
    exigir_cabecalho_csrf()
    corpo, email, senha = _credenciais()
    if corpo.get("aceite_termos") is not True:
        raise ValidacaoError("Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.")
    nome = (corpo.get("nome") or "").strip()
    try:
        resposta = anon_client().auth.sign_up({
            "email": email,
            "password": senha,
            # O gatilho do banco grava a versão e a data do aceite no perfil.
            "options": {"data": {"nome": nome, "termos_versao": TERMOS_VERSAO}},
        })
    except AuthApiError as exc:
        raise ValidacaoError(
            _MENSAGENS_CADASTRO.get(exc.code, "Não foi possível criar a conta. Tente novamente.")
        ) from exc

    if resposta.session is None:
        # Projeto com confirmação de e-mail ligada: a sessão só vem após confirmar.
        return jsonify({"mensagem": "Cadastro criado. Confirme seu e-mail para entrar."}), 201
    return _resposta_logada(resposta.session, 201)


@bp.post("/login")
def login():
    exigir_cabecalho_csrf()
    _, email, senha = _credenciais()
    try:
        resposta = anon_client().auth.sign_in_with_password(
            {"email": email, "password": senha}
        )
    except AuthApiError as exc:
        raise NaoAutenticadoError("E-mail ou senha incorretos.") from exc
    return _resposta_logada(resposta.session)


@bp.post("/renovar")
def renovar():
    """Troca o token vencido por um novo usando o cookie de renovação (também HttpOnly)."""
    exigir_cabecalho_csrf()
    renovacao = request.cookies.get(COOKIE_RENOVACAO)
    if not renovacao:
        raise NaoAutenticadoError("Sessão encerrada. Entre de novo.")
    try:
        sessao = anon_client().auth.refresh_session(renovacao).session
    except AuthApiError:
        sessao = None
    if sessao is None:
        resposta = jsonify({"erro": "nao_autenticado", "mensagem": "Sessão expirada. Entre de novo."})
        limpar_sessao(resposta)
        return resposta, 401
    return _resposta_logada(sessao)


@bp.post("/sair")
def sair():
    exigir_cabecalho_csrf()
    resposta = jsonify({"logado": False})
    limpar_sessao(resposta)
    return resposta


@bp.get("/sessao")
@login_required
def sessao():
    return jsonify({"logado": True, "user_id": g.user_id})
