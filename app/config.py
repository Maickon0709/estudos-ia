"""Configuração da aplicação. Tudo vem de variáveis de ambiente (.env)."""
import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    # Chave ANON (pública). Com ela + o token do usuário, o RLS do Postgres
    # protege os dados. NÃO use a service_role aqui.
    SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

    # IA (Groq). Opcional na inicialização: sem chave, só o chat responde 502.
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
    # Modelos mudam com o tempo: confira o nome atual no console da Groq.
    GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

    # Busca de conteúdo real (Tavily). Sem chave, a pesquisa responde 502.
    TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")
    # YouTube Data API: OPCIONAL. Sem chave, vídeos saem como "nao_verificado".
    YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY")

    @classmethod
    def validar(cls) -> None:
        faltando = [
            nome
            for nome in ("SUPABASE_URL", "SUPABASE_ANON_KEY")
            if not getattr(cls, nome)
        ]
        if faltando:
            raise RuntimeError(
                "Variáveis de ambiente ausentes: " + ", ".join(faltando)
            )
