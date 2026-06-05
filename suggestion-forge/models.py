"""Pydantic v2 contract for the Suggestion Forge engine.

Authoritative source: suggestion-forge/engine_spec.md §2 (the closed OpenAPI 3.1
contract). Where the master prompt's sketch and the engine_spec disagree on
bounds, the engine_spec wins.
"""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

# --- enums (canonical vocabularies) ----------------------------------------

AcademicLevel = Literal["grad", "msc", "phd", "postdoc"]
QualityTier = Literal["regular", "muito_bom", "excelente", "excepcional"]
# vocabulário canônico extraído de research-engine/prompts.py (FASE 1)
GapType = Literal["empirica", "metodologica", "geografica", "temporal", "interdisciplinar"]
Language = Literal["pt-BR", "en"]

# --- constrained item aliases for list members -----------------------------

Str200 = Annotated[str, StringConstraints(max_length=200)]
Str160 = Annotated[str, StringConstraints(max_length=160)]
NonNegInt = Annotated[int, Field(ge=0)]

_DOI_PATTERN = r"^10\.\d{4,}/.+$"


# --- request ---------------------------------------------------------------

class IncomingRef(BaseModel):
    title: str = Field(..., min_length=3, max_length=400)
    authors: str = Field(..., min_length=2, max_length=600)
    year: str = Field(..., pattern=r"^\d{4}$")
    venue: str = Field(..., min_length=2, max_length=200)
    doi: str | None = None
    # opcional — quando presente, melhora qualidade da forja em ~25%
    abstract: str | None = Field(default=None, max_length=4000)

    @field_validator("doi")
    @classmethod
    def doi_shape(cls, v: str | None) -> str | None:
        if v is None:
            return None
        import re

        if not re.match(_DOI_PATTERN, v):
            raise ValueError(f"doi must match {_DOI_PATTERN}")
        return v


class ForgeRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500)
    user_level: AcademicLevel  # calibra apresentação, NÃO trava propostas
    references: list[IncomingRef] = Field(..., min_length=3, max_length=40)
    count: int = Field(default=5, ge=1, le=10)
    exclude_titles: list[Annotated[str, StringConstraints(max_length=300)]] = Field(
        default_factory=list
    )
    language: Language = "pt-BR"

    @field_validator("topic")
    @classmethod
    def topic_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < 2:
            raise ValueError("topic must have at least 2 non-whitespace characters")
        return stripped


# --- suggestion sub-objects -------------------------------------------------

class SuggestionAxes(BaseModel):
    difficulty: AcademicLevel  # ancorada no esforço REAL, não no nível do usuário
    relevance: float = Field(..., ge=0.0, le=1.0)
    innovation: float = Field(..., ge=0.0, le=1.0)
    estimated_months_min: int = Field(..., ge=1, le=120)
    estimated_months_max: int = Field(..., ge=1, le=120)

    @field_validator("estimated_months_max")
    @classmethod
    def max_ge_min(cls, v: int, info) -> int:
        lo = info.data.get("estimated_months_min")
        if lo is not None and v < lo:
            raise ValueError("estimated_months_max must be >= estimated_months_min")
        return v


class SuggestionDesdobramento(BaseModel):
    """Tudo que se desdobra ao iniciar essa pesquisa."""

    publication_targets: list[Str200] = Field(..., min_length=1, max_length=6)
    required_methods: list[Str160] = Field(..., min_length=1, max_length=10)
    material_resources: list[Str200] = Field(..., min_length=0, max_length=10)
    prerequisites: list[Str160] = Field(..., min_length=0, max_length=8)
    risks: list[Str200] = Field(..., min_length=1, max_length=8)
    milestones: list[Str200] = Field(..., min_length=3, max_length=12)
    evidence_refs: list[NonNegInt] = Field(..., min_length=1)
    cross_link_refs: list[NonNegInt] = Field(..., min_length=0)


class Suggestion(BaseModel):
    id: str  # uuid4 gerado pelo engine
    title: str = Field(..., min_length=8, max_length=180)
    rationale: str = Field(..., min_length=20, max_length=400)
    novelty_angle: str = Field(..., min_length=8, max_length=140)
    gap_type: GapType
    gap_score: float = Field(..., ge=0.0, le=1.0)
    axes: SuggestionAxes
    quality_tier: QualityTier  # derivado determinístico — NÃO confiar só no LLM
    desdobramentos: SuggestionDesdobramento


# --- response ---------------------------------------------------------------

class ForgeResponse(BaseModel):
    suggestions: list[Suggestion] = Field(..., min_length=1, max_length=10)
    coverage_summary: str = Field(..., min_length=20, max_length=600)
    generated_at: str  # ISO 8601 date-time
    gemini_overconfidence_count: int = Field(default=0, ge=0)


class ErrorBody(BaseModel):
    detail: str
