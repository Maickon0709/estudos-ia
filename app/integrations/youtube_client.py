"""Cliente da YouTube Data API v3 (chave OPCIONAL).

Para que serve aqui: confirmar que vídeos e playlists encontrados pela busca
EXISTEM e são públicos, e trazer título oficial, canal, duração e tamanho da
playlist. Só usa `videos.list` e `playlists.list` (1 unidade de cota cada,
até 50 ids por chamada). Nunca usa `search.list`, que tem limite diário baixo.

Pontos tratados de forma defensiva (comportamento não confirmado ao vivo):
- id removido/privado pode vir como item ausente (200) ou como 404.
  Se um lote inteiro der 404, repetimos id a id e tratamos 404 como "não existe".
- Cota estourada (403/429) ou chave inválida (400) levantam
  YouTubeIndisponivelError, e o service degrada para "nao_verificado".
"""
import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit

import httpx

from app.core.errors import YouTubeIndisponivelError

BASE_URL = "https://www.googleapis.com/youtube/v3"
LOTE_MAX = 50

_ID_VIDEO = re.compile(r"^[A-Za-z0-9_-]{11}$")
_ID_PLAYLIST = re.compile(r"^[A-Za-z0-9_-]{10,64}$")
_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"}
_PREFIXOS_VIDEO = ("/shorts/", "/embed/", "/live/")
_DURACAO = re.compile(r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")


@dataclass(frozen=True)
class InfoVideo:
    id: str
    titulo: str
    canal: str
    duracao_segundos: int | None
    categoria_id: str | None = None  # snippet.categoryId ("10" = Música, "27" = Educação...)


@dataclass(frozen=True)
class InfoPlaylist:
    id: str
    titulo: str
    canal: str
    total_videos: int


def extrair_alvo(url: str) -> tuple[str, str] | None:
    """('video'|'playlist', id) se a URL for de um vídeo/playlist do YouTube."""
    try:
        partes = urlsplit(url.strip())
    except (ValueError, AttributeError):
        return None
    if partes.scheme not in ("http", "https"):
        return None
    host = (partes.hostname or "").lower()
    params = parse_qs(partes.query)

    if host == "youtu.be":
        candidato = partes.path.strip("/").split("/")[0]
        return ("video", candidato) if _ID_VIDEO.match(candidato) else None

    if host not in _HOSTS:
        return None
    if partes.path == "/watch":
        candidato = params.get("v", [""])[0]
        return ("video", candidato) if _ID_VIDEO.match(candidato) else None
    if partes.path == "/playlist":
        candidato = params.get("list", [""])[0]
        return ("playlist", candidato) if _ID_PLAYLIST.match(candidato) else None
    for prefixo in _PREFIXOS_VIDEO:
        if partes.path.startswith(prefixo):
            candidato = partes.path[len(prefixo):].split("/")[0]
            return ("video", candidato) if _ID_VIDEO.match(candidato) else None
    return None


def url_video(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def url_playlist(playlist_id: str) -> str:
    return f"https://www.youtube.com/playlist?list={playlist_id}"


def duracao_em_segundos(iso: str | None) -> int | None:
    """'PT1H2M3S' -> 3723. Transmissão ao vivo ('P0D') vira 0."""
    if not isinstance(iso, str):
        return None
    achou = _DURACAO.match(iso)
    if not achou:
        return None
    dias, horas, minutos, segundos = (int(x or 0) for x in achou.groups())
    return dias * 86400 + horas * 3600 + minutos * 60 + segundos


class YouTubeClient:
    def __init__(
        self,
        api_key: str | None,
        timeout: float = 15.0,
        http_client: httpx.Client | None = None,
    ):
        self._api_key = api_key
        self._timeout = timeout
        self._http = http_client  # injetável nos testes

    @property
    def disponivel(self) -> bool:
        return bool(self._api_key)

    def videos(self, ids: list[str]) -> dict[str, InfoVideo]:
        encontrados = {}
        for item in self._listar("videos", "snippet,contentDetails,status", ids):
            if _privacidade(item) != "public" or not isinstance(item.get("id"), str):
                continue
            snippet = item.get("snippet") or {}
            encontrados[item["id"]] = InfoVideo(
                id=item["id"],
                titulo=snippet.get("title") or "",
                canal=snippet.get("channelTitle") or "",
                duracao_segundos=duracao_em_segundos(
                    (item.get("contentDetails") or {}).get("duration")
                ),
                categoria_id=snippet.get("categoryId") if isinstance(snippet.get("categoryId"), str) else None,
            )
        return encontrados

    def playlists(self, ids: list[str]) -> dict[str, InfoPlaylist]:
        encontradas = {}
        for item in self._listar("playlists", "snippet,contentDetails,status", ids):
            if _privacidade(item) != "public" or not isinstance(item.get("id"), str):
                continue
            total = (item.get("contentDetails") or {}).get("itemCount")
            if not isinstance(total, int) or total < 1:
                continue
            snippet = item.get("snippet") or {}
            encontradas[item["id"]] = InfoPlaylist(
                id=item["id"],
                titulo=snippet.get("title") or "",
                canal=snippet.get("channelTitle") or "",
                total_videos=total,
            )
        return encontradas

    # ---------- internos ----------
    def _listar(self, recurso: str, part: str, ids: list[str]) -> list[dict]:
        if not self.disponivel:
            raise YouTubeIndisponivelError("A chave do YouTube não está configurada.")
        itens: list[dict] = []
        unicos = list(dict.fromkeys(ids))
        for inicio in range(0, len(unicos), LOTE_MAX):
            lote = unicos[inicio:inicio + LOTE_MAX]
            dados = self._chamar(recurso, part, lote)
            if dados is None and len(lote) > 1:
                # 404 num lote: repete id a id para não perder os que existem.
                for um in lote:
                    dados_um = self._chamar(recurso, part, [um])
                    itens += (dados_um or {}).get("items", [])
            else:
                itens += (dados or {}).get("items", [])
        return [i for i in itens if isinstance(i, dict)]

    def _chamar(self, recurso: str, part: str, ids: list[str]) -> dict | None:
        """Devolve o JSON, ou None se a API respondeu 404 (não encontrado)."""
        params = {"part": part, "id": ",".join(ids), "key": self._api_key}
        url = f"{BASE_URL}/{recurso}"
        try:
            if self._http is not None:
                resposta = self._http.get(url, params=params)
            else:
                with httpx.Client(timeout=self._timeout) as cliente:
                    resposta = cliente.get(url, params=params)
        except httpx.HTTPError as exc:
            raise YouTubeIndisponivelError("Não foi possível falar com o YouTube agora.") from exc

        if resposta.status_code == 404:
            return None
        if resposta.status_code in (400, 401, 403, 429):
            raise YouTubeIndisponivelError("Chave ou cota do YouTube indisponível.")
        if resposta.status_code >= 400:
            raise YouTubeIndisponivelError("O YouTube retornou um erro.")
        try:
            dados = resposta.json()
        except ValueError as exc:
            raise YouTubeIndisponivelError("Resposta inesperada do YouTube.") from exc
        return dados if isinstance(dados, dict) else {}


def _privacidade(item: dict) -> str | None:
    status = item.get("status")
    return status.get("privacyStatus") if isinstance(status, dict) else None
