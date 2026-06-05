"""Tests for the FastAPI surface: /health, /forge, /reforge, error mapping."""
from fastapi.testclient import TestClient

import engine
import main
from _factories import make_request, make_suggestion
from models import ForgeResponse

client = TestClient(main.app)


def _fake_response():
    return ForgeResponse(
        suggestions=[make_suggestion(), make_suggestion(gap_type="temporal")],
        coverage_summary="Forjadas propostas cobrindo lacunas metodológicas e temporais distintas.",
        generated_at="2026-06-05T18:34:12.481Z",
        gemini_overconfidence_count=1,
    )


def test_health_returns_service_identity():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "zaeon-suggestion-forge", "version": "1.0.0"}


def test_forge_returns_200_with_suggestions(monkeypatch):
    monkeypatch.setattr(engine, "generate_suggestions", lambda req: _fake_response())
    r = client.post("/forge", json=make_request(count=2).model_dump())
    assert r.status_code == 200
    body = r.json()
    assert len(body["suggestions"]) == 2
    assert body["gemini_overconfidence_count"] == 1


def test_forge_422_on_too_few_references():
    payload = make_request().model_dump()
    payload["references"] = payload["references"][:2]  # contract requires >= 3
    r = client.post("/forge", json=payload)
    assert r.status_code == 422


def test_forge_503_when_model_unavailable(monkeypatch):
    def boom(req):
        raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY env var not set")
    monkeypatch.setattr(engine, "generate_suggestions", boom)
    r = client.post("/forge", json=make_request().model_dump())
    assert r.status_code == 503


def test_reforge_requires_exclude_titles(monkeypatch):
    monkeypatch.setattr(engine, "generate_suggestions", lambda req: _fake_response())
    r = client.post("/reforge", json=make_request().model_dump())  # no exclude_titles
    assert r.status_code == 422


def test_reforge_200_with_exclude_titles(monkeypatch):
    monkeypatch.setattr(engine, "generate_suggestions", lambda req: _fake_response())
    payload = make_request(exclude_titles=["Um título já mostrado anteriormente"]).model_dump()
    r = client.post("/reforge", json=payload)
    assert r.status_code == 200


def test_forge_maps_value_error_to_422(monkeypatch):
    def boom(req):
        raise ValueError("malformed Gemini output")
    monkeypatch.setattr(engine, "generate_suggestions", boom)
    r = client.post("/forge", json=make_request().model_dump())
    assert r.status_code == 422

