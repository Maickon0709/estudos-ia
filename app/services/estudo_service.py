"""Cronômetro de estudo, metas semanais e a tela "Hoje".

"Hoje" junta numa resposta só o que a pessoa precisa ao abrir o site:
o que revisar, como estão as categorias, o calendário de atividade
(estilo GitHub), a sequência de dias e o andamento da meta da semana.
"""
from datetime import date, datetime, timedelta, timezone

from app.core.errors import ValidacaoError
from app.core.validacao import hoje_brasil
from app.services.regras.sequencia import sequencia_de_dias

TIPOS_SESSAO = ("foco", "livre")
DURACAO_MIN, DURACAO_MAX = 60, 4 * 3600
SEMANAS_CALENDARIO = 26
SESSAO_ANTIGA_MAX = timedelta(days=2)
FUTURO_TOLERANCIA = timedelta(minutes=5)


class EstudoService:
    def __init__(self, categoria_service, estudo_repo, revisao_repo, flashcard_repo, hoje=hoje_brasil,
                 agora=lambda: datetime.now(timezone.utc)):
        self._categorias = categoria_service
        self._estudo = estudo_repo
        self._revisoes = revisao_repo
        self._flashcards = flashcard_repo
        self._hoje = hoje
        self._agora = agora

    # ---------- cronômetro ----------
    def registrar_sessao(self, corpo) -> dict:
        if not isinstance(corpo, dict):
            raise ValidacaoError("Envie os dados da sessão de estudo.")
        tipo = corpo.get("tipo", "foco")
        if tipo not in TIPOS_SESSAO:
            raise ValidacaoError(f"Tipo inválido. Use: {', '.join(TIPOS_SESSAO)}.")
        duracao = corpo.get("duracao_segundos")
        if isinstance(duracao, bool) or not isinstance(duracao, int) or not DURACAO_MIN <= duracao <= DURACAO_MAX:
            raise ValidacaoError("A sessão precisa durar de 1 minuto a 4 horas.")
        iniciada_em = _data_hora(corpo.get("iniciada_em"))
        agora = self._agora()
        if iniciada_em > agora + FUTURO_TOLERANCIA or iniciada_em < agora - SESSAO_ANTIGA_MAX:
            raise ValidacaoError("O início da sessão precisa ser dos últimos dois dias.")

        categoria_id = corpo.get("categoria_id")
        if categoria_id is not None:
            categoria_id = self._categorias.obter(categoria_id)["id"]  # 404 se não for sua

        return self._estudo.registrar_sessao({
            "categoria_id": categoria_id,
            "tipo": tipo,
            "duracao_segundos": duracao,
            "iniciada_em": iniciada_em.isoformat(),
        })

    # ---------- metas ----------
    def meta(self) -> dict:
        return self._estudo.obter_meta() or {"dias_por_semana": None, "minutos_por_semana": None}

    def salvar_meta(self, user_id: str, corpo) -> dict:
        if not isinstance(corpo, dict):
            raise ValidacaoError("Envie a meta da semana.")
        dias = corpo.get("dias_por_semana")
        if isinstance(dias, bool) or not isinstance(dias, int) or not 1 <= dias <= 7:
            raise ValidacaoError("Dias por semana deve ser de 1 a 7.")
        minutos = corpo.get("minutos_por_semana")
        if minutos is not None and (isinstance(minutos, bool) or not isinstance(minutos, int)
                                    or not 0 <= minutos <= 10080):
            raise ValidacaoError("Minutos por semana deve ser de 0 a 10080.")
        return self._estudo.salvar_meta(user_id, dias, minutos)

    # ---------- tela "Hoje" ----------
    def hoje(self) -> dict:
        hoje = self._hoje()
        inicio_calendario = hoje - timedelta(weeks=SEMANAS_CALENDARIO) + timedelta(days=1)
        segunda = hoje - timedelta(days=hoje.weekday())

        atividade = [_dia(l) for l in self._estudo.atividade(inicio_calendario.isoformat())]
        dias_com_estudo = {date.fromisoformat(a["dia"]) for a in atividade if a["total"] > 0}
        semana = [a for a in atividade if date.fromisoformat(a["dia"]) >= segunda]

        return {
            "hoje": hoje.isoformat(),
            "revisoes_pendentes": len(self._revisoes.pendentes(hoje.isoformat())),
            "flashcards_pendentes": len(self._flashcards.pendentes(hoje.isoformat())),
            "categorias": [
                {
                    "id": c["categoria_id"],
                    "nome": c["categoria"],
                    "total_etapas": int(c.get("total_etapas") or 0),
                    "etapas_concluidas": int(c.get("etapas_concluidas") or 0),
                    "pct_concluido": float(c.get("pct_concluido") or 0),
                }
                for c in self._estudo.progresso_categorias()
            ],
            "atividade": atividade,
            "sequencia_dias": sequencia_de_dias(dias_com_estudo, hoje),
            "estudou_hoje": hoje in dias_com_estudo,
            "semana": {
                "inicio": segunda.isoformat(),
                "dias_estudados": sum(1 for a in semana if a["total"] > 0),
                "minutos": sum(a["minutos"] for a in semana),
            },
            "meta": self._estudo.obter_meta(),
        }


def _dia(linha: dict) -> dict:
    respostas = int(linha.get("respostas") or 0)
    flashcards = int(linha.get("flashcards") or 0)
    minutos = int(linha.get("minutos") or 0)
    simulados = int(linha.get("simulados") or 0)
    return {
        "dia": str(linha["dia"])[:10],
        "respostas": respostas,
        "flashcards": flashcards,
        "minutos": minutos,
        "simulados": simulados,
        # "Pontos" do calendário: cada atividade vale 1; cada 10 min de foco vale 1.
        "total": respostas + flashcards + simulados + minutos // 10,
    }


def _data_hora(valor) -> datetime:
    if not isinstance(valor, str):
        raise ValidacaoError("Informe quando a sessão começou (data e hora ISO 8601).")
    try:
        momento = datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidacaoError("Data e hora de início inválidas.") from exc
    if momento.tzinfo is None:
        raise ValidacaoError("Informe o fuso horário no início da sessão.")
    return momento
