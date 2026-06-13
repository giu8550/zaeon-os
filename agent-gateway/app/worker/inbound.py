"""Handler de inbound — cola o evento do adapter ao orquestrador de turno.

Recebe o evento parseado (do InboundConsumer), filtra só mensagens de usuário, deduplica
por id, carrega o perfil, roda o turno e responde pelo transporte. Tudo injetável → testável.

Dedup: `Seen` async (default em memória; em prod, Redis SETNX `wa:seen:{id}`).
Perfil: `get_profile(ev)` async injetado (default usa um ProfileRepository).
"""
from __future__ import annotations

from typing import Awaitable, Callable, Optional

from app.agent.persona import UserProfile
from app.agent.session import AgentDeps, TurnInput, process_turn

# kinds que representam mensagem de usuário (o adapter Go deve usar um destes)
_MESSAGE_KINDS = {"message", "messages.upsert", "inbound"}


class InMemorySeen:
    """Dedup em memória (testes / single-process). Prod: trocar por Redis SETNX."""

    def __init__(self) -> None:
        self._seen: set[str] = set()

    async def __call__(self, msg_id: str) -> bool:
        if msg_id in self._seen:
            return True
        self._seen.add(msg_id)
        return False


GetProfile = Callable[[dict], Awaitable[Optional[UserProfile]]]
Seen = Callable[[str], Awaitable[bool]]


def make_inbound_handler(
    get_profile: GetProfile,
    deps: AgentDeps,
    transport,
    *,
    seen: Optional[Seen] = None,
) -> Callable[[dict], Awaitable[None]]:
    _seen: Seen = seen or InMemorySeen()

    async def handle(ev: dict) -> None:
        kind = ev.get("kind") or ev.get("operation")
        if kind not in _MESSAGE_KINDS:
            return  # connection_state / resultado de comando → ignora aqui

        payload = ev.get("payload") or ev
        jid = payload.get("jid") or payload.get("remoteJid")
        text = payload.get("text") or payload.get("conversation")
        audio = payload.get("audio")  # bytes, se o adapter já baixou a mídia
        msg_id = ev.get("event_id") or payload.get("id")
        instance = ev.get("instance") or payload.get("instance_id")

        if msg_id and await _seen(str(msg_id)):
            return
        if not jid:
            return

        profile = await get_profile(ev)
        if profile is None:
            return

        out = await process_turn(
            profile, deps,
            TurnInput(text=text, audio=audio, channel="whatsapp", want_voice=bool(audio)),
        )

        if out.audio:
            await transport.send_presence(str(instance), jid, "recording")
            await transport.send_audio(str(instance), jid, out.audio)
        else:
            await transport.send_text(str(instance), jid, out.text)

    return handle
