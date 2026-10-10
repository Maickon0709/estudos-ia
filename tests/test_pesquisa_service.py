import uuid

import pytest

from app.core.errors import (
    BuscaIndisponivelError,
    NaoEncontradoError,
    ValidacaoError,
    YouTubeIndisponivelError,
)
from app.services.categoria_service import CategoriaService
from app.services.pesquisa_service import CONSULTA_MAX, PesquisaService
from tests.fakes_busca import (
    BuscaFalsa,
    InfoPlaylist,
    InfoVideo,
    ValidadorFalso,
    YouTubeFalso,
    res,
)
from tests.test_categoria_service import RepoFalso

V1, V2, V3 = "aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"
PL = "PLabcdefghij1234"
URL_V1 = f"https://www.youtube.com/watch?v={V1}"
URL_PL = f"https://www.youtube.com/playlist?list={PL}"


def montar(busca, youtube, validador):
    categorias = RepoFalso()
    categoria = categorias.criar("u1", "Português")
    return PesquisaService(CategoriaService(categorias), busca, youtube, validador), categoria


def por_tipo(resultado, tipo):
    return [r for r in resultado["recursos"] if r["tipo"] == tipo]


def test_fluxo_completo_descarta_o_que_nao_e_verificado():
    busca = BuscaFalsa(
        web=[res("https://bom1.com"), res("https://morto.com"), res("https://bom2.com")],
        yt=[
            res(URL_V1, "título da busca"),
            res(f"https://youtu.be/{V1}"),                       # mesmo vídeo, outra URL
            res(f"https://www.youtube.com/watch?v={V2}"),        # não existe mais
            res(URL_PL),
            res("https://www.youtube.com/@canal"),               # não é vídeo nem playlist
        ],
    )
    youtube = YouTubeFalso(
        videos={V1: InfoVideo(V1, "Crase em 10 minutos", "Prof. Ana", 600)},
        playlists={PL: InfoPlaylist(PL, "Curso de gramática", "Prof. Ana", 24)},
    )
    validador = ValidadorFalso(validos={"https://bom1.com", "https://bom2.com"})
    servico, _ = montar(busca, youtube, validador)

    resultado = servico.buscar_recursos("crase")

    assert [r["url"] for r in por_tipo(resultado, "link")] == ["https://bom1.com", "https://bom2.com"]
    (video,) = por_tipo(resultado, "video")
    assert video["url"] == URL_V1
    assert video["titulo"] == "Crase em 10 minutos"  # título oficial, não o da busca
    assert (video["canal"], video["duracao_segundos"]) == ("Prof. Ana", 600)
    (playlist,) = por_tipo(resultado, "playlist")
    assert (playlist["url"], playlist["total_videos"]) == (URL_PL, 24)
    assert all(r["verificacao"] == "verificado" and r["validado_em"] for r in resultado["recursos"])
    assert resultado["descartados"] == 2  # 1 link morto + 1 vídeo inexistente
    assert resultado["youtube_verificado"] is True
    assert resultado["consulta"] == "crase"


def test_chamadas_a_busca_sao_duas_e_com_os_filtros_certos():
    busca = BuscaFalsa()
    servico, _ = montar(busca, YouTubeFalso(), ValidadorFalso())
    servico.buscar_recursos("  crase   no  português ")

    web, yt = busca.chamadas
    assert web["consulta"] == "crase no português"  # espaços normalizados
    assert "youtube.com" in web["excluir"] and web["dominios"] is None
    assert "youtube.com" in yt["dominios"] and yt["consulta"].endswith("aula")
    assert len(busca.chamadas) == 2  # 2 créditos, nem mais


def test_busca_web_ja_pede_para_excluir_redes_sociais():
    busca = BuscaFalsa()
    servico, _ = montar(busca, YouTubeFalso(), ValidadorFalso())
    servico.buscar_recursos("crase")

    web, _ = busca.chamadas
    assert {"instagram.com", "tiktok.com", "facebook.com"} <= set(web["excluir"])


def test_rede_social_que_escapa_da_busca_e_descartada_sem_ser_acessada():
    # Achado no teste ao vivo: um reel do Instagram chegou como material de estudo.
    social = [
        "https://www.instagram.com/reel/DXKqlyoiZKn",
        "https://m.facebook.com/post/1",
        "https://vm.tiktok.com/abc",
        "https://x.com/perfil/status/1",
    ]
    busca = BuscaFalsa(web=[res(u) for u in social] + [res("https://todamateria.com.br/crase")])
    validador = ValidadorFalso(validos=set(social) | {"https://todamateria.com.br/crase"})
    servico, _ = montar(busca, YouTubeFalso(), validador)

    resultado = servico.buscar_recursos("crase")

    assert [r["url"] for r in resultado["recursos"]] == ["https://todamateria.com.br/crase"]
    assert validador.recebidos == [["https://todamateria.com.br/crase"]]  # nem chega a validar
    assert resultado["descartados"] == 4


def test_dominio_que_so_parece_rede_social_passa():
    urls = ["https://box.com/aula", "https://instagram.com.br.exemplo.org/crase"]
    busca = BuscaFalsa(web=[res(u) for u in urls])
    servico, _ = montar(busca, YouTubeFalso(), ValidadorFalso(validos=set(urls)))

    resultado = servico.buscar_recursos("crase")
    assert [r["url"] for r in resultado["recursos"]] == urls


