"""Deterministic scoring + invariant enforcement for the Suggestion Forge.

The LLM proposes axis values; this module is the source of truth for the
`quality_tier` and the I-1..I-10 invariants (engine_spec.md §4). Pure Python,
no network — fully testable without Gemini.

Thresholds recalibrated per ADR-001 Decision 5: the original 0.85/0.70/0.55
cut-points were inconsistent with the spec's own target distribution. Weights
are unchanged; only the cut-points moved to 0.45/0.60/0.73.
"""
from __future__ import annotations

import random
from collections import Counter

from models import ForgeRequest, QualityTier, Suggestion, SuggestionAxes

# Composição auditável — pesos inalterados.
DIFFICULTY_WEIGHT = {"grad": 0.25, "msc": 0.5, "phd": 0.75, "postdoc": 1.0}
# Cut-points recalibrados (ADR-001 D5) para reproduzir a distribuição-alvo.
TIER_THRESHOLDS: dict[QualityTier, float] = {
    "excepcional": 0.73,
    "excelente": 0.60,
    "muito_bom": 0.45,
}

_TIERS: tuple[QualityTier, ...] = ("regular", "muito_bom", "excelente", "excepcional")


# --- scoring ----------------------------------------------------------------

def composite_score(axes: SuggestionAxes, gap_score: float) -> float:
    return (
        0.30 * axes.relevance
        + 0.30 * axes.innovation
        + 0.25 * gap_score
        + 0.15 * DIFFICULTY_WEIGHT[axes.difficulty]
    )


def _tier_from_score(score: float) -> QualityTier:
    if score >= TIER_THRESHOLDS["excepcional"]:
        return "excepcional"
    if score >= TIER_THRESHOLDS["excelente"]:
        return "excelente"
    if score >= TIER_THRESHOLDS["muito_bom"]:
        return "muito_bom"
    return "regular"


def compute_tier(axes: SuggestionAxes, gap_score: float) -> QualityTier:
    """Deterministic tier — always recomputed after parse, overrides the LLM."""
    return _tier_from_score(composite_score(axes, gap_score))


# --- per-suggestion invariants (I-1, I-2, I-3, I-5, I-6, I-8) ---------------

def suggestion_violations(sugg: Suggestion, n_references: int) -> list[str]:
    v: list[str] = []
    a = sugg.axes
    t = sugg.quality_tier
    d = sugg.desdobramentos

    # I-1: excepcional ⇒ difficulty ∈ {phd, postdoc} AND innovation ≥ 0.80
    if t == "excepcional" and not (a.difficulty in ("phd", "postdoc") and a.innovation >= 0.80):
        v.append("I-1")
    # I-2: excelente ⇒ difficulty ∈ {msc, phd, postdoc} AND gap_score ≥ 0.65
    if t == "excelente" and not (a.difficulty in ("msc", "phd", "postdoc") and sugg.gap_score >= 0.65):
        v.append("I-2")
    # I-3: regular ⇒ estimated_months_max ≤ 24
    if t == "regular" and a.estimated_months_max > 24:
        v.append("I-3")
    # I-5: (max - min) ≤ 0.6 × max
    if (a.estimated_months_max - a.estimated_months_min) > 0.6 * a.estimated_months_max:
        v.append("I-5")
    # I-6: evidence_refs ≥ 1 when references ≥ 5 (model already guarantees ≥ 1)
    if n_references >= 5 and len(d.evidence_refs) < 1:
        v.append("I-6")
    # I-8: index validity — all evidence/cross-link indices must be < n_references
    if any(i >= n_references for i in d.evidence_refs) or any(i >= n_references for i in d.cross_link_refs):
        v.append("I-8")
    return v


# --- set-level invariants (I-9, I-10) ---------------------------------------

def set_violations(suggestions: list[Suggestion], request: ForgeRequest) -> list[str]:
    v: list[str] = []
    # I-9: count ≥ 3 ⇒ at least 2 distinct gap_types
    if request.count >= 3 and len({s.gap_type for s in suggestions}) < 2:
        v.append("I-9")
    # I-10: no suggestion title may be a near-duplicate (Levenshtein ≤ 0.15) of an excluded title
    for s in suggestions:
        title = s.title.lower()
        if any(levenshtein_ratio(title, ex.lower()) <= 0.15 for ex in request.exclude_titles):
            v.append("I-10")
            break
    return v


# --- I-8 sanitization on the raw parsed dict (pre-validation) ---------------

def sanitize_ref_indices(raw: dict, n_references: int) -> dict:
    """Drop out-of-range ref indices from a raw suggestion dict before validation."""
    d = raw.get("desdobramentos")
    if isinstance(d, dict):
        for key in ("evidence_refs", "cross_link_refs"):
            vals = d.get(key, [])
            d[key] = [i for i in vals if isinstance(i, int) and 0 <= i < n_references]
    return raw


# --- deterministic downgrade after retries exhausted ------------------------

def downgrade_to_consistent_tier(sugg: Suggestion) -> Suggestion:
    """Apply I-1/I-2/I-3 deterministic fixes when the LLM never converged."""
    tier = sugg.quality_tier
    a = sugg.axes

    # I-1
    if tier == "excepcional" and not (a.difficulty in ("phd", "postdoc") and a.innovation >= 0.80):
        tier = "excelente"
    # I-2 (re-check, in case I-1 just downgraded into excelente)
    if tier == "excelente" and not (a.difficulty in ("msc", "phd", "postdoc") and sugg.gap_score >= 0.65):
        tier = "muito_bom"

    updates: dict = {"quality_tier": tier}
    # I-3
    if tier == "regular" and a.estimated_months_max > 24:
        new_min = min(a.estimated_months_min, 24)
        updates["axes"] = a.model_copy(update={"estimated_months_max": 24, "estimated_months_min": new_min})

    return sugg.model_copy(update=updates)


# --- Levenshtein (for I-10) -------------------------------------------------

def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def levenshtein_ratio(a: str, b: str) -> float:
    """Normalized edit distance in [0, 1]; 0 == identical."""
    if not a and not b:
        return 0.0
    return _levenshtein(a, b) / max(len(a), len(b))


# --- Monte Carlo calibration gate (engine_spec.md §4) -----------------------

def monte_carlo_distribution(n: int = 10000, seed: int = 42) -> dict[str, float]:
    """Tier fractions under uniform axis sampling — used by the CI calibration gate."""
    rng = random.Random(seed)
    weights = list(DIFFICULTY_WEIGHT.values())
    counts: Counter = Counter()
    for _ in range(n):
        score = (
            0.30 * rng.random()
            + 0.30 * rng.random()
            + 0.25 * rng.random()
            + 0.15 * rng.choice(weights)
        )
        counts[_tier_from_score(score)] += 1
    return {tier: counts[tier] / n for tier in _TIERS}
