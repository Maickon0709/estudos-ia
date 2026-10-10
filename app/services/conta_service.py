"""Conta do usuário: dados, nome, foto de perfil, exportação (LGPD) e exclusão.

Excluir é irreversível, então pede duas confirmações: a senha atual (prova que
é o dono, não alguém com o computador aberto) e a palavra EXCLUIR digitada.
"""
from datetime import datetime, timezone

from app.core.errors import ValidacaoError
from app.services.imagem import preparar_avatar

PALAVRA_CONFIRMACAO = "EXCLUIR"
NOME_MAX = 80


def caminho_avatar(user_id: str) -> str:
    """Sempre o mesmo arquivo por usuário, dentro da pasta dele (é o que as políticas exigem)."""
    return f"{user_id}/avatar.webp"


class ContaService:
    def __init__(self, conta_repo, storage=None, agora=lambda: datetime.now(timezone.utc)):
        self._conta = conta_repo
        self._storage = storage
        self._agora = agora

    def resumo(self) -> dict:
        perfil = self._conta.perfil() or {}
        return {
            "email": self._conta.email(),
            "nome": perfil.get("nome"),
            "criada_em": perfil.get("created_at"),
            "termos_versao": perfil.get("termos_versao"),
            "termos_aceitos_em": perfil.get("termos_aceitos_em"),
            "avatar_atualizado_em": perfil.get("avatar_atualizado_em"),
        }

    def renomear(self, user_id: str, corpo) -> dict:
        nome = corpo.get("nome") if isinstance(corpo, dict) else None
        if not isinstance(nome, str) or not nome.strip():
            raise ValidacaoError("Informe um nome.")
        nome = " ".join(nome.split())
        if len(nome) > NOME_MAX:
            raise ValidacaoError(f"O nome pode ter no máximo {NOME_MAX} caracteres.")
        self._conta.atualizar_perfil(user_id, {"nome": nome})
        return self.resumo()

    # ---------- foto de perfil ----------
    def enviar_avatar(self, user_id: str, conteudo: bytes) -> dict:
        webp = preparar_avatar(conteudo)  # valida e regrava ANTES de qualquer envio
        self._storage.enviar(caminho_avatar(user_id), webp, "image/webp")
        self._conta.atualizar_perfil(user_id, {"avatar_atualizado_em": self._agora().isoformat()})
        return self.resumo()

    def avatar(self, user_id: str) -> bytes | None:
        return self._storage.baixar(caminho_avatar(user_id))

    def remover_avatar(self, user_id: str) -> None:
        self._storage.apagar(caminho_avatar(user_id))
        self._conta.atualizar_perfil(user_id, {"avatar_atualizado_em": None})

    # ---------- LGPD ----------
    def exportar(self) -> dict:
        return {
            "exportado_em": self._agora().isoformat(),
            "formato": "Cada chave é uma tabela do banco; só aparecem os seus dados.",
            "dados": self._conta.exportar(),
        }

    def excluir(self, user_id: str, corpo) -> None:
        corpo = corpo if isinstance(corpo, dict) else {}
        if corpo.get("confirmacao") != PALAVRA_CONFIRMACAO:
            raise ValidacaoError(f"Digite {PALAVRA_CONFIRMACAO} para confirmar a exclusão.")
        senha = corpo.get("senha")
        if not isinstance(senha, str) or not senha:
            raise ValidacaoError("Informe sua senha para confirmar.")
        email = self._conta.email()
        if not email or not self._conta.senha_confere(email, senha):
            # 400, não 401: senha errada aqui não significa sessão expirada (o site deslogaria).
            raise ValidacaoError("Senha incorreta.")
        # A foto mora no Storage, fora da cascata do banco: apaga primeiro para não sobrar arquivo.
        if self._storage is not None:
            self._storage.apagar(caminho_avatar(user_id))
        self._conta.excluir()
