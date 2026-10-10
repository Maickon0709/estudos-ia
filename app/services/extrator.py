"""Tira o texto de um arquivo enviado pelo aluno (função pura, sem rede).

Formatos: PDF, Word (.docx), PowerPoint (.pptx), texto (.txt) e Markdown (.md).

Mesmos cuidados da foto de perfil:
- o tipo é descoberto pelo CONTEÚDO (assinatura do arquivo), não pela extensão;
- tudo tem teto (bytes, páginas, tamanho de cada XML, caracteres): um arquivo
  feito para estourar a memória (bomba de compressão) é recusado no meio do caminho;
- XML com DOCTYPE é recusado (não há DOCTYPE em .docx/.pptx legítimos e é por ele
  que entram os ataques de entidade, como o "billion laughs").

O arquivo original não é guardado: só o texto segue adiante.
"""
import io
import re
import zipfile
from dataclasses import dataclass
from xml.etree import ElementTree

from app.core.errors import ValidacaoError

TAMANHO_MAX_BYTES = 4 * 1024 * 1024  # a Vercel recusa corpo acima de 4,5 MB
PAGINAS_MAX = 300
XML_MAX_BYTES = 20 * 1024 * 1024  # cada XML de dentro do .docx/.pptx, já descompactado
CARACTERES_MAX = 400_000  # ~200 páginas de livro; o resto é cortado (e avisado)
TEXTO_MINIMO = 40  # menos que isso num PDF = provavelmente escaneado (só imagem)

EXTENSOES_TEXTO = {".txt": "txt", ".md": "md", ".markdown": "md"}
FORMATOS_ACEITOS = "PDF, Word (.docx), PowerPoint (.pptx), .txt ou .md"

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


@dataclass
class Extraido:
    tipo: str  # pdf | docx | pptx | txt | md
    paginas: list[tuple[int | None, str]]  # (número da página/slide, texto); None = sem paginação
    truncado: bool = False

    @property
    def total_paginas(self) -> int | None:
        numeros = [n for n, _ in self.paginas if n is not None]
        return max(numeros) if numeros else None


def extrair_texto(nome_arquivo: str, conteudo: bytes) -> Extraido:
    if not conteudo:
        raise ValidacaoError("Envie um arquivo.")
    if len(conteudo) > TAMANHO_MAX_BYTES:
        raise ValidacaoError("O arquivo pode ter no máximo 4 MB.")

    if conteudo.startswith(b"%PDF-"):
        tipo, paginas = "pdf", _pdf(conteudo)
    elif conteudo.startswith(b"PK\x03\x04"):
        tipo, paginas = _office(conteudo)
    else:
        tipo, paginas = _texto(nome_arquivo, conteudo)

    paginas = [(n, limpar(t)) for n, t in paginas]
    paginas = [(n, t) for n, t in paginas if t]
    total = sum(len(t) for _, t in paginas)
    if total < (TEXTO_MINIMO if tipo == "pdf" else 1):
        if tipo == "pdf":
            raise ValidacaoError(
                "Não achei texto nesse PDF. Ele parece escaneado (só imagens); "
                "por enquanto só leio PDFs com texto selecionável."
            )
        raise ValidacaoError("Esse arquivo está vazio.")
    paginas, truncado = _cortar(paginas)
    return Extraido(tipo, paginas, truncado)


def limpar(texto: str) -> str:
    """O Postgres não aceita o caractere NUL; espaços e linhas em branco viram um só."""
    texto = texto.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    texto = re.sub(r"[ \t\f\v ]+", " ", texto)
    texto = re.sub(r" *\n *", "\n", texto)
    texto = re.sub(r"\n{3,}", "\n\n", texto)
    return texto.strip()


def _cortar(paginas):
    saida, total = [], 0
    for numero, texto in paginas:
        sobra = CARACTERES_MAX - total
        if sobra <= 0:
            return saida, True
        if len(texto) > sobra:
            saida.append((numero, texto[:sobra]))
            return saida, True
        saida.append((numero, texto))
        total += len(texto)
    return saida, False


