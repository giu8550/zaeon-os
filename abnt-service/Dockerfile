# Zaeon ABNT Service — FastAPI + LibreOffice (conversão PDF). Imagem para o VPS.
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

# LibreOffice Writer (headless) p/ exportar PDF + fontes. -writer é bem menor que o full.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer fonts-dejavu fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .
EXPOSE 8001
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
