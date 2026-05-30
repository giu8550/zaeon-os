"""Pydantic v2 data models for the research-engine service."""
from pydantic import BaseModel, Field, field_validator
from typing import Literal

AcademicLevel = Literal["grad", "msc", "phd", "postdoc"]


class SuggestRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500,
                       description="Research topic the student entered")
    level: AcademicLevel = Field(..., description="grad | msc | phd | postdoc")
    exclude_titles: list[str] = Field(
        default_factory=list,
        description="Titles already shown — engine must avoid them on refresh"
    )

    @field_validator("topic")
    @classmethod
    def topic_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < 2:
            raise ValueError("topic must have at least 2 non-whitespace characters")
        return stripped


class RefItem(BaseModel):
    source: Literal["PubMed", "arXiv", "DOI", "Scholar"]
    title: str
    authors: str
    year: str
    venue: str
    doi: str | None = None


class InlineCitation(BaseModel):
    quote: str
    source: Literal["PubMed", "arXiv", "DOI", "Scholar"]
    doi: str | None = None


class SuggestionItem(BaseModel):
    type: Literal["Exploratória", "Experimental", "Pioneira"]
    title: str
    rationale: str
    novelty_angle: str
    gap_score: float = Field(..., ge=0.0, le=1.0)


class SuggestResponse(BaseModel):
    suggestion: SuggestionItem
    references: list[RefItem] = Field(default_factory=list)
    inline_citation: InlineCitation | None = None
