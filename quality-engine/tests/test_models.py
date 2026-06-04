import pytest
from pydantic import ValidationError
from models import ScoreRequest, SectionIn, ParagraphScore


def test_score_request_minimal():
    r = ScoreRequest(
        title="Impacto de X sobre Y",
        sections=[SectionIn(type="introducao", title="INTRODUÇÃO", content="Texto.")],
    )
    assert r.work_type == "TCC"
    assert r.academic_level == "grad"
    assert r.sections[0].subsections == []


def test_section_requires_type():
    with pytest.raises(ValidationError):
        SectionIn(title="X", content="y")  # falta `type`


def test_invalid_work_type_fails():
    with pytest.raises(ValidationError):
        ScoreRequest(title="t", work_type="Tese", sections=[])


def test_paragraph_score_band_literal():
    ps = ParagraphScore(idx=0, section_type="introducao", band="bom", score=70.0)
    assert ps.band == "bom"
    with pytest.raises(ValidationError):
        ParagraphScore(idx=0, section_type="x", band="otimo", score=70.0)
