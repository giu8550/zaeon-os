# Termômetro Acadêmico (Motor de Qualidade) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um motor Python (FastAPI :8003) que classifica título, seções e parágrafos de um TCC PT-BR em 5 bandas (ruim→excepcional) com métricas citáveis, exposto por um proxy Next e um painel "Termômetro Acadêmico" + trilha por parágrafo no research-lab.

**Architecture:** Serviço Python espelhando `research-engine/` (FastAPI, Pydantic v2, pytest). Provider nativo (Flesch-BR/Martins, MTLD, sintaxe, coesão, citações, flags) sempre disponível; provider NILC-Metrix (HTTP, opcional) como autoritativo. Proxy `app/api/quality/route.ts` (auth por email). UI: `AcademicThermometer.tsx` + hook com debounce/cache, integrado na FOLHA A4.

**Tech Stack:** Python 3.11+, FastAPI 0.115, Pydantic 2.8, `pyphen`, `lexical-diversity`, `httpx`, `pytest`. Next 14, React, TypeScript, vitest.

---

## File Structure

```
quality-engine/
  conftest.py            # sys.path insert (igual research-engine)
  requirements.txt
  .env.example
  README.md
  lexicons.py            # conectivos, fingerprint IA, hedges/boosters, pistas CARS, sufixos nominalização, stopwords PT
  models.py              # Pydantic: ScoreRequest/Response, *Score, enums
  segmentation.py        # parágrafos, frases, tokens, sílabas (pyphen)
  metrics/__init__.py
  metrics/native.py      # readability, mtld, sintaxe, coesão, citações, flags
  metrics/nilc.py        # NilcMetrixClient (httpx) + mapeamento
  providers.py           # FeatureProvider: escolhe nilc↔nativo
  bands.py               # shaping gaussiano, limiares, descritores VALUE
  scorer.py              # orquestra parágrafo→seção→documento, CARS, título, nível
  main.py                # FastAPI /health /score /score/paragraph
  tests/
    __init__.py
    test_models.py  test_segmentation.py  test_native_metrics.py
    test_bands.py   test_scorer.py        test_providers.py  test_api.py
lib/quality/
  types.ts               # tipos compartilhados (Band, ParagraphScore, ...)
  segment.ts             # segmentação de parágrafos no cliente (paridade c/ Python)
  segment.test.ts
  useQualityScore.ts     # hook: debounce + cache por hash + fetch
app/api/quality/route.ts # proxy TS (auth email→user)
app/api/quality/route.test.ts
components/research/AcademicThermometer.tsx
app/research-lab/page.tsx # integração (FOLHA A4 ~1342)
```

---

### Task 1: Scaffold do serviço `quality-engine`

**Files:** Create `quality-engine/{conftest.py,requirements.txt,.env.example,metrics/__init__.py,tests/__init__.py}`

- [ ] **Step 1: requirements.txt**
```
fastapi==0.115.0
uvicorn==0.30.6
pydantic==2.8.2
pyphen==0.15.0
lexical-diversity==0.1.1
httpx==0.27.2
python-dotenv==1.0.1
pytest==8.3.3
pytest-asyncio==0.24.0
```
- [ ] **Step 2: conftest.py** (idêntico ao research-engine)
```python
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
```
- [ ] **Step 3: .env.example**
```
# quality-engine — porta 8003
# Opcional: instância NILC-Metrix (container próprio). Sem isto, usa só o provider nativo.
NILC_METRIX_URL=
```
- [ ] **Step 4:** `metrics/__init__.py` e `tests/__init__.py` vazios.
- [ ] **Step 5: venv + deps + smoke**
Run: `cd quality-engine && python3 -m venv .venv && . .venv/bin/activate && pip install -q -r requirements.txt && pytest -q`
Expected: "no tests ran" (coleta ok, sem erro de import).
- [ ] **Step 6: Commit** `chore(quality-engine): scaffold do serviço Python (:8003)`

---

### Task 2: Modelos Pydantic

**Files:** Create `quality-engine/models.py`, `quality-engine/tests/test_models.py`

