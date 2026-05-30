# research-engine/models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Literal

AcademicLevel = Literal["grad", "msc", "phd", "postdoc"]


class SuggestRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500,
                       description="Research topic the student entered")
    level: AcademicLevel = Field(..., description="grad | msc | phd | postdoc")
    exclude_titles: List[str] = Field(
        default_factory=list,
        description="Titles already shown — engine must avoid them on refresh"
    )


class RefItem(BaseModel):
    source: Literal["PubMed", "arXiv", "DOI", "Scholar"]
    title: str
    authors: str
    year: str
    venue: str
    doi: Optional[str] = None


class InlineCitation(BaseModel):
    quote: str
    source: str
    doi: Optional[str] = None


class SuggestionItem(BaseModel):
    type: Literal["Exploratória", "Experimental", "Pioneira"]
    title: str
    rationale: str
    novelty_angle: str
    gap_score: float = Field(..., ge=0.0, le=1.0)


class SuggestResponse(BaseModel):
    suggestion: SuggestionItem
    references: List[RefItem] = Field(default_factory=list)
    inline_citation: Optional[InlineCitation] = None
