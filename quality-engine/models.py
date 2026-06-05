"""Modelos Pydantic v2 do contrato do quality-engine.

Bandas em snake_case (`muito_bom`) para casar 1:1 com o cliente TypeScript.
Compatível com Python 3.9 (sem PEP 604 `X | None`; usa `Optional`).
"""
from typing import Optional
from pydantic import BaseModel, Field
from typing import Literal

WorkType = Literal["Artigo", "Relatório", "TCC"]
AcademicLevel = Literal["grad", "msc", "phd", "postdoc"]
Band = Literal["ruim", "aceitavel", "bom", "muito_bom", "excepcional"]


class SubsectionIn(BaseModel):
    title: str = ""
    content: str = ""


class SectionIn(BaseModel):
    type: str
    title: str = ""
    content: str = ""
    subsections: list[SubsectionIn] = Field(default_factory=list)


class ScoreRequest(BaseModel):
    title: str = ""
    work_type: WorkType = "TCC"
    academic_level: AcademicLevel = "grad"
    sections: list[SectionIn] = Field(default_factory=list)


class ParagraphScore(BaseModel):
    idx: int
    section_type: str
    band: Band
    score: float  # 0-100
    rationale: str = ""
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)
    metrics: dict[str, float] = Field(default_factory=dict)


class SectionScore(BaseModel):
    type: str
    title: str = ""
    band: Band
    score: float
    structure_flags: list[str] = Field(default_factory=list)
    rationale: str = ""
    paragraphs: list[ParagraphScore] = Field(default_factory=list)


class TitleScore(BaseModel):
    band: Band
    specificity: float
    notes: list[str] = Field(default_factory=list)


class OverallScore(BaseModel):
    band: Band
    score: float
    level_read: str  # "Exploratória (TCC)" ... "Pioneira Ultra"
    rationale: str = ""
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)


class ScoreResponse(BaseModel):
    overall: OverallScore
    title: TitleScore
    sections: list[SectionScore] = Field(default_factory=list)
    meta: dict = Field(default_factory=dict)


class ParagraphRequest(BaseModel):
    """Entrada do endpoint rápido /score/paragraph (trilha ao vivo)."""
    text: str
    section_type: str = "desenvolvimento"
    academic_level: AcademicLevel = "grad"
