"""Shaping de métricas e mapeamento para as 5 bandas.

Duas formas de recompensa:
- `optimal_middle`: faixa-ótima (gaussiana). Para métricas NÃO-monotônicas como
  legibilidade — texto acadêmico bom não é o mais fácil nem o mais difícil.
- `monotonic_up`: "mais é melhor" com saturação (diversidade, coesão, citações).

Bandas ancoradas na rubrica AAC&U Written Communication VALUE (níveis 0-4).
"""
import math

BAND_ORDER = ["ruim", "aceitavel", "bom", "muito_bom", "excepcional"]


def optimal_middle(x: float, center: float, sigma: float) -> float:
    """Recompensa 0-1 com pico em `center`, decaindo gaussiana com `sigma`."""
    if sigma <= 0:
        return 1.0 if x == center else 0.0
    return math.exp(-((x - center) ** 2) / (2 * sigma ** 2))


def monotonic_up(x: float, lo: float, hi: float) -> float:
    """Rampa 0-1: 0 em/abaixo de `lo`, 1 em/acima de `hi`, linear no meio."""
    if hi <= lo:
        return 1.0 if x >= hi else 0.0
    if x <= lo:
        return 0.0
    if x >= hi:
        return 1.0
    return (x - lo) / (hi - lo)


# Limiares 0-100 → 5 bandas (ancorados em VALUE 0-4).
_THRESHOLDS = [(35, "ruim"), (52, "aceitavel"), (70, "bom"), (85, "muito_bom")]


def score_to_band(score: float) -> str:
    for thr, name in _THRESHOLDS:
        if score < thr:
            return name
    return "excepcional"


def band_index(band: str) -> int:
    return BAND_ORDER.index(band)


BAND_DESCRIPTIONS = {
    "ruim": "Abaixo do mínimo — pouco claro, sem sustentação ou com problemas estruturais.",
    "aceitavel": "Adequado, porém plano — lacunas de coesão, evidência ou precisão.",
    "bom": "Claro, coeso e apoiado — padrão sólido de TCC.",
    "muito_bom": "Sofisticado e bem-argumentado — acima da média.",
    "excepcional": "Controle magistral de conteúdo, estrutura, fontes e estilo.",
}

# Rótulos legíveis (UI/PT) para as bandas snake_case.
BAND_LABELS = {
    "ruim": "Ruim",
    "aceitavel": "Aceitável",
    "bom": "Bom",
    "muito_bom": "Muito bom",
    "excepcional": "Excepcional",
}
