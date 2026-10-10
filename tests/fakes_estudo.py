"""Dublês de trilha, etapas, exercícios, respostas, revisões e painel.

O RespostaRepoFalso imita a função SQL registrar_resposta: grava a resposta,
recalcula os níveis da etapa e aplica a revisão, para os testes de service
enxergarem os mesmos efeitos que o banco de verdade produz.
"""
import copy
import uuid

ETAPA = "e0000000-0000-4000-8000-000000000001"
TRILHA = "a0000000-0000-4000-8000-000000000001"
CATEGORIA_ID_FIXO = None  # definido pelo teste a partir do RepoFalso de categorias


def novo_id():
    return str(uuid.uuid4())


class EtapaRepoFalso:
    def __init__(self):
        self.etapas: dict[str, dict] = {}
        self.recursos_por_etapa: dict[str, list] = {}
        self.niveis_por_etapa: dict[str, dict] = {}
        self.atualizacoes: list[tuple[str, dict]] = []
        # partes dos arquivos do aluno (migração 009): etapa_id -> [material]; (doc, início, fim) -> [trecho]
        self.materiais_por_etapa: dict[str, list] = {}
        self.textos: dict[tuple, list] = {}

    def adicionar(self, etapa_id=ETAPA, trilha_id=TRILHA, ordem=1, status="nao_iniciado",
                  ja_sabia=False, titulo="Conceito", recursos=None):
        self.etapas[etapa_id] = {
            "id": etapa_id, "trilha_id": trilha_id, "ordem": ordem, "titulo": titulo,
            "descricao": f"Descrição de {titulo}", "status": status, "ja_sabia": ja_sabia,
            "tentativas": 0, "taxa_acerto": 0, "concluida_em": "2026-10-01T00:00:00+00:00" if status == "concluido" else None,
        }
        self.recursos_por_etapa[etapa_id] = recursos if recursos is not None else [
            {"id": novo_id(), "etapa_id": etapa_id, "tipo": "link", "titulo": "Guia de crase",
             "url": "https://site.com/crase", "trecho": "Crase é a fusão de a + a."},
        ]
        return self.etapas[etapa_id]

    def obter(self, etapa_id):
        e = self.etapas.get(etapa_id)
        return copy.deepcopy(e) if e else None

    def atualizar(self, etapa_id, campos):
        if etapa_id not in self.etapas:
            return None
        self.atualizacoes.append((etapa_id, dict(campos)))
        self.etapas[etapa_id].update(campos)
        return copy.deepcopy(self.etapas[etapa_id])

    def recursos(self, etapa_id):
        return copy.deepcopy(self.recursos_por_etapa.get(etapa_id, []))

    def materiais(self, etapa_id):
        return copy.deepcopy(self.materiais_por_etapa.get(etapa_id, []))

    def texto_material(self, documento_id, ordem_inicio, ordem_fim):
        return copy.deepcopy(self.textos.get((documento_id, ordem_inicio, ordem_fim), []))

    def niveis(self, etapa_id):
        return copy.deepcopy(self.niveis_por_etapa.get(etapa_id, {}))


class TrilhaRepoFalso:
    def __init__(self, etapas: EtapaRepoFalso):
        self._etapas = etapas
        self.trilhas: dict[str, dict] = {}

    def adicionar(self, trilha_id=TRILHA, categoria_id="cat", titulo="Crase do zero"):
        self.trilhas[trilha_id] = {"id": trilha_id, "categoria_id": categoria_id, "titulo": titulo}
        return self.trilhas[trilha_id]

    def listar(self, categoria_id):
        return [copy.deepcopy(t) for t in self.trilhas.values() if t["categoria_id"] == categoria_id]

    def obter(self, trilha_id):
        t = self.trilhas.get(trilha_id)
        return copy.deepcopy(t) if t else None

    def etapas(self, trilha_id):
        return [copy.deepcopy(e) for e in self._etapas.etapas.values() if e["trilha_id"] == trilha_id]

    def recursos_das_etapas(self, etapa_ids):
        return [r for i in etapa_ids for r in self._etapas.recursos(i)]

    def materiais_das_etapas(self, etapa_ids):
        return [{**m, "etapa_id": i} for i in etapa_ids for m in self._etapas.materiais(i)]


