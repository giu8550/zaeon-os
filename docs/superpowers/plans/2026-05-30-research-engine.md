# Research Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python FastAPI microservice (port 8002) that receives a research topic + academic level and returns one pioneer research suggestion plus up to 9 academic references, then wire it to a React panel in the Pesquisa tab of `/research-lab`.

**Architecture:** Standalone FastAPI service (`research-engine/`) following the `abnt-service` pattern. Gemini 2.0 Flash generates structured JSON via a deep "gap-analyst" system prompt that scores novelty, feasibility, and pioneer potential per academic level. A thin Next.js proxy route (`app/api/ai/research-suggest/route.ts`) forwards authenticated requests. The React component `ResearchSuggestionPanel` handles level selection, "Gerar" + "↻ outra" flow, and renders one suggestion card + references list.

**Tech Stack:** FastAPI 0.115, Pydantic v2, `google-generativeai` (Vertex Gemini 2.0 Flash), Python 3.11+, pytest, Next.js 14 App Router, TypeScript, Tailwind CSS, Space Grotesk / JetBrains Mono

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `research-engine/main.py` | Create | FastAPI app, CORS, `/health`, `/suggest`, `/refresh` |
| `research-engine/models.py` | Create | Pydantic models: `SuggestRequest`, `RefItem`, `SuggestionItem`, `SuggestResponse` |
| `research-engine/prompts.py` | Create | `SYSTEM_PROMPT_BASE` + `LEVEL_INSTRUCTIONS` dict (the primordial prompt) |
| `research-engine/engine.py` | Create | `build_prompt()`, `call_gemini()`, `parse_response()` |
| `research-engine/requirements.txt` | Create | Python deps |
| `research-engine/tests/test_models.py` | Create | Pydantic validation tests |
| `research-engine/tests/test_engine.py` | Create | `parse_response()` unit tests |
| `app/api/ai/research-suggest/route.ts` | Create | Auth check + proxy to `:8002/suggest` |
| `components/research/ResearchSuggestionPanel.tsx` | Create | Full React UI: level selector, topic input, suggestion card, refs list |
| `app/research-lab/page.tsx` | Modify | Import panel + render in Pesquisa left column |

---

## Task 1: Python models

**Files:**
- Create: `research-engine/models.py`
- Create: `research-engine/requirements.txt`
- Create: `research-engine/tests/__init__.py`
- Create: `research-engine/tests/test_models.py`

- [ ] **Step 1.1: Create `research-engine/models.py`**

```python
# research-engine/models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Literal

AcademicLevel = Literal["grad", "msc", "phd", "postdoc"]


class SuggestRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500,
                       description="Research topic the student entered")
    level: AcademicLevel = Field(..., description="grad | msc | phd | postdoc")
    exclude_titles: List[str] = Field(
        default_factory=list,
        description="Titles already shown — engine must avoid them on refresh"
    )


class RefItem(BaseModel):
    source: Literal["PubMed", "arXiv", "DOI", "Scholar"]
    title: str
    authors: str
    year: str
    venue: str
    doi: Optional[str] = None


class InlineCitation(BaseModel):
    quote: str
    source: str
    doi: Optional[str] = None


class SuggestionItem(BaseModel):
    type: Literal["Exploratória", "Experimental", "Pioneira"]
    title: str
    rationale: str
    novelty_angle: str
    gap_score: float = Field(..., ge=0.0, le=1.0)


class SuggestResponse(BaseModel):
    suggestion: SuggestionItem
    references: List[RefItem] = Field(default_factory=list)
    inline_citation: Optional[InlineCitation] = None
```

- [ ] **Step 1.2: Create `research-engine/requirements.txt`**

```
fastapi==0.115.0
uvicorn==0.30.6
pydantic==2.8.2
google-generativeai==0.8.3
python-dotenv==1.0.1
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
```

- [ ] **Step 1.3: Create `research-engine/tests/__init__.py`** (empty file)

- [ ] **Step 1.4: Write model validation tests**

```python
# research-engine/tests/test_models.py
import pytest
from pydantic import ValidationError
from models import SuggestRequest, SuggestResponse, SuggestionItem, RefItem


def test_suggest_request_valid():
    req = SuggestRequest(topic="orquídeas rosas", level="phd")
    assert req.topic == "orquídeas rosas"
    assert req.exclude_titles == []


def test_suggest_request_empty_topic_fails():
    with pytest.raises(ValidationError):
        SuggestRequest(topic="", level="grad")


def test_suggest_request_invalid_level_fails():
    with pytest.raises(ValidationError):
        SuggestRequest(topic="orquídeas", level="invalid")


def test_suggest_request_exclude_titles():
    req = SuggestRequest(topic="algo", level="msc", exclude_titles=["Título A"])
    assert req.exclude_titles == ["Título A"]


def test_suggest_response_valid():
    resp = SuggestResponse(
        suggestion=SuggestionItem(
            type="Pioneira",
            title="Título pioneiro",
            rationale="Lacuna real identificada.",
            novelty_angle="Nunca cruzado antes.",
            gap_score=0.82,
        ),
        references=[
            RefItem(
                source="PubMed",
                title="Example paper",
                authors="Smith, J. et al.",
                year="2022",
                venue="Nature Plants",
                doi="10.1234/np.2022.01",
            )
        ],
    )
    assert resp.suggestion.type == "Pioneira"
    assert len(resp.references) == 1


def test_gap_score_out_of_range_fails():
    with pytest.raises(ValidationError):
        SuggestionItem(
            type="Exploratória",
            title="T",
            rationale="R",
            novelty_angle="N",
            gap_score=1.5,
        )
```

