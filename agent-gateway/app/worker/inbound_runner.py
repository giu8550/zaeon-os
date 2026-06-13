"""Runner do consumer de inbound — processo separado que liga a ponte ao agente.

Roda em paralelo ao worker arq (outro container no compose). Consome `WA_INBOUND_STREAM`
do barramento, resolve o perfil, processa o turno e responde pelo transporte.

    python -m app.worker.inbound_runner

PONTO DE PAUSA: precisa de Redis vivo E do adapter Go publicando inbound (ADR-001 Decisão 2).
"""
from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger("ZaeonInbound")


async def main() -> None:
    import redis.asyncio as aioredis  # import tardio

    from app.bridge.consumer import InboundConsumer
    from app.core.config import settings
    from app.providers.profile_repo import HttpProfileRepository
    from app.providers.transport.whatsmeow import WhatsmeowAdapterTransport
    from app.worker.inbound import make_inbound_handler
    from app.worker.worker import _build_deps

    deps = await _build_deps()
    transport = WhatsmeowAdapterTransport()
    repo = HttpProfileRepository(settings.ZAEON_INTERNAL_URL or "",
                                 settings.ZAEON_INTERNAL_TOKEN)

    async def get_profile(ev: dict):
        payload = ev.get("payload") or {}
        owner_id = ev.get("owner_id") or payload.get("owner_id")
        if owner_id is not None:
            return await repo.get(int(owner_id))
        inst = ev.get("instance") or payload.get("instance_id")
        return await repo.get_by_instance(str(inst)) if inst else None

    handler = make_inbound_handler(get_profile, deps, transport)
    r = aioredis.from_url(settings.BRIDGE_REDIS_URL, decode_responses=True)
    consumer = InboundConsumer(r, settings.WA_INBOUND_STREAM, on_event=handler)

    logger.info("Inbound runner ligado em %s (stream=%s)",
                settings.BRIDGE_REDIS_URL, settings.WA_INBOUND_STREAM)
    await consumer.run_forever()


if __name__ == "__main__":
    asyncio.run(main())
