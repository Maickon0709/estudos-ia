"""Dados da conta: perfil, exportação (LGPD) e exclusão.

Usa dois clientes: o do usuário (JWT, RLS vale) para ler e excluir os próprios
dados, e o anônimo só para conferir a senha antes de uma ação irreversível.
"""
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError

from app.core.errors import NaoAutenticadoError

# Tudo que pertence ao usuário. O RLS garante que cada consulta só traz o que é dele.
TABELAS_EXPORTADAS = (
    "profiles", "metas", "categorias", "mensagens", "propostas", "trilhas", "etapas",
    "recursos", "exercicios", "respostas", "revisoes", "flashcards", "flashcard_revisoes",
    "simulados", "simulado_questoes", "sessoes_estudo", "uso_diario",
    "documentos", "documento_trechos", "etapa_materiais",
)


class ContaRepository:
    def __init__(self, client_usuario, client_anonimo, token: str):
        self._usuario = client_usuario
        self._anonimo = client_anonimo
        self._token = token

    def email(self) -> str | None:
        resposta = self._anonimo.auth.get_user(self._token)
        return getattr(getattr(resposta, "user", None), "email", None)

    def perfil(self) -> dict | None:
        dados = self._usuario.table("profiles").select("*").limit(1).execute().data
        return dados[0] if dados else None

    def atualizar_perfil(self, user_id: str, campos: dict) -> None:
        # O filtro por id é explícito; mesmo assim, o RLS de profiles só deixa o dono alterar a própria linha.
        self._usuario.table("profiles").update(campos).eq("id", user_id).execute()

    def senha_confere(self, email: str, senha: str) -> bool:
        try:
            self._anonimo.auth.sign_in_with_password({"email": email, "password": senha})
        except AuthApiError:
            return False
        return True

    def exportar(self) -> dict[str, list]:
        return {t: self._usuario.table(t).select("*").execute().data for t in TABELAS_EXPORTADAS}

    def excluir(self) -> None:
        try:
            self._usuario.rpc("excluir_minha_conta", {}).execute()
        except APIError as exc:
            if "nao_autenticado" in (getattr(exc, "message", "") or ""):
                raise NaoAutenticadoError("Sessão expirada. Entre de novo.") from exc
            raise
