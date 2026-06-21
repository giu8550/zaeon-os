"""Zaeon Voice Engine — FastAPI (porta 8004 por padrão).

Não roda na Vercel; é um engine local/host, no mesmo padrão dos demais
engines Python (abnt-service 8001, suggestion-forge 8003). O Next consome via
proxy /api/ai/voice usando VOICE_ENGINE_URL.

Rodar:  uvicorn main:app --port 8004
"""
from __future__ import annotations

import threading

from fastapi import FastAPI, HTTPException

import engine
from models import SynthesizeRequest, SynthesizeResponse, VoicesResponse

app = FastAPI(title="Zaeon Voice Engine", version="2.0.0")


@app.on_event("startup")
def _warm_models() -> None:
    """Aquece o Kokoro no boot (em background) — carrega pipeline + pesos antes da
    primeira requisição real, eliminando o cold-start da primeira fala. Não bloqueia
    a subida do servidor; se falhar, o 1º synth apenas paga o load (comportamento antigo)."""
    def run() -> None:
        try:
            engine.synthesize_wav("Olá.", None)
        except Exception:  # noqa: BLE001 — warmup é best-effort
            pass
    threading.Thread(target=run, daemon=True).start()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "voice": engine.DEFAULT_VOICE}


@app.get("/voices", response_model=VoicesResponse)
def voices() -> dict:
    return {"voices": engine.list_voices(), "default": engine.DEFAULT_VOICE}


@app.post("/synthesize", response_model=SynthesizeResponse)
def synthesize(req: SynthesizeRequest) -> dict:
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Texto vazio.")
    try:
        return engine.synthesize_base64(text, req.voice)
    except FileNotFoundError as exc:
        # Nenhum modelo de voz disponível → 503 (o proxy degrada graciosamente).
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # noqa: BLE001 — falha de síntese vira 500 informativo
        raise HTTPException(status_code=500, detail=f"Falha na síntese: {exc}")