- [ ] **Step 1: Teste que falha** (`tests/test_models.py`)
```python
import pytest
from pydantic import ValidationError
from models import ScoreRequest, SectionIn

def test_score_request_minimal():
    r = ScoreRequest(title="Impacto de X sobre Y", sections=[SectionIn(type="introducao", title="INTRODUÇÃO", content="Texto.")])
    assert r.work_type == "TCC" and r.academic_level == "grad"
    assert r.sections[0].subsections == []

def test_section_requires_type():
    with pytest.raises(ValidationError):
        SectionIn(title="X", content="y")  # falta type
```
- [ ] **Step 2:** Run `pytest tests/test_models.py -q` → FAIL (ImportError).
- [ ] **Step 3: Implementar `models.py`**
```python
from pydantic import BaseModel, Field
from typing import Literal

WorkType = Literal["Artigo", "Relatório", "TCC"]
AcademicLevel = Literal["grad", "msc", "phd", "postdoc"]
Band = Literal["ruim", "aceitavel", "bom", "muito_bom", "excepcional"]

class SubsectionIn(BaseModel):
    title: str = ""
    content: str = ""

class SectionIn(BaseModel):
    type: str
    title: str = ""
    content: str = ""
    subsections: list[SubsectionIn] = Field(default_factory=list)

class ScoreRequest(BaseModel):
    title: str = ""
    work_type: WorkType = "TCC"
    academic_level: AcademicLevel = "grad"
    sections: list[SectionIn] = Field(default_factory=list)

class ParagraphScore(BaseModel):
    idx: int
    section_type: str
    band: Band
    score: float           # 0-100
    rationale: str = ""
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)
    metrics: dict[str, float] = Field(default_factory=dict)

class SectionScore(BaseModel):
    type: str
    title: str = ""
    band: Band
    score: float
    structure_flags: list[str] = Field(default_factory=list)
    rationale: str = ""
    paragraphs: list[ParagraphScore] = Field(default_factory=list)

class TitleScore(BaseModel):
    band: Band
    specificity: float
    notes: list[str] = Field(default_factory=list)

class OverallScore(BaseModel):
    band: Band
    score: float
    level_read: str          # "Exploratória (TCC)" ... "Pioneira Ultra"
    rationale: str = ""
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)

class ScoreResponse(BaseModel):
    overall: OverallScore
    title: TitleScore
    sections: list[SectionScore] = Field(default_factory=list)
    meta: dict = Field(default_factory=dict)
```
- [ ] **Step 4:** Run `pytest tests/test_models.py -q` → PASS.
- [ ] **Step 5: Commit** `feat(quality-engine): modelos Pydantic do contrato de score`

---

### Task 3: Léxicos PT (dados)

**Files:** Create `quality-engine/lexicons.py` (sem teste próprio; coberto via métricas)

- [ ] **Step 1: Implementar `lexicons.py`** com conjuntos `frozenset`/listas:
```python
# Conectivos por categoria (amostra; ampliar com cautela)
CONNECTIVES = {
    "aditivo": {"além disso", "também", "ademais", "outrossim", "bem como", "e ainda"},
    "adversativo": {"no entanto", "porém", "contudo", "todavia", "entretanto", "apesar de"},
    "causal": {"porque", "pois", "visto que", "uma vez que", "dado que", "já que", "devido a"},
    "conclusivo": {"portanto", "logo", "assim", "dessa forma", "por conseguinte", "consequentemente"},
    "temporal": {"em seguida", "posteriormente", "anteriormente", "finalmente", "então"},
    "explicativo": {"isto é", "ou seja", "por exemplo", "a saber", "em outras palavras"},
}
ALL_CONNECTIVES = frozenset().union(*CONNECTIVES.values())

# Pistas do modelo CARS de Swales (introdução)
CARS_GAP = {"no entanto", "poucos estudos", "pouca atenção", "lacuna", "carece", "ainda não",
            "não foi", "escassez", "limitações", "falta de", "raros são"}
CARS_PURPOSE = {"o objetivo deste", "este trabalho visa", "objetiva-se", "propõe-se",
                "este estudo", "a presente pesquisa", "tem como objetivo", "busca-se"}
CONCLUSION_LIMITS = {"limitaç", "trabalhos futuros", "pesquisas futuras", "como limitaç", "estudos futuros"}

# Léxico-fingerprint de IA (PT) — FLAG fraca, decai com o tempo
AI_FINGERPRINT = frozenset({
    "ressaltar", "aprofundar", "intricado", "robusto", "abrangente", "crucial",
    "multifacetado", "fundamental", "primordial", "elucidar", "vasto leque",
    "paisagem", "tapeçaria", "navegar", "alavancar", "vale ressaltar", "é importante notar",
})

# Sufixos de nominalização (densidade alta = mais difícil — sinal do estudo)
NOMINALIZATION_SUFFIXES = ("ção", "ções", "mento", "mentos", "idade", "idades",
                           "ância", "ência", "ismo", "agem")

# Stopwords PT (amostra funcional para overlap de conteúdo)
STOPWORDS = frozenset("""a o e é de do da das dos em no na nos nas um uma uns umas para por
com sem sob sobre entre que se ao aos à às como mas ou nem já não sim quando onde qual quais
seu sua seus suas este esta isto esse essa isso aquele aquela aquilo lhe lhes me te nos vos
ser estar ter haver foi são era as os""".split())

# Marcadores de método/contexto p/ especificidade de título
TITLE_METHOD_CUES = {"análise", "estudo de caso", "impacto", "avaliação", "comparação",
                     "modelo", "proposta", "desenvolvimento", "revisão sistemática",
                     "investigação", "aplicação", "efeito", "influência"}
TITLE_VAGUE = {"tecnologia", "sociedade", "estudo sobre", "um estudo", "geral", "coisas"}
```
- [ ] **Step 2: Commit** `feat(quality-engine): léxicos PT (conectivos, CARS, fingerprint, nominalização)`

