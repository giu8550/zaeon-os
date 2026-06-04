"""Seleção de provider de métricas.

`native` (Python puro) está sempre disponível. Na Task 9 entra o provider
NILC-Metrix (HTTP), que sobrepõe as métricas que cobre quando configurado.
"""
import os

from metrics.native import all_metrics


def native_features(text: str) -> dict:
    f = all_metrics(text)
    f["provider"] = "native"
    return f


def get_features(text: str, section_type: str = "desenvolvimento") -> dict:
    """Por ora, nativo. NILC será mesclado aqui quando NILC_METRIX_URL existir."""
    return native_features(text)


def active_provider() -> str:
    """Nome do provider que seria usado (para meta da resposta)."""
    if os.environ.get("NILC_METRIX_URL"):
        # Em Task 9, verifica /health; por ora reporta nativo de forma conservadora.
        return "native"
    return "native"
