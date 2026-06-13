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
    """Recebe eventos do Evolution. Só processa MESSAGES_UPSERT de entrada."""
    payload: dict[str, Any] = await request.json()
    if payload.get("event") != "messages.upsert":
        return {"ignored": True}

    msg = payload.get("data", {})
    key = msg.get("key", {})
    # ignora o que a própria instância enviou
    if key.get("fromMe"):
        return {"ignored": "fromMe"}

    msg_id = key.get("id")
    jid = key.get("remoteJid")
    instance = payload.get("instance")

    # dedup idempotente por msg_id (Redis SET NX) — evita turno duplicado
    if await _already_processed(msg_id):
        _dedup.inc()
        return {"deduped": True}

    kind = "audio" if msg.get("message", {}).get("audioMessage") else "text"
    _inbound.labels(kind=kind).inc()

    # enfileira o turno no arq (o worker gera e envia a resposta)
    await _enqueue_turn({"instance": instance, "jid": jid, "msg_id": msg_id,
                         "kind": kind, "raw": msg})
    return {"queued": True}


async def _already_processed(msg_id: str | None) -> bool:
    if not msg_id:
        return False
    # TODO(pausa): redis SETNX f"wa:seen:{msg_id}" ex=3600
    return False


async def _enqueue_turn(job: dict) -> None:
    # TODO(pausa): arq pool.enqueue_job("task_process_turn", job)
    _ = json.dumps(job)
