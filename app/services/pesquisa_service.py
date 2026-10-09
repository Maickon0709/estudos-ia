"""Pesquisa de conteúdo real: busca -> classifica -> valida -> devolve.

Regra de ouro do projeto: a IA NUNCA recebe nem mostra um link que o back-end
não tenha verificado. Aqui é onde isso acontece.

Custo por pesquisa: 2 buscas no Tavily (2 créditos) + 1 a 2 chamadas ao
YouTube (1 unidade cada) quando há chave.
"""
from datetime import datetime, timezone

from app.core.errors import ValidacaoError, YouTubeIndisponivelError
from app.integrations.youtube_client import (
    extrair_alvo,
    url_playlist,
    url_video,
)

CONSULTA_MIN = 3
CONSULTA_MAX = 200
MAX_LINKS = 5
MAX_YOUTUBE = 8  # candidatos pedidos; sobram menos após a verificação
DOMINIOS_YOUTUBE = ["youtube.com", "youtu.be"]


class PesquisaService:
    def __init__(self, categoria_service, busca, youtube, validador):
        self._categorias = categoria_service
        self._busca = busca
        self._youtube = youtube
        self._validador = validador

    def pesquisar(self, categoria_id: str, consulta) -> dict:
        # Valida o id e garante que a categoria existe e é do usuário (RLS).
        self._categorias.obter(categoria_id)
        return self.buscar_recursos(consulta)

    def buscar_recursos(self, consulta) -> dict:
        consulta = self._validar_consulta(consulta)

        web = self._busca.buscar(consulta, excluir=DOMINIOS_YOUTUBE, max_resultados=MAX_LINKS)
        yt = self._busca.buscar(
            f"{consulta} aula", dominios=DOMINIOS_YOUTUBE, max_resultados=MAX_YOUTUBE
        )

        links, descartados = self._links_validados(web)
        midia, descartados_yt, youtube_verificado = self._midia_youtube(yt)

        return {
            "consulta": consulta,
            "recursos": links + midia,
            "descartados": descartados + descartados_yt,
            "youtube_verificado": youtube_verificado,
        }

    # ---------- links da web ----------
    def _links_validados(self, resultados) -> tuple[list[dict], int]:
        unicos = {}
        for r in resultados:
            unicos.setdefault(r.url, r)
        veredito = self._validador.validar_varios(list(unicos))

        agora = _agora()
        aprovados = [
            _recurso("link", r.titulo, r.url, trecho=r.trecho, verificacao="verificado", validado_em=agora)
            for url, r in unicos.items()
            if veredito.get(url)
        ]
        return aprovados, len(unicos) - len(aprovados)

    # ---------- vídeos e playlists ----------
    def _midia_youtube(self, resultados) -> tuple[list[dict], int, bool]:
        videos, playlists = {}, {}
        for r in resultados:
            alvo = extrair_alvo(r.url)
            if alvo is None:
                continue  # canal, busca, página institucional...
            tipo, ident = alvo
            (videos if tipo == "video" else playlists).setdefault(ident, r)

        if not videos and not playlists:
            return [], 0, self._youtube.disponivel

        if self._youtube.disponivel:
            try:
                return self._verificar_no_youtube(videos, playlists)
            except YouTubeIndisponivelError:
                pass  # cota/chave/queda: degrada para "nao_verificado"

        recursos = [
            _recurso("video", r.titulo, url_video(i), trecho=r.trecho, verificacao="nao_verificado")
            for i, r in videos.items()
        ] + [
            _recurso("playlist", r.titulo, url_playlist(i), trecho=r.trecho, verificacao="nao_verificado")
            for i, r in playlists.items()
        ]
        return recursos, 0, False

    def _verificar_no_youtube(self, videos: dict, playlists: dict):
        infos_v = self._youtube.videos(list(videos)) if videos else {}
        infos_p = self._youtube.playlists(list(playlists)) if playlists else {}

        agora = _agora()
        recursos = []
        for ident, r in videos.items():
            info = infos_v.get(ident)
            if info:
                recursos.append(_recurso(
                    "video", info.titulo or r.titulo, url_video(ident), trecho=r.trecho,
                    canal=info.canal, duracao_segundos=info.duracao_segundos,
                    verificacao="verificado", validado_em=agora,
                ))
        for ident, r in playlists.items():
            info = infos_p.get(ident)
            if info:
                recursos.append(_recurso(
                    "playlist", info.titulo or r.titulo, url_playlist(ident), trecho=r.trecho,
                    canal=info.canal, total_videos=info.total_videos,
                    verificacao="verificado", validado_em=agora,
                ))
        descartados = len(videos) + len(playlists) - len(recursos)
        return recursos, descartados, True

    @staticmethod
    def _validar_consulta(consulta) -> str:
        if not isinstance(consulta, str) or len(consulta.strip()) < CONSULTA_MIN:
            raise ValidacaoError(f"Informe o que estudar (mínimo {CONSULTA_MIN} caracteres).")
        consulta = " ".join(consulta.split())
        if len(consulta) > CONSULTA_MAX:
            raise ValidacaoError(f"A consulta pode ter no máximo {CONSULTA_MAX} caracteres.")
        return consulta


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _recurso(tipo, titulo, url, *, trecho="", canal=None, duracao_segundos=None,
             total_videos=None, verificacao, validado_em=None) -> dict:
    return {
        "tipo": tipo,
        "titulo": titulo,
        "url": url,
        "trecho": trecho,
        "canal": canal,
        "duracao_segundos": duracao_segundos,
        "total_videos": total_videos,
        "verificacao": verificacao,
        "validado_em": validado_em,
    }
