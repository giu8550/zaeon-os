"""Core forging logic: Gemini call + JSON parse + deterministic scoring + retry.

The Gemini call is isolated in `_call_gemini` so tests mock it without a key.
Per engine_spec.md §5: up to 3 attempts at decreasing temperature; the tier is
always recomputed by the classifier (overrides the LLM); after retries are
exhausted, surviving inconsistencies are downgraded deterministically.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone

import google.generativeai as genai
from pydantic import ValidationError

import classifier
from models import ForgeRequest, ForgeResponse, Suggestion, SuggestionAxes
from prompts import build_system_prompt, build_user_message

_MODEL_NAME = "gemini-2.0-flash"
_model: genai.GenerativeModel | None = None

# Decreasing temperature per attempt (engine_spec.md §5).
TEMPERATURES = (0.7, 0.5, 0.3)
# Violations that justify a re-prompt (vs. those fixed deterministically / structurally).
RETRIABLE = {"I-1", "I-2", "I-3", "I-5", "I-6", "I-9"}


def _get_model() -> genai.GenerativeModel:
    global _model
    if _model is None:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY env var not set")
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel(_MODEL_NAME)
    return _model


def _call_gemini(system_prompt: str, user_message: str, temperature: float) -> str:
    model = _get_model()
    response = model.generate_content(
        [{"role": "user", "parts": [system_prompt + "\n\n" + user_message]}],
        generation_config=genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=8192,
        ),
    )
    return response.text


def _extract_json(raw: str) -> dict:
    """Strip markdown fences and parse JSON. Raises ValueError on malformed output."""
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"Gemini returned invalid JSON: {e}\nRaw: {raw[:400]}")
    if not isinstance(data, dict):
        raise ValueError("Gemini output is not a JSON object")
    return data


def _coverage(data: dict) -> str:
    summary = (data.get("coverage_summary") or "").strip()
    if len(summary) < 20:
        summary = "Forja concluída; resumo de cobertura indisponível nesta geração."
    return summary[:600]


def _parse(raw: str, request: ForgeRequest) -> tuple[list[Suggestion], str]:
    """Parse raw Gemini output into validated, tier-overridden Suggestions.

    Raises ValueError on structurally invalid output (caught by the retry loop).
    """
    data = _extract_json(raw)
    raw_suggestions = data.get("suggestions")
    if not isinstance(raw_suggestions, list) or not raw_suggestions:
        raise ValueError("Gemini returned no suggestions")

    n_refs = len(request.references)
    out: list[Suggestion] = []
    for sd in raw_suggestions:
        if not isinstance(sd, dict):
            raise ValueError("suggestion entry is not an object")
        classifier.sanitize_ref_indices(sd, n_refs)  # I-8
        try:
            axes = SuggestionAxes(**sd["axes"])
            sd["id"] = sd.get("id") or str(uuid.uuid4())
            # quality_tier is server-owned — always recompute, overriding the LLM.
            sd["quality_tier"] = classifier.compute_tier(axes, float(sd.get("gap_score", 0.0)))
            out.append(Suggestion(**sd))
        except (KeyError, TypeError, ValueError, ValidationError) as e:
            raise ValueError(f"invalid suggestion: {e}")

    # I-10: drop near-duplicates of excluded titles (never drop the whole set).
    if request.exclude_titles:
        kept = [
            s for s in out
            if not any(
                classifier.levenshtein_ratio(s.title.lower(), ex.lower()) <= 0.15
                for ex in request.exclude_titles
            )
        ]
        out = kept or out

    return out, _coverage(data)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def generate_suggestions(request: ForgeRequest) -> ForgeResponse:
    min_gap_types = min(request.count, 3)
    system_prompt = build_system_prompt(request.language, request.count, min_gap_types)
    user_message = build_user_message(request)

    suggestions: list[Suggestion] | None = None
    coverage = ""
    last_error: Exception | None = None

    for attempt, temperature in enumerate(TEMPERATURES):
        raw = _call_gemini(system_prompt, user_message, temperature)
        try:
            suggestions, coverage = _parse(raw, request)
        except ValueError as e:
            last_error = e
            suggestions = None
            if attempt == len(TEMPERATURES) - 1:
                raise
            continue

        violations: set[str] = set()
        for s in suggestions:
            violations |= {v for v in classifier.suggestion_violations(s, len(request.references)) if v in RETRIABLE}
        violations |= {v for v in classifier.set_violations(suggestions, request) if v in RETRIABLE}

        if not violations:
            break  # clean — stop retrying

    if suggestions is None:  # pragma: no cover - defensive
        raise last_error or ValueError("forge produced no suggestions")

    # Deterministic calibration of whatever the LLM never fixed (I-1/I-2/I-3).
    final: list[Suggestion] = []
    overconfidence = 0
    for s in suggestions:
        fixed = classifier.downgrade_to_consistent_tier(s)
        if fixed.quality_tier != s.quality_tier:
            overconfidence += 1
        final.append(fixed)

    return ForgeResponse(
        suggestions=final,
        coverage_summary=coverage,
        generated_at=_now_iso(),
        gemini_overconfidence_count=overconfidence,
    )
