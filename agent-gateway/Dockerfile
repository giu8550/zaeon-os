# syntax=docker/dockerfile:1.6
# Multi-stage (espelha o zenith-warmer): builder compila deps nativas; runtime slim,
# non-root, com ffmpeg (transcodifica TTS MP3 -> Ogg/Opus pra nota de voz do WhatsApp).
# Pinado pra rebuild reproduzível; bumpar deliberadamente por CVE.

# ───────────────────────── Stage 1: builder ─────────────────────────
FROM python:3.12.7-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade 'pip==25.0' && \
    pip install --prefix=/install -r requirements.txt

# ───────────────────────── Stage 2: runtime ─────────────────────────
FROM python:3.12.7-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# libpq5 p/ asyncpg; ffmpeg p/ nota de voz (Ogg/Opus).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 ffmpeg && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 zaeon

COPY --from=builder /install /usr/local
COPY . /app
WORKDIR /app
USER zaeon

EXPOSE 8000
# API por padrão. O worker roda noutro container com:
#   python -m arq app.worker.worker.WorkerSettings
CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
