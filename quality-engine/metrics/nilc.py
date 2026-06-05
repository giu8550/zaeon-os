"""Cliente HTTP para uma instância NILC-Metrix (opcional).

NILC-Metrix (NILC/USP) calcula ~200 métricas validadas para PT-BR, mas roda
como serviço próprio (PostgreSQL + ~2GB, AGPLv3). Aqui só o consumimos por
HTTP — nosso código NÃO embute o NILC, então não herda a AGPL. Quando
`NILC_METRIX_URL` aponta para uma instância saudável, as métricas que o NILC
cobre sobrepõem as nativas (ver providers.py).

A forma exata do endpoint pode variar por instância; o mapeamento abaixo é
conservador (só métricas com semântica/escala compatíveis com as nativas).
"""
import httpx

# Nomes NILC-Metrix (e apelidos comuns) → nossas chaves de feature.
# Conservador de propósito: só o que é seguro em escala/semântica.
_NILC_MAP = {
    "flesch": "flesch",
    "words_per_sentence": "msl",
    "sentence_length_mean": "msl",
    "sentences_per_paragraph": None,  # ignorado
    "adj_arg_ovl": "overlap",
    "adjacent_argument_overlap": "overlap",
    "arg_ovl": "overlap",
    "adj_mean": "overlap",            # LSA adjacente ~ coesão local
}


class NilcMetrixClient:
    def __init__(self, base_url: str, timeout: float = 8.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def health(self) -> bool:
        try:
            r = httpx.get(self.base_url + "/health", timeout=self.timeout)
            return r.status_code == 200
        except Exception:
            return False

    def metrics(self, text: str) -> dict:
        r = httpx.post(self.base_url + "/metrics", json={"text": text}, timeout=self.timeout)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict):
            return data.get("metrics", data)
        return {}


def map_nilc_features(raw: dict) -> dict:
    """Traduz a saída do NILC para o subconjunto de chaves que usamos."""
    out = {}
    for k, v in raw.items():
        key = _NILC_MAP.get(k)
        if key and isinstance(v, (int, float)):
            out[key] = float(v)
    return out
