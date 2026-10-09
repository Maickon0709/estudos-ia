"""Painel de progresso por categoria e lista de revisões do dia."""
from datetime import date

from app.core.validacao import hoje_brasil
from app.services.regras.adaptacao import ORDEM_NIVEIS
from app.services.regras.sequencia import sequencia_de_dias


class PainelService:
    def __init__(self, categoria_service, painel_repo, revisao_repo, hoje=hoje_brasil):
        self._categorias = categoria_service
        self._painel = painel_repo
        self._revisoes = revisao_repo
        self._hoje = hoje

    def painel(self, categoria_id: str) -> dict:
        categoria = self._categorias.obter(categoria_id)
        hoje = self._hoje()

        progresso = self._painel.progresso(categoria["id"]) or {}
        por_nivel = {l["nivel"]: l for l in self._painel.acerto_por_nivel(categoria["id"])}
        dias = {date.fromisoformat(str(d)[:10]) for d in self._painel.dias_estudo()}

        return {
            "categoria": {"id": categoria["id"], "nome": categoria["nome"]},
            "progresso": {
                "total_etapas": int(progresso.get("total_etapas") or 0),
                "etapas_concluidas": int(progresso.get("etapas_concluidas") or 0),
                "pct_concluido": float(progresso.get("pct_concluido") or 0),
            },
            "acerto_por_nivel": [
                {
                    "nivel": nivel,
                    "total_respostas": int(por_nivel.get(nivel, {}).get("total_respostas") or 0),
                    "taxa_acerto": float(por_nivel.get(nivel, {}).get("taxa_acerto") or 0),
                }
                for nivel in ORDEM_NIVEIS
            ],
            "pontos_fracos": [
                {"etapa_id": p["etapa_id"], "etapa": p["etapa"],
                 "tentativas": p["tentativas"], "taxa_acerto": float(p["taxa_acerto"])}
                for p in self._painel.pontos_fracos(categoria["id"])
            ],
            "revisoes_pendentes": len(self._revisoes.pendentes(hoje.isoformat(), categoria["id"])),
            "sequencia_dias": sequencia_de_dias(dias, hoje),
            "estudou_hoje": hoje in dias,
        }

    def revisoes_de_hoje(self, categoria_id: str | None = None) -> list[dict]:
        if categoria_id is not None:
            categoria_id = self._categorias.obter(categoria_id)["id"]
        return self._revisoes.pendentes(self._hoje().isoformat(), categoria_id)