- [ ] **Step 1.5: Run tests from `research-engine/` directory**

```bash
cd /Users/donmartinez/Documents/Projects/zaeon-os/research-engine
python -m pytest tests/test_models.py -v
```

Expected output:
```
tests/test_models.py::test_suggest_request_valid PASSED
tests/test_models.py::test_suggest_request_empty_topic_fails PASSED
tests/test_models.py::test_suggest_request_invalid_level_fails PASSED
tests/test_models.py::test_suggest_request_exclude_titles PASSED
tests/test_models.py::test_suggest_response_valid PASSED
tests/test_models.py::test_gap_score_out_of_range_fails PASSED
6 passed
```

- [ ] **Step 1.6: Commit**

```bash
git add research-engine/models.py research-engine/requirements.txt research-engine/tests/
git commit -m "feat(research-engine): add Pydantic models and model tests"
```

---

## Task 2: Primordial prompt system

**Files:**
- Create: `research-engine/prompts.py`

- [ ] **Step 2.1: Create `research-engine/prompts.py`**

```python
# research-engine/prompts.py
"""
Sistema de prompts para o Arquiteto de Pesquisa.
Cada nível acadêmico recebe instruções de calibração diferentes.
"""

LEVEL_INSTRUCTIONS: dict[str, str] = {
    "grad": """
GRADUANDO — Modo EXPLORATÓRIA
• Objetivo: mapeamento territorial com twist local/contextual único
• Prazo realista: 6-12 meses
• Complexidade: baixa-média
• Alvo publicação: TCC aprovado; possível artigo em revista regional brasileira (Qualis B3-B4)
• Regra de ouro: o gap deve existir na literatura internacional, mas ser INEXPLORADO no contexto
  brasileiro ou para uma variável demográfica/ambiental específica — não exija novidade absoluta
• Tipo de resultado esperado: "Exploratória"
• Exemplo de forma: "Análise comparativa de X em contexto Y no Brasil: revisão sistemática"
""",
    "msc": """
MESTRANDO — Modo EXPERIMENTAL
• Objetivo: contribuição original com hipótese testável e metodologia controlada
• Prazo realista: 18-24 meses (dissertação)
• Complexidade: média-alta
• Alvo publicação: 1-2 artigos em periódicos Scopus (Qualis A2-B1)
• Regra de ouro: a hipótese DEVE ser testável com recursos de universidade federal brasileira
  (sem equipamentos de US$1M+); prefira designs quasi-experimentais, metanálises, estudos de coorte
• Tipo de resultado esperado: "Experimental"
• Exemplo de forma: "Efeito de X sobre Y em Z: estudo experimental controlado"
""",
    "phd": """
DOUTORANDO — Modo PIONEIRA
• Objetivo: contribuição que avance a FRONTEIRA INTERNACIONAL do conhecimento
• Prazo realista: 3-4 anos (tese de doutorado)
• Complexidade: alta
• Alvo publicação: 2-3 artigos Q1 internacional (IF > 3.0)
• Regra de ouro: o trabalho DEVE identificar um gap real na literatura indexada E propor método
  inovador ou cruzamento interdisciplinar não explorado — gap_score mínimo: 0.70
• Tipo de resultado esperado: "Pioneira"
• Exemplo de forma: "Interação entre X e Y via mecanismo Z: evidências de paradigma emergente"
""",
    "postdoc": """
PÓS-DOC — Modo PIONEIRA ULTRA
• Objetivo: pesquisa paradigmática que redefina um campo ou crie um novo subdomínio
• Prazo: 1-2 anos com resultado publicável rapidamente
• Complexidade: altíssima; cruzamento obrigatório de disciplinas distantes
• Alvo publicação: Nature, Science, Cell, PNAS ou equivalente Q1 de alta relevância (IF > 8.0)
• Regra de ouro: a combinação TEMA + MÉTODO + CONTEXTO deve ser ÚNICA no mundo;
  identifique o ponto exato onde dois campos ainda não se tocaram — gap_score mínimo: 0.85
• Tipo de resultado esperado: "Pioneira"
• Exemplo de forma: "Prova de conceito: X como modulador de Y em Z — primeiro estudo in vivo"
""",
}


def build_system_prompt(level: str, exclude_titles: list[str]) -> str:
    level_block = LEVEL_INSTRUCTIONS.get(level, LEVEL_INSTRUCTIONS["grad"])
    exclude_block = ""
    if exclude_titles:
        joined = "\n".join(f"  • {t}" for t in exclude_titles)
        exclude_block = f"""
┌─ RESTRIÇÃO OBRIGATÓRIA ────────────────────────────────────────────────────
│ Os seguintes títulos JÁ foram sugeridos. NÃO repita nem parafrasei-os.
│ Proponha um ângulo COMPLETAMENTE DIFERENTE:
{joined}
└──────────────────────────────────────────────────────────────────────────────
"""

    return f"""Você é ARQUITETO DE PESQUISA — estrategista acadêmico de classe mundial com conhecimento
profundo em epistemologia, metodologia científica e fronteiras do conhecimento em todas as
disciplinas. Sua missão: identificar UMA oportunidade de pesquisa que seja simultaneamente
original, viável no nível acadêmico informado, e de máximo valor científico possível.
{exclude_block}
PROCESSO DE ANÁLISE INTERNA (raciocine antes de gerar a resposta):

┌─ FASE 1: VARREDURA DE LACUNAS ──────────────────────────────────────────────
│ A partir do tópico e do seu conhecimento da literatura atual:
│
│ LACUNAS EMPÍRICAS:        Quais fenômenos permanecem SEM MEDIÇÃO direta?
│ LACUNAS METODOLÓGICAS:   Quais métodos de campos adjacentes NUNCA foram aplicados aqui?
│ LACUNAS GEOGRÁFICAS:     Quais populações/regiões estão SISTEMATICAMENTE ausentes?
│ LACUNAS TEMPORAIS:       Quais mudanças recentes (pós-2022) ainda não foram estudadas?
│ LACUNAS INTERDISCIPLIN.: Onde dois campos distintos NUNCA se cruzaram de forma produtiva?
│
│ Para cada lacuna, estime internamente:
│   relevância × novidade × viabilidade   (cada 0–1)
│   Score = novidade×0.4 + relevância×0.4 + viabilidade×0.2
│ Escolha a lacuna de MAIOR score.
└──────────────────────────────────────────────────────────────────────────────

┌─ FASE 2: DETECÇÃO PIONEIRA ─────────────────────────────────────────────────
│ Sinalize como potencialmente PIONEIRO quando:
│   • Nenhum artigo nos últimos 3-5 anos cobre este ângulo específico
│   • Cruzamento interdisciplinar pode gerar resultados surpreendentes
│   • Método comprovado em campo X aplicado a campo Y = território inexplorado
│   • A literatura existente tem CONTRADIÇÕES não resolvidas que seu estudo poderia resolver
│   • Dados ou tecnologias emergentes (pós-2022) tornam hipóteses anteriores questionáveis
└──────────────────────────────────────────────────────────────────────────────

┌─ FASE 3: CALIBRAÇÃO DE NÍVEL ───────────────────────────────────────────────
{level_block}
└──────────────────────────────────────────────────────────────────────────────

┌─ FASE 4: SELEÇÃO DE REFERÊNCIAS ───────────────────────────────────────────
│ Selecione 5-9 trabalhos acadêmicos reais que:
│   • Documentem a existência da lacuna identificada
│   • Forneçam scaffolding metodológico para o estudo proposto
│   • Sejam de periódicos reconhecidos (Scopus, WoS, PubMed, arXiv)
│   • Cite APENAS trabalhos dos quais você tem ALTA CONFIANÇA de existência real
│   • Prefira trabalhos de 2018-2024 (relevância atual)
│   • Classifique a fonte:
│       PubMed  → ciências da vida / biomedicina
│       arXiv   → ciências exatas, computação, física, interdisciplinar
│       DOI     → qualquer periódico com DOI verificável
│       Scholar → trabalhos em português ou grey literature
└──────────────────────────────────────────────────────────────────────────────

FORMATO DE SAÍDA — JSON PURO, SEM MARKDOWN, SEM TEXTO FORA DO JSON:
{{
  "suggestion": {{
    "type": "Exploratória | Experimental | Pioneira",
    "title": "<título completo da pesquisa proposta, máximo 180 caracteres>",
    "rationale": "<justificativa em 1-2 frases: qual lacuna foi identificada e por quê este é um caminho científico valioso; máximo 300 caracteres>",
    "novelty_angle": "<o que torna este trabalho diferente de tudo que existe; máximo 120 caracteres>",
    "gap_score": <float 0.0-1.0>
  }},
  "references": [
    {{
      "source": "PubMed | arXiv | DOI | Scholar",
      "title": "<título exato do paper>",
      "authors": "<Sobrenome, N. et al. ou lista completa se ≤ 3 autores>",
      "year": "<YYYY>",
      "venue": "<nome do periódico ou conferência>",
      "doi": "<10.XXXX/... ou null>"
    }}
  ],
  "inline_citation": null
}}"""


def build_user_message(topic: str) -> str:
    return f'Tópico de pesquisa do estudante: "{topic}"\n\nGere a sugestão e as referências conforme o processo descrito.'
```

