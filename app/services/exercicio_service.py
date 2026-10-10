"""Exercícios por nível, correção e efeitos da resposta (adaptação + revisão).

- Gerar: só no nível liberado pela trilha adaptativa; fontes = recursos e materiais da etapa.
  A IA recebe as perguntas que a etapa já tem e o código ainda descarta as repetidas.
- Completar simulado: gera as questões de múltipla escolha que faltam para o tamanho pedido.
- Listar: nunca devolve gabarito nem explicação.
- Responder: múltipla escolha é corrigida NO CÓDIGO (sem IA, sem custo, sem
  erro); discursiva é corrigida pela IA comparando com o gabarito. Depois, a
  função SQL grava tudo de forma atômica e as regras ajustam a etapa.
"""
from app.core.errors import EstadoInvalidoError, IAIndisponivelError, NaoEncontradoError, ValidacaoError
from app.core.validacao import hoje_brasil, validar_uuid
from app.repositories.exercicio_repository import COLUNAS_PUBLICAS
from app.services.exercicio_parser import (
    interpretar_correcao,
    letra,
    limpar_reexplicacao,
    montar_exercicios,
    remover_repetidos,
)
from app.services.materiais_trilha import fontes_de_material
from app.services.prompts import (
    mensagem_correcao,
    mensagem_exercicios,
    mensagem_reexplicar,
    prompt_correcao,
    prompt_exercicios,
    prompt_reexplicar,
)
from app.services.proposta_parser import extrair_json
from app.services.regras.adaptacao import (
    LIMIAR_LIBERAR,
    MIN_RESPOSTAS_LIBERAR,
    ORDEM_NIVEIS,
    avaliar,
    niveis_liberados,
    taxa,
)
from app.services.regras.revisao import proxima_revisao

QUANTIDADE_PADRAO = 10
QUANTIDADE_MAX = 10
RESPOSTA_MAX = 2000
MAX_GERACOES_SIMULADO = 2  # chamadas à IA para completar um simulado (cabe no tempo da função)
_PUBLICAS = {c.strip() for c in COLUNAS_PUBLICAS.split(",")}
_NOME_NIVEL = {"basico": "básico", "intermediario": "intermediário", "avancado": "avançado"}


def motivo_bloqueio(nivel: str, niveis: dict) -> str:
    """Por que o nível está bloqueado e quanto falta, com os números do aluno."""
    anterior = ORDEM_NIVEIS[ORDEM_NIVEIS.index(nivel) - 1]
    stats = niveis.get(anterior) or {}
    feitas = int(stats.get("total") or 0)
    pct = taxa(stats)
    situacao = f"Você respondeu {feitas} de {MIN_RESPOSTAS_LIBERAR} questões do {_NOME_NIVEL[anterior]}"
    situacao += f", com {round(pct)}% de acerto." if pct is not None else "."
    extra = ' Ou marque "já sei" na etapa.' if nivel == "intermediario" else ""
    return (
        f"Nível {_NOME_NIVEL[nivel]} ainda bloqueado. Responda pelo menos {MIN_RESPOSTAS_LIBERAR} questões "
        f"diferentes do {_NOME_NIVEL[anterior]} com {round(LIMIAR_LIBERAR)}% de acerto. {situacao}{extra}"
    )


def publico(exercicio: dict) -> dict:
    """Remove gabarito, explicação e fontes antes de sair para o cliente."""
    return {k: v for k, v in exercicio.items() if k in _PUBLICAS}


