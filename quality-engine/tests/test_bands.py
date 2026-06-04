from bands import (
    optimal_middle, monotonic_up, score_to_band, band_index,
    BAND_DESCRIPTIONS, BAND_LABELS, BAND_ORDER,
)


def test_optimal_middle_peaks_at_center():
    assert optimal_middle(40, center=40, sigma=20) == 1.0
    assert optimal_middle(40, 40, 20) > optimal_middle(80, 40, 20)
    assert optimal_middle(40, 40, 20) > optimal_middle(0, 40, 20)


def test_optimal_middle_symmetric():
    assert abs(optimal_middle(20, 40, 20) - optimal_middle(60, 40, 20)) < 1e-9


def test_monotonic_up_saturates():
    assert monotonic_up(10, lo=40, hi=90) == 0.0
    assert monotonic_up(120, lo=40, hi=90) == 1.0
    assert 0 < monotonic_up(65, 40, 90) < 1


def test_score_to_band_order():
    bands = [score_to_band(x) for x in (10, 42, 60, 78, 92)]
    assert bands == ["ruim", "aceitavel", "bom", "muito_bom", "excepcional"]


def test_band_index_monotonic():
    assert band_index("ruim") < band_index("bom") < band_index("excepcional")


def test_every_band_has_text():
    for b in BAND_ORDER:
        assert b in BAND_DESCRIPTIONS and b in BAND_LABELS
