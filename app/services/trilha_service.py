"""Trilha confirmada e checklist manual das etapas."""
from datetime import datetime, timezone

from app.core.errors import NaoEncontradoError, ValidacaoError
from app.core.validacao import validar_uuid
from app.services.regras.adaptacao import niveis_liberados

STATUS_ETAPA = ("nao_iniciado", "em_andamento", "concluido")


class TrilhaService:
    def __init__(self, categoria_service, trilha_repo, etapa_repo):
        self._categorias = categoria_service
        self._trilhas = trilha_repo
        self._etapas = etapa_repo

    def listar(self, categoria_id: str) -> list[dict]:
        categoria = self._categorias.obter(categoria_id)
        return self._trilhas.listar(categoria["id"])

    def obter(self, trilha_id: str) -> dict:
        trilha = self._trilhas.obter(validar_uuid(trilha_id, "trilha"))
        if trilha is None:
            raise NaoEncontradoError("Trilha não encontrada.")

        etapas = sorted(self._trilhas.etapas(trilha["id"]), key=lambda e: e["ordem"])
        ids = [e["id"] for e in etapas]
        por_etapa: dict[str, list] = {}
        for r in self._trilhas.recursos_das_etapas(ids):
            por_etapa.setdefault(r["etapa_id"], []).append(r)
        # Partes dos arquivos do aluno (trilha montada com os materiais, migração 009).
        materiais: dict[str, list] = {}
        for m in self._trilhas.materiais_das_etapas(ids):
            materiais.setdefault(m["etapa_id"], []).append(m)

        concluidas = sum(1 for e in etapas if e["status"] == "concluido")
        return {
            **trilha,
            "progresso": {
                "concluidas": concluidas,
                "total": len(etapas),
                "pct": round(100 * concluidas / len(etapas), 1) if etapas else 0.0,
            },
            "etapas": [
                {**e, "recursos": por_etapa.get(e["id"], []),
                 "materiais": sorted(materiais.get(e["id"], []), key=lambda m: (m["nome"] or "", m["ordem_inicio"]))}
                for e in etapas
            ],
        }

    def atualizar_etapa(self, etapa_id: str, corpo) -> dict:
        etapa_id = validar_uuid(etapa_id, "etapa")
        if not isinstance(corpo, dict):
            corpo = {}
        desconhecidos = set(corpo) - {"status", "ja_sabia"}
        if desconhecidos:
            raise ValidacaoError(f"Campos não permitidos: {', '.join(sorted(desconhecidos))}.")

        campos = {}
        if "status" in corpo:
            if corpo["status"] not in STATUS_ETAPA:
                raise ValidacaoError(f"Status inválido. Use: {', '.join(STATUS_ETAPA)}.")
            campos["status"] = corpo["status"]
            campos["concluida_em"] = (
                datetime.now(timezone.utc).isoformat() if corpo["status"] == "concluido" else None
            )
        if "ja_sabia" in corpo:
            if not isinstance(corpo["ja_sabia"], bool):
                raise ValidacaoError("ja_sabia deve ser true ou false.")
            campos["ja_sabia"] = corpo["ja_sabia"]
        if not campos:
            raise ValidacaoError("Informe status e/ou ja_sabia.")

        etapa = self._etapas.atualizar(etapa_id, campos)
        if etapa is None:
            raise NaoEncontradoError("Etapa não encontrada.")
        etapa["niveis_liberados"] = niveis_liberados(self._etapas.niveis(etapa_id), etapa["ja_sabia"])
        return etapa
