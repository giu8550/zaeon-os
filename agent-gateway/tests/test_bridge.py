"""Ponte Redis end-to-end com um Redis fake — produtor (wa:cmd) ↔ consumer (wa:evt)."""
import json
from collections import defaultdict

import pytest

from app.agent.persona import UserProfile
from app.agent.session import AgentDeps
from app.bridge.consumer import InboundConsumer, parse_event
from app.bridge.protocol import build_command, shard_of
from app.engines import plans
from app.providers.fakes import FakeLLM, FakeRag, FakeSearch, FakeTransport, FakeVoice
from app.providers.profile_repo import InMemoryProfileRepository
from app.providers.transport.whatsmeow import WhatsmeowAdapterTransport
from app.worker.inbound import make_inbound_handler


class FakeRedis:
    def __init__(self):
        self.streams = defaultdict(list)
        self.cursors = defaultdict(dict)
        self.acked = []
        self._seq = 0

    async def xadd(self, stream, fields, **kw):
        self._seq += 1
        mid = f"{self._seq}-0"
        self.streams[stream].append((mid, dict(fields)))
        return mid

    async def xgroup_create(self, stream, group, id="0", mkstream=False):
        self.cursors[stream][group] = 0

    async def xreadgroup(self, group, consumer, streams, count=10, block=None):
        out = []
        for stream in streams:
            idx = self.cursors[stream].get(group, 0)
            entries = self.streams[stream][idx:idx + count]
            if entries:
                self.cursors[stream][group] = idx + len(entries)
                out.append((stream, entries))
        return out

    async def xack(self, stream, group, msg_id):
        self.acked.append((stream, group, msg_id))
        return 1


# ───────── protocolo ─────────
def test_shard_of():
    assert shard_of(7, 1) == "0"
    assert shard_of(7, 4) == "3"
    assert shard_of(8, 4) == "0"


def test_build_command_shape():
    stream, fields = build_command("send_text", 3, {"jid": "x", "text": "oi"}, n_shards=4)
    assert stream == "wa:cmd:3"
    v = json.loads(fields["v"])
    assert v["operation"] == "send_text" and v["instance_id"] == 3
    assert v["payload"]["text"] == "oi"


# ───────── produtor (transport → wa:cmd) ─────────
@pytest.mark.asyncio
async def test_producer_publishes_to_wa_cmd():
    t = WhatsmeowAdapterTransport()
    t._redis = FakeRedis()  # injeta o fake
    ok = await t.send_text("5", "5511@s.whatsapp.net", "olá")
    assert ok
    stream = "wa:cmd:0"  # n_shards default 1 → shard 0
    assert len(t._redis.streams[stream]) == 1
    v = json.loads(t._redis.streams[stream][0][1]["v"])
    assert v["operation"] == "send_text" and v["payload"]["text"] == "olá"


# ───────── consumer (wa:evt → on_event) ─────────
@pytest.mark.asyncio
async def test_consumer_roundtrip_and_ack():
    r = FakeRedis()
    await r.xadd("wa:evt", {"v": json.dumps({
        "kind": "message", "event_id": "m1", "instance": "7",
        "payload": {"jid": "5511@s", "text": "oi"},
    })})
    received = []
    c = InboundConsumer(r, "wa:evt", on_event=lambda ev: received.append(ev))
    await c.ensure_group()
    n = await c.run_once(block_ms=0)
    assert n == 1
    assert received[0]["kind"] == "message"
    assert len(r.acked) == 1  # ack sempre


def test_parse_event_malformed_is_none():
    assert parse_event({"v": "{not json"}) is None
    assert parse_event({}) is None


# ───────── handler de inbound (evento → turno → resposta) ─────────
def _deps(reply="resposta do agente"):
    return AgentDeps(FakeLLM(reply), FakeRag([]), FakeSearch(), FakeVoice())


def _repo():
    prof = UserProfile(user_id=7, full_name="Ana Souza", email="ana@usp.br",
                       plan_state=plans.PlanState(plan=plans.Plan.PLUS))
    return InMemoryProfileRepository(by_owner={7: prof})


@pytest.mark.asyncio
async def test_handler_processes_message_and_replies():
    repo, transport = _repo(), FakeTransport()

    async def get_profile(ev):
        return await repo.get(int(ev.get("owner_id")))

    handle = make_inbound_handler(get_profile, _deps(), transport)
    ev = {"kind": "message", "event_id": "m1", "instance": "7", "owner_id": 7,
          "payload": {"jid": "5511@s", "text": "oi"}}
    await handle(ev)
    assert transport.sent == [("5511@s", "resposta do agente")]


@pytest.mark.asyncio
async def test_handler_dedups_same_message():
    repo, transport = _repo(), FakeTransport()

    async def get_profile(ev):
        return await repo.get(7)

    handle = make_inbound_handler(get_profile, _deps(), transport)
    ev = {"kind": "message", "event_id": "dup", "instance": "7", "owner_id": 7,
          "payload": {"jid": "5511@s", "text": "oi"}}
    await handle(ev)
    await handle(ev)  # mesma msg_id → ignorada
    assert len(transport.sent) == 1


@pytest.mark.asyncio
async def test_handler_ignores_connection_state():
    repo, transport = _repo(), FakeTransport()

    async def get_profile(ev):
        return await repo.get(7)

    handle = make_inbound_handler(get_profile, _deps(), transport)
    await handle({"kind": "connection_state", "instance": "7", "payload": {"state": "close"}})
    assert transport.sent == []
