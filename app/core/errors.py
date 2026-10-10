"""Erros de domínio. As camadas internas levantam estes erros e só o
handler registrado em create_app() os converte em resposta HTTP."""


class AppError(Exception):
    status_code = 500
    codigo = "erro_interno"

    def __init__(self, mensagem: str):
        super().__init__(mensagem)
        self.mensagem = mensagem


class ValidacaoError(AppError):
    status_code = 400
    codigo = "validacao"


class NaoAutenticadoError(AppError):
    status_code = 401
    codigo = "nao_autenticado"


class NaoEncontradoError(AppError):
    status_code = 404
    codigo = "nao_encontrado"


class ProibidoError(AppError):
    """Requisição recusada por regra de segurança (ex.: sem o cabeçalho anti-CSRF)."""

    status_code = 403
    codigo = "proibido"


class DuplicadoError(AppError):
    status_code = 409
    codigo = "duplicado"


class EstadoInvalidoError(AppError):
    """A ação não vale no estado atual (ex.: confirmar proposta já decidida)."""

    status_code = 409
    codigo = "estado_invalido"


class PropostaInvalidaError(AppError):
    status_code = 422
    codigo = "proposta_invalida"


class SemConteudoError(AppError):
    """A pesquisa não achou nenhum material verificado para montar a trilha."""

    status_code = 422
    codigo = "sem_conteudo"


class IAIndisponivelError(AppError):
    """A IA falhou, estourou limite ou não está configurada (502)."""

    status_code = 502
    codigo = "ia_indisponivel"


class BuscaIndisponivelError(AppError):
    """A busca na web falhou, estourou limite ou não está configurada (502)."""

    status_code = 502
    codigo = "busca_indisponivel"


class YouTubeIndisponivelError(BuscaIndisponivelError):
    """YouTube sem chave, sem cota ou fora do ar. O serviço se degrada com
    elegância: os vídeos seguem, só que marcados como não verificados."""

    codigo = "youtube_indisponivel"


class ArmazenamentoIndisponivelError(AppError):
    """O Supabase Storage (fotos de perfil) falhou ou não respondeu (502)."""

    status_code = 502
    codigo = "armazenamento_indisponivel"
