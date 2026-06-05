"""Orquestração do score: parágrafo → seção → documento.

Combina sub-scores normalizados (shaping de bandas) com regras estruturais
conscientes do gênero (CARS de Swales na introdução, limitações na conclusão,
citações no referencial), produz bandas explicáveis e uma leitura de "nível"
alinhada à taxonomia Exploratória→Pioneira Ultra.
"""
from statistics import mean

from models import (
    ScoreRequest, ScoreResponse, SectionIn, SectionScore, ParagraphScore,
    TitleScore, OverallScore,
)
from segmentation import split_paragraphs, tokenize, content_tokens
from bands import monotonic_up, score_to_band, BAND_DESCRIPTIONS
from lexicons import (
    CARS_GAP, CARS_PURPOSE, CONCLUSION_LIMITS, TITLE_METHOD_CUES, TITLE_VAGUE,
)
from metrics.native import paragraph_flags
import providers

ENGINE_VERSION = "0.1.0"

# Faixa-ótima de legibilidade (Flesch-BR) por nível: texto acadêmico bom é
# legitimamente "difícil". Níveis mais altos toleram texto mais denso; acima de
# ~54 o texto começa a soar simplista. Densidade NÃO é punida com força — um
# trabalho excepcional costuma ser denso, citado e sofisticado.
_READABILITY_LO = {"grad": 22.0, "msc": 18.0, "phd": 14.0, "postdoc": 12.0}
_READABILITY_HI = 54.0

# Pesos por tipo de seção (readability, diversity, syntax, cohesion, evidence).
# Evidência/diversidade/coesão pesam mais — marcam qualidade real; legibilidade
# é um modulador, não um juiz dominante.
_SECTION_WEIGHTS = {
    "introducao":      dict(readability=.15, diversity=.18, syntax=.17, cohesion=.27, evidence=.23),
    "desenvolvimento": dict(readability=.15, diversity=.20, syntax=.18, cohesion=.24, evidence=.23),
    "conclusao":       dict(readability=.18, diversity=.18, syntax=.17, cohesion=.30, evidence=.17),
    "referencias":     dict(readability=.10, diversity=.15, syntax=.10, cohesion=.15, evidence=.50),
    "custom":          dict(readability=.16, diversity=.20, syntax=.19, cohesion=.25, evidence=.20),
}
_DEFAULT_WEIGHTS = _SECTION_WEIGHTS["desenvolvimento"]

# Quanto a seção "espera" citações (gating do sub-score de evidência).
_EVIDENCE_EXPECTED = {
    "introducao": .4, "desenvolvimento": .6, "conclusao": .2, "referencias": 1.0, "custom": .5,
}

_LABELS = {
    "readability": "legibilidade", "diversity": "vocabulário", "syntax": "estrutura frasal",
    "cohesion": "coesão", "evidence": "evidência/citação",
}


def _readability_reward(flesch: float, level: str) -> float:
    """Plateau: 1.0 na faixa acadêmica saudável; decai SUAVE no denso (não pune
    sofisticação) e mais firme no 'fácil demais' (simplista)."""
    lo = _READABILITY_LO.get(level, 22.0)
    hi = _READABILITY_HI
    if lo <= flesch <= hi:
        return 1.0
    if flesch < lo:
        return max(0.55, 1.0 - (lo - flesch) / 70.0)
    return max(0.30, 1.0 - (flesch - hi) / 45.0)


def _length_reward(msl: float) -> float:
    """Plateau de comprimento de frase: 13-30 palavras é saudável. Picotado
    (<13) penaliza mais; longo (>30) penaliza suave."""
    if 13.0 <= msl <= 30.0:
        return 1.0
    if msl < 13.0:
        return max(0.25, msl / 13.0)
    return max(0.45, 1.0 - (msl - 30.0) / 40.0)