class ExercicioRepoFalso:
    """Devolve linhas COMPLETAS (com gabarito) de propósito: o service é que
    precisa filtrar. Defesa em profundidade."""

    def __init__(self):
        self.itens: dict[str, dict] = {}

    def criar_varios(self, etapa_id, itens):
        salvos = []
        for item in itens:
            linha = {"id": novo_id(), "etapa_id": etapa_id, "created_at": "2026-10-09T12:00:00+00:00", **copy.deepcopy(item)}
            self.itens[linha["id"]] = linha
            salvos.append(copy.deepcopy(linha))
        return salvos

    def adicionar(self, etapa_id=ETAPA, nivel="basico", tipo="multipla_escolha", gabarito="B",
                  explicacao="Crase = a + a.", opcoes=None):
        linha = {
            "id": novo_id(), "etapa_id": etapa_id, "nivel": nivel, "tipo": tipo,
            "enunciado": "Pergunta?", "gabarito": gabarito, "explicacao": explicacao,
            "opcoes": (opcoes or ["um", "dois", "três", "quatro"]) if tipo == "multipla_escolha" else None,
            "fontes": [], "created_at": "2026-10-09T12:00:00+00:00",
        }
        self.itens[linha["id"]] = linha
        return linha

    def listar(self, etapa_id, nivel=None):
        return [copy.deepcopy(e) for e in self.itens.values()
                if e["etapa_id"] == etapa_id and (nivel is None or e["nivel"] == nivel)]

    def obter_completo(self, exercicio_id):
        e = self.itens.get(exercicio_id)
        return copy.deepcopy(e) if e else None


class RevisaoRepoFalso:
    def __init__(self):
        self.revisoes: dict[str, dict] = {}
        self.pendentes_chamadas = []
        self.lista_pendentes: list[dict] = []

    def obter(self, exercicio_id):
        r = self.revisoes.get(exercicio_id)
        return copy.deepcopy(r) if r else None

    def pendentes(self, hoje, categoria_id=None):
        self.pendentes_chamadas.append((hoje, categoria_id))
        return [p for p in self.lista_pendentes if categoria_id is None or p["categoria_id"] == categoria_id]


class RespostaRepoFalso:
    def __init__(self, exercicios: ExercicioRepoFalso, etapas: EtapaRepoFalso, revisoes: RevisaoRepoFalso):
        self._exercicios = exercicios
        self._etapas = etapas
        self._revisoes = revisoes
        self.chamadas = []

    def registrar(self, exercicio_id, resposta, correta, feedback, revisao):
        self.chamadas.append({"exercicio_id": exercicio_id, "resposta": resposta,
                              "correta": correta, "feedback": feedback, "revisao": revisao})
        ex = self._exercicios.itens[exercicio_id]
        niveis = self._etapas.niveis_por_etapa.setdefault(ex["etapa_id"], {})
        stats = niveis.setdefault(ex["nivel"], {"total": 0, "acertos": 0})
        stats["total"] += 1
        stats["acertos"] += int(correta)
        if revisao is not None:
            if revisao.get("remover"):
                self._revisoes.revisoes.pop(exercicio_id, None)
            else:
                self._revisoes.revisoes[exercicio_id] = dict(revisao)
        return {"resposta_id": novo_id(), "etapa_id": ex["etapa_id"], "niveis": copy.deepcopy(niveis)}


class PainelRepoFalso:
    def __init__(self):
        self.progresso_por_categoria: dict[str, dict] = {}
        self.niveis_por_categoria: dict[str, list] = {}
        self.fracos_por_categoria: dict[str, list] = {}
        self.dias: list[str] = []

    def progresso(self, categoria_id):
        return self.progresso_por_categoria.get(categoria_id)

    def acerto_por_nivel(self, categoria_id):
        return self.niveis_por_categoria.get(categoria_id, [])

    def pontos_fracos(self, categoria_id):
        return self.fracos_por_categoria.get(categoria_id, [])

    def dias_estudo(self):
        return list(self.dias)