# ---------- PDF ----------
def _pdf(conteudo: bytes) -> list[tuple[int, str]]:
    from pypdf import PdfReader  # import tardio: só quem envia PDF paga o custo

    try:
        leitor = PdfReader(io.BytesIO(conteudo))
        if leitor.is_encrypted and not leitor.decrypt(""):
            raise ValidacaoError("Esse PDF é protegido por senha. Envie uma versão sem senha.")
        if len(leitor.pages) > PAGINAS_MAX:
            raise ValidacaoError(f"O PDF pode ter no máximo {PAGINAS_MAX} páginas.")
        return [(i, pagina.extract_text() or "") for i, pagina in enumerate(leitor.pages, start=1)]
    except ValidacaoError:
        raise
    except Exception as exc:  # o pypdf levanta muitos tipos diferentes para PDF quebrado
        raise ValidacaoError("Não consegui ler esse PDF. Ele pode estar corrompido.") from exc


# ---------- Word e PowerPoint (são arquivos ZIP com XML dentro) ----------
def _office(conteudo: bytes) -> tuple[str, list[tuple[int | None, str]]]:
    try:
        with zipfile.ZipFile(io.BytesIO(conteudo)) as pacote:
            nomes = set(pacote.namelist())
            if "word/document.xml" in nomes:
                return "docx", [(None, _docx(_ler_xml(pacote, "word/document.xml")))]
            if "ppt/presentation.xml" in nomes:
                return "pptx", _pptx(pacote, nomes)
    except ValidacaoError:
        raise
    except (zipfile.BadZipFile, ElementTree.ParseError, KeyError, OSError, ValueError) as exc:
        raise ValidacaoError("Não consegui ler esse arquivo. Ele pode estar corrompido.") from exc
    raise ValidacaoError(f"Formato não aceito. Envie {FORMATOS_ACEITOS}.")


def _ler_xml(pacote: zipfile.ZipFile, nome: str) -> ElementTree.Element:
    with pacote.open(nome) as arquivo:
        dados = arquivo.read(XML_MAX_BYTES + 1)  # lê no máximo o teto, mesmo se o ZIP mentir o tamanho
    if len(dados) > XML_MAX_BYTES:
        raise ValidacaoError("O arquivo é grande demais depois de descompactado.")
    if b"<!DOCTYPE" in dados[:4096].upper():
        raise ValidacaoError("Não consegui ler esse arquivo. Ele pode estar corrompido.")
    return ElementTree.fromstring(dados)


def _docx(raiz: ElementTree.Element) -> str:
    paragrafos = []
    for paragrafo in raiz.iter(f"{_W}p"):
        partes = []
        for no in paragrafo.iter():
            if no.tag == f"{_W}t" and no.text:
                partes.append(no.text)
            elif no.tag == f"{_W}tab":
                partes.append(" ")
            elif no.tag in (f"{_W}br", f"{_W}cr"):
                partes.append("\n")
        paragrafos.append("".join(partes))
    return "\n".join(paragrafos)


def _pptx(pacote: zipfile.ZipFile, nomes: set[str]) -> list[tuple[int, str]]:
    slides = sorted(
        (int(m.group(1)), nome)
        for nome in nomes
        if (m := re.fullmatch(r"ppt/slides/slide(\d+)\.xml", nome))
    )
    if len(slides) > PAGINAS_MAX:
        raise ValidacaoError(f"A apresentação pode ter no máximo {PAGINAS_MAX} slides.")
    saida = []
    for posicao, (_, nome) in enumerate(slides, start=1):
        raiz = _ler_xml(pacote, nome)
        linhas = ["".join(t.text or "" for t in p.iter(f"{_A}t")) for p in raiz.iter(f"{_A}p")]
        saida.append((posicao, "\n".join(linhas)))
    return saida


# ---------- texto puro ----------
def _texto(nome_arquivo: str, conteudo: bytes) -> tuple[str, list[tuple[None, str]]]:
    extensao = ""
    if "." in (nome_arquivo or ""):
        extensao = "." + nome_arquivo.rsplit(".", 1)[1].lower()
    tipo = EXTENSOES_TEXTO.get(extensao)
    if tipo is None:
        raise ValidacaoError(f"Formato não aceito. Envie {FORMATOS_ACEITOS}.")
    if b"\x00" in conteudo[:8192]:  # bytes nulos = binário com extensão de texto
        raise ValidacaoError("Esse arquivo não parece ser de texto.")
    try:
        texto = conteudo.decode("utf-8-sig")
    except UnicodeDecodeError:
        texto = conteudo.decode("cp1252", errors="replace")  # bloco de notas antigo do Windows
    return tipo, [(None, texto)]