def _subscores(feat: dict, section_type: str, level: str) -> dict:
    readability = _readability_reward(feat["flesch"], level)
    diversity = monotonic_up(feat["diversity"], 55.0, 88.0)
    length = _length_reward(feat["msl"])
    clauses = monotonic_up(feat["clauses"], 1.0, 3.2)  # subordinação premia
    burst = monotonic_up(feat["cv"], 0.12, 0.5)
    syntax = 0.45 * length + 0.30 * clauses + 0.25 * burst
    # Coesão por conectivos (independe de repetição) + sobreposição lexical.
    # Inclinada a conectivos para não punir prosa de vocabulário rico.
    cohesion = (0.6 * monotonic_up(feat["connective"], 0.12, 1.0)
                + 0.4 * monotonic_up(feat["overlap"], 0.03, 0.18))
    expected = _EVIDENCE_EXPECTED.get(section_type, .5)
    evidence = max(monotonic_up(feat["citation"], 0.0, 3.0), 1.0 - expected)
    return dict(readability=readability, diversity=diversity, syntax=syntax,
                cohesion=cohesion, evidence=evidence)


def _composite(sub: dict, weights: dict) -> float:
    return sum(sub[k] * weights[k] for k in weights)


def _structure_adjust(text: str, section_type: str) -> tuple:
    low = " " + text.lower() + " "
    bonus = 0.0
    notes = []
    if section_type == "introducao":
        if any(c in low for c in CARS_GAP):
            bonus += 6.0
        else:
            bonus -= 6.0
            notes.append("introdução sem lacuna explícita (CARS Move 2)")
        if any(c in low for c in CARS_PURPOSE):
            bonus += 6.0
        else:
            bonus -= 5.0
            notes.append("introdução sem objetivo explícito (CARS Move 3)")
    elif section_type == "conclusao":
        if any(c in low for c in CONCLUSION_LIMITS):
            bonus += 5.0
        else:
            notes.append("conclusão sem limitações/trabalhos futuros")
    return bonus, notes


def _rationale(sub: dict, struct_notes: list) -> tuple:
    strengths, gaps = [], list(struct_notes)
    for k, v in sub.items():
        if v >= 0.75:
            strengths.append(_LABELS[k])
        elif v < 0.40:
            gaps.append("pouca " + _LABELS[k] if k != "evidence" else "falta de evidência/citação")
    return strengths, gaps


def score_paragraph_text(text, section_type="desenvolvimento", level="grad", idx=0, feat=None):
    feat = feat if feat is not None else providers.get_features(text, section_type)
    sub = _subscores(feat, section_type, level)
    weights = _SECTION_WEIGHTS.get(section_type, _DEFAULT_WEIGHTS)
    base = _composite(sub, weights) * 100.0
    adj, struct_notes = _structure_adjust(text, section_type)
    score = max(0.0, min(100.0, base + adj))
    band = score_to_band(score)
    strengths, gaps = _rationale(sub, struct_notes)
    metrics = {k: round(float(v), 3) for k, v in feat.items() if k != "provider"}
    return ParagraphScore(
        idx=idx, section_type=section_type, band=band, score=round(score, 1),
        rationale=BAND_DESCRIPTIONS[band], strengths=strengths, gaps=gaps,
        flags=paragraph_flags(text), metrics=metrics,
    )


def _section_structure_flags(section: SectionIn, paragraphs: list) -> list:
    text = (section.content + " " + " ".join(s.content for s in section.subsections)).lower()
    flags = []
    if not paragraphs:
        flags.append("seção vazia")
        return flags
    if section.type == "introducao":
        if not any(c in text for c in CARS_GAP):
            flags.append("sem lacuna de pesquisa")
        if not any(c in text for c in CARS_PURPOSE):
            flags.append("sem objetivo declarado")
    if section.type == "referencias" and "(" not in text and "[" not in text:
        flags.append("referências sem citações reconhecíveis")
    if section.type == "conclusao" and not any(c in text for c in CONCLUSION_LIMITS):
        flags.append("sem limitações/trabalhos futuros")
    return flags


