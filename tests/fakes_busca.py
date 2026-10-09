"""Dublês da busca, do YouTube e do validador (sem rede)."""
from app.core.errors import BuscaIndisponivelError, YouTubeIndisponivelError
from app.integrations.search_client import ResultadoBusca
from app.integrations.youtube_client import InfoPlaylist, InfoVideo


class BuscaFalsa:
    """Devolve `web` quando a busca exclui o YouTube e `yt` quando o filtra."""

    def __init__(self, web=None, yt=None):
        self.web = web or []
        self.yt = yt or []
        self.chamadas = []
        self.erro = None

    def buscar(self, consulta, dominios=None, excluir=None, max_resultados=5):
        self.chamadas.append(
            {"consulta": consulta, "dominios": dominios, "excluir": excluir, "max": max_resultados}
        )
        if self.erro is not None:
            raise self.erro
        return list(self.yt if dominios else self.web)


class YouTubeFalso:
    def __init__(self, disponivel=True, videos=None, playlists=None):
        self.disponivel = disponivel
        self._videos = videos or {}
        self._playlists = playlists or {}
        self.erro = None
        self.chamadas = []

    def videos(self, ids):
        self.chamadas.append(("videos", list(ids)))
        if self.erro is not None:
            raise self.erro
        return {i: self._videos[i] for i in ids if i in self._videos}

    def playlists(self, ids):
        self.chamadas.append(("playlists", list(ids)))
        if self.erro is not None:
            raise self.erro
        return {i: self._playlists[i] for i in ids if i in self._playlists}


class ValidadorFalso:
    def __init__(self, validos=()):
        self.validos = set(validos)
        self.recebidos = []

    def validar_varios(self, urls):
        self.recebidos.append(list(urls))
        return {u: u in self.validos for u in urls}


def res(url, titulo="Título", trecho="trecho"):
    return ResultadoBusca(titulo, url, trecho)


__all__ = [
    "BuscaFalsa", "YouTubeFalso", "ValidadorFalso", "res",
    "InfoVideo", "InfoPlaylist", "BuscaIndisponivelError", "YouTubeIndisponivelError",
]
