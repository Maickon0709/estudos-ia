"""Exercícios por nível, correção e efeitos da resposta (adaptação + revisão).

- Gerar: só no nível liberado pela trilha adaptativa; fontes = recursos da etapa.
- Listar: nunca devolve gabarito nem explicação.
- Responder: múltipla escolha é corrigida NO CÓDIGO (sem IA, sem custo, sem
  erro); discursiva é corrigida pela IA comparando com o gabarito. Depois, a
  função SQL grava tudo de forma atômica e as regras ajustam a etapa.
"""
from app.core.errors import EstadoInvalidoError, NaoEncontradoError, ValidacaoError
from app.core.validacao import hoje_brasil, validar_uuid
from app.repositories.exercicio_repository import COLUNAS_PUBLICAS
from app.services.exercicio_parser import interpretar_correcao, letra, montar_exercicios
from app.services.prompts import (
    mensagem_correcao,
    mensagem_exercicios,
    prompt_correcao,
    prompt_exercicios,
)
from app.services.proposta_parser import extrair_json
from app.services.regras.adaptacao import ORDEM_NIVEIS, avaliar, niveis_liberados
from app.services.regras.revisao import proxima_revisao

QUANTIDADE_PADRAO = 3
QUANTIDADE_MAX = 5
RESPOSTA_MAX = 2000
_PUBLICAS = {c.strip() for c in COLUNAS_PUBLICAS.split(",")}
_MOTIVO_BLOQUEIO = {
    "intermediario": "Acerte pelo menos 80% de 3 ou mais exercícios do básico (ou marque \"já sei\" na etapa).",
    "avancado": "Acerte pelo menos 80% de 3 ou mais exercícios do intermediário.",
}


def publico(exercicio: dict) -> dict:
    """Remove gabarito, explicação e fontes antes de sair para o cliente."""
    return {k: v for k, v in exercicio.items() if k in _PUBLICAS}


class ExercicioService:
    def __init__(self, etapa_repo, trilha_repo, exercicio_repo, resposta_repo,
                 revisao_repo, llm, hoje=hoje_brasil):
        self._etapas = etapa_repo
        self._trilhas = trilha_repo
        self._exercicios = exercicio_repo
        self._respostas = resposta_repo
        self._revisoes = revisao_repo
        self._llm = llm
        self._hoje = hoje

    # ---------- gerar ----------
    def gerar(self, etapa_id: str, nivel, quantidade=None) -> list[dict]:
        nivel = _validar_nivel(nivel)
        quantidade = _validar_quantidade(quantidade)
        etapa = self._obter_etapa(etapa_id)

        liberados = niveis_liberados(self._etapas.niveis(etapa["id"]), etapa["ja_sabia"])
        if nivel not in liberados:
            raise EstadoInvalidoError(f"Nível {nivel} ainda bloqueado. {_MOTIVO_BLOQUEIO[nivel]}")

        trilha = self._trilhas.obter(etapa["trilha_id"]) or {}
        fontes = [
            {"titulo": r["titulo"], "url": r["url"], "trecho": r.get("trecho")}
            for r in self._etapas.recursos(etapa["id"])
        ]
        resposta = self._llm.responder([
            {"role": "system", "content": prompt_exercicios()},
            {"role": "user", "content": mensagem_exercicios(
                trilha.get("titulo", ""), etapa, nivel, quantidade, fontes)},
        ])
        itens = montar_exercicios(extrair_json(resposta), nivel, quantidade, fontes)
        return [publico(e) for e in self._exercicios.criar_varios(etapa["id"], itens)]

    def listar(self, etapa_id: str, nivel=None) -> list[dict]:
        if nivel is not None:
            nivel = _validar_nivel(nivel)
        etapa = self._obter_etapa(etapa_id)
        return [publico(e) for e in self._exercicios.listar(etapa["id"], nivel)]

    # ---------- responder ----------
    def responder(self, exercicio_id: str, resposta) -> dict:
        exercicio_id = validar_uuid(exercicio_id, "exercício")
        if not isinstance(resposta, str) or not resposta.strip():
            raise ValidacaoError("A resposta é obrigatória.")
        resposta = resposta.strip()
        if len(resposta) > RESPOSTA_MAX:
            raise ValidacaoError(f"A resposta pode ter no máximo {RESPOSTA_MAX} caracteres.")

        exercicio = self._exercicios.obter_completo(exercicio_id)
        if exercicio is None:
            raise NaoEncontradoError("Exercício não encontrado.")

        if exercicio["tipo"] == "multipla_escolha":
            escolhida = letra(resposta, len(exercicio.get("opcoes") or []))
            if escolhida is None:
                raise ValidacaoError("Responda com a letra de uma das alternativas.")
            resposta = escolhida
            correta = escolhida == exercicio["gabarito"]
            feedback = exercicio.get("explicacao") or (
                "Correto!" if correta else f"A resposta certa é a letra {exercicio['gabarito']}."
            )
        else:
            avaliacao = interpretar_correcao(self._llm.responder([
                {"role": "system", "content": prompt_correcao()},
                {"role": "user", "content": mensagem_correcao(exercicio, resposta)},
            ]))
            correta, feedback = avaliacao["correta"], avaliacao["feedback"]

        revisao = proxima_revisao(self._revisoes.obter(exercicio_id), correta, self._hoje())
        registro = self._respostas.registrar(exercicio_id, resposta, correta, feedback, revisao)

        etapa = self._etapas.obter(registro["etapa_id"]) or {}
        decisao = avaliar(etapa, registro["niveis"]) if etapa else None
        if decisao and decisao["mudou"]:
            campos = {"status": decisao["status"], "ja_sabia": decisao["ja_sabia"]}
            if etapa["status"] == "concluido" and decisao["status"] != "concluido":
                campos["concluida_em"] = None
            self._etapas.atualizar(etapa["id"], campos)

        return {
            "correta": correta,
            "feedback": feedback,
            "gabarito": exercicio["gabarito"],
            "explicacao": exercicio.get("explicacao"),
            "etapa": None if decisao is None else {
                "id": etapa["id"],
                "status": decisao["status"],
                "ja_sabia": decisao["ja_sabia"],
                "niveis_liberados": decisao["niveis_liberados"],
                "recomendacao": decisao["recomendacao"],
                "nivel_reforco": decisao["nivel_reforco"],
            },
            "revisao": revisao if revisao and not revisao.get("remover") else None,
            "dominado": bool(revisao and revisao.get("remover")),
        }

    def _obter_etapa(self, etapa_id: str) -> dict:
        etapa = self._etapas.obter(validar_uuid(etapa_id, "etapa"))
        if etapa is None:
            raise NaoEncontradoError("Etapa não encontrada.")
        return etapa


def _validar_nivel(nivel) -> str:
    if nivel not in ORDEM_NIVEIS:
        raise ValidacaoError(f"Nível inválido. Use: {', '.join(ORDEM_NIVEIS)}.")
    return nivel


def _validar_quantidade(quantidade) -> int:
    if quantidade is None:
        return QUANTIDADE_PADRAO
    if isinstance(quantidade, bool) or not isinstance(quantidade, int) or not 1 <= quantidade <= QUANTIDADE_MAX:
        raise ValidacaoError(f"Quantidade deve ser um número de 1 a {QUANTIDADE_MAX}.")
    return quantidade
