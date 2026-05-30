# research-engine/tests/test_models.py
import pytest
from pydantic import ValidationError
from models import SuggestRequest, SuggestResponse, SuggestionItem, RefItem


def test_suggest_request_valid():
    req = SuggestRequest(topic="orquídeas rosas", level="phd")
    assert req.topic == "orquídeas rosas"
    assert req.exclude_titles == []


def test_suggest_request_empty_topic_fails():
    with pytest.raises(ValidationError):
        SuggestRequest(topic="", level="grad")


def test_suggest_request_invalid_level_fails():
    with pytest.raises(ValidationError):
        SuggestRequest(topic="orquídeas", level="invalid")


def test_suggest_request_exclude_titles():
    req = SuggestRequest(topic="algo", level="msc", exclude_titles=["Título A"])
    assert req.exclude_titles == ["Título A"]


def test_suggest_response_valid():
    resp = SuggestResponse(
        suggestion=SuggestionItem(
            type="Pioneira",
            title="Título pioneiro",
            rationale="Lacuna real identificada.",
            novelty_angle="Nunca cruzado antes.",
            gap_score=0.82,
        ),
        references=[
            RefItem(
                source="PubMed",
                title="Example paper",
                authors="Smith, J. et al.",
                year="2022",
                venue="Nature Plants",
                doi="10.1234/np.2022.01",
            )
        ],
    )
    assert resp.suggestion.type == "Pioneira"
    assert len(resp.references) == 1


def test_gap_score_out_of_range_fails():
    with pytest.raises(ValidationError):
        SuggestionItem(
            type="Exploratória",
            title="T",
            rationale="R",
            novelty_angle="N",
            gap_score=1.5,
        )
