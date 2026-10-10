"""Foto de perfil: tratamento da imagem, cliente do Storage, service e rotas."""
import io

import httpx
import pytest
from PIL import Image

from app.core import auth, dependencies
from app.core.errors import ArmazenamentoIndisponivelError, NaoAutenticadoError, ValidacaoError
from app.integrations.storage_client import StorageClient
from app.services.conta_service import ContaService, caminho_avatar
from app.services.imagem import LADO, preparar_avatar
from tests.test_conta import ContaRepoFalso


def imagem(formato="JPEG", tamanho=(640, 480), cor=(200, 90, 50), exif=None):
    saida = io.BytesIO()
    modo = "RGBA" if formato == "PNG" else "RGB"
    figura = Image.new(modo, tamanho, cor)
    if exif is not None:
        figura.save(saida, format=formato, exif=exif)
    else:
        figura.save(saida, format=formato)
    return saida.getvalue()


# ---------- tratamento da imagem ----------
@pytest.mark.parametrize("formato", ["JPEG", "PNG", "WEBP"])
def test_regrava_em_webp_quadrado(formato):
    with Image.open(io.BytesIO(preparar_avatar(imagem(formato)))) as saida:
        assert saida.format == "WEBP" and saida.size == (LADO, LADO)


def test_remove_metadados_como_gps():
    exif = Image.Exif()
    exif[0x8825] = {2: (23.0, 33.0, 0.0)}  # GPSInfo: latitude
    exif[0x0110] = "Celular X"              # modelo da câmera
    original = imagem(exif=exif.tobytes())
    with Image.open(io.BytesIO(original)) as antes:
        assert antes.getexif()  # o arquivo de entrada TEM metadados
    with Image.open(io.BytesIO(preparar_avatar(original))) as depois:
        assert not depois.getexif() and "exif" not in depois.info


@pytest.mark.parametrize("conteudo,trecho", [
    (b"", "Envie"),
    (b"<?php system($_GET['x']); ?>", "não é uma imagem"),
    (b"GIF89a" + b"\x00" * 100, "não é uma imagem"),
    (b"x" * (5 * 1024 * 1024 + 1), "5 MB"),
], ids=["vazio", "php", "gif_falso", "grande_demais"])
def test_recusa_o_que_nao_e_imagem_aceita(conteudo, trecho):
    with pytest.raises(ValidacaoError, match=trecho):
        preparar_avatar(conteudo)


def test_recusa_gif_mesmo_sendo_imagem():
    saida = io.BytesIO()
    Image.new("RGB", (10, 10)).save(saida, format="GIF")
    with pytest.raises(ValidacaoError, match="JPG, PNG ou WebP"):
        preparar_avatar(saida.getvalue())


def test_recusa_imagem_gigante_sem_decodificar():
    with pytest.raises(ValidacaoError, match="grande demais"):
        preparar_avatar(imagem("PNG", tamanho=(9000, 5000), cor=(0, 0, 0, 0)))


def test_arquivo_com_lixo_no_fim_vira_imagem_limpa():
    poliglota = imagem() + b"<script>alert(1)</script>"
    assert b"<script>" not in preparar_avatar(poliglota)


