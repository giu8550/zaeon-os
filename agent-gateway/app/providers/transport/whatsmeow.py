"""MessagingTransport PRIMÁRIO — whatsmeow adapter (zenith-wa-bridge). Ver ADR-001.

Ciclo de vida (pair/qr/set_proxy/revoke) → operator HTTP (adapter:9091).
Mensagens (send_text/audio/presence) → publish em wa:cmd:{shard} (publish-and-trust:
"sucesso" = comando enfileirado; a entrega real aparece em wa:evt, consumido pelo worker).

PONTOS DE PAUSA: precisa do adapter rodando (operator HTTP), do Redis do barramento, e
— pro assistente ouvir — do INBOUND PUBLISHER no adapter (NET-NOVO, ver ADR-001 Decisão 2).
"""
from __future__ import annotations

from typing import Optional

from app.bridge.protocol import build_command
from app.core.config import settings
from app.providers.interfaces import MessagingTransport, PairResult


class WhatsmeowAdapterTransport(MessagingTransport):
    def __init__(self, operator_url: Optional[str] = None,
                 redis_url: Optional[str] = None, n_shards: Optional[int] = None) -> None:
        self._op = (operator_url or settings.WHATSMEOW_ADAPTER_URL or "").rstrip("/")
        self._redis_url = redis_url or settings.BRIDGE_REDIS_URL
        self._n = n_shards or settings.BRIDGE_N_SHARDS
        self._redis = None

    async def _redis_or_init(self):
        if self._redis is None:
            import redis.asyncio as aioredis  # type: ignore
            self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
        return self._redis

    async def _publish(self, operation: str, instance_id: int, payload: dict) -> bool:
        r = await self._redis_or_init()
        stream, fields = build_command(operation, instance_id, payload, n_shards=self._n)
        await r.xadd(stream, fields)
        return True  # enfileirado (publish-and-trust)

    # ---- ciclo de vida: operator HTTP ----
    async def pair(self, owner_id, phone=None) -> PairResult:
        import httpx  # import tardio — o caminho Redis (mensagens) não depende de httpx
        async with httpx.AsyncClient(timeout=20) as c:
            created = await c.post(f"{self._op}/instance/create",
                                   json={"owner_id": owner_id})
            data = created.json() if created.is_success else {}
            inst_id = str(data.get("instance_id") or owner_id)
            qr = await c.get(f"{self._op}/instance/qr",
                             params={"instance_id": inst_id})
            qrb = qr.json() if qr.is_success else {}
        return PairResult(instance_id=inst_id, qr_code=qrb.get("qrcode"),
                          pairing_code=qrb.get("pairingCode"))

    async def set_proxy(self, instance_id, proxy_url) -> bool:
        import httpx
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{self._op}/instance/proxy/{instance_id}",
                             json={"proxy": proxy_url})
            return r.is_success

    async def revoke(self, instance_id) -> bool:
        import httpx
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{self._op}/instance/logout",
                             json={"instance_id": instance_id})
            return r.is_success

    # ---- mensagens: barramento Redis ----
    async def send_text(self, instance_id, jid, text) -> bool:
        return await self._publish("send_text", int(instance_id),
                                   {"jid": jid, "text": text})

    async def send_audio(self, instance_id, jid, audio) -> bool:
        # áudio já em Ogg/Opus; o payload referencia a mídia (o adapter resolve o upload)
        return await self._publish("send_audio", int(instance_id),
                                   {"jid": jid, "mime": "audio/ogg; codecs=opus"})

    async def send_presence(self, instance_id, jid, state="composing") -> bool:
        return await self._publish("send_presence", int(instance_id),
                                   {"jid": jid, "state": state})