def score_section(section: SectionIn, level="grad") -> SectionScore:
    paras = split_paragraphs(section.content)
    for sub in section.subsections:
        paras += split_paragraphs(sub.content)
    pscores = [score_paragraph_text(p, section.type, level, idx=i) for i, p in enumerate(paras)]
    if pscores:
        weights = [max(1, len(tokenize(p))) for p in paras]
        sec_score = sum(ps.score * w for ps, w in zip(pscores, weights)) / sum(weights)
    else:
        sec_score = 0.0
    structure_flags = _section_structure_flags(section, paras)
    sec_score = max(0.0, sec_score - 4.0 * len(structure_flags))
    band = score_to_band(sec_score)
    return SectionScore(
        type=section.type, title=section.title, band=band, score=round(sec_score, 1),
        structure_flags=structure_flags, rationale=BAND_DESCRIPTIONS[band], paragraphs=pscores,
    )


def title_specificity(title: str) -> tuple:
    low = title.lower().strip()
    notes = []
    n = len(content_tokens(title))
    score = 0.15  # baseline
    score += monotonic_up(n, 2, 8) * 0.40
    if any(c in low for c in TITLE_METHOD_CUES):
        score += 0.30
    else:
        notes.append("título sem indicação de método/abordagem")
    if ":" in title:
        score += 0.15
    if any(v in low for v in TITLE_VAGUE):
        score -= 0.30
        notes.append("título genérico/vago")
    return max(0.0, min(1.0, score)), notes


def _level_read(overall_score, title_spec, has_method, cited_paragraphs) -> str:
    if title_spec < 0.25 or overall_score < 45:
        return "Exploratória (TCC)"
    if overall_score < 62:
        return "Experimental" if has_method else "Exploratória (TCC)"
    if overall_score < 78:
        return "Pioneira" if cited_paragraphs >= 3 else "Experimental"
    return "Pioneira Ultra" if (cited_paragraphs >= 5 and title_spec >= 0.6) else "Pioneira"


def _doc_rationale(sections: list) -> tuple:
    strengths, gaps = [], []
    for s in sections:
        if s.band in ("muito_bom", "excepcional"):
            strengths.append(f"{s.title or s.type}: {s.band.replace('_', ' ')}")
        elif s.band in ("ruim", "aceitavel"):
            gaps.append(f"{s.title or s.type}: {s.band}")
        for f in s.structure_flags:
            gaps.append(f"{s.title or s.type} — {f}")
    return strengths[:5], gaps[:6]


def score_document(req: ScoreRequest) -> ScoreResponse:
    level = req.academic_level
    sections = [score_section(s, level) for s in req.sections]

    tspec, tnotes = title_specificity(req.title)
    title_score = TitleScore(band=score_to_band(tspec * 100.0), specificity=round(tspec, 3), notes=tnotes)

    if sections:
        weights = [max(1, len(s.paragraphs)) for s in sections]
        overall_raw = sum(s.score * w for s, w in zip(sections, weights)) / sum(weights)
    else:
        overall_raw = 0.0

    present = {s.type for s in sections}
    completeness = len(present & {"introducao", "desenvolvimento", "conclusao", "referencias"}) / 4.0
    overall_score = overall_raw * 0.9 + completeness * 10.0
    if tspec < 0.2:
        overall_score = min(overall_score, 70.0)
    overall_score = max(0.0, min(100.0, overall_score))

    cited_paragraphs = sum(
        1 for s in sections for p in s.paragraphs if p.metrics.get("citation", 0) > 0
    )
    has_method = any("metodolog" in (s.title or "").lower() for s in sections) or \
        any(c in req.title.lower() for c in TITLE_METHOD_CUES)
    level_read = _level_read(overall_score, tspec, has_method, cited_paragraphs)

    strengths, gaps = _doc_rationale(sections)
    band = score_to_band(overall_score)
    overall = OverallScore(
        band=band, score=round(overall_score, 1), level_read=level_read,
        rationale=BAND_DESCRIPTIONS[band], strengths=strengths, gaps=gaps,
    )
    return ScoreResponse(
        overall=overall, title=title_score, sections=sections,
        meta={"provider": providers.active_provider(), "engine_version": ENGINE_VERSION},
    )
