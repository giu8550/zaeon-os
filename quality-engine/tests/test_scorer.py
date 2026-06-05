from models import ScoreRequest, SectionIn
from scorer import score_document, score_paragraph_text, title_specificity

RUIM = "isso e bom. coisa boa. muito bom mesmo. legal demais isso ai."
BOM = ("A automação de processos reduz custos operacionais (SILVA, 2020). No entanto, sua "
       "adoção exige investimento inicial relevante. Portanto, este trabalho avalia o retorno "
       "financeiro em pequenas empresas do setor têxtil ao longo de doze meses de operação.")


def test_paragraph_ranking_bom_gt_ruim():
    assert score_paragraph_text(BOM, "desenvolvimento").score > \
        score_paragraph_text(RUIM, "desenvolvimento").score


def test_intro_without_cars_loses():
    with_cars = ("Há ampla literatura sobre inteligência artificial na educação. No entanto, "
                 "poucos estudos abordam o ensino fundamental rural. O objetivo deste trabalho "
                 "é investigar esse contexto específico com dados de campo.")
    without = ("A inteligência artificial é muito usada atualmente. Ela aparece em vários "
               "lugares diferentes e é bastante interessante para todos os públicos.")
    assert score_paragraph_text(with_cars, "introducao").score > \
        score_paragraph_text(without, "introducao").score


def test_title_specificity_specific_gt_vague():
    specific = title_specificity("Impacto da automação têxtil no custo: estudo de caso em MPEs")[0]
    vague = title_specificity("Um estudo sobre tecnologia")[0]
    assert specific > vague


def test_band_is_valid_literal():
    ps = score_paragraph_text(BOM, "desenvolvimento")
    assert ps.band in ("ruim", "aceitavel", "bom", "muito_bom", "excepcional")
    assert 0.0 <= ps.score <= 100.0


def test_score_document_shapes_response():
    req = ScoreRequest(
        title="Impacto da automação no setor têxtil: um estudo de caso",
        sections=[
            SectionIn(type="introducao", title="INTRODUÇÃO", content=BOM),
            SectionIn(type="desenvolvimento", title="METODOLOGIA", content=BOM),
        ],
    )
    resp = score_document(req)
    assert resp.overall.band in ("ruim", "aceitavel", "bom", "muito_bom", "excepcional")
    assert len(resp.sections) == 2
    assert resp.sections[0].paragraphs
    assert resp.overall.level_read
    assert resp.meta["engine_version"]


def test_flags_do_not_inflate_score():
    # Parágrafo com fingerprint de IA não deve virar "excepcional" só por isso.
    ai = ("É crucial ressaltar o robusto e abrangente panorama. Vale ressaltar o "
          "multifacetado e primordial cenário. Em suma, navegar é fundamental.")
    ps = score_paragraph_text(ai, "desenvolvimento")
    assert ps.band != "excepcional"
