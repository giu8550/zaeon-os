"""MessagingTransport concreto — Evolution API (fork enxuto do evo_client do zenith-warmer).

Reusa os mesmos endpoints já validados em produção: criar instância, QR/pareamento,
sendText, sendWhatsAppAudio, presence (digitando/gravando). Pareamento é SEMPRE
consentido pelo dono do número (QR no aparelho dele).

PONTO DE PAUSA: precisa de uma instância Evolution acessível (EVO_URL/EVO_API_KEY).
"""
from __future__ import annotations

from typing import Optional

import httpx

from app.core.config import settings
from app.providers.interfaces import MessagingTransport, PairResult


def _admin_headers() -> dict:
    return {"apikey": settings.EVO_API_KEY or "", "Content-Type": "application/json"}


def _inst_headers(token: str) -> dict:
    return {"apikey": token, "Content-Type": "application/json"}


class EvolutionTransport(MessagingTransport):
    def __init__(self, base_url: Optional[str] = None) -> None:
        self._base = (base_url or settings.EVO_URL or "").rstrip("/")

    async def pair(self, owner_id, phone=None) -> PairResult:
        name = f"zaeon-agent-{owner_id}"
        async with httpx.AsyncClient(timeout=20) as c:
            created = await c.post(
                f"{self._base}/instance/create",
                json={"name": name, "advancedSettings": {"alwaysOnline": True,
                      "readMessages": True}},
                headers=_admin_headers(),
            )
            data = created.json().get("data", {}) if created.is_success else {}
            inst_id = data.get("id", name)
            token = data.get("token", "")
            # webhook de inbound (NET-NOVO vs warming): manda MESSAGES_UPSERT pro gateway
            await c.post(
                f"{self._base}/webhook/set/{name}",
                json={"url": f"{settings.__dict__.get('PUBLIC_URL','')}/webhook/wa",
                      "events": ["MESSAGES_UPSERT"]},
                headers=_inst_headers(token),
            )
            qr = await c.get(f"{self._base}/instance/qr", headers=_inst_headers(token))
            qr_body = qr.json().get("data", {}) if qr.is_success else {}
        return PairResult(instance_id=str(inst_id), qr_code=qr_body.get("qrcode"),
                          pairing_code=qr_body.get("pairingCode"))

    async def send_text(self, instance_id, jid, text) -> bool:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(f"{self._base}/message/sendText/{instance_id}",
                             json={"number": jid, "text": text}, headers=_admin_headers())
            return r.is_success

    async def send_audio(self, instance_id, jid, audio) -> bool:
        # audio deve estar em Ogg/Opus (ver audio.to_ogg_opus do zenith-warmer)
        async with httpx.AsyncClient(timeout=30) as c:
            files = {"file": ("audio.ogg", audio, "audio/ogg; codecs=opus")}
            r = await c.post(f"{self._base}/message/sendWhatsAppAudio/{instance_id}",
                             data={"number": jid}, files=files, headers=_admin_headers())
            return r.is_success

    async def send_presence(self, instance_id, jid, state="composing") -> bool:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(f"{self._base}/message/presence/{instance_id}",
                             json={"number": jid, "presence": state}, headers=_admin_headers())
            return r.is_success

    async def revoke(self, instance_id) -> bool:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.delete(f"{self._base}/instance/delete/{instance_id}",
                               headers=_admin_headers())
            return r.is_success
