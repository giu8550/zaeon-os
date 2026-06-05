"""Tests for the deterministic classifier (engine_spec.md §4 + invariants I-1..I-10).

Thresholds recalibrated per ADR-001 D5: muito_bom>=0.45, excelente>=0.60, excepcional>=0.73.
"""
from _factories import make_axes, make_request, make_suggestion

import classifier


# --- compute_tier: the four bands at recalibrated cut-points ----------------

def test_compute_tier_regular_for_low_axes():
    # score = .03 + .03 + .025 + .0375 = 0.1225 < 0.45
    axes = make_axes(difficulty="grad", relevance=0.1, innovation=0.1, estimated_months_min=2, estimated_months_max=6)
    assert classifier.compute_tier(axes, gap_score=0.1) == "regular"


def test_compute_tier_muito_bom_band():
    # score = .15 + .15 + .125 + .0375 = 0.4625  in [0.45, 0.60)
    axes = make_axes(difficulty="grad", relevance=0.5, innovation=0.5, estimated_months_min=6, estimated_months_max=12)
    assert classifier.compute_tier(axes, gap_score=0.5) == "muito_bom"


def test_compute_tier_excelente_band():
    # score = .21 + .21 + .175 + .075 = 0.67  in [0.60, 0.73)
    axes = make_axes(difficulty="msc", relevance=0.7, innovation=0.7, estimated_months_min=12, estimated_months_max=20)
    assert classifier.compute_tier(axes, gap_score=0.7) == "excelente"


def test_compute_tier_excepcional_band():
    # score = .285 + .285 + .225 + .15 = 0.945 >= 0.73
    axes = make_axes(difficulty="postdoc", relevance=0.95, innovation=0.95, estimated_months_min=12, estimated_months_max=18)
    assert classifier.compute_tier(axes, gap_score=0.9) == "excepcional"


# --- invariants I-1..I-10 ---------------------------------------------------

def test_i1_excepcional_requires_phd_and_high_innovation():
    bad = make_suggestion(quality_tier="excepcional", axes=make_axes(difficulty="grad", innovation=0.95))
    assert "I-1" in classifier.suggestion_violations(bad, n_references=5)
    ok = make_suggestion(quality_tier="excepcional", axes=make_axes(difficulty="phd", innovation=0.85))
    assert "I-1" not in classifier.suggestion_violations(ok, n_references=5)


def test_i2_excelente_requires_msc_plus_and_gap_floor():
    bad_level = make_suggestion(quality_tier="excelente", axes=make_axes(difficulty="grad"), gap_score=0.9)
    assert "I-2" in classifier.suggestion_violations(bad_level, n_references=5)
    bad_gap = make_suggestion(quality_tier="excelente", axes=make_axes(difficulty="msc"), gap_score=0.5)
    assert "I-2" in classifier.suggestion_violations(bad_gap, n_references=5)


def test_i3_regular_caps_months_at_24():
    bad = make_suggestion(quality_tier="regular", axes=make_axes(estimated_months_min=20, estimated_months_max=30))
    assert "I-3" in classifier.suggestion_violations(bad, n_references=5)


def test_i5_month_range_cannot_be_too_wide():
    bad = make_suggestion(quality_tier="muito_bom", axes=make_axes(estimated_months_min=5, estimated_months_max=40))
    assert "I-5" in classifier.suggestion_violations(bad, n_references=5)
    ok = make_suggestion(quality_tier="muito_bom", axes=make_axes(estimated_months_min=30, estimated_months_max=42))
    assert "I-5" not in classifier.suggestion_violations(ok, n_references=5)


def test_i6_evidence_refs_required_when_many_references():
    # the model guarantees evidence_refs>=1, so a valid Suggestion never violates I-6
    ok = make_suggestion()  # default desdobramento has evidence_refs=[0]
    assert "I-6" not in classifier.suggestion_violations(ok, n_references=8)


def test_i8_flags_out_of_range_indices_and_sanitizes():
    bad = make_suggestion(
        desdobramentos=make_suggestion().desdobramentos.model_copy(update={"evidence_refs": [0, 5]})
    )
    assert "I-8" in classifier.suggestion_violations(bad, n_references=3)
    raw = {"desdobramentos": {"evidence_refs": [0, 5, -1], "cross_link_refs": [2, 9]}}
    cleaned = classifier.sanitize_ref_indices(raw, n_references=3)
    assert cleaned["desdobramentos"]["evidence_refs"] == [0]
    assert cleaned["desdobramentos"]["cross_link_refs"] == [2]


def test_i9_set_requires_two_distinct_gap_types_when_count_ge_3():
    req = make_request(count=3)
    same = [make_suggestion(gap_type="metodologica") for _ in range(3)]
    assert "I-9" in classifier.set_violations(same, req)
    mixed = [make_suggestion(gap_type="metodologica"), make_suggestion(gap_type="temporal"), make_suggestion(gap_type="empirica")]
    assert "I-9" not in classifier.set_violations(mixed, req)


def test_i10_set_flags_near_duplicate_of_excluded_title():
    req = make_request(exclude_titles=["Estudo sobre grafeno e celulose bacteriana"])
    dup = [make_suggestion(title="Estudo sobre grafeno e celulose bacteriana")]
    assert "I-10" in classifier.set_violations(dup, req)
    distinct = [make_suggestion(title="Bioeletroquímica de membranas de quitosana")]
    assert "I-10" not in classifier.set_violations(distinct, req)


# --- deterministic downgrade (post-retry fixes) -----------------------------

def test_downgrade_excepcional_to_excelente_when_i1_unfixed():
    s = make_suggestion(quality_tier="excepcional", axes=make_axes(difficulty="phd", innovation=0.5), gap_score=0.78)
    fixed = classifier.downgrade_to_consistent_tier(s)
    assert fixed.quality_tier == "excelente"  # phd + gap0.78 keeps it at excelente


def test_downgrade_grad_excepcional_cascades_to_muito_bom():
    s = make_suggestion(quality_tier="excepcional", axes=make_axes(difficulty="grad", innovation=0.95), gap_score=0.9)
    fixed = classifier.downgrade_to_consistent_tier(s)
    assert fixed.quality_tier == "muito_bom"  # grad fails I-1 then I-2


def test_downgrade_regular_clamps_months_to_24():
    s = make_suggestion(quality_tier="regular", axes=make_axes(estimated_months_min=20, estimated_months_max=36))
    fixed = classifier.downgrade_to_consistent_tier(s)
    assert fixed.axes.estimated_months_max == 24


# --- Monte Carlo calibration gate (engine_spec.md §4) -----------------------

def test_monte_carlo_distribution_matches_targets():
    dist = classifier.monte_carlo_distribution(n=10000, seed=42)
    assert 0.29 <= dist["regular"] <= 0.35
    assert 0.35 <= dist["muito_bom"] <= 0.41
    assert 0.19 <= dist["excelente"] <= 0.25
    assert 0.06 <= dist["excepcional"] <= 0.10
    assert abs(sum(dist.values()) - 1.0) < 1e-9


# --- helper used by I-10 ----------------------------------------------------

def test_levenshtein_ratio_is_normalized_distance():
    assert classifier.levenshtein_ratio("abc", "abc") == 0.0
    assert abs(classifier.levenshtein_ratio("kitten", "sitting") - 3 / 7) < 1e-9
