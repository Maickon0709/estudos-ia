import httpx
import pytest

from app.core.errors import YouTubeIndisponivelError
from app.integrations.youtube_client import (
    LOTE_MAX,
    InfoPlaylist,
    InfoVideo,
    YouTubeClient,
    duracao_em_segundos,
    extrair_alvo,
    url_playlist,
    url_video,
)

CHAVE = "AIza-chave-secreta-123"
V1, V2, V3 = "aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"
PL = "PLabcdefghij1234"


def cliente(handler, api_key=CHAVE):
    http = httpx.Client(transport=httpx.MockTransport(handler))
    return YouTubeClient(api_key, http_client=http)


def item_video(vid, titulo="T", canal="C", duracao="PT10M", privacidade="public"):
    return {
        "id": vid,
        "snippet": {"title": titulo, "channelTitle": canal},
        "contentDetails": {"duration": duracao},
        "status": {"privacyStatus": privacidade},
    }


# ---------- extrair_alvo ----------
@pytest.mark.parametrize(
    "url,esperado",
    [
        (f"https://www.youtube.com/watch?v={V1}", ("video", V1)),
        (f"https://youtube.com/watch?v={V1}&t=30s", ("video", V1)),
        (f"https://m.youtube.com/watch?v={V1}", ("video", V1)),
        (f"https://www.youtube.com/watch?v={V1}&list={PL}", ("video", V1)),
        (f"https://youtu.be/{V1}", ("video", V1)),
        (f"https://youtu.be/{V1}?si=abc", ("video", V1)),
        (f"https://www.youtube.com/shorts/{V1}", ("video", V1)),
        (f"https://www.youtube.com/embed/{V1}", ("video", V1)),
        (f"https://www.youtube.com/playlist?list={PL}", ("playlist", PL)),
        ("https://www.youtube.com/@canal", None),
        ("https://www.youtube.com/results?search_query=x", None),
        ("https://www.youtube.com/watch?v=curto", None),
        ("https://www.youtube.com/watch", None),
        ("https://evil.com/watch?v=" + V1, None),
        ("https://youtube.com.evil.com/watch?v=" + V1, None),
        (f"ftp://www.youtube.com/watch?v={V1}", None),
        ("nao e url", None),
        ("", None),
    ],
)
def test_extrair_alvo(url, esperado):
    assert extrair_alvo(url) == esperado


def test_extrair_alvo_aceita_entrada_nao_string_sem_quebrar():
    assert extrair_alvo(None) is None


def test_urls_canonicas():
    assert url_video(V1) == f"https://www.youtube.com/watch?v={V1}"
    assert url_playlist(PL) == f"https://www.youtube.com/playlist?list={PL}"


@pytest.mark.parametrize(
    "iso,segundos",
    [("PT1H2M3S", 3723), ("PT45S", 45), ("PT10M", 600), ("P0D", 0), ("P1DT1H", 90000), ("lixo", None), (None, None)],
)
def test_duracao_em_segundos(iso, segundos):
    assert duracao_em_segundos(iso) == segundos


# ---------- videos() ----------
def test_videos_devolve_info_e_envia_chave_ids_e_parts():
    visto = {}

    def handler(request):
        visto["path"] = request.url.path
        visto["params"] = dict(request.url.params)
        return httpx.Response(200, json={"items": [item_video(V1, "Aula 1", "Canal X", "PT1H2M3S")]})

    resultado = cliente(handler).videos([V1, V2])
    assert resultado == {V1: InfoVideo(V1, "Aula 1", "Canal X", 3723)}  # V2 ausente = não existe
    assert visto["path"].endswith("/videos")
    assert visto["params"]["key"] == CHAVE
    assert visto["params"]["id"] == f"{V1},{V2}"
    assert "contentDetails" in visto["params"]["part"]
    assert "status" in visto["params"]["part"]


