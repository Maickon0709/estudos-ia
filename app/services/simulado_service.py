"""Simulado: prova cronometrada com exercícios de múltipla escolha já gerados.

- Não gasta IA: sorteia exercícios existentes da categoria (função SQL atômica).
- Gabarito e explicação só aparecem DEPOIS de finalizar (mesma regra dos exercícios).
- Correção no código, sem IA. O banco trava a linha para não finalizar duas vezes
  e marca se a entrega foi dentro do prazo.
"""
from datetime import datetime, timedelta

from app.core.errors import EstadoInvalidoError, NaoEncontradoError, ValidacaoError
from app.core.validacao import validar_uuid
from app.services.exercicio_parser import letra
from app.services.exercicio_service import publico

QUANTIDADE_MIN, QUANTIDADE_MAX, QUANTIDADE_PADRAO = 3, 20, 10
MINUTOS_MIN, MINUTOS_MAX, MINUTOS_PADRAO = 1, 120, 15
RESPOSTA_MAX = 10
CAMPOS_CORRIGIDOS = ("gabarito", "explicacao")


class SimuladoService:
    def __init__(self, categoria_service, simulado_repo):
        self._categorias = categoria_service
        self._simulados = simulado_repo

    def criar(self, categoria_id: str, quantidade=None, minutos=None) -> dict:
        quantidade = _inteiro(quantidade, QUANTIDADE_PADRAO, QUANTIDADE_MIN, QUANTIDADE_MAX, "Quantidade")
        minutos = _inteiro(minutos, MINUTOS_PADRAO, MINUTOS_MIN, MINUTOS_MAX, "Tempo (minutos)")
        categoria = self._categorias.obter(categoria_id)
        simulado_id = self._simulados.criar(categoria["id"], quantidade, minutos * 60)
        return self.obter(simulado_id)

    def listar(self, categoria_id: str) -> list[dict]:
        categoria = self._categorias.obter(categoria_id)
        return [_com_prazo(s) for s in self._simulados.listar(categoria["id"])]

    def obter(self, simulado_id: str) -> dict:
        simulado = self._obter(simulado_id)
        questoes = self._simulados.questoes(simulado["id"])
        ids = [q["exercicio_id"] for q in questoes]
        finalizado = simulado.get("finalizado_em") is not None
        # Antes de finalizar, o banco nem seleciona gabarito/explicação.
        exercicios = (self._simulados.exercicios_completos(ids) if finalizado
                      else self._simulados.exercicios_publicos(ids))
        por_id = {str(e["id"]): e for e in exercicios}

        itens = []
        for q in questoes:
            exercicio = por_id.get(str(q["exercicio_id"]))
            if exercicio is None:
                continue  # exercício apagado depois (cascata)
            item = {"ordem": q["ordem"], "exercicio": publico(exercicio)}
            if finalizado:
                item["exercicio"].update({c: exercicio.get(c) for c in CAMPOS_CORRIGIDOS})
                item.update(resposta=q.get("resposta"), correta=q.get("correta"))
            itens.append(item)
        return {**_com_prazo(simulado), "questoes": itens}

    def finalizar(self, simulado_id: str, respostas) -> dict:
        respostas = _validar_respostas(respostas)
        simulado = self._obter(simulado_id)
        if simulado.get("finalizado_em") is not None:
            raise EstadoInvalidoError("Este simulado já foi finalizado.")

        questoes = self._simulados.questoes(simulado["id"])
        completos = {str(e["id"]): e for e in self._simulados.exercicios_completos(
            [q["exercicio_id"] for q in questoes])}

        itens = []
        for q in questoes:
            exercicio = completos.get(str(q["exercicio_id"]))
            bruta = respostas.get(q["ordem"])
            if exercicio is None or bruta is None:
                continue  # sem resposta: o banco conta como errada
            escolhida = letra(bruta, len(exercicio.get("opcoes") or []))
            itens.append({
                "ordem": q["ordem"],
                "resposta": escolhida,
                "correta": escolhida is not None and escolhida == exercicio["gabarito"],
            })
        self._simulados.finalizar(simulado["id"], itens)
        return self.obter(simulado["id"])

    def _obter(self, simulado_id: str) -> dict:
        simulado = self._simulados.obter(validar_uuid(simulado_id, "simulado"))
        if simulado is None:
            raise NaoEncontradoError("Simulado não encontrado.")
        return simulado


def _com_prazo(simulado: dict) -> dict:
    """Acrescenta `prazo_em` (início + limite), usado pela contagem regressiva do site."""
    inicio = datetime.fromisoformat(str(simulado["iniciado_em"]).replace("Z", "+00:00"))
    prazo = inicio + timedelta(seconds=int(simulado["limite_segundos"]))
    return {**simulado, "prazo_em": prazo.isoformat()}


def _inteiro(valor, padrao: int, minimo: int, maximo: int, nome: str) -> int:
    if valor is None:
        return padrao
    if isinstance(valor, bool) or not isinstance(valor, int) or not minimo <= valor <= maximo:
        raise ValidacaoError(f"{nome} deve ser um número de {minimo} a {maximo}.")
    return valor


def _validar_respostas(respostas) -> dict[int, str]:
    """{"1": "B", "2": "A"} -> {1: "B", 2: "A"}. Respostas em branco ficam de fora."""
    if not isinstance(respostas, dict):
        raise ValidacaoError("Envie as respostas no formato {número da questão: letra}.")
    limpas = {}
    for chave, valor in respostas.items():
        if not str(chave).isdigit():
            raise ValidacaoError("Número de questão inválido.")
        if valor is None or valor == "":
            continue
        if not isinstance(valor, str) or len(valor) > RESPOSTA_MAX:
            raise ValidacaoError("Responda cada questão com a letra de uma alternativa.")
        limpas[int(chave)] = valor
    return limpas
