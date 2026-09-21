"""Bridge FINO (docs/WHATSAPP_MENTOR.md): Evolution → app Zaeon.

Decisão-chave do Mentor no WhatsApp: o agent-gateway NÃO é um cérebro paralelo. O raciocínio
é o harness/mentor que já existe no app (Next: /api/whatsapp/webhook → lib/whatsapp/brain.ts).
Aqui só normalizamos o evento do Evolution e repassamos com o segredo compartilhado. Sem
Postgres, sem pgvector, sem fila: um POST síncrono e idempotente (o app deduplica por lógica
de negócio; `messageId` viaja junto pra auditoria).

`to_app_payload` é puro (testável); `forward_to_app` faz o HTTP (client injetável).
"""
from __future__ import annotations

from typing import Any, Optional

import httpx


def _text_of(msg: dict[str, Any]) -> Optional[str]:
    m = msg.get("message") or {}
    for cand in (
        m.get("conversation"),
        (m.get("extendedTextMessage") or {}).get("text"),
        (m.get("imageMessage") or {}).get("caption"),
        msg.get("text"),
    ):
        if isinstance(cand, str) and cand.strip():
            return cand.strip()
    return None


def to_app_payload(evolution_payload: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Evento `messages.upsert` do Evolution → `{phone, text, messageId, instance}` (formato
    genérico que /api/whatsapp/webhook aceita). None = ignorar (fromMe, grupo, outro evento)."""
    if not isinstance(evolution_payload, dict):
        return None
    event = str(evolution_payload.get("event") or "").lower().replace("_", ".")
    if event and event != "messages.upsert":
        return None
    data = evolution_payload.get("data") or {}
    key = data.get("key") or {}
    if key.get("fromMe"):
        return None
    jid = str(key.get("remoteJid") or "")
    if "@" not in jid or not jid.endswith(("@s.whatsapp.net", "@c.us")):
        return None
    number = jid.split("@", 1)[0].split(":", 1)[0]
    if not number.isdigit():
        return None
    text = _text_of(data)
    if not text:
        return None
    return {
        "phone": f"+{number}",
        "text": text,
        "messageId": key.get("id"),
        "instance": evolution_payload.get("instance"),
    }


async def forward_to_app(
    payload: dict[str, Any], *, url: str, secret: str, client: Optional[httpx.AsyncClient] = None,
) -> tuple[int, dict[str, Any]]:
    """POST no app com `x-whatsapp-secret`. Devolve (status, corpo). Nunca levanta por HTTP ruim."""
    headers = {"x-whatsapp-secret": secret, "Content-Type": "application/json"}
    own = client is None
    c = client or httpx.AsyncClient(timeout=60)
    try:
        r = await c.post(url, json=payload, headers=headers)
        try:
            body = r.json() if r.content else {}
        except ValueError:
            body = {"raw": r.text[:300]}
        return r.status_code, body if isinstance(body, dict) else {"body": body}
    finally:
        if own:
            await c.aclose()
