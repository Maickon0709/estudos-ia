"""Dublês dos repositórios da migração 004 (flashcards, simulados, estudo)."""
import copy
import uuid


def novo_id():
    return str(uuid.uuid4())


class FlashcardRepoFalso:
    def __init__(self):
        self.cartoes: dict[str, dict] = {}
        self.revisoes = []
        self.lista_pendentes: list[dict] = []

    def criar_varios(self, etapa_id, cartoes):
        criados = []
        for c in cartoes:
            linha = {"id": novo_id(), "etapa_id": etapa_id, "frente": c["frente"], "verso": c["verso"],
                     "proxima_revisao": "2026-10-09", "intervalo_dias": 0, "acertos_seguidos": 0, "dominado": False}
            self.cartoes[linha["id"]] = linha
            criados.append(copy.deepcopy(linha))
        return criados

    def listar(self, etapa_id):
        return [copy.deepcopy(c) for c in self.cartoes.values() if c["etapa_id"] == etapa_id]

    def obter(self, flashcard_id):
        c = self.cartoes.get(flashcard_id)
        return copy.deepcopy(c) if c else None

    def pendentes(self, hoje):
        self.pendentes_hoje = hoje
        return list(self.lista_pendentes)

    def revisar(self, flashcard_id, lembrou, revisao):
        self.revisoes.append((flashcard_id, lembrou, revisao))
        c = self.cartoes[flashcard_id]
        if revisao.get("remover"):
            c["dominado"] = True
        else:
            c.update(revisao)
        return copy.deepcopy(c)


class SimuladoRepoFalso:
    """Imita criar_simulado/finalizar_simulado com um 'banco' em memória."""

    def __init__(self, exercicios: dict[str, dict]):
        self.exercicios = exercicios  # id -> exercício completo (com gabarito)
        self.simulados: dict[str, dict] = {}
        self.questoes_por_sim: dict[str, list] = {}
        self.finalizacoes = []
        self.pediu_completos = []

    def criar(self, categoria_id, quantidade, limite_segundos):
        ids = [e for e in self.exercicios if self.exercicios[e]["tipo"] == "multipla_escolha"][:quantidade]
        sid = novo_id()
        self.simulados[sid] = {"id": sid, "categoria_id": categoria_id, "limite_segundos": limite_segundos,
                               "total": len(ids), "acertos": None, "dentro_do_prazo": None,
                               "iniciado_em": "2026-10-09T12:00:00+00:00", "finalizado_em": None}
        self.questoes_por_sim[sid] = [{"ordem": i + 1, "exercicio_id": e, "resposta": None, "correta": None}
                                      for i, e in enumerate(ids)]
        return sid

    def obter(self, simulado_id):
        s = self.simulados.get(simulado_id)
        return copy.deepcopy(s) if s else None

    def listar(self, categoria_id, limite=10):
        return [copy.deepcopy(s) for s in self.simulados.values() if s["categoria_id"] == categoria_id]

    def questoes(self, simulado_id):
        return copy.deepcopy(self.questoes_por_sim.get(simulado_id, []))

    def exercicios_publicos(self, ids):
        publicas = ("id", "etapa_id", "nivel", "tipo", "enunciado", "opcoes", "created_at")
        return [{k: self.exercicios[i][k] for k in publicas} for i in ids if i in self.exercicios]

    def exercicios_completos(self, ids):
        self.pediu_completos.append(list(ids))
        return [copy.deepcopy(self.exercicios[i]) for i in ids if i in self.exercicios]

    def finalizar(self, simulado_id, itens):
        self.finalizacoes.append((simulado_id, itens))
        por_ordem = {i["ordem"]: i for i in itens}
        for q in self.questoes_por_sim[simulado_id]:
            i = por_ordem.get(q["ordem"])
            q["resposta"] = i["resposta"] if i else None
            q["correta"] = bool(i and i["correta"])
        s = self.simulados[simulado_id]
        s["acertos"] = sum(q["correta"] for q in self.questoes_por_sim[simulado_id])
        s["finalizado_em"] = "2026-10-09T12:05:00+00:00"
        s["dentro_do_prazo"] = True
        return copy.deepcopy(s)


class EstudoRepoFalso:
    def __init__(self):
        self.sessoes = []
        self.meta = None
        self.linhas_atividade: list[dict] = []
        self.semanais: list[dict] = []
        self.progresso: list[dict] = []
        self.atividade_desde = None

    def registrar_sessao(self, sessao):
        linha = {"id": novo_id(), **sessao}
        self.sessoes.append(linha)
        return linha

    def obter_meta(self):
        return copy.deepcopy(self.meta)

    def salvar_meta(self, user_id, dias, minutos):
        self.meta = {"user_id": user_id, "dias_por_semana": dias, "minutos_por_semana": minutos}
        return copy.deepcopy(self.meta)

    def atividade(self, desde):
        self.atividade_desde = desde
        return [l for l in self.linhas_atividade if l["dia"] >= desde]

    def minutos_por_semana(self, categoria_id, desde):
        return [l for l in self.semanais if l["semana"] >= desde]

    def progresso_categorias(self):
        return list(self.progresso)
