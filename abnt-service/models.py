from pydantic import BaseModel, Field
from typing import List, Optional


class SubsectionData(BaseModel):
    title: str
    content: str


class SectionData(BaseModel):
    type: str  # "introducao" | "desenvolvimento" | "conclusao" | "custom"
    title: str
    content: str
    subsections: List[SubsectionData] = []


class ReferenceData(BaseModel):
    text: str  # já formatada em ABNT NBR 6023:2018 pelo agente Scholar


class CoverData(BaseModel):
    author: str
    institution: str
    course: str
    advisor: Optional[str] = None
    city: str
    year: str


class ValidationData(BaseModel):
    has_introduction: bool = False
    has_conclusion: bool = False
    has_references: bool = False
    warnings: List[str] = []


class DocumentPayload(BaseModel):
    title: str
    work_type: str = Field(..., description="Artigo | TCC | Relatório")
    cover: CoverData
    resumo: str
    palavras_chave: List[str] = Field(..., min_length=1)
    sections: List[SectionData]
    references: List[ReferenceData] = []
    validation: Optional[ValidationData] = None
    format: str = Field(..., description="pdf | docx")
    font_choice: str = Field(default="Times New Roman", description="Times New Roman | Arial")
