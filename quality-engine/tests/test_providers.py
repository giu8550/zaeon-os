import providers
from metrics.nilc import map_nilc_features


def test_native_features_keys():
    f = providers.native_features("A casa é bela (SILVA, 2020).")
    for k in ("flesch", "diversity", "msl", "cv", "clauses", "connective",
              "overlap", "citation", "nominalization", "ai_fingerprint"):
        assert k in f
    assert f["provider"] == "native"


def test_map_nilc_features_subset():
    raw = {"flesch": 50.0, "adj_arg_ovl": 0.3, "words_per_sentence": 18.0, "unknown_metric": 9}
    m = map_nilc_features(raw)
    assert m["flesch"] == 50.0
    assert m["overlap"] == 0.3
    assert m["msl"] == 18.0
    assert "unknown_metric" not in m


def test_get_features_falls_back_without_url(monkeypatch):
    monkeypatch.delenv("NILC_METRIX_URL", raising=False)
    providers._nilc_cache.update(ts=0.0, ok=False, url=None)
    f = providers.get_features("Texto simples de teste.", "desenvolvimento")
    assert f["provider"] == "native"
    assert providers.active_provider() == "native"


def test_get_features_uses_nilc_when_available(monkeypatch):
    monkeypatch.setenv("NILC_METRIX_URL", "http://fake-nilc:9999")
    providers._nilc_cache.update(ts=0.0, ok=False, url=None)

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def health(self):
            return True

        def metrics(self, text):
            return {"flesch": 12.3, "adj_arg_ovl": 0.99}

    monkeypatch.setattr(providers, "NilcMetrixClient", FakeClient)
    f = providers.get_features("Qualquer texto.", "desenvolvimento")
    assert f["provider"] == "nilc"
    assert f["flesch"] == 12.3
    assert f["overlap"] == 0.99


def test_nilc_failure_degrades_to_native(monkeypatch):
    monkeypatch.setenv("NILC_METRIX_URL", "http://fake-nilc:9999")
    providers._nilc_cache.update(ts=0.0, ok=False, url=None)

    class BrokenClient:
        def __init__(self, *a, **k):
            pass

        def health(self):
            return True

        def metrics(self, text):
            raise RuntimeError("nilc down mid-call")

    monkeypatch.setattr(providers, "NilcMetrixClient", BrokenClient)
    f = providers.get_features("Qualquer texto.", "desenvolvimento")
    # health ok, mas metrics falha → mantém nativo, sem lançar
    assert f["provider"] == "native"
