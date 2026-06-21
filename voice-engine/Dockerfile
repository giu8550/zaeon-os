# Zaeon Voice Engine (Kokoro + Piper) — imagem CPU-only para o VPS.
# Python 3.12 (Kokoro NÃO roda no 3.13). espeak-ng = fonemização PT-BR do Kokoro.
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.hf \
    KOKORO_LANG=p

# Dependências de sistema: espeak-ng (Kokoro), libsndfile (soundfile).
RUN apt-get update && apt-get install -y --no-install-recommends \
      espeak-ng libespeak-ng1 libsndfile1 curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
# torch CPU-only PRIMEIRO: evita ~2GB de libs CUDA que o kokoro puxaria por padrão.
RUN pip install --upgrade pip \
    && pip install torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install -r requirements.txt

COPY . .
# Voz pt-BR de qualidade (Piper faber-medium) — baixa no build pra a prod já ter.
RUN bash scripts/download_voice.sh pt_BR-faber-medium || echo "aviso: download da voz Piper falhou (segue com Kokoro)"
EXPOSE 8004
# warmup do Kokoro acontece no startup (main.py) → 1ª fala sem cold-start.
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8004"]
