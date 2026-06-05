"""Tests for the engine: JSON parsing, tier override, retry loop, downgrade.

Gemini is always mocked (no network, no API key needed) by monkeypatching
engine._call_gemini.
"""
import json
import pathlib
import uuid

import pytest

import classifier
import engine
from _factories import make_request
from models import ForgeRequest

FIXTURES = pathlib.Path(__file__).parent / "fixtures"


# --- raw-Gemini-output builders (no id / quality_tier — server computes those) ---

def gemini_suggestion(axes=None, desdobramentos=None, **over):
    base = dict(
        title="Bioeletroquímica de compósitos celulose-grafeno bacteriano",
        rationale="A literatura documenta a síntese mas não caracteriza o desempenho elétrico em ciclos longos.",
        novelty_angle="Primeiro estudo a quantificar retenção pós-10k ciclos",
        gap_type="metodologica",
        gap_score=0.78,
        axes=dict(difficulty="phd", relevance=0.82, innovation=0.81, estimated_months_min=30, estimated_months_max=42),
        desdobramentos=dict(
            publication_targets=["Qualis A1"], required_methods=["voltametria"],
            material_resources=[], prerequisites=[], risks=["risco técnico"],
            milestones=["M1", "M2", "M3"], evidence_refs=[0], cross_link_refs=[],
        ),
    )
    if axes is not None:
        base["axes"].update(axes)
    if desdobramentos is not None:
        base["desdobramentos"].update(desdobramentos)
    base.update(over)
    return base


def gemini_payload(suggestions, coverage="Forjadas propostas cobrindo lacunas diversas e suficientes para o tópico."):
    return json.dumps({"suggestions": suggestions, "coverage_summary": coverage})


class FakeGemini:
    """Records temperatures; returns queued responses (last repeats)."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.temps = []

    def __call__(self, system_prompt, user_message, temperature):
        self.temps.append(temperature)
        return self.responses[min(len(self.temps) - 1, len(self.responses) - 1)]


# --- _extract_json ----------------------------------------------------------

def test_extract_json_strips_markdown_fences():
    data = engine._extract_json('```json\n{"suggestions": [], "coverage_summary": "x"}\n```')
    assert data["coverage_summary"] == "x"


def test_extract_json_raises_on_malformed():
    with pytest.raises(ValueError):
        engine._extract_json('```json\n{ "suggestion": { broken json')


# --- _parse -----------------------------------------------------------------

def test_parse_assigns_uuid_and_overrides_tier():
    raw = gemini_payload([gemini_suggestion(quality_tier="excepcional")])  # LLM lies; server overrides
    suggs, coverage = engine._parse(raw, make_request(count=1))
    s = suggs[0]
    assert uuid.UUID(s.id)  # valid uuid4 assigned by server
    assert s.quality_tier == classifier.compute_tier(s.axes, s.gap_score)
    assert coverage.startswith("Forjadas")


def test_parse_sanitizes_out_of_range_ref_indices():
    raw = gemini_payload([gemini_suggestion(desdobramentos=dict(evidence_refs=[0, 99], cross_link_refs=[1, 50]))])
    suggs, _ = engine._parse(raw, make_request(count=1))  # request has 3 references
    assert suggs[0].desdobramentos.evidence_refs == [0]
    assert suggs[0].desdobramentos.cross_link_refs == [1]


# --- generate_suggestions ---------------------------------------------------

def test_generate_returns_forge_response(monkeypatch):
    fake = FakeGemini(gemini_payload([gemini_suggestion(), gemini_suggestion(gap_type="temporal")]))
    monkeypatch.setattr(engine, "_call_gemini", fake)
    resp = engine.generate_suggestions(make_request(count=2))
    assert len(resp.suggestions) == 2
    assert resp.generated_at  # ISO timestamp present
    assert fake.temps == [0.7]  # clean on first try, no retry


def test_generate_retries_on_invariant_violation_then_succeeds(monkeypatch):
    bad = gemini_payload([gemini_suggestion(axes=dict(difficulty="grad", relevance=0.95, innovation=0.95,
                                                      estimated_months_min=12, estimated_months_max=18),
                                            gap_score=0.95)])  # score>=0.73 -> excepcional, but grad -> I-1
    good = gemini_payload([gemini_suggestion()])
    fake = FakeGemini(bad, good)
    monkeypatch.setattr(engine, "_call_gemini", fake)
    resp = engine.generate_suggestions(make_request(count=1))
    assert fake.temps == [0.7, 0.5]  # retried once with lower temperature
    assert resp.gemini_overconfidence_count == 0  # good response needed no calibration


def test_generate_downgrades_after_exhausting_retries(monkeypatch):
    bad = gemini_payload([gemini_suggestion(axes=dict(difficulty="grad", relevance=0.95, innovation=0.95,
                                                      estimated_months_min=12, estimated_months_max=18),
                                            gap_score=0.95)])
    fake = FakeGemini(bad)  # always overconfident
    monkeypatch.setattr(engine, "_call_gemini", fake)
    resp = engine.generate_suggestions(make_request(count=1))
    assert fake.temps == [0.7, 0.5, 0.3]  # all three attempts
    assert resp.gemini_overconfidence_count >= 1
    assert resp.suggestions[0].quality_tier == "muito_bom"  # grad excepcional cascades down


def test_generate_raises_on_persistently_malformed_output(monkeypatch):
    fake = FakeGemini("not json at all {{{")
    monkeypatch.setattr(engine, "_call_gemini", fake)
    with pytest.raises(ValueError):
        engine.generate_suggestions(make_request(count=1))


# --- fixtures (engine_spec.md §6) -------------------------------------------

def test_sample_request_fixture_is_a_valid_forge_request():
    data = json.loads((FIXTURES / "sample_request.json").read_text())
    req = ForgeRequest(**data)
    assert req.count == 3
    assert len(req.references) == 3


def test_malformed_fixture_makes_extract_json_raise():
    raw = json.loads((FIXTURES / "malformed_gemini_output.json").read_text())["raw"]
    with pytest.raises(ValueError):
        engine._extract_json(raw)


def test_overconfident_fixture_is_downgraded(monkeypatch):
    fake = FakeGemini((FIXTURES / "overconfident_response.json").read_text())
    monkeypatch.setattr(engine, "_call_gemini", fake)
    resp = engine.generate_suggestions(make_request(count=1))
    assert resp.suggestions[0].quality_tier == "muito_bom"  # grad excepcional cascades down
    assert resp.gemini_overconfidence_count >= 1


# --- live-Gemini wiring (no key / fake model) -------------------------------

def test_get_model_raises_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.setattr(engine, "_model", None)
    with pytest.raises(RuntimeError):
        engine._get_model()


def test_call_gemini_passes_temperature_to_model(monkeypatch):
    captured = {}

    class FakeResp:
        text = '{"suggestions": [], "coverage_summary": "x"}'

    class FakeModel:
        def generate_content(self, contents, generation_config=None):
            captured["temp"] = generation_config.temperature
            return FakeResp()

    monkeypatch.setattr(engine, "_get_model", lambda: FakeModel())
    out = engine._call_gemini("sys", "usr", 0.42)
    assert "suggestions" in out
    assert captured["temp"] == 0.42
