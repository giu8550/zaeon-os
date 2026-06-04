"""Segmentação de texto PT-BR: parágrafos, frases, tokens e sílabas.

A contagem de sílabas usa o dicionário de hifenização pt_BR do `pyphen`,
que é a base mais confiável e leve para o Índice de Flesch adaptado (Martins
et al. 1996) sem depender de modelos pesados.
"""
import re
import pyphen

from lexicons import STOPWORDS

_dic = pyphen.Pyphen(lang="pt_BR")

# Abreviações comuns que NÃO terminam frase (evita falso corte em "Dr.", "etc.").
_ABBREV = {
    "dr", "dra", "sr", "sra", "prof", "profa", "etc", "ex", "fig", "ed", "org",
    "p", "pp", "v", "vol", "n", "ref", "cap", "art", "séc", "i.e", "e.g",
}

_WORD_RE = re.compile(r"[A-Za-zÀ-ÿ]+")
_SENT_RE = re.compile(r".*?[.!?…]+(?=\s|$)|.+$", re.S)


def split_paragraphs(text: str) -> list[str]:
    """Divide por linhas em branco; remove linhas de marcador `# ...`/`## ...`."""
    blocks = re.split(r"\n\s*\n", text.strip())
    out = []
    for b in blocks:
        lines = [ln for ln in b.split("\n") if not re.match(r"^#{1,6}\s", ln.strip())]
        joined = "\n".join(lines).strip()
        if joined:
            out.append(joined)
    return out


def split_sentences(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    parts = [p.strip() for p in _SENT_RE.findall(text) if p.strip()]
    merged: list[str] = []
    for p in parts:
        if merged:
            prev = merged[-1]
            prev_words = _WORD_RE.findall(prev)
            prev_last = prev_words[-1].lower() if prev_words else ""
            if prev.rstrip().endswith(".") and prev_last in _ABBREV:
                merged[-1] = prev + " " + p
                continue
        merged.append(p)
    return merged


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in _WORD_RE.findall(text)]


def content_tokens(text: str) -> list[str]:
    return [t for t in tokenize(text) if t not in STOPWORDS and len(t) > 2]


def syllables_in_word(word: str) -> int:
    w = re.sub(r"[^A-Za-zÀ-ÿ]", "", word)
    if not w:
        return 0
    return max(1, _dic.inserted(w).count("-") + 1)


def count_syllables(text: str) -> int:
    return sum(syllables_in_word(w) for w in tokenize(text))