- [ ] **Step 2.2: Commit**

```bash
git add research-engine/prompts.py
git commit -m "feat(research-engine): add primordial gap-analyst system prompt"
```

---

## Task 3: Gemini engine + parse tests

**Files:**
- Create: `research-engine/engine.py`
- Create: `research-engine/tests/test_engine.py`

- [ ] **Step 3.1: Create `research-engine/engine.py`**

```python
# research-engine/engine.py
"""
Core generation logic.
Isolates the Gemini call so it can be mocked in tests.
"""
import json
import re
import os
from typing import Any

import google.generativeai as genai

from models import SuggestRequest, SuggestResponse, SuggestionItem, RefItem, InlineCitation
from prompts import build_system_prompt, build_user_message

_MODEL_NAME = "gemini-2.0-flash"


def _get_model() -> genai.GenerativeModel:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY env var not set")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(_MODEL_NAME)


def _extract_json(raw: str) -> dict[str, Any]:
    """Strip markdown fences and parse JSON from Gemini response."""
    # Remove ```json ... ``` or ``` ... ```
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()
    return json.loads(cleaned)


def parse_response(raw: str) -> SuggestResponse:
    """
    Parse the raw string from Gemini into a validated SuggestResponse.
    Raises ValueError on malformed output.
    """
    try:
        data = _extract_json(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Gemini returned invalid JSON: {e}\nRaw: {raw[:400]}")

    sug_data = data.get("suggestion", {})
    suggestion = SuggestionItem(
        type=sug_data.get("type", "Exploratória"),
        title=sug_data.get("title", ""),
        rationale=sug_data.get("rationale", ""),
        novelty_angle=sug_data.get("novelty_angle", ""),
        gap_score=float(sug_data.get("gap_score", 0.5)),
    )

    references = [
        RefItem(
            source=r.get("source", "DOI"),
            title=r.get("title", ""),
            authors=r.get("authors", ""),
            year=str(r.get("year", "")),
            venue=r.get("venue", ""),
            doi=r.get("doi") or None,
        )
        for r in data.get("references", [])
    ]

    inline_raw = data.get("inline_citation")
    inline = None
    if inline_raw and isinstance(inline_raw, dict):
        inline = InlineCitation(
            quote=inline_raw.get("quote", ""),
            source=inline_raw.get("source", ""),
            doi=inline_raw.get("doi") or None,
        )

    return SuggestResponse(
        suggestion=suggestion,
        references=references,
        inline_citation=inline,
    )


def generate_suggestion(request: SuggestRequest) -> SuggestResponse:
    """
    Call Gemini and return a validated SuggestResponse.
    """
    model = _get_model()
    system_prompt = build_system_prompt(request.level, request.exclude_titles)
    user_message = build_user_message(request.topic)

    response = model.generate_content(
        [
            {"role": "user", "parts": [system_prompt + "\n\n" + user_message]},
        ],
        generation_config=genai.types.GenerationConfig(
            temperature=0.85,
            max_output_tokens=1800,
        ),
    )

    raw = response.text
    return parse_response(raw)
```

