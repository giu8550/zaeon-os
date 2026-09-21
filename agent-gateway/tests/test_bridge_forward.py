"""Bridge fino: Evolution → payload genérico do app, e o POST com segredo (client fake)."""
import httpx
import pytest

from app.bridge.forward import forward_to_app, to_app_payload


def _upsert(jid="5511999999999@s.whatsapp.net", text="CONECTAR-ABC234", from_me=False, mid="M1"):
    return {
        "event": "messages.upsert", "instance": "zaeon",
        "data": {"key": {"remoteJid": jid, "fromMe": from_me, "id": mid}, "message": {"conversation": text}},
    }


def test_to_app_payload_ok():
    assert to_app_payload(_upsert()) == {"phone": "+5511999999999", "text": "CONECTAR-ABC234", "messageId": "M1", "instance": "zaeon"}


def test_to_app_payload_extended_text_and_uppercase_event():
    p = _upsert()
    p["event"] = "MESSAGES_UPSERT"
    p["data"]["message"] = {"extendedTextMessage": {"text": "oi mentor"}}
    assert to_app_payload(p)["text"] == "oi mentor"


def test_to_app_payload_ignores_from_me_groups_other_events_and_empty():
    assert to_app_payload(_upsert(from_me=True)) is None
    assert to_app_payload(_upsert(jid="1203630@g.us")) is None
    assert to_app_payload({"event": "connection.update", "data": {}}) is None
    assert to_app_payload(_upsert(text="   ")) is None
    assert to_app_payload("lixo") is None  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_forward_to_app_posts_with_secret():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["secret"] = request.headers.get("x-whatsapp-secret")
        captured["json"] = request.read()
        return httpx.Response(200, json={"ok": True, "action": "connected"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        status, body = await forward_to_app(
            {"phone": "+5511999999999", "text": "oi"}, url="http://web:3000/api/whatsapp/webhook", secret="s3cr3t", client=client,
        )
    assert status == 200 and body["action"] == "connected"
    assert captured["url"] == "http://web:3000/api/whatsapp/webhook"
    assert captured["secret"] == "s3cr3t"
    assert b'"phone":"+5511999999999"' in captured["json"].replace(b" ", b"")


@pytest.mark.asyncio
async def test_forward_to_app_non_json_error_body():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(502, text="bad gateway")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        status, body = await forward_to_app({"phone": "+1", "text": "x"}, url="http://x", secret="s", client=client)
    assert status == 502 and body["raw"] == "bad gateway"