---

### Task 4: Segmentação (parágrafos, frases, tokens, sílabas)

**Files:** Create `quality-engine/segmentation.py`, `tests/test_segmentation.py`

- [ ] **Step 1: Testes que falham**
```python
from segmentation import split_paragraphs, split_sentences, tokenize, count_syllables, syllables_in_word

def test_split_paragraphs_blank_lines():
    txt = "Par um.\nLinha mesmo par.\n\nPar dois."
    assert split_paragraphs(txt) == ["Par um.\nLinha mesmo par.", "Par dois."]

def test_split_sentences_basic():
    assert split_sentences("Olá mundo. Tudo bem? Sim!") == ["Olá mundo.", "Tudo bem?", "Sim!"]

def test_split_sentences_ignores_abbrev():
    s = split_sentences("Segundo o Dr. Silva, a amostra cresceu. Fim.")
    assert s == ["Segundo o Dr. Silva, a amostra cresceu.", "Fim."]

def test_tokenize_words_only():
    assert tokenize("A casa, bonita! 123") == ["a", "casa", "bonita"]

def test_syllables_pt():
    assert syllables_in_word("casa") == 2
    assert syllables_in_word("metodologia") == 5
    assert count_syllables("a casa") >= 3
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar `segmentation.py`**
```python
import re
import pyphen
from lexicons import STOPWORDS

_dic = pyphen.Pyphen(lang="pt_BR")
_ABBREV = {"dr", "dra", "sr", "sra", "prof", "profa", "etc", "ex", "fig", "ed", "org", "p", "v", "n"}

def split_paragraphs(text: str) -> list[str]:
    blocks = re.split(r"\n\s*\n", text.strip())
    return [b.strip() for b in blocks if b.strip()]

