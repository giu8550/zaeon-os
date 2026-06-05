"""Tests for the Pydantic contract (engine_spec.md §2).

The closed contract — not the simplified sketch in the master prompt — is the
source of truth for bounds (title 8-180, rationale 20-400, risks minItems 1, etc.).
"""
import uuid

import pytest
from pydantic import ValidationError

from models import (
    ForgeRequest,
    ForgeResponse,
    IncomingRef,
    Suggestion,
    SuggestionAxes,
    SuggestionDesdobramento,
)


# --- builders for valid nested objects -------------------------------------

def valid_ref(**over):
    base = dict(
        title="In situ Biosynthesis of Bacterial Cellulose Composites",
        authors="Silva, R. et al.",
        year="2023",
        venue="ACS Nano",
    )
    base.update(over)
    return base


def valid_axes(**over):
    base = dict(
        difficulty="phd",
        relevance=0.82,
        innovation=0.81,
        estimated_months_min=30,
        estimated_months_max=42,
    )
    base.update(over)
    return base


def valid_desdobramento(**over):
    base = dict(
        publication_targets=["Qualis A1"],
        required_methods=["voltametria cíclica"],
        material_resources=[],
        prerequisites=[],
        risks=["variabilidade lote-a-lote"],
        milestones=["M1: piloto", "M2: coleta", "M3: submissão"],
        evidence_refs=[0],
        cross_link_refs=[],
    )
    base.update(over)
    return base


def valid_suggestion(**over):
    base = dict(
        id=str(uuid.uuid4()),
        title="Bioeletroquímica de compósitos celulose-grafeno",
        rationale="A literatura documenta a síntese mas não caracteriza o desempenho.",
        novelty_angle="Primeiro estudo a quantificar retenção pós-10k ciclos",
        gap_type="metodologica",
        gap_score=0.78,
        axes=valid_axes(),
        quality_tier="excelente",
        desdobramentos=valid_desdobramento(),
    )
    base.update(over)
    return base


def valid_request(**over):
    base = dict(
        topic="graphene oxide synthesis via bacterial fermentation",
        user_level="phd",
        references=[valid_ref(), valid_ref(title="PETase engineering paper"), valid_ref(title="Mycelium memristor arrays")],
    )
    base.update(over)
    return base


# --- ForgeRequest -----------------------------------------------------------

def test_valid_forge_request_parses():
    req = ForgeRequest(**valid_request())
    assert req.count == 5  # default
    assert req.language == "pt-BR"  # default
    assert req.exclude_titles == []  # default


def test_forge_request_rejects_fewer_than_3_references():
    with pytest.raises(ValidationError):
        ForgeRequest(**valid_request(references=[valid_ref(), valid_ref()]))


def test_forge_request_rejects_count_above_10():
    with pytest.raises(ValidationError):
        ForgeRequest(**valid_request(count=11))


def test_forge_request_rejects_blank_topic():
    with pytest.raises(ValidationError):
        ForgeRequest(**valid_request(topic=" "))


# --- IncomingRef ------------------------------------------------------------

def test_incoming_ref_rejects_non_4_digit_year():
    with pytest.raises(ValidationError):
        IncomingRef(**valid_ref(year="20a3"))


def test_incoming_ref_rejects_malformed_doi():
    with pytest.raises(ValidationError):
        IncomingRef(**valid_ref(doi="not-a-doi"))


def test_incoming_ref_accepts_null_doi_and_valid_doi():
    assert IncomingRef(**valid_ref(doi=None)).doi is None
    assert IncomingRef(**valid_ref(doi="10.1021/acsnano.3c01234")).doi.startswith("10.")


# --- SuggestionAxes ---------------------------------------------------------

def test_axes_rejects_max_months_below_min():
    with pytest.raises(ValidationError):
        SuggestionAxes(**valid_axes(estimated_months_min=40, estimated_months_max=20))


def test_axes_rejects_relevance_above_one():
    with pytest.raises(ValidationError):
        SuggestionAxes(**valid_axes(relevance=1.5))


# --- SuggestionDesdobramento ------------------------------------------------

def test_desdobramento_requires_at_least_one_risk():
    with pytest.raises(ValidationError):
        SuggestionDesdobramento(**valid_desdobramento(risks=[]))


def test_desdobramento_requires_three_milestones():
    with pytest.raises(ValidationError):
        SuggestionDesdobramento(**valid_desdobramento(milestones=["só um"]))


# --- Suggestion -------------------------------------------------------------

def test_suggestion_rejects_short_title():
    with pytest.raises(ValidationError):
        Suggestion(**valid_suggestion(title="curto"))  # < 8 chars


def test_suggestion_rejects_gap_score_above_one():
    with pytest.raises(ValidationError):
        Suggestion(**valid_suggestion(gap_score=1.2))


# --- ForgeResponse ----------------------------------------------------------

def test_forge_response_rejects_short_coverage_summary():
    with pytest.raises(ValidationError):
        ForgeResponse(
            suggestions=[Suggestion(**valid_suggestion())],
            coverage_summary="curto",  # < 20 chars
            generated_at="2026-06-05T18:34:12.481Z",
        )


def test_forge_response_valid_parses():
    resp = ForgeResponse(
        suggestions=[Suggestion(**valid_suggestion())],
        coverage_summary="Forjadas propostas cobrindo lacunas metodológicas e temporais.",
        generated_at="2026-06-05T18:34:12.481Z",
        gemini_overconfidence_count=1,
    )
    assert len(resp.suggestions) == 1
    assert resp.gemini_overconfidence_count == 1
