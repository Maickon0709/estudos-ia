"""Dublês das propostas e da pesquisa (sem rede e sem banco)."""
import copy
import uuid

from app.core.errors import EstadoInvalidoError, NaoEncontradoError


def rec(n, tipo="link", verificacao="verificado", **extra):
    base = {
        "tipo": tipo,
        "titulo": f"Material {n}",
        "url": f"https://site{n}.com/aula",
        "trecho": f"trecho {n}",
        "canal": None,
        "duracao_segundos": None,
        "total_videos": None,
        "verificacao": verificacao,
        "validado_em": "2026-10-09T12:00:00+00:00" if verificacao == "verificado" else None,
    }
    base.update(extra)
    return base


class PesquisaFalsa:
    def __init__(self, recursos=None, youtube_verificado=True):
        self.recursos = recursos if recursos is not None else [rec(1), rec(2), rec(3, "video", duracao_segundos=600)]
        self.youtube_verificado = youtube_verificado
        self.chamadas = []

    def buscar_recursos(self, consulta):
        self.chamadas.append(consulta)
        return {
            "consulta": consulta,
            "recursos": copy.deepcopy(self.recursos),
            "descartados": 0,
            "youtube_verificado": self.youtube_verificado,
        }


class PropostaRepoFalso:
    def __init__(self):
        self.itens: dict[str, dict] = {}

    def criar(self, categoria_id, payload):
        item = {
            "id": str(uuid.uuid4()),
            "categoria_id": categoria_id,
            "payload": copy.deepcopy(payload),
            "status": "pendente",
        }
        self.itens[item["id"]] = item
        return copy.deepcopy(item)

    def obter(self, proposta_id):
        item = self.itens.get(proposta_id)
        return copy.deepcopy(item) if item else None

    def listar(self, categoria_id, status=None):
        return [
            copy.deepcopy(p) for p in self.itens.values()
            if p["categoria_id"] == categoria_id and (status is None or p["status"] == status)
        ]

    def rejeitar(self, proposta_id):
        item = self.itens.get(proposta_id)
        if not item or item["status"] != "pendente":
            return None
        item["status"] = "rejeitada"
        return copy.deepcopy(item)

    def rejeitar_outras_pendentes(self, categoria_id, exceto_id):
        for p in self.itens.values():
            if p["categoria_id"] == categoria_id and p["status"] == "pendente" and p["id"] != exceto_id:
                p["status"] = "rejeitada"

    def confirmar(self, proposta_id):
        item = self.itens.get(proposta_id)
        if item is None:
            raise NaoEncontradoError("Proposta não encontrada.")
        if item["status"] != "pendente":
            raise EstadoInvalidoError("Esta proposta já foi confirmada ou rejeitada.")
        item["status"] = "confirmada"
        return f"trilha-de-{proposta_id[:8]}"
