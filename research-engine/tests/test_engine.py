# research-engine/tests/test_engine.py
import pytest
import json
from engine import parse_response, _extract_json
from models import SuggestResponse


VALID_JSON_RAW = json.dumps({
    "suggestion": {
        "type": "Pioneira",
        "title": "Bioacústica e pigmentação em Phalaenopsis amabilis",
        "rationale": "Nenhum estudo cruzou bioacústica com pigmentação em Orchidaceae ornamentais.",
        "novelty_angle": "Primeira interface entre neurociência vegetal e genômica de pigmentação.",
        "gap_score": 0.87,
    },
    "references": [
        {
            "source": "PubMed",
            "title": "Anthocyanin biosynthesis in Phalaenopsis",
            "authors": "Chen, L. et al.",
            "year": "2021",
            "venue": "Scientia Horticulturae",
            "doi": "10.1016/j.scienta.2021.110234",
        }
    ],
    "inline_citation": None,
})

MARKDOWN_WRAPPED = f"```json\n{VALID_JSON_RAW}\n```"

PARTIAL_JSON = '{"suggestion": {"type": "Exploratória", "title": "Título X", "rationale": "R", "novelty_angle": "N", "gap_score": 0.55}, "references": [], "inline_citation": null}'


def test_parse_valid_json():
    result = parse_response(VALID_JSON_RAW)
    assert isinstance(result, SuggestResponse)
    assert result.suggestion.type == "Pioneira"
    assert result.suggestion.gap_score == 0.87
    assert len(result.references) == 1
    assert result.references[0].source == "PubMed"


def test_parse_markdown_wrapped():
    result = parse_response(MARKDOWN_WRAPPED)
    assert result.suggestion.title == "Bioacústica e pigmentação em Phalaenopsis amabilis"


def test_parse_partial_json_no_inline():
    result = parse_response(PARTIAL_JSON)
    assert result.inline_citation is None
    assert result.references == []


def test_parse_invalid_json_raises():
    with pytest.raises(ValueError, match="invalid JSON"):
        parse_response("not json at all {{{")


def test_extract_json_strips_fences():
    raw = "```json\n{\"key\": 1}\n```"
    result = _extract_json(raw)
    assert result == {"key": 1}


def test_extract_json_no_fences():
    raw = '{"key": 2}'
    result = _extract_json(raw)
    assert result == {"key": 2}
