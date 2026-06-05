"""Shared builders for valid model instances (not collected as tests)."""
import uuid

from models import (
    ForgeRequest,
    IncomingRef,
    Suggestion,
    SuggestionAxes,
    SuggestionDesdobramento,
)


def make_axes(**over) -> SuggestionAxes:
    base = dict(
        difficulty="phd",
        relevance=0.82,
        innovation=0.81,
        estimated_months_min=30,
        estimated_months_max=42,
    )
    base.update(over)
    return SuggestionAxes(**base)


def make_desdobramento(**over) -> SuggestionDesdobramento:
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
    return SuggestionDesdobramento(**base)


def make_suggestion(**over) -> Suggestion:
    base = dict(
        id=str(uuid.uuid4()),
        title="Proposta de pesquisa válida e suficientemente longa",
        rationale="Justificativa com mais de vinte caracteres para passar no contrato.",
        novelty_angle="Ângulo de novidade claro",
        gap_type="metodologica",
        gap_score=0.78,
        axes=make_axes(),
        quality_tier="excelente",
        desdobramentos=make_desdobramento(),
    )
    base.update(over)
    return Suggestion(**base)


def make_ref(**over) -> IncomingRef:
    base = dict(title="Some valid paper title", authors="Silva, R.", year="2023", venue="Nature")
    base.update(over)
    return IncomingRef(**base)


def make_request(**over) -> ForgeRequest:
    base = dict(
        topic="graphene oxide synthesis via bacterial fermentation",
        user_level="phd",
        references=[make_ref(), make_ref(title="Paper two title"), make_ref(title="Paper three title")],
    )
    base.update(over)
    return ForgeRequest(**base)