def test_links_repetidos_sao_validados_uma_vez():
    busca = BuscaFalsa(web=[res("https://a.com"), res("https://a.com"), res("https://b.com")])
    validador = ValidadorFalso(validos={"https://a.com", "https://b.com"})
    servico, _ = montar(busca, YouTubeFalso(), validador)

    resultado = servico.buscar_recursos("sql")
    assert validador.recebidos == [["https://a.com", "https://b.com"]]
    assert len(resultado["recursos"]) == 2


def test_sem_chave_do_youtube_marca_nao_verificado_e_normaliza_urls():
    busca = BuscaFalsa(yt=[res(f"https://youtu.be/{V1}?si=x", "Aula"), res(URL_PL)])
    youtube = YouTubeFalso(disponivel=False)
    servico, _ = montar(busca, youtube, ValidadorFalso())

    resultado = servico.buscar_recursos("crase")

    assert youtube.chamadas == []
    assert {r["url"] for r in resultado["recursos"]} == {URL_V1, URL_PL}
    assert all(r["verificacao"] == "nao_verificado" and r["validado_em"] is None for r in resultado["recursos"])
    assert resultado["youtube_verificado"] is False
    assert resultado["descartados"] == 0


@pytest.mark.parametrize("erro", [YouTubeIndisponivelError("cota"), ])
def test_cota_do_youtube_estourada_degrada_sem_perder_os_videos(erro):
    busca = BuscaFalsa(yt=[res(URL_V1, "Aula")])
    youtube = YouTubeFalso(videos={V1: InfoVideo(V1, "x", "y", 1)})
    youtube.erro = erro
    servico, _ = montar(busca, youtube, ValidadorFalso())

    resultado = servico.buscar_recursos("crase")
    (video,) = resultado["recursos"]
    assert video["verificacao"] == "nao_verificado"
    assert video["titulo"] == "Aula"
    assert resultado["youtube_verificado"] is False


def test_video_de_musica_e_descartado_mesmo_existindo():
    # Achado ao vivo: "crase na língua portuguesa" trouxe um clipe da banda Lingua Ignota.
    busca = BuscaFalsa(yt=[
        res(URL_V1),
        res(f"https://www.youtube.com/watch?v={V2}"),
        res(f"https://www.youtube.com/watch?v={V3}"),
    ])
    youtube = YouTubeFalso(videos={
        V1: InfoVideo(V1, "Crase em 10 minutos", "Prof. Ana", 600, categoria_id="27"),
        V2: InfoVideo(V2, "PENNSYLVANIA FURNACE (Official Video)", "Sargent House", 300, categoria_id="10"),
        V3: InfoVideo(V3, "Aula sem categoria", "Canal", 60),
    })
    servico, _ = montar(busca, youtube, ValidadorFalso())

    resultado = servico.buscar_recursos("crase")

    assert [r["titulo"] for r in resultado["recursos"]] == ["Crase em 10 minutos", "Aula sem categoria"]
    assert resultado["descartados"] == 1


def test_sem_candidatos_do_youtube_nao_chama_a_api():
    youtube = YouTubeFalso()
    busca = BuscaFalsa(yt=[res("https://www.youtube.com/@canal")])
    servico, _ = montar(busca, youtube, ValidadorFalso())

    resultado = servico.buscar_recursos("crase")
    assert youtube.chamadas == []
    assert resultado["recursos"] == []


def test_so_pede_a_api_o_que_existe_de_cada_tipo():
    youtube = YouTubeFalso()
    busca = BuscaFalsa(yt=[res(URL_V1)])
    servico, _ = montar(busca, youtube, ValidadorFalso())
    servico.buscar_recursos("crase")
    assert youtube.chamadas == [("videos", [V1])]  # sem chamada de playlists


def test_falha_da_busca_propaga_como_erro_de_dominio():
    busca = BuscaFalsa()
    busca.erro = BuscaIndisponivelError("fora do ar")
    servico, _ = montar(busca, YouTubeFalso(), ValidadorFalso())
    with pytest.raises(BuscaIndisponivelError):
        servico.buscar_recursos("crase")


@pytest.mark.parametrize("consulta", [None, "", "   ", "ab", 42, ["x"], "a" * (CONSULTA_MAX + 1)])
def test_consulta_invalida_nao_gasta_credito(consulta):
    busca = BuscaFalsa()
    servico, _ = montar(busca, YouTubeFalso(), ValidadorFalso())
    with pytest.raises(ValidacaoError):
        servico.buscar_recursos(consulta)
    assert busca.chamadas == []


def test_pesquisar_exige_categoria_existente_e_nao_gasta_credito_sem_ela():
    busca = BuscaFalsa()
    servico, _ = montar(busca, YouTubeFalso(), ValidadorFalso())
    with pytest.raises(NaoEncontradoError):
        servico.pesquisar(str(uuid.uuid4()), "crase")
    with pytest.raises(ValidacaoError):
        servico.pesquisar("abc", "crase")
    assert busca.chamadas == []


def test_pesquisar_com_categoria_valida_devolve_recursos():
    busca = BuscaFalsa(web=[res("https://bom.com")])
    servico, categoria = montar(busca, YouTubeFalso(), ValidadorFalso(validos={"https://bom.com"}))
    resultado = servico.pesquisar(categoria["id"], "crase")
    assert [r["url"] for r in resultado["recursos"]] == ["https://bom.com"]
