"""Consumer do barramento Redis — lê wa:evt:{shard} e despacha eventos (lado entrada).

Porta enxuta de `app/bridge/consumer.py` do zenith-warmer. O adapter Go publica eventos
(inbound de mensagem, connection_state, resultado de comando) com um mapa flat + campo `v`
contendo o JSON completo. Aqui lemos `v`, json.loads e chamamos `on_event`. O ACK acontece
SEMPRE que uma entry é lida — inclusive malformada — pra não travar o pending do grupo.

A regra de negócio (enfileirar turno, atualizar status) NÃO mora aqui: é o `on_event`
injetado. Transporte puro, testável com um Redis fake.
"""
from __future__ import annotations

import inspect
import json
from typing import Any, Awaitable, Callable, Mapping, Optional, Union

OnEvent = Callable[[dict], Union[None, Awaitable[None]]]


def parse_event(fields: Mapping[str, Any]) -> Optional[dict]:
    """Extrai o dict do evento. Prioriza o campo `v` (JSON); cai pro mapa flat."""
    if not fields:
        return None
    v = fields.get("v")
    if v is None and b"v" in fields:  # type: ignore[operator]
        v = fields.get(b"v")
    if v is None:
        # sem `v` → devolve os campos crus (decodificando bytes)
        return {
            (k.decode() if isinstance(k, bytes) else k):
            (val.decode() if isinstance(val, bytes) else val)
            for k, val in fields.items()
        }
    if isinstance(v, bytes):
        v = v.decode()
    try:
        return json.loads(v)
    except Exception:
        return None


class InboundConsumer:
    """XREADGROUP loop num stream do barramento. on_event pode ser sync ou async."""

    def __init__(self, redis: Any, stream: str, *, group: str = "zaeon-agent",
                 consumer: str = "agent-1", on_event: Optional[OnEvent] = None) -> None:
        self._r = redis
        self._stream = stream
        self._group = group
        self._consumer = consumer
        self._on_event = on_event

    async def ensure_group(self) -> None:
        try:
            await self._r.xgroup_create(self._stream, self._group, id="0", mkstream=True)
        except Exception as e:  # BUSYGROUP = grupo já existe → ok
            if "BUSYGROUP" not in str(e):
                raise

    async def run_once(self, *, count: int = 10, block_ms: int = 5000) -> int:
        resp = await self._r.xreadgroup(
            self._group, self._consumer, {self._stream: ">"},
            count=count, block=block_ms,
        )
        if not resp:
            return 0
        processed = 0
        for _stream, entries in resp:
            for msg_id, fields in entries:
                ev = parse_event(fields)
                if ev is not None and self._on_event is not None:
                    res = self._on_event(ev)
                    if inspect.isawaitable(res):
                        await res
                # ACK sempre — mesma política do adapter (não trava o pending)
                await self._r.xack(self._stream, self._group, msg_id)
                processed += 1
        return processed

    async def run_forever(self) -> None:
        await self.ensure_group()
        while True:  # pragma: no cover - loop infinito de runtime
            await self.run_once()
