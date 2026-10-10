"""Tratamento da foto de perfil (função pura, sem rede).

Nunca guardamos o arquivo do jeito que veio:
- o tipo é descoberto pelo conteúdo, não pela extensão nem pelo Content-Type;
- só JPEG, PNG e WebP; imagens gigantes são recusadas antes de abrir (bomba de descompressão);
- a imagem é regravada do zero em WebP 256x256: some qualquer metadado (EXIF com GPS,
  modelo do celular) e qualquer conteúdo escondido junto do arquivo.
"""
import io

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import ValidacaoError

TAMANHO_MAX_BYTES = 5 * 1024 * 1024
PIXELS_MAX = 40_000_000  # ~ 8000 x 5000
FORMATOS = {"JPEG", "PNG", "WEBP"}
LADO = 256


def preparar_avatar(conteudo: bytes) -> bytes:
    if not conteudo:
        raise ValidacaoError("Envie uma imagem.")
    if len(conteudo) > TAMANHO_MAX_BYTES:
        raise ValidacaoError("A imagem pode ter no máximo 5 MB.")
    try:
        with Image.open(io.BytesIO(conteudo)) as bruta:
            if bruta.format not in FORMATOS:
                raise ValidacaoError("Use uma imagem JPG, PNG ou WebP.")
            if bruta.width * bruta.height > PIXELS_MAX:
                raise ValidacaoError("A imagem é grande demais. Use uma de até 40 megapixels.")
            imagem = ImageOps.exif_transpose(bruta)  # respeita a rotação da câmera
            imagem = imagem.convert("RGBA" if imagem.mode in ("RGBA", "LA", "P") else "RGB")
            quadrada = ImageOps.fit(imagem, (LADO, LADO), method=Image.Resampling.LANCZOS)
            saida = io.BytesIO()
            quadrada.save(saida, format="WEBP", quality=85, method=4)  # sem exif=: nenhum metadado
            return saida.getvalue()
    except ValidacaoError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise ValidacaoError("Esse arquivo não é uma imagem válida.") from exc
