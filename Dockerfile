# ---------- base: dependências de produção ----------
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

# ---------- testes: roda a suíte inteira ----------
# docker compose --profile testes run --rm testes
FROM base AS testes
COPY requirements-dev.txt .
RUN pip install -r requirements-dev.txt
COPY . .
CMD ["pytest", "-q"]

# ---------- produção (alvo padrão) ----------
FROM base AS producao
RUN useradd --create-home --uid 10001 app
COPY app ./app
COPY api ./api
USER app
EXPOSE 8000
# 60s de timeout: gerar proposta faz busca + validação de links + IA.
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60", "app:create_app()"]