def split_sentences(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    out, buf = [], ""
    tokens = re.split(r"(\s+)", text)
    i = 0
    # abordagem simples: regex de fim de frase com guarda de abreviação
    parts = re.findall(r".*?[.!?…]+(?=\s|$)|.+$", text, flags=re.S)
    cleaned = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        last_word = re.sub(r"[^\wÀ-ÿ]", "", p.split()[-1].lower()) if p.split() else ""
        if cleaned and last_word in _ABBREV:
            cleaned[-1] = cleaned[-1] + " " + p
        else:
            cleaned.append(p)
    return cleaned

def tokenize(text: str) -> list[str]:
    return [t.lower() for t in re.findall(r"[A-Za-zÀ-ÿ]+", text)]

def content_tokens(text: str) -> list[str]:
    return [t for t in tokenize(text) if t not in STOPWORDS and len(t) > 2]

def syllables_in_word(word: str) -> int:
    w = re.sub(r"[^A-Za-zÀ-ÿ]", "", word)
    if not w:
        return 0
    return max(1, _dic.inserted(w).count("-") + 1)

def count_syllables(text: str) -> int:
    return sum(syllables_in_word(w) for w in tokenize(text))
```
- [ ] **Step 4:** Run `pytest tests/test_segmentation.py -q` → PASS (ajustar regex até verde).
- [ ] **Step 5: Commit** `feat(quality-engine): segmentação PT (parágrafos/frases/sílabas via pyphen)`

---

### Task 5: Métricas nativas — legibilidade, lexical, sintaxe, coesão, citações

**Files:** Create `quality-engine/metrics/native.py`, `tests/test_native_metrics.py`

- [ ] **Step 1: Testes que falham** (âncoras de comportamento)
```python
from metrics.native import (flesch_br, mtld_score, mean_sentence_length, sentence_length_cv,
                            connective_density, lexical_overlap, citation_density)

EASY = "O gato dorme. A casa é bela. O sol brilha hoje."
HARD = ("A operacionalização epistemológica das contingências paradigmáticas pressupõe a "
        "ressignificação ontológica das estruturas socioculturais subjacentes às práxis discursivas.")

def test_flesch_br_easy_higher_than_hard():
    assert flesch_br(EASY) > flesch_br(HARD)

def test_flesch_br_in_reasonable_range():
    v = flesch_br(EASY)
    assert -50 <= v <= 120

def test_mtld_varied_gt_repetitive():
    rep = "casa casa casa casa casa casa casa casa"
    var = "casa prédio rua avenida ponte viaduto praça jardim"
    assert mtld_score(var) > mtld_score(rep)

def test_citation_density_detects_abnt():
    t = "A teoria se confirma (SILVA, 2020) e também em Souza (2019)."
    assert citation_density(t) > 0

def test_connective_density_counts():
    assert connective_density("No entanto, o dado subiu. Portanto, aceitamos.") > 0
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar `metrics/native.py`** (Flesch-BR = Martins 1996)
```python
import re
from statistics import mean, pstdev
from lexical_diversity import lex_div as ld
from segmentation import (split_sentences, tokenize, content_tokens, count_syllables)
from lexicons import ALL_CONNECTIVES

_CITATION_PATTERNS = [
    re.compile(r"\([A-ZÀ-Ý][A-ZÀ-Ýa-zà-ÿ]+(?:\s+et\s+al\.)?,?\s*\d{4}[a-z]?\)"),  # (SILVA, 2020)
    re.compile(r"\b[A-ZÀ-Ý][a-zà-ÿ]+\s*\(\d{4}[a-z]?\)"),                          # Souza (2019)
    re.compile(r"\[\d{1,3}\]"),                                                       # [12]
]

def flesch_br(text: str) -> float:
    sents = split_sentences(text)
    words = tokenize(text)
    if not sents or not words:
        return 0.0
    asl = len(words) / len(sents)
    asw = count_syllables(text) / len(words)
    return 248.835 - 1.015 * asl - 84.6 * asw

def mtld_score(text: str) -> float:
    toks = tokenize(text)
    if len(toks) < 5:
        return 0.0
    try:
        return float(ld.mtld(toks))
    except Exception:
        return 0.0

def mean_sentence_length(text: str) -> float:
    sents = split_sentences(text)
    if not sents:
        return 0.0
    return mean(len(tokenize(s)) for s in sents)

def sentence_length_cv(text: str) -> float:
    sents = split_sentences(text)
    lens = [len(tokenize(s)) for s in sents]
    if len(lens) < 2 or mean(lens) == 0:
        return 0.0
    return pstdev(lens) / mean(lens)

def connective_density(text: str) -> float:
    low = " " + text.lower() + " "
    hits = sum(low.count(" " + c + " ") + low.count(" " + c + ",") for c in ALL_CONNECTIVES)
    sents = max(1, len(split_sentences(text)))
    return hits / sents

def lexical_overlap(text: str) -> float:
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
    words = max(1, len(tokenize(text)))
    hits = sum(len(p.findall(text)) for p in _CITATION_PATTERNS)
    return 100.0 * hits / words
```
- [ ] **Step 4:** Run `pytest tests/test_native_metrics.py -q` → PASS.
- [ ] **Step 5: Commit** `feat(quality-engine): métricas nativas (Flesch-BR, MTLD, sintaxe, coesão, citações)`

---

### Task 6: Flags (canal ortogonal de "revisar")

**Files:** Modify `quality-engine/metrics/native.py`; add tests to `tests/test_native_metrics.py`

- [ ] **Step 1: Testes que falham**
```python
from metrics.native import ai_fingerprint_rate, nominalization_rate, paragraph_flags

def test_nominalization_rate_positive():
    assert nominalization_rate("A operacionalização e a ressignificação da informação.") > 0.2

def test_ai_fingerprint_detects():
    assert ai_fingerprint_rate("É crucial ressaltar o robusto e abrangente resultado.") > 0

def test_flags_uniform_sentences():
    uniform = "O dado subiu hoje cedo. O dado caiu hoje cedo. O dado subiu hoje cedo."
    assert "uniformidade" in paragraph_flags(uniform)
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar** (append em `metrics/native.py`)
```python
from lexicons import AI_FINGERPRINT, NOMINALIZATION_SUFFIXES
from segmentation import content_tokens as _ct

def nominalization_rate(text: str) -> float:
    toks = _ct(text)
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
    cv = sentence_length_cv(text)
    if len(split_sentences(text)) >= 3 and cv < 0.20:
        flags.append("uniformidade")
    return flags
```
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(quality-engine): flags ortogonais (nominalização, léxico IA, uniformidade)`

---

### Task 7: Bandas e shaping

**Files:** Create `quality-engine/bands.py`, `tests/test_bands.py`

- [ ] **Step 1: Testes que falham**
```python
from bands import optimal_middle, monotonic_up, score_to_band, BAND_DESCRIPTIONS

def test_optimal_middle_peaks_at_center():
    assert optimal_middle(40, center=40, sigma=20) == 1.0
    assert optimal_middle(40, center=40, sigma=20) > optimal_middle(80, center=40, sigma=20)
    assert optimal_middle(40, center=40, sigma=20) > optimal_middle(0, center=40, sigma=20)

def test_monotonic_up_saturates():
    assert monotonic_up(10, lo=40, hi=90) == 0.0
    assert monotonic_up(120, lo=40, hi=90) == 1.0
    assert 0 < monotonic_up(65, lo=40, hi=90) < 1

def test_score_to_band_order():
    bands = [score_to_band(x) for x in (10, 42, 60, 75, 92)]
    assert bands == ["ruim", "aceitavel", "bom", "muito_bom", "excepcional"]

def test_every_band_has_description():
    for b in ("ruim", "aceitavel", "bom", "muito_bom", "excepcional"):
        assert b in BAND_DESCRIPTIONS
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar `bands.py`**
```python
import math

def optimal_middle(x: float, center: float, sigma: float) -> float:
    return math.exp(-((x - center) ** 2) / (2 * sigma ** 2))

def monotonic_up(x: float, lo: float, hi: float) -> float:
    if x <= lo:
        return 0.0
    if x >= hi:
        return 1.0
    return (x - lo) / (hi - lo)

# limiares 0-100 → 5 bandas (ancorados em VALUE 0-4)
_THRESHOLDS = [(35, "ruim"), (52, "aceitavel"), (70, "bom"), (85, "muito_bom"), (101, "excepcional")]

def score_to_band(score: float) -> str:
    for thr, name in _THRESHOLDS:
        if score < thr:
            return name
    return "excepcional"

BAND_DESCRIPTIONS = {
    "ruim": "Abaixo do mínimo — pouco claro, sem sustentação ou com problemas estruturais.",
    "aceitavel": "Adequado, porém plano — lacunas de coesão, evidência ou precisão.",
    "bom": "Claro, coeso e apoiado — padrão sólido de TCC.",
    "muito_bom": "Sofisticado e bem-argumentado — acima da média.",
    "excepcional": "Controle magistral de conteúdo, estrutura, fontes e estilo.",
}
BAND_ORDER = ["ruim", "aceitavel", "bom", "muito_bom", "excepcional"]
```
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(quality-engine): shaping (faixa-ótima/monotônico) e mapeamento de bandas`

---

### Task 8: Scorer (parágrafo → seção → documento; CARS, título, nível)

**Files:** Create `quality-engine/scorer.py`, `tests/test_scorer.py`. Provider nativo por enquanto (NILC entra na Task 9 via `features`).

- [ ] **Step 1: Testes-âncora que falham** (travam a ORDEM das bandas e regras estruturais)
```python
from models import ScoreRequest, SectionIn
from scorer import score_document, score_paragraph_text, title_specificity

RUIM = "isso e bom. coisa boa. muito bom mesmo. legal demais isso ai."
BOM = ("A automação de processos reduz custos operacionais (SILVA, 2020). No entanto, sua "
       "adoção exige investimento inicial relevante. Portanto, este trabalho avalia o "
       "retorno financeiro em pequenas empresas do setor têxtil ao longo de doze meses.")

def test_paragraph_ranking_bom_gt_ruim():
    assert score_paragraph_text(BOM, "desenvolvimento").score > score_paragraph_text(RUIM, "desenvolvimento").score

def test_intro_without_cars_loses():
    with_cars = "Há ampla literatura sobre IA. No entanto, poucos estudos abordam X. O objetivo deste trabalho é investigar X."
    without = "A inteligência artificial é muito usada atualmente. Ela aparece em vários lugares e é interessante."
    assert score_paragraph_text(with_cars, "introducao").score > score_paragraph_text(without, "introducao").score

def test_title_specificity_specific_gt_vague():
    assert title_specificity("Impacto da automação têxtil no custo: estudo de caso em MPEs")[0] > title_specificity("Um estudo sobre tecnologia")[0]

def test_score_document_shapes_response():
    req = ScoreRequest(title="Impacto da automação no setor têxtil: um estudo de caso",
                       sections=[SectionIn(type="introducao", title="INTRODUÇÃO", content=BOM),
                                 SectionIn(type="desenvolvimento", title="METODOLOGIA", content=BOM)])
    resp = score_document(req)
    assert resp.overall.band in ("ruim","aceitavel","bom","muito_bom","excepcional")
    assert len(resp.sections) == 2
    assert resp.sections[0].paragraphs
    assert resp.overall.level_read
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar `scorer.py`** usando `providers.get_features` (Task 9 fornece; por ora importar de `providers`). Resumo da lógica:
  - `score_paragraph_text(text, section_type, level="grad", provider_features=None)`:
    - features = provider_features or `providers.native_features(text)`.
    - sub-scores (0–1): `readability = optimal_middle(flesch, center_by_level, 22)`; `lexical = monotonic_up(mtld, 35, 95)`; `syntax = mean(optimal_middle(MSL,21,9), faixa de orações, optimal_middle(cv,0.55,0.4))`; `cohesion = mean(monotonic_up(conn,0.2,1.2), monotonic_up(overlap,0.05,0.30))`; `evidence = monotonic_up(citation, 0, 3)` **gated** por seção (intro/desenvolvimento peso menor; referencial/desenvolvimento c/ "discussão" maior; conclusão isenta).
    - pesos por `section_type` (dict). soma ponderada → 0–100.
    - bônus/penalidade CARS p/ `introducao` (lacuna +; objetivo +; ausência −). Conclusão: limitações/futuro +.
    - `flags = paragraph_flags(text)` (não entram na nota).
    - rationale + strengths/gaps derivados dos sub-scores (regra simples: <0.4 vira gap, >0.75 vira strength, com rótulos legíveis).
    - retorna `ParagraphScore`.
  - `score_section(section, level)`: agrega parágrafos (média ponderada por nº de tokens), structure_flags (intro sem CARS, referencial sem citação, conclusão sem limites), banda.
  - `title_specificity(title) -> (score0_1, notes)`: comprimento em content-words, presença de `TITLE_METHOD_CUES`, presença de ":" / contexto, penalidade por `TITLE_VAGUE`.
  - `level_read(overall_score, title_spec, citation_breadth, method_specificity)`: mapeia p/ "Exploratória (TCC)" | "Experimental" | "Pioneira" | "Pioneira Ultra" (limiares crescentes; título vago e zero citações rebaixam).
  - `score_document(req)`: title score, por seção, overall (média ponderada + completude IMRaD), level_read, rationale agregado, meta `{provider, engine_version:"0.1.0"}`.
- [ ] **Step 4:** Run `pytest tests/test_scorer.py -q` → PASS (ajustar centros/pesos até as âncoras passarem e as bandas saírem na ordem).
- [ ] **Step 5: Commit** `feat(quality-engine): scorer com CARS, título e leitura de nível`

---

### Task 9: Provider NILC + nativo (abstração)

**Files:** Create `quality-engine/providers.py`, `quality-engine/metrics/nilc.py`, `tests/test_providers.py`

- [ ] **Step 1: Testes que falham** (NILC mockado; fallback nativo)
```python
import providers
from metrics.nilc import map_nilc_features

def test_native_features_keys():
    f = providers.native_features("A casa é bela (SILVA, 2020).")
    for k in ("flesch","mtld","msl","cv","connective","overlap","citation","nominalization","ai_fingerprint"):
        assert k in f

def test_map_nilc_features_subset():
    raw = {"flesch": 50.0, "adj_arg_ovl": 0.3, "words_per_sentence": 18.0}
    m = map_nilc_features(raw)
    assert m["flesch"] == 50.0 and "overlap" in m

def test_get_features_falls_back_without_url(monkeypatch):
    monkeypatch.delenv("NILC_METRIX_URL", raising=False)
    f = providers.get_features("Texto simples de teste.", "desenvolvimento")
    assert f["provider"] == "native"
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar**
  - `metrics/nilc.py`: `class NilcMetrixClient` (httpx, base_url, `health()`, `metrics(text)->dict`), `map_nilc_features(raw)->dict` (traduz nomes NILC → nossas chaves; preenche o que existir).
  - `providers.py`: `native_features(text)` (chama `metrics.native.*` → dict com a chave `provider:"native"`), `get_features(text, section_type)` (se `NILC_METRIX_URL` setado e `health()` ok → mescla NILC sobre nativo, `provider:"nilc"`; senão nativo). Nunca lança: erro de NILC → nativo.
- [ ] **Step 4:** Run `pytest tests/test_providers.py -q` → PASS. Refatorar `scorer` p/ usar `providers.get_features`.
- [ ] **Step 5: Commit** `feat(quality-engine): provider NILC-Metrix (HTTP, opcional) + fallback nativo`

---

### Task 10: API FastAPI

**Files:** Create `quality-engine/main.py`, `tests/test_api.py`

- [ ] **Step 1: Testes que falham**
```python
from fastapi.testclient import TestClient
from main import app
client = TestClient(app)

def test_health():
    assert client.get("/health").json()["status"] == "ok"

def test_score_endpoint():
    body = {"title":"Impacto X em Y: estudo de caso","work_type":"TCC","academic_level":"grad",
            "sections":[{"type":"introducao","title":"INTRODUÇÃO",
                         "content":"Há literatura sobre X. No entanto, poucos estudos abordam Y (SILVA, 2020). O objetivo deste trabalho é investigar Y."}]}
    r = client.post("/score", json=body)
    assert r.status_code == 200
    d = r.json()
    assert d["overall"]["band"] and d["sections"][0]["paragraphs"]
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar `main.py`** (espelha research-engine: CORS localhost:3000 + zaeonos.com; `/health`; `POST /score`; `POST /score/paragraph` recebe `{text, section_type, academic_level}`; try/except → 422/503/500; `uvicorn ... port=8003`).
- [ ] **Step 4:** Run `pytest -q` (suíte inteira do quality-engine) → PASS.
- [ ] **Step 5: Commit** `feat(quality-engine): API FastAPI (/health, /score, /score/paragraph)`

---

### Task 11: TS — tipos + segmentação no cliente

**Files:** Create `lib/quality/types.ts`, `lib/quality/segment.ts`, `lib/quality/segment.test.ts`

- [ ] **Step 1: Teste vitest que falha** (`segment.test.ts`)
```ts
import { describe, it, expect } from "vitest";
import { splitParagraphs } from "@/lib/quality/segment";
describe("splitParagraphs", () => {
  it("divide por linhas em branco e ignora marcadores", () => {
    expect(splitParagraphs("# INTRO\nPar um.\n\nPar dois.")).toEqual(["Par um.", "Par dois."]);
  });
});
```
- [ ] **Step 2:** Run `npm test -- segment` → FAIL.
- [ ] **Step 3: Implementar** `types.ts` (Band, ParagraphScore, SectionScore, ScoreResponse — espelham o Python) e `segment.ts`:
```ts
export function splitParagraphs(sectionContent: string): string[] {
  return sectionContent
    .split(/\n\s*\n/)
    .map(s => s.split("\n").filter(l => !/^#{1,6}\s/.test(l)).join("\n").trim())
    .filter(Boolean);
}
```
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(quality): tipos + segmentação de parágrafos no cliente`

---

### Task 12: TS — proxy `app/api/quality/route.ts`

**Files:** Create `app/api/quality/route.ts`, `app/api/quality/route.test.ts`

- [ ] **Step 1: Teste vitest que falha** (mock `getServerSession`, `prisma`, `fetch`)
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { getServerSession } from "next-auth";
import { prisma } from "@/src/lib/prisma";
import { POST } from "@/app/api/quality/route";

beforeEach(() => vi.clearAllMocks());
function req(body: any) { return new Request("http://x/api/quality", { method: "POST", body: JSON.stringify(body) }); }

it("401 sem sessão", async () => {
  (getServerSession as any).mockResolvedValue(null);
  expect((await POST(req({}))).status).toBe(401);
});
it("503 quando engine offline", async () => {
  (getServerSession as any).mockResolvedValue({ user: { email: "a@b.c" } });
  (prisma.user.findUnique as any).mockResolvedValue({ id: "1" });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
  expect((await POST(req({ title: "x", sections: [] }))).status).toBe(503);
});
```
- [ ] **Step 2:** Run `npm test -- quality/route` → FAIL.
- [ ] **Step 3: Implementar** (espelha `research-suggest/route.ts`): `QUALITY_ENGINE_URL ?? "http://localhost:8003"`, auth email→user, `fetch(/score, AbortSignal.timeout(25000))`, 503 "Quality engine offline. Run quality-engine on port 8003."
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(quality): proxy /api/quality (auth por email, degrada p/ 503)`

---

### Task 13: UI — `AcademicThermometer` + hook + integração

**Files:** Create `lib/quality/useQualityScore.ts`, `components/research/AcademicThermometer.tsx`; Modify `app/research-lab/page.tsx`

- [ ] **Step 1: Hook** `useQualityScore.ts`: recebe `{title, workType, academicLevel, docContent}`; usa `parseAbntMarkers` + `splitParagraphs`; debounce 700ms; cache `Map<hash, ScoreResponse>` (hash simples do conteúdo); `POST /api/quality`; retorna `{score, loading, offline}`. Não computa se `isEmptyOrTemplate`.
- [ ] **Step 2: Componente** `AcademicThermometer.tsx` (client):
  - Barra colapsável (padrão visual da ABNT HINT BAR, [page.tsx:1344](app/research-lab/page.tsx)): medalhão de banda geral (cor+rótulo+score 0–100), `level_read`, chips por seção, top forças/lacunas, contagem de "⚠ revisar".
  - Toggle "Modo Revisão" → renderiza parágrafos (de `parseAbntMarkers`+`splitParagraphs`) read-only com **borda-esquerda colorida** por banda + `title`/aria com rationale; pontos por parágrafo.
  - Paleta `BAND_UI`: ruim=rose, aceitavel=amber, bom=sky, muito_bom=teal, excepcional=cyan. Sempre cor **+ rótulo textual**.
  - Props: `{ title, workType, academicLevel, docContent, reviewMode, onToggleReview }`.
- [ ] **Step 3: Integrar** na FOLHA A4: importar e renderizar `<AcademicThermometer/>` logo após o header da folha (antes da ÁREA DE TEXTO, ~[page.tsx:1340](app/research-lab/page.tsx)); adicionar estado `reviewMode`; quando `reviewMode`, esconder o `<textarea>` e mostrar a renderização por parágrafo do componente; mapear `workType||"TCC"` e `User.academicLevel`→`grad|msc|phd|postdoc` (helper).
- [ ] **Step 4: Verificar** `npm run build` e `npm run lint` (sem novos erros) + checagem visual via `/run` se viável.
- [ ] **Step 5: Commit** `feat(quality): painel Termômetro Acadêmico + trilha por parágrafo no research-lab`

---

### Task 14: Wiring final, docs e verificação

**Files:** Create `quality-engine/main.py` README, `quality-engine/README.md`; Modify `.env.example` raiz (se existir) — adicionar `QUALITY_ENGINE_URL`, `NILC_METRIX_URL`.

- [ ] **Step 1: README** do quality-engine (rodar `uvicorn main:app --port 8003`; contrato; NILC opcional via docker; nota AGPL).
- [ ] **Step 2:** Adicionar `QUALITY_ENGINE_URL` (e `NILC_METRIX_URL`) ao `.env.example` da raiz, se houver.
- [ ] **Step 3: Suíte completa** — `cd quality-engine && pytest -q` (verde) e raiz `npm test` (verde) e `npm run build` (ok).
- [ ] **Step 4: Commit** `docs(quality-engine): README + env vars`
- [ ] **Step 5: PR** para `main` com resumo (link ao spec), checklist de testes verdes, e nota de deploy (NILC opcional; nativo é o caminho padrão).

---

## Self-Review (cobertura do spec)
- §3 arquitetura → Tasks 1,9,10,12,13. §4 métricas/banding → Tasks 4,5,6,7,8. §5 contrato → Tasks 2,10. §6 UI → Task 13. §7 NILC+nativo → Task 9. §8 testes → cada task tem testes + Task 14 fecha. §9 entrega → Task 14.
- Consistência de tipos: bandas `ruim|aceitavel|bom|muito_bom|excepcional` (snake) em Python e TS; `Band` reusado. `get_features`/`native_features` nomeados consistentes entre Tasks 8–9.
- Sem placeholders nos núcleos (código real em 1–12). UI (13) tem código-esqueleto concreto + pontos de integração exatos por ser camada visual.