def test_videos_trazem_a_categoria_do_youtube():
    com_categoria = item_video(V1)
    com_categoria["snippet"]["categoryId"] = "27"
    sem_categoria = item_video(V2)

    def handler(request):
        return httpx.Response(200, json={"items": [com_categoria, sem_categoria]})

    resultado = cliente(handler).videos([V1, V2])
    assert resultado[V1].categoria_id == "27"
    assert resultado[V2].categoria_id is None


def test_videos_privados_ou_nao_listados_sao_descartados():
    def handler(request):
        return httpx.Response(
            200,
            json={"items": [item_video(V1), item_video(V2, privacidade="private"), item_video(V3, privacidade="unlisted")]},
        )

    assert set(cliente(handler).videos([V1, V2, V3])) == {V1}


def test_videos_em_lotes_de_50_e_sem_ids_repetidos():
    chamadas = []

    def handler(request):
        ids = request.url.params["id"].split(",")
        chamadas.append(ids)
        return httpx.Response(200, json={"items": []})

    ids = [f"{i:011d}" for i in range(120)]
    cliente(handler).videos(ids + ids[:10])  # com repetidos
    assert [len(c) for c in chamadas] == [LOTE_MAX, LOTE_MAX, 20]


def test_lote_com_404_repete_id_a_id():
    chamadas = []

    def handler(request):
        ids = request.url.params["id"].split(",")
        chamadas.append(ids)
        if len(ids) > 1:
            return httpx.Response(404, json={"error": {"errors": [{"reason": "videoNotFound"}]}})
        if ids == [V1]:
            return httpx.Response(200, json={"items": [item_video(V1)]})
        return httpx.Response(404, json={})

    assert set(cliente(handler).videos([V1, V2])) == {V1}
    assert chamadas == [[V1, V2], [V1], [V2]]


@pytest.mark.parametrize("status", [400, 401, 403, 429, 500])
def test_status_de_erro_vira_youtube_indisponivel(status):
    with pytest.raises(YouTubeIndisponivelError):
        cliente(lambda r: httpx.Response(status, json={})).videos([V1])


def test_timeout_e_json_invalido_viram_youtube_indisponivel():
    def lento(request):
        raise httpx.ConnectTimeout("lento", request=request)

    with pytest.raises(YouTubeIndisponivelError):
        cliente(lento).videos([V1])
    with pytest.raises(YouTubeIndisponivelError):
        cliente(lambda r: httpx.Response(200, text="<html>")).videos([V1])


def test_sem_chave_nao_chama_e_informa_indisponivel():
    chamou = []

    def handler(request):
        chamou.append(1)
        return httpx.Response(200, json={"items": []})

    youtube = cliente(handler, api_key=None)
    assert youtube.disponivel is False
    with pytest.raises(YouTubeIndisponivelError):
        youtube.videos([V1])
    assert chamou == []


def test_erros_nunca_vazam_a_chave():
    with pytest.raises(YouTubeIndisponivelError) as info:
        cliente(lambda r: httpx.Response(403, text=CHAVE)).videos([V1])
    assert CHAVE not in str(info.value)


def test_itens_malformados_nao_quebram():
    def handler(request):
        return httpx.Response(200, json={"items": ["lixo", {"id": V1}, {"sem": "id", "status": {"privacyStatus": "public"}}]})

    assert cliente(handler).videos([V1]) == {}


# ---------- playlists() ----------
def test_playlists_mantem_publicas_com_videos():
    def handler(request):
        assert request.url.path.endswith("/playlists")
        return httpx.Response(
            200,
            json={
                "items": [
                    {"id": PL, "snippet": {"title": "Curso", "channelTitle": "Canal"},
                     "contentDetails": {"itemCount": 12}, "status": {"privacyStatus": "public"}},
                    {"id": "PLvazia000000", "snippet": {}, "contentDetails": {"itemCount": 0},
                     "status": {"privacyStatus": "public"}},
                    {"id": "PLprivada00000", "snippet": {}, "contentDetails": {"itemCount": 5},
                     "status": {"privacyStatus": "private"}},
                ]
            },
        )

    assert cliente(handler).playlists([PL, "PLvazia000000", "PLprivada00000"]) == {
        PL: InfoPlaylist(PL, "Curso", "Canal", 12)
    }
