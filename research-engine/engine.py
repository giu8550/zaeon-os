# research-engine/engine.py
"""
Core generation logic.
Isolates the Gemini call so it can be mocked in tests.
"""
import json
import re
import os
from typing import Any

import google.generativeai as genai

from models import SuggestRequest, SuggestResponse, SuggestionItem, RefItem, InlineCitation
from prompts import build_system_prompt, build_user_message

_MODEL_NAME = "gemini-2.0-flash"
_model: genai.GenerativeModel | None = None


def _get_model() -> genai.GenerativeModel:
    global _model
    if _model is None:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY env var not set")
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel(_MODEL_NAME)
    return _model


def _extract_json(raw: str) -> dict[str, Any]:
    """Strip markdown fences and parse JSON from Gemini response."""
    # Remove ```json ... ``` or ``` ... ```
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()
    return json.loads(cleaned)


def parse_response(raw: str) -> SuggestResponse:
    """
    Parse the raw string from Gemini into a validated SuggestResponse.
    Raises ValueError on malformed output.
    """
    try:
        data = _extract_json(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Gemini returned invalid JSON: {e}\nRaw: {raw[:400]}")

    sug_data = data.get("suggestion", {})
    suggestion = SuggestionItem(
        type=sug_data.get("type", "Exploratória"),
        title=sug_data.get("title", ""),
        rationale=sug_data.get("rationale", ""),
        novelty_angle=sug_data.get("novelty_angle", ""),
        gap_score=float(sug_data.get("gap_score", 0.5)),
    )

    references = [
        RefItem(
            source=r.get("source", "DOI"),
            title=r.get("title", ""),
            authors=r.get("authors", ""),
            year=str(r.get("year", "")),
            venue=r.get("venue", ""),
            doi=r.get("doi") or None,
        )
        for r in data.get("references", [])
    ]

    inline_raw = data.get("inline_citation")
    inline = None
    if inline_raw and isinstance(inline_raw, dict):
        inline = InlineCitation(
            quote=inline_raw.get("quote", ""),
            source=inline_raw.get("source", ""),
            doi=inline_raw.get("doi") or None,
        )

    return SuggestResponse(
        suggestion=suggestion,
        references=references,
        inline_citation=inline,
    )


def generate_suggestion(request: SuggestRequest) -> SuggestResponse:
    """
    Call Gemini and return a validated SuggestResponse.
    """
    model = _get_model()
    system_prompt = build_system_prompt(request.level, request.exclude_titles)
    user_message = build_user_message(request.topic)

    response = model.generate_content(
        [
            {"role": "user", "parts": [system_prompt + "\n\n" + user_message]},
        ],
        generation_config=genai.types.GenerationConfig(
            temperature=0.85,
            max_output_tokens=1800,
        ),
    )

    raw = response.text
    return parse_response(raw)
