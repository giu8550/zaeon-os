"""Seleção de provider de métricas.

`native` (Python puro) está sempre disponível e é rápido. Quando
`NILC_METRIX_URL` aponta para uma instância NILC-Metrix saudável, as métricas
que ela cobre (legibilidade/coesão/sintaxe validadas para PT) sobrepõem as
nativas. A disponibilidade do NILC é cacheada por 30s para não martelar
`/health` a cada parágrafo.
"""
import os
import time

from metrics.native import all_metrics
from metrics.nilc import NilcMetrixClient, map_nilc_features

_nilc_cache = {"ts": 0.0, "ok": False, "url": None}
_NILC_TTL = 30.0


def native_features(text: str) -> dict:
    f = all_metrics(text)
    f["provider"] = "native"
    return f


def _nilc_available():
    """Retorna a URL do NILC se configurado e saudável (cacheado), senão None."""
    url = os.environ.get("NILC_METRIX_URL")
    if not url:
        return None
    now = time.monotonic()
    if _nilc_cache["url"] == url and (now - _nilc_cache["ts"]) < _NILC_TTL:
        return url if _nilc_cache["ok"] else None
    ok = False
    try:
        ok = NilcMetrixClient(url).health()
    except Exception:
        ok = False
    _nilc_cache.update(ts=now, ok=ok, url=url)
    return url if ok else None


def get_features(text: str, section_type: str = "desenvolvimento") -> dict:
    base = native_features(text)
    url = _nilc_available()
    if url:
        try:
            raw = NilcMetrixClient(url).metrics(text)
            base.update(map_nilc_features(raw))
            base["provider"] = "nilc"
        except Exception:
            pass  # qualquer falha do NILC → segue com nativo
    return base


def active_provider() -> str:
    return "nilc" if _nilc_available() else "native"