class ExercicioService:
    def __init__(self, etapa_repo, trilha_repo, exercicio_repo, resposta_repo,
                 revisao_repo, llm, hoje=hoje_brasil, uso=None):
        self._etapas = etapa_repo
        self._trilhas = trilha_repo
        self._exercicios = exercicio_repo
        self._respostas = resposta_repo
        self._revisoes = revisao_repo
        self._llm = llm
        self._hoje = hoje
        self._uso = uso  # limite diário: entre as respostas, só a aberta gasta IA

    # ---------- gerar ----------
    def gerar(self, etapa_id: str, nivel, quantidade=None) -> list[dict]:
        nivel = _validar_nivel(nivel)
        quantidade = _validar_quantidade(quantidade)
        etapa = self._obter_etapa(etapa_id)

        niveis = self._etapas.niveis(etapa["id"])
        if nivel not in niveis_liberados(niveis, etapa["ja_sabia"]):
            raise EstadoInvalidoError(motivo_bloqueio(nivel, niveis))
        return [publico(e) for e in self._gerar_na_etapa(etapa, nivel, quantidade)]

    def _gerar_na_etapa(self, etapa: dict, nivel: str, quantidade: int, somente_multipla: bool = False) -> list[dict]:
        trilha = self._trilhas.obter(etapa["trilha_id"]) or {}
        fontes = [
            {"titulo": r["titulo"], "url": r["url"], "trecho": r.get("trecho")}
            for r in self._etapas.recursos(etapa["id"])
        ] + fontes_de_material(self._etapas, etapa["id"])
        # Todas as perguntas da etapa (de qualquer nível): a IA não deve repetir nenhuma.
        anteriores = [e["enunciado"] for e in self._exercicios.listar(etapa["id"]) if e.get("enunciado")]
        resposta = self._llm.responder([
            {"role": "system", "content": prompt_exercicios()},
            {"role": "user", "content": mensagem_exercicios(
                trilha.get("titulo", ""), etapa, nivel, quantidade, fontes, anteriores, somente_multipla)},
        ])
        # Cada exercício guarda de onde veio, mas não o texto inteiro do arquivo do aluno.
        guardadas = [{k: v for k, v in f.items() if k != "conteudo"} for f in fontes]
        itens = montar_exercicios(extrair_json(resposta), nivel, quantidade, guardadas)
        if somente_multipla:
            itens = [i for i in itens if i["tipo"] == "multipla_escolha"]
        itens = remover_repetidos(itens, anteriores)
        if not itens:
            raise IAIndisponivelError("A IA só trouxe perguntas que você já tem. Tente gerar de novo.")
        return self._exercicios.criar_varios(etapa["id"], itens)

    def completar_para_simulado(self, categoria_id: str, faltam: int) -> int:
        """Gera as questões de múltipla escolha que faltam para o simulado. Devolve quantas criou.

        Usa a trilha mais recente da categoria, espalhando pelas etapas, no nível mais alto já
        liberado em cada uma. Gasta 1 do limite "ia". Falha da IA numa etapa não derruba as outras.
        """
        trilhas = self._trilhas.listar(categoria_id)
        etapas = sorted(self._trilhas.etapas(trilhas[0]["id"]), key=lambda e: e["ordem"]) if trilhas else []
        if faltam <= 0 or not etapas:
            return 0
        if self._uso is not None:
            self._uso.consumir("ia")

        criadas = 0
        for i in range(min(MAX_GERACOES_SIMULADO, len(etapas), -(-faltam // QUANTIDADE_MAX))):
            if criadas >= faltam:
                break
            # Espalha: com 2 gerações numa trilha de 6 etapas, usa a 1ª e a 4ª.
            etapa = etapas[i * len(etapas) // min(MAX_GERACOES_SIMULADO, len(etapas))]
            nivel = niveis_liberados(self._etapas.niveis(etapa["id"]), etapa["ja_sabia"])[-1]
            try:
                criadas += len(self._gerar_na_etapa(
                    etapa, nivel, min(QUANTIDADE_MAX, faltam - criadas), somente_multipla=True))
            except IAIndisponivelError:
                continue
        return criadas

    def listar(self, etapa_id: str, nivel=None) -> list[dict]:
        if nivel is not None:
            nivel = _validar_nivel(nivel)
        etapa = self._obter_etapa(etapa_id)
        return [publico(e) for e in self._exercicios.listar(etapa["id"], nivel)]

    # ---------- "não entendi" ----------
    def explicar(self, exercicio_id: str) -> dict:
        """Outra explicação, mais simples, de um exercício JÁ respondido.

        Só depois da resposta: a explicação usa o gabarito, e ele nunca sai antes.
        """
        exercicio_id = validar_uuid(exercicio_id, "exercício")
        exercicio = self._exercicios.obter_completo(exercicio_id)
        if exercicio is None:
            raise NaoEncontradoError("Exercício não encontrado.")
        ultima = self._respostas.ultima(exercicio_id)
        if ultima is None:
            raise EstadoInvalidoError("Responda o exercício antes de pedir outra explicação.")
        texto = self._llm.responder([
            {"role": "system", "content": prompt_reexplicar()},
            {"role": "user", "content": mensagem_reexplicar(exercicio, ultima)},
        ])
        return {"explicacao": limpar_reexplicacao(texto)}

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
            if self._uso is not None:
                self._uso.consumir("ia")
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