# ---------- cliente do Storage ----------
def storage(handler):
    return StorageClient("https://x.supabase.co/", "anon", "jwt-do-usuario",
                         http_client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_enviar_usa_jwt_do_usuario_e_upsert():
    visto = {}

    def handler(r):
        visto.update(url=str(r.url), auth=r.headers["Authorization"], apikey=r.headers["apikey"],
                     upsert=r.headers["x-upsert"], tipo=r.headers["Content-Type"], corpo=r.read())
        return httpx.Response(200, json={"Key": "avatares/u1/avatar.webp"})

    storage(handler).enviar("u1/avatar.webp", b"webp", "image/webp")
    assert visto["url"] == "https://x.supabase.co/storage/v1/object/avatares/u1/avatar.webp"
    assert (visto["auth"], visto["apikey"], visto["upsert"], visto["tipo"], visto["corpo"]) == (
        "Bearer jwt-do-usuario", "anon", "true", "image/webp", b"webp")


def test_baixar_e_inexistente():
    assert storage(lambda r: httpx.Response(200, content=b"img")).baixar("u1/avatar.webp") == b"img"
    assert storage(lambda r: httpx.Response(404)).baixar("u1/avatar.webp") is None
    nao_achou = httpx.Response(400, json={"statusCode": "404", "error": "not_found"})
    assert storage(lambda r: nao_achou).baixar("u1/avatar.webp") is None


def test_baixar_usa_rota_autenticada():
    urls = []
    storage(lambda r: urls.append(str(r.url)) or httpx.Response(200, content=b"")).baixar("u1/avatar.webp")
    assert urls == ["https://x.supabase.co/storage/v1/object/authenticated/avatares/u1/avatar.webp"]


def test_apagar_inexistente_nao_e_erro_mas_falha_real_e():
    storage(lambda r: httpx.Response(404)).apagar("u1/avatar.webp")
    with pytest.raises(ArmazenamentoIndisponivelError):
        storage(lambda r: httpx.Response(500)).apagar("u1/avatar.webp")
    with pytest.raises(ArmazenamentoIndisponivelError):
        storage(lambda r: httpx.Response(403, json={"error": "Unauthorized"})).enviar("x", b"", "image/webp")


def test_queda_de_rede_vira_erro_de_dominio():
    def cair(_):
        raise httpx.ConnectError("sem rede")

    with pytest.raises(ArmazenamentoIndisponivelError):
        storage(cair).baixar("u1/avatar.webp")


# ---------- service ----------
class StorageFalso:
    def __init__(self, falhar_apagar=False):
        self.arquivos: dict[str, bytes] = {}
        self.falhar_apagar = falhar_apagar

    def enviar(self, caminho, conteudo, tipo):
        assert tipo == "image/webp"
        self.arquivos[caminho] = conteudo

    def baixar(self, caminho):
        return self.arquivos.get(caminho)

    def apagar(self, caminho):
        if self.falhar_apagar:
            raise ArmazenamentoIndisponivelError("caiu")
        self.arquivos.pop(caminho, None)


def test_caminho_fica_na_pasta_do_usuario():
    assert caminho_avatar("abc") == "abc/avatar.webp"


def test_enviar_valida_antes_de_subir():
    repo, guardado = ContaRepoFalso(), StorageFalso()
    servico = ContaService(repo, guardado)
    with pytest.raises(ValidacaoError):
        servico.enviar_avatar("u1", b"nao e imagem")
    assert guardado.arquivos == {}

    servico.enviar_avatar("u1", imagem())
    with Image.open(io.BytesIO(guardado.arquivos["u1/avatar.webp"])) as salva:
        assert salva.format == "WEBP"
    assert repo.atualizacoes[-1][0] == "u1" and repo.atualizacoes[-1][1]["avatar_atualizado_em"]


def test_remover_avatar_limpa_a_marca_do_perfil():
    repo, guardado = ContaRepoFalso(), StorageFalso()
    servico = ContaService(repo, guardado)
    servico.enviar_avatar("u1", imagem())
    servico.remover_avatar("u1")
    assert guardado.arquivos == {} and repo.atualizacoes[-1] == ("u1", {"avatar_atualizado_em": None})


def test_excluir_conta_apaga_a_foto_antes():
    repo, guardado = ContaRepoFalso(), StorageFalso()
    servico = ContaService(repo, guardado)
    servico.enviar_avatar("u1", imagem())
    servico.excluir("u1", {"confirmacao": "EXCLUIR", "senha": "certa"})
    assert guardado.arquivos == {} and repo.excluiu is True


def test_se_a_foto_nao_apagar_a_conta_nao_e_excluida():
    repo = ContaRepoFalso()
    with pytest.raises(ArmazenamentoIndisponivelError):
        ContaService(repo, StorageFalso(falhar_apagar=True)).excluir("u1", {"confirmacao": "EXCLUIR", "senha": "certa"})
    assert repo.excluiu is False  # nada pela metade: nem conta sem foto, nem foto órfã


@pytest.mark.parametrize("corpo", [None, {}, {"nome": "   "}, {"nome": 3}, {"nome": "x" * 81}])
def test_renomear_valida(corpo):
    with pytest.raises(ValidacaoError):
        ContaService(ContaRepoFalso()).renomear("u1", corpo)


def test_renomear_normaliza_espacos():
    repo = ContaRepoFalso()
    ContaService(repo).renomear("u1", {"nome": "  Ana   Maria "})
    assert repo.atualizacoes == [("u1", {"nome": "Ana Maria"})]


# ---------- rotas ----------
@pytest.fixture
def logado(monkeypatch):
    repo, guardado = ContaRepoFalso(), StorageFalso()

    def validar(token):
        if token != "ok":
            raise NaoAutenticadoError("Token inválido.")
        return "u1"

    monkeypatch.setattr(auth, "obter_user_id", validar)
    monkeypatch.setattr(dependencies, "get_conta_service", lambda: ContaService(repo, guardado))
    return guardado


H = {"Authorization": "Bearer ok"}


def test_rotas_do_avatar(client, logado):
    assert client.get("/conta/avatar").status_code == 401
    assert client.get("/conta/avatar", headers=H).status_code == 404

    sem_arquivo = client.put("/conta/avatar", headers=H, data={})
    assert sem_arquivo.status_code == 400

    enviado = client.put("/conta/avatar", headers=H,
                         data={"foto": (io.BytesIO(imagem()), "eu.jpg")}, content_type="multipart/form-data")
    assert enviado.status_code == 200 and "u1/avatar.webp" in logado.arquivos

    baixado = client.get("/conta/avatar", headers=H)
    assert baixado.mimetype == "image/webp" and baixado.headers["X-Content-Type-Options"] == "nosniff"
    assert "private" in baixado.headers["Cache-Control"]

    assert client.delete("/conta/avatar", headers=H).status_code == 204
    assert logado.arquivos == {}


def test_arquivo_grande_demais_responde_413_em_json(client, logado):
    enorme = io.BytesIO(b"0" * (6 * 1024 * 1024 + 10))
    resposta = client.put("/conta/avatar", headers=H, data={"foto": (enorme, "x.jpg")}, content_type="multipart/form-data")
    assert resposta.status_code == 413 and resposta.get_json()["erro"] == "muito_grande"


def test_renomear_pela_rota(client, logado):
    assert client.patch("/conta", json={"nome": "Ana"}, headers=H).status_code == 200
    assert client.patch("/conta", json={"nome": ""}, headers=H).status_code == 400