- [ ] **Step 3.2: Write engine unit tests (mock Gemini, test parse_response)**

```python
# research-engine/tests/test_engine.py
import pytest
import json
from engine import parse_response, _extract_json
from models import SuggestResponse


VALID_JSON_RAW = json.dumps({
    "suggestion": {
        "type": "Pioneira",
        "title": "Bioacústica e pigmentação em Phalaenopsis amabilis",
        "rationale": "Nenhum estudo cruzou bioacústica com pigmentação em Orchidaceae ornamentais.",
        "novelty_angle": "Primeira interface entre neurociência vegetal e genômica de pigmentação.",
        "gap_score": 0.87,
    },
    "references": [
        {
            "source": "PubMed",
            "title": "Anthocyanin biosynthesis in Phalaenopsis",
            "authors": "Chen, L. et al.",
            "year": "2021",
            "venue": "Scientia Horticulturae",
            "doi": "10.1016/j.scienta.2021.110234",
        }
    ],
    "inline_citation": None,
})

MARKDOWN_WRAPPED = f"```json\n{VALID_JSON_RAW}\n```"

PARTIAL_JSON = '{"suggestion": {"type": "Exploratória", "title": "Título X", "rationale": "R", "novelty_angle": "N", "gap_score": 0.55}, "references": [], "inline_citation": null}'


def test_parse_valid_json():
    result = parse_response(VALID_JSON_RAW)
    assert isinstance(result, SuggestResponse)
    assert result.suggestion.type == "Pioneira"
    assert result.suggestion.gap_score == 0.87
    assert len(result.references) == 1
    assert result.references[0].source == "PubMed"


def test_parse_markdown_wrapped():
    result = parse_response(MARKDOWN_WRAPPED)
    assert result.suggestion.title == "Bioacústica e pigmentação em Phalaenopsis amabilis"


def test_parse_partial_json_no_inline():
    result = parse_response(PARTIAL_JSON)
    assert result.inline_citation is None
    assert result.references == []


def test_parse_invalid_json_raises():
    with pytest.raises(ValueError, match="invalid JSON"):
        parse_response("not json at all {{{")


def test_extract_json_strips_fences():
    raw = "```json\n{\"key\": 1}\n```"
    result = _extract_json(raw)
    assert result == {"key": 1}


def test_extract_json_no_fences():
    raw = '{"key": 2}'
    result = _extract_json(raw)
    assert result == {"key": 2}
```

- [ ] **Step 3.3: Run engine tests**

```bash
cd /Users/donmartinez/Documents/Projects/zaeon-os/research-engine
python -m pytest tests/test_engine.py -v
```

Expected output:
```
tests/test_engine.py::test_parse_valid_json PASSED
tests/test_engine.py::test_parse_markdown_wrapped PASSED
tests/test_engine.py::test_parse_partial_json_no_inline PASSED
tests/test_engine.py::test_parse_invalid_json_raises PASSED
tests/test_engine.py::test_extract_json_strips_fences PASSED
tests/test_engine.py::test_extract_json_no_fences PASSED
6 passed
```

- [ ] **Step 3.4: Commit**

```bash
git add research-engine/engine.py research-engine/tests/test_engine.py
git commit -m "feat(research-engine): add Gemini engine + parse_response with tests"
```

---

## Task 4: FastAPI app

**Files:**
- Create: `research-engine/main.py`

- [ ] **Step 4.1: Create `research-engine/main.py`**

```python
# research-engine/main.py
"""
Research Engine Service — FastAPI
Porta: 8002
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import SuggestRequest, SuggestResponse
from engine import generate_suggestion

load_dotenv()

app = FastAPI(
    title="Zaeon Research Engine",
    description="Sugestões de pesquisa baseadas em análise de lacunas com Gemini 2.0 Flash",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://zaeonos.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "zaeon-research-engine", "version": "1.0.0"}


@app.post("/suggest", response_model=SuggestResponse)
def suggest(payload: SuggestRequest):
    """
    Recebe um tópico + nível acadêmico e retorna 1 sugestão de pesquisa + referências.
    """
    try:
        return generate_suggestion(payload)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro inesperado: {str(e)}")


@app.post("/refresh", response_model=SuggestResponse)
def refresh(payload: SuggestRequest):
    """
    Mesmo contrato de /suggest, mas o cliente deve incluir o título anterior
    em exclude_titles para garantir variação.
    """
    try:
        return generate_suggestion(payload)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro inesperado: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
```

- [ ] **Step 4.2: Verify the service starts (requires GEMINI_API_KEY in env)**

Start in a terminal:
```bash
cd /Users/donmartinez/Documents/Projects/zaeon-os/research-engine
python -m uvicorn main:app --port 8002 --reload
```

Confirm health in another terminal:
```bash
curl http://localhost:8002/health
# Expected: {"status":"ok","service":"zaeon-research-engine","version":"1.0.0"}
```

- [ ] **Step 4.3: Commit**

```bash
git add research-engine/main.py
git commit -m "feat(research-engine): add FastAPI app with /suggest and /refresh endpoints"
```

---

## Task 5: Next.js proxy route

**Files:**
- Create: `app/api/ai/research-suggest/route.ts`

The route follows the same auth pattern as `app/api/ai/scholar/route.ts`: uses `getServerSession`, looks up the user by email, then proxies to the Python service.

- [ ] **Step 5.1: Create `app/api/ai/research-suggest/route.ts`**

```typescript
// app/api/ai/research-suggest/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

const ENGINE_URL = process.env.RESEARCH_ENGINE_URL ?? "http://localhost:8002";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Session.user has no id — look up from email (same pattern as scholar route)
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();

  try {
    const upstream = await fetch(`${ENGINE_URL}/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(
        JSON.stringify({ error: `Research engine error: ${text}` }),
        { status: upstream.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Research engine offline. Run research-engine on port 8002." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

- [ ] **Step 5.2: Smoke-test the route with the service running**

With both `npm run dev` (port 3000) and the Python service (port 8002) running:
```bash
curl -X POST http://localhost:3000/api/ai/research-suggest \
  -H "Content-Type: application/json" \
  -d '{"topic":"orquídeas rosas","level":"phd","exclude_titles":[]}' \
  -b "<paste session cookie here>"
```

Expected: 200 with JSON containing `suggestion.title` and `references` array.

If you get 503: the Python service is not running — start it per Task 4 Step 4.2.

- [ ] **Step 5.3: Commit**

```bash
git add app/api/ai/research-suggest/route.ts
git commit -m "feat(research-suggest): add Next.js proxy route to Python engine"
```

---

## Task 6: React component

**Files:**
- Create: `components/research/ResearchSuggestionPanel.tsx`

This is a self-contained client component. It must NOT import anything from `@/app/workstation` or depend on OmegaScholarContext — it has its own state.

Visual spec (from approved `level-selector.html` mockup):
- Background: `#030014`, card: `bg-white/[0.03] border border-white/[0.07] rounded-[2rem] backdrop-blur-2xl`
- Accent: cyan ONLY — `#22d3ee` / `cyan-400`. No purple, no violet.
- Fonts: `font-['Space_Grotesk']` for text, `font-mono` for metadata
- Level icons: 🎓 Graduando, 🔬 Mestrando, ⚗️ Doutorando, 🚀 Pós-Doc
- Level tags: Exploratória → `bg-cyan-500/10 text-cyan-400/50`, Experimental → `bg-teal-500/10 text-teal-400/60`, Pioneira → `bg-cyan-500/12 text-cyan-600/70`, Ultra → `bg-cyan-400/15 text-cyan-300`
- Active level button: `bg-cyan-400/10 border border-cyan-400/40 shadow-[0_0_14px_rgba(34,211,238,0.1)]`
- Active level dot: absolute top-right 5×5 cyan dot with glow

- [ ] **Step 6.1: Create `components/research/ResearchSuggestionPanel.tsx`**

```tsx
// components/research/ResearchSuggestionPanel.tsx
"use client";
import { useState, useEffect } from "react";

type Level = "grad" | "msc" | "phd" | "postdoc";

interface RefItem {
  source: "PubMed" | "arXiv" | "DOI" | "Scholar";
  title: string;
  authors: string;
  year: string;
  venue: string;
  doi?: string | null;
}

interface Suggestion {
  type: "Exploratória" | "Experimental" | "Pioneira";
  title: string;
  rationale: string;
  novelty_angle: string;
  gap_score: number;
}

interface EngineResponse {
  suggestion: Suggestion;
  references: RefItem[];
  inline_citation?: { quote: string; source: string; doi?: string } | null;
}

interface Props {
  docTitle?: string;
  onSelectTitle?: (title: string) => void;
}

const LEVELS: { id: Level; icon: string; name: string; tag: string; tagClass: string }[] = [
  { id: "grad",    icon: "🎓", name: "Graduando",  tag: "Exploratória", tagClass: "bg-cyan-500/10 text-cyan-400/50" },
  { id: "msc",     icon: "🔬", name: "Mestrando",  tag: "Experimental", tagClass: "bg-teal-500/10 text-teal-400/60" },
  { id: "phd",     icon: "⚗️", name: "Doutorando", tag: "Pioneira",     tagClass: "bg-cyan-500/[0.12] text-cyan-300/70" },
  { id: "postdoc", icon: "🚀", name: "Pós-Doc",    tag: "Ultra",        tagClass: "bg-cyan-400/15 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.15)]" },
];

const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  grad:    'Modo <strong class="text-cyan-400">EXPLORATÓRIA</strong> — mapeia o território, organiza literatura existente. Ideal para TCC e Iniciação Científica.',
  msc:     'Modo <strong class="text-cyan-400">EXPERIMENTAL</strong> — hipótese clara, metodologia controlada. Mira Qualis A2/B1 e periódicos Scopus.',
  phd:     'Modo <strong class="text-cyan-400">PIONEIRA</strong> — contribuição original, gap real na literatura. Mira Tese sólida e journals Q1.',
  postdoc: 'Modo <strong class="text-cyan-400">PIONEIRA ULTRA</strong> — cruza disciplinas, identifica lacunas sem precedente, mira Q1 internacional e publicações de alto impacto.',
};

const SOURCE_STYLES: Record<string, string> = {
  PubMed: "bg-teal-500/8 text-teal-400/70 border border-teal-500/15",
  arXiv:  "bg-cyan-500/8 text-cyan-400/60 border border-cyan-400/13",
  DOI:    "bg-sky-500/7 text-sky-400/60 border border-sky-500/13",
  Scholar:"bg-cyan-400/6 text-cyan-300/50 border border-cyan-400/10",
};

const TYPE_LABEL_STYLES: Record<string, string> = {
  Exploratória: "bg-cyan-400/10 text-cyan-300/60 border border-cyan-400/15",
  Experimental: "bg-teal-400/10 text-teal-300/60 border border-teal-400/15",
  Pioneira:     "bg-cyan-400/12 text-cyan-300/70 border border-cyan-400/20",
};

export default function ResearchSuggestionPanel({ docTitle = "", onSelectTitle }: Props) {
  const [level, setLevel] = useState<Level>("postdoc");
  const [topic, setTopic] = useState(docTitle || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EngineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excludeTitles, setExcludeTitles] = useState<string[]>([]);

  // Keep topic in sync if docTitle changes from outside
  useEffect(() => {
    if (docTitle && !topic) setTopic(docTitle);
  }, [docTitle]);

  async function fetchSuggestion(isRefresh = false) {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);

    const exclude = isRefresh && result ? [...excludeTitles, result.suggestion.title] : excludeTitles;

    try {
      const res = await fetch("/api/ai/research-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), level, exclude_titles: exclude }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }

      const data: EngineResponse = await res.json();
      setResult(data);
      if (isRefresh && result) {
        setExcludeTitles(prev => [...prev, result.suggestion.title]);
      }
    } catch (err: any) {
      setError(err.message ?? "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  const currentLevel = LEVELS.find(l => l.id === level)!;

  return (
    <div
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-[2rem] backdrop-blur-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
    >
      {/* ── HEADER ── */}
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-cyan-400/10 border border-cyan-400/20 rounded-[9px] flex items-center justify-center text-sm">
            🧭
          </div>
          <span className="text-[11px] font-black uppercase tracking-[.15em] text-cyan-400">
            Sugestão de Pesquisa
          </span>
        </div>
        <span className="text-[8px] font-bold uppercase tracking-[.1em] text-cyan-400/50 border border-cyan-400/15 px-2.5 py-1 rounded-full bg-cyan-400/[0.05]">
          IA · Gemini
        </span>
      </div>

      {/* ── LEVEL SELECTOR ── */}
      <div className="px-5 py-3.5 border-b border-white/[0.05]">
        <p className="text-[8px] font-black uppercase tracking-[.18em] text-white/20 mb-2.5">
          Nível acadêmico
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {LEVELS.map(l => (
            <button
              key={l.id}
              onClick={() => setLevel(l.id)}
              className={`relative border rounded-xl py-2 px-1.5 flex flex-col items-center gap-1 transition-all duration-150
                ${level === l.id
                  ? "bg-cyan-400/[0.08] border-cyan-400/35 shadow-[0_0_14px_rgba(34,211,238,0.1)]"
                  : "bg-white/[0.02] border-white/[0.08] hover:bg-cyan-400/[0.05] hover:border-cyan-400/20"
                }`}
            >
              {level === l.id && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
              )}
              <span className="text-base leading-none">{l.icon}</span>
              <span className={`text-[8px] font-black uppercase tracking-[.06em] text-center leading-tight
                ${level === l.id ? "text-cyan-400" : "text-white/35"}`}>
                {l.name.includes(" ") ? l.name.replace(" ", "­") : l.name}
              </span>
              <span className={`text-[7px] font-bold uppercase tracking-[.06em] px-1.5 py-0.5 rounded-lg text-center leading-tight ${l.tagClass}`}>
                {l.tag}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TYPE INDICATOR ── */}
      <div className="mx-5 mt-3.5 mb-0 p-2 rounded-xl bg-cyan-400/[0.04] border border-cyan-400/10 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)] shrink-0" />
        <p
          className="text-[9px] font-bold text-white/40 leading-snug"
          dangerouslySetInnerHTML={{ __html: LEVEL_DESCRIPTIONS[level] }}
        />
      </div>

      {/* ── INPUT ── */}
      <div className="px-5 py-3.5 flex gap-2 items-center">
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchSuggestion(false)}
          placeholder="Tema da pesquisa..."
          className="flex-1 bg-cyan-400/[0.04] border border-cyan-400/12 rounded-[13px] px-3 py-2.5 text-[12px] font-medium text-white outline-none transition-all focus:border-cyan-400/40 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.06)] placeholder:text-white/20"
        />
        <button
          onClick={() => fetchSuggestion(false)}
          disabled={loading || !topic.trim()}
          className="bg-[#06b6d4] hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed border-none rounded-[13px] px-4 py-2.5 text-[10px] font-black uppercase tracking-[.1em] text-[#030014] cursor-pointer whitespace-nowrap shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_28px_rgba(34,211,238,0.35)] transition-all"
        >
          {loading ? "..." : "Gerar ✦"}
        </button>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div className="mx-5 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-300">
          {error}
        </div>
      )}

      {/* ── LOADING SKELETON ── */}
      {loading && !result && (
        <div className="mx-5 mb-3.5 p-4 rounded-2xl border border-cyan-400/12 bg-cyan-400/[0.04] animate-pulse">
          <div className="h-2.5 w-24 bg-white/10 rounded mb-3" />
          <div className="h-4 w-full bg-white/10 rounded mb-2" />
          <div className="h-4 w-4/5 bg-white/10 rounded mb-3" />
          <div className="h-2.5 w-3/4 bg-white/[0.07] rounded" />
        </div>
      )}

      {/* ── SUGGESTION CARD ── */}
      {result && !loading && (
        <div className="mx-5 mb-3.5 p-4 rounded-2xl border border-cyan-400/12 bg-cyan-400/[0.04]">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[8px] font-black uppercase tracking-[.15em] text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-0.5 rounded-full">
              ✦ Sugestão
            </span>
            <span className={`text-[8px] font-bold uppercase tracking-[.08em] px-2 py-0.5 rounded-full ${TYPE_LABEL_STYLES[result.suggestion.type] ?? ""}`}>
              {currentLevel.icon} {result.suggestion.type}
            </span>
            <button
              onClick={() => fetchSuggestion(true)}
              disabled={loading}
              className="ml-auto bg-transparent border border-cyan-400/15 rounded-[9px] px-2.5 py-1 text-[8px] font-black uppercase tracking-[.1em] text-cyan-400/40 hover:border-cyan-400/40 hover:text-cyan-400 hover:bg-cyan-400/[0.06] transition-all cursor-pointer disabled:opacity-40"
            >
              ↻ outra
            </button>
          </div>

          <p className="text-[12px] font-extrabold text-white/90 leading-[1.45] mb-1.5">
            {result.suggestion.title}
          </p>
          <p className="text-[10px] text-white/35 leading-[1.55] mb-2.5">
            {result.suggestion.rationale}
          </p>

          {onSelectTitle && (
            <button
              onClick={() => onSelectTitle(result.suggestion.title)}
              className="text-[9px] font-bold uppercase tracking-[.1em] text-cyan-400/40 hover:text-cyan-400 transition-colors cursor-pointer bg-transparent border-none"
            >
              Usar como título no editor →
            </button>
          )}
        </div>
      )}

      {/* ── REFERENCES ── */}
      {result && result.references.length > 0 && (
        <div className="mx-5 mb-5 border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-white/[0.04]">
            <span className="text-[8px] font-black uppercase tracking-[.15em] text-white/20">
              Trabalhos relacionados
            </span>
            <span className="text-[8px] font-bold text-cyan-400/40 bg-cyan-400/[0.06] border border-cyan-400/12 px-2 py-0.5 rounded-[9px]">
              {result.references.length} referências
            </span>
          </div>

          {result.references.map((ref, i) => (
            <div
              key={i}
              className="px-3.5 py-2.5 border-t border-white/[0.03] flex items-start gap-2"
            >
              <span className={`text-[7px] font-black uppercase tracking-[.08em] px-2 py-0.5 rounded-[8px] shrink-0 mt-0.5 ${SOURCE_STYLES[ref.source] ?? SOURCE_STYLES["DOI"]}`}>
                {ref.source}
              </span>
              <div>
                <p className="text-[10px] font-semibold text-white/65 leading-snug">{ref.title}</p>
                <p
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  className="text-[8px] text-white/20 mt-0.5"
                >
                  {ref.authors} · {ref.year} · {ref.venue}
                </p>
              </div>
            </div>
          ))}

          <div className="px-3.5 py-2">
            <p className="text-[8px] font-bold uppercase tracking-[.12em] text-white/12 text-center">
              exportar ABNT
            </p>
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ── */}
      {!result && !loading && !error && (
        <div className="px-5 pb-6 pt-2 text-center">
          <p className="text-[10px] text-white/20 leading-relaxed">
            Selecione o nível, confirme o tema e clique em <strong className="text-white/30">Gerar ✦</strong>
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6.2: Run the Vitest test suite to ensure no regressions**

```bash
cd /Users/donmartinez/Documents/Projects/zaeon-os
npm test
```

Expected: all existing tests pass.

- [ ] **Step 6.3: Commit**

```bash
git add components/research/ResearchSuggestionPanel.tsx
git commit -m "feat(research): add ResearchSuggestionPanel component (cyan-only Zaeon design)"
```

---

## Task 7: Integration in research-lab page

**Files:**
- Modify: `app/research-lab/page.tsx`

The panel goes in the **left column** of the Pesquisa tab, as the first `<section>` before the existing PDF library section. It receives `docTitle` so the input is pre-populated.

- [ ] **Step 7.1: Add import to `app/research-lab/page.tsx`**

Find the block of dynamic imports (near `const StudyRoomContent = dynamic...`). Add after the last dynamic import:

```typescript
const ResearchSuggestionPanel = dynamic(
  () => import("@/components/research/ResearchSuggestionPanel"),
  { ssr: false }
);
```

- [ ] **Step 7.2: Wire `onSelectTitle` handler**

The component accepts an `onSelectTitle` callback. Add this handler function inside the component, near the other document handlers (e.g. after `handlePdfQuestion`):

```typescript
const handleSelectResearchTitle = (title: string) => {
  setDocTitle(title);
  // Optionally scroll to the document editor
};
```

- [ ] **Step 7.3: Insert the panel in the Pesquisa left column**

In the Pesquisa left column (the `<div className={`w-1/2 h-full flex flex-col gap-8 overflow-y-auto ...`}>` div), add the panel as the **first child**, before the `<input type="file" ...>` and `<section data-tour="pdf-upload"...>`:

Locate this exact block (around line 1150):
```tsx
<div className={`w-1/2 h-full flex flex-col gap-8 overflow-y-auto custom-scrollbar pb-32 pr-2 ${isChatLeft ? 'order-first' : 'order-last'}`}>
    <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" multiple onChange={(e) => handleFiles(e.target.files)} />

    {/* CHAT COM PDF & CITAÇÕES */}
    <section data-tour="pdf-upload"
```

Change it to:
```tsx
<div className={`w-1/2 h-full flex flex-col gap-8 overflow-y-auto custom-scrollbar pb-32 pr-2 ${isChatLeft ? 'order-first' : 'order-last'}`}>
    <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" multiple onChange={(e) => handleFiles(e.target.files)} />

    {/* SUGESTÃO DE PESQUISA */}
    <div className="bg-[#030014] rounded-[2rem]">
      <ResearchSuggestionPanel
        docTitle={docTitle}
        onSelectTitle={handleSelectResearchTitle}
      />
    </div>

    {/* CHAT COM PDF & CITAÇÕES */}
    <section data-tour="pdf-upload"
```

- [ ] **Step 7.4: Run Vitest to ensure no regressions**

```bash
cd /Users/donmartinez/Documents/Projects/zaeon-os
npm test
```

Expected: all existing tests pass.

- [ ] **Step 7.5: Manually verify in browser**

With `npm run dev` and the Python service running:

1. Open http://localhost:3000/research-lab
2. Verify the Research Suggestion Panel appears at the top of the left column
3. The topic field is pre-filled from `docTitle`
4. Select a level (e.g. Pós-Doc)
5. Click "Gerar ✦" → loading skeleton appears → suggestion card + refs render
6. Click "↻ outra" → new suggestion with different title appears
7. Click "Usar como título →" → `docTitle` input at top of editor updates

- [ ] **Step 7.6: Commit**

```bash
git add app/research-lab/page.tsx
git commit -m "feat(research-lab): integrate ResearchSuggestionPanel in Pesquisa left column"
```

---

## Task 8: Run all tests before PR

Following the project's `tests-before-pr` memory requirement:

- [ ] **Step 8.1: Run the full Python test suite**

```bash
cd /Users/donmartinez/Documents/Projects/zaeon-os/research-engine
python -m pytest tests/ -v
```

Expected: all 12 tests pass (6 model + 6 engine).

- [ ] **Step 8.2: Run the full Next.js test suite**

```bash
cd /Users/donmartinez/Documents/Projects/zaeon-os
npm test
```

Expected: green suite, no failures.

- [ ] **Step 8.3: Commit if any fixes were needed, then proceed with the finishing-a-development-branch skill**

```bash
# If there were any fixes:
git add -p
git commit -m "fix: address test failures before PR"
```

Then invoke `superpowers:finishing-a-development-branch` to create the PR.

---

## Self-Review Checklist

- [x] **Spec coverage:** Level selector ✓, topic input ✓, 1 suggestion card ✓, refresh ✓, references list ✓, "Usar como título →" ✓, Python service ✓, Next.js proxy ✓, integration in Pesquisa tab ✓, 3 research types ✓, 4 academic levels ✓
- [x] **No placeholders:** All code is complete in every step
- [x] **Type consistency:** `SuggestRequest`, `SuggestResponse`, `SuggestionItem`, `RefItem` used consistently across models.py, engine.py, main.py, route.ts, and the React component's local interface (mirrored by name)
- [x] **Tests before PR:** Task 8 requires full green suite before proceeding
- [x] **Auth pattern:** Proxy route uses `getServerSession` + `prisma.user.findUnique({ where: { email }})` — same as scholar route (no `session.user.id`)
- [x] **Port:** Python service on 8002 to avoid conflict with abnt-service on 8001
- [x] **CORS:** Python service allows `localhost:3000` and `zaeonos.com`
- [x] **Design:** Cyan-only palette (`#22d3ee`, `#06b6d4`, `#030014` bg, `rounded-[2rem]` glass card, Space Grotesk / JetBrains Mono)
