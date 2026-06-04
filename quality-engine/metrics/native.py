"""Métricas nativas (Python puro) para qualidade textual PT-BR.

Sempre disponíveis (sem modelos pesados), servem de fallback e do caminho
"rápido" para a trilha ao vivo. NILC-Metrix, quando configurado, sobrepõe
as métricas que cobre (ver providers.py).

Referências: Flesch adaptado p/ PT (Martins et al. 1996); MTLD (McCarthy &
Jarvis 2010); densidade de conectivos (Coh-Metrix-Port); citação ABNT NBR 10520.
"""
import re
from statistics import mean, pstdev

from lexical_diversity import lex_div as ld

from segmentation import split_sentences, tokenize, content_tokens, count_syllables
from lexicons import ALL_CONNECTIVES, AI_FINGERPRINT, NOMINALIZATION_SUFFIXES

_CITATION_PATTERNS = [
    re.compile(r"\([A-ZÀ-Ý][A-ZÀ-Ýa-zà-ÿ]+(?:\s+et\s+al\.)?,?\s*\d{4}[a-z]?\)"),  # (SILVA, 2020)
    re.compile(r"\b[A-ZÀ-Ý][a-zà-ÿ]+\s*\(\d{4}[a-z]?\)"),                          # Souza (2019)
    re.compile(r"\[\d{1,3}\]"),                                                      # [12]
]

# Marcadores aproximados de fronteira de oração (proxy de complexidade).
_CLAUSE_MARKERS = frozenset({
    "que", "porque", "quando", "onde", "se", "pois", "mas", "ou", "como", "embora",
    "enquanto", "cujo", "cuja", "cujos", "cujas", "qual", "quais", "contudo", "porém",
    "todavia", "entretanto", "caso", "conforme", "uma vez que",
})


def flesch_br(text: str) -> float:
    """Índice de Legibilidade de Flesch adaptado ao PT (Martins et al. 1996).

    ILF = 248.835 - 1.015*(palavras/frase) - 84.6*(sílabas/palavra)
    Mais alto = mais fácil de ler.
    """
    sents = split_sentences(text)
    words = tokenize(text)
    if not sents or not words:
        return 0.0
    asl = len(words) / len(sents)
    asw = count_syllables(text) / len(words)
    return 248.835 - 1.015 * asl - 84.6 * asw


def lexical_diversity_score(text: str) -> float:
    """Diversidade lexical robusta a tamanho — MATTR escalado a 0-100.

    MATTR (moving-average TTR; McCarthy & Jarvis 2010) é estável mesmo em
    parágrafos curtos, ao contrário do MTLD puro, que degenera (retorna ~0)
    abaixo de ~50 tokens. Mantém a mesma intenção do MTLD (riqueza lexical
    independente do comprimento) sem punir parágrafos curtos e bons.
    """
    toks = tokenize(text)
    n = len(toks)
    if n < 3:
        return 0.0
    try:
        mattr = float(ld.mattr(toks, window_length=min(n, 50)))
    except Exception:
        mattr = len(set(toks)) / n
    return mattr * 100.0


def mean_sentence_length(text: str) -> float:
    sents = split_sentences(text)
    if not sents:
        return 0.0
    return mean(len(tokenize(s)) for s in sents)


def sentence_length_cv(text: str) -> float:
    """Coeficiente de variação do comprimento de frase (burstiness)."""
    sents = split_sentences(text)
    lens = [len(tokenize(s)) for s in sents]
    if len(lens) < 2 or mean(lens) == 0:
        return 0.0
    return pstdev(lens) / mean(lens)


def clauses_per_sentence(text: str) -> float:
    sents = split_sentences(text)
    if not sents:
        return 0.0
    counts = []
    for s in sents:
        toks = tokenize(s)
        markers = sum(1 for t in toks if t in _CLAUSE_MARKERS)
        commas = s.count(",") + s.count(";") + s.count(":")
        counts.append(1 + min(markers + commas, 8))
    return mean(counts)


def connective_density(text: str) -> float:
    low = " " + text.lower() + " "
    hits = sum(low.count(" " + c + " ") + low.count(" " + c + ",") for c in ALL_CONNECTIVES)
    sents = max(1, len(split_sentences(text)))
    return hits / sents


def lexical_overlap(text: str) -> float:
    """Sobreposição lexical de conteúdo (Jaccard) média entre frases adjacentes."""
    sents = split_sentences(text)
    if len(sents) < 2:
        return 0.0
    sets = [set(content_tokens(s)) for s in sents]
    scores = []
    for a, b in zip(sets, sets[1:]):
        if a and b:
            scores.append(len(a & b) / len(a | b))
    return mean(scores) if scores else 0.0


def citation_density(text: str) -> float:
    """Citações ABNT por 100 palavras."""
    words = max(1, len(tokenize(text)))
    hits = sum(len(p.findall(text)) for p in _CITATION_PATTERNS)
    return 100.0 * hits / words


# ── Canal de FLAGS (não entra na nota) ──────────────────────────────────────

def nominalization_rate(text: str) -> float:
    toks = content_tokens(text)
    if not toks:
        return 0.0
    nom = sum(1 for t in toks if t.endswith(NOMINALIZATION_SUFFIXES))
    return nom / len(toks)


def ai_fingerprint_rate(text: str) -> float:
    low = " " + text.lower() + " "
    words = max(1, len(tokenize(text)))
    hits = sum(low.count(" " + w + " ") for w in AI_FINGERPRINT if " " not in w)
    hits += sum(low.count(w) for w in AI_FINGERPRINT if " " in w)
    return 100.0 * hits / words


def paragraph_flags(text: str) -> list[str]:
    flags = []
    if nominalization_rate(text) > 0.28:
        flags.append("nominalizacao_excessiva")
    if ai_fingerprint_rate(text) > 1.5:
        flags.append("lexico_ia")
    if len(split_sentences(text)) >= 3 and sentence_length_cv(text) < 0.20:
        flags.append("uniformidade")
    return flags


def all_metrics(text: str) -> dict:
    """Vetor cru de métricas nativas (chaves estáveis usadas pelo scorer)."""
    return {
        "flesch": flesch_br(text),
        "diversity": lexical_diversity_score(text),
        "msl": mean_sentence_length(text),
        "cv": sentence_length_cv(text),
        "clauses": clauses_per_sentence(text),
        "connective": connective_density(text),
        "overlap": lexical_overlap(text),
        "citation": citation_density(text),
        "nominalization": nominalization_rate(text),
        "ai_fingerprint": ai_fingerprint_rate(text),
    }
