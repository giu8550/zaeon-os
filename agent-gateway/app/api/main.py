"""API do agent-gateway (FastAPI).

Expõe: /health, /metrics (Prometheus), e o NET-NOVO /webhook/wa — o inbound do WhatsApp
que o warming não tem. Recebe MESSAGES_UPSERT, deduplica por id da mensagem (idempotência)
e enfileira o turno no arq. A resposta é gerada no worker, não aqui (turnos são assíncronos).

PONTO DE PAUSA: precisa de Redis (fila + dedup) e, para inbound real, da instância Evolution.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, generate_latest

app = FastAPI(title="Zaeon Agent Gateway")

_inbound = Counter("zaeon_agent_inbound_total", "Mensagens recebidas", ["kind"])
_dedup = Counter("zaeon_agent_dedup_skips_total", "Mensagens duplicadas ignoradas")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/metrics")
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/webhook/wa")
async def whatsapp_webhook(request: Request) -> dict:
    """Recebe eventos do Evolution e REPASSA pro app (bridge fino — docs/WHATSAPP_MENTOR.md).

    O cérebro (harness + mentor + memória) vive no app Next; aqui só normalizamos o evento e
    fazemos um POST com o segredo compartilhado. Dedup por id da mensagem em memória
    (processo único); o app é idempotente por lógica de negócio.
    """
    from app.bridge.forward import forward_to_app, to_app_payload
    from app.core.config import settings

    payload: dict[str, Any] = await request.json()
    normalized = to_app_payload(payload)
    if normalized is None:
        return {"ignored": True}

    msg_id = normalized.get("messageId")
    if await _already_processed(msg_id):
        _dedup.inc()
        return {"deduped": True}

    kind = "audio" if (payload.get("data") or {}).get("message", {}).get("audioMessage") else "text"
    _inbound.labels(kind=kind).inc()

    if not settings.WHATSAPP_WEBHOOK_SECRET:
        return {"forwarded": False, "error": "WHATSAPP_WEBHOOK_SECRET ausente"}
    status, body = await forward_to_app(
        normalized, url=settings.ZAEON_WEBHOOK_URL, secret=settings.WHATSAPP_WEBHOOK_SECRET,
    )
    return {"forwarded": status < 400, "status": status, "app": body}


_SEEN: dict[str, float] = {}
_SEEN_MAX = 5000


async def _already_processed(msg_id: str | None) -> bool:
    """Dedup em memória (bridge = processo único). Em escala: Redis SETNX wa:seen:{id}."""
    if not msg_id:
        return False
    import time
    now = time.time()
    if msg_id in _SEEN:
        return True
    if len(_SEEN) >= _SEEN_MAX:
        for k in [k for k, t in _SEEN.items() if now - t > 3600][:1000] or list(_SEEN)[:1000]:
            _SEEN.pop(k, None)
    _SEEN[msg_id] = now
    return False


async def _enqueue_turn(job: dict) -> None:
    # TODO(pausa): arq pool.enqueue_job("task_process_turn", job)
    _ = json.dumps(job)
