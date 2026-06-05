# Suggestion Forge — Engine Specification

> **Versão:** 1.0
> **Porta:** 8003
> **Stack:** FastAPI + Pydantic v2 + google-generativeai (Gemini 2.0 Flash)
> **Posição:** terceiro serviço FastAPI do monorepo `zaeon-os`, irmão de `research-engine` (8002) e `abnt-service` (8001)
> **Subordinação:** consome `OMEGA_SCHOLAR.md` como system prompt base — não é agente autônomo, é capability do Omega Scholar

---

## 1. ESCOPO

A Suggestion Forge recebe **um tópico + nível acadêmico + lista de referências verificadas** vindas de uma `ScholarSession` e devolve **N propostas de trabalhos derivados**, cada uma com:

- termômetro multi-eixo (dificuldade, relevância, inovação, tempo)
- tier de qualidade derivado deterministicamente
- desdobramentos completos (alvo de publicação, métodos, recursos, pré-requisitos, riscos, marcos, refs)

Ela **não** busca papers, **não** lê PDFs, **não** persiste — é stateless. O proxy Next (`/api/ai/suggestion-forge`) cuida de auth e persistência em `ScholarSession.suggestions`.

---

## 2. CONTRATO OPENAPI 3.1

```yaml
openapi: 3.1.0
info:
  title: Zaeon Suggestion Forge
  version: 1.0.0
  description: |
    Forja propostas de trabalhos acadêmicos derivados a partir de uma base de referências verificadas.
    Subordinada ao Omega Scholar (`OMEGA_SCHOLAR.md`).
  contact:
    name: Zaeon Research Platform
servers:
  - url: http://localhost:8003
    description: dev local
  - url: https://forge.zaeonos.com
    description: prod

paths:
  /health:
    get:
      summary: Liveness probe
      operationId: health
      responses:
        "200":
          description: serviço vivo
          content:
            application/json:
              schema:
                type: object
                required: [status, service, version]
                properties:
                  status: { type: string, enum: [ok] }
                  service: { type: string, enum: [zaeon-suggestion-forge] }
                  version: { type: string, example: "1.0.0" }

  /forge:
    post:
      summary: Gera N sugestões a partir das referências fornecidas
      operationId: forge
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ForgeRequest"
            examples:
              biotec_phd:
                $ref: "#/components/examples/BiotecPhdRequest"
              cs_msc:
                $ref: "#/components/examples/CsMscRequest"
      responses:
        "200":
          description: forja bem-sucedida
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ForgeResponse"
        "422":
          description: payload inválido (Pydantic)
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorBody" }
        "503":
          description: Gemini indisponível ou rate-limited
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorBody" }
        "500":
          description: erro inesperado
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorBody" }

  /reforge:
    post:
      summary: Re-forja exigindo diversificação contra títulos já emitidos
      operationId: reforge
      description: |
        Mesmo contrato de /forge, mas `exclude_titles` deve estar populado.
        O engine força `gap_type` distinto dos already-shown.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ForgeRequest"
      responses:
        "200":
          description: re-forja bem-sucedida
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ForgeResponse" }
        "422": { $ref: "#/paths/~1forge/post/responses/422" }
        "503": { $ref: "#/paths/~1forge/post/responses/503" }
        "500": { $ref: "#/paths/~1forge/post/responses/500" }

components:
  schemas:

    AcademicLevel:
      type: string
      enum: [grad, msc, phd, postdoc]
      description: |
        grad     = graduação (TCC, IC)
        msc      = mestrado / pós-graduação / extensão avançada
        phd      = doutorado
        postdoc  = pós-doutorado / pesquisa pioneira ultra

    QualityTier:
      type: string
      enum: [regular, muito_bom, excelente, excepcional]
      description: |
        regular     = banca de graduação
        muito_bom   = mestrado / extensão / Qualis B1-A2
        excelente   = doutorado / Qualis A1 / Q1 internacional
        excepcional = pós-doc / Nature, Science, Cell, PNAS

    GapType:
      type: string
      enum: [empirica, metodologica, geografica, temporal, interdisciplinar]
      description: vocabulário canônico extraído de research-engine/prompts.py

    Language:
      type: string
      enum: ["pt-BR", "en"]

    IncomingRef:
      type: object
      required: [title, authors, year, venue]
      properties:
        title: { type: string, minLength: 3, maxLength: 400 }
        authors: { type: string, minLength: 2, maxLength: 600 }
        year: { type: string, pattern: '^\d{4}$' }
        venue: { type: string, minLength: 2, maxLength: 200 }
        doi:
          type: [string, "null"]
          pattern: '^10\.\d{4,}\/.+$'
        abstract:
          type: [string, "null"]
          maxLength: 4000
          description: opcional — quando presente, melhora qualidade da forja em ~25%

    ForgeRequest:
      type: object
      required: [topic, user_level, references]
      properties:
        topic: { type: string, minLength: 2, maxLength: 500 }
        user_level: { $ref: "#/components/schemas/AcademicLevel" }
        references:
          type: array
          minItems: 3
          maxItems: 40
          items: { $ref: "#/components/schemas/IncomingRef" }
        count:
          type: integer
          minimum: 1
          maximum: 10
          default: 5
        exclude_titles:
          type: array
          items: { type: string, maxLength: 300 }
          default: []
        language:
          allOf: [{ $ref: "#/components/schemas/Language" }]
          default: "pt-BR"

    SuggestionAxes:
      type: object
      required:
        [difficulty, relevance, innovation, estimated_months_min, estimated_months_max]
      properties:
        difficulty: { $ref: "#/components/schemas/AcademicLevel" }
        relevance: { type: number, minimum: 0.0, maximum: 1.0 }
        innovation: { type: number, minimum: 0.0, maximum: 1.0 }
        estimated_months_min: { type: integer, minimum: 1, maximum: 120 }
        estimated_months_max: { type: integer, minimum: 1, maximum: 120 }

    SuggestionDesdobramento:
      type: object
      required:
        [publication_targets, required_methods, material_resources,
         prerequisites, risks, milestones, evidence_refs, cross_link_refs]
      properties:
        publication_targets:
          type: array
          items: { type: string, maxLength: 200 }
          minItems: 1
          maxItems: 6
          description: "ex: Qualis A2, PLoS ONE, arXiv cs.LG"
        required_methods:
          type: array
          items: { type: string, maxLength: 160 }
          minItems: 1
          maxItems: 10
          description: "ex: qPCR, Monte Carlo, fMRI, AlphaFold2"
        material_resources:
          type: array
          items: { type: string, maxLength: 200 }
          minItems: 0
          maxItems: 10
          description: equipamentos, reagentes, datasets, compute
        prerequisites:
          type: array
          items: { type: string, maxLength: 160 }
          minItems: 0
          maxItems: 8
          description: cursos, certificações, conhecimentos prévios
        risks:
          type: array
          items: { type: string, maxLength: 200 }
          minItems: 1
          maxItems: 8
          description: técnicos, éticos, de viabilidade — pelo menos um obrigatório
        milestones:
          type: array
          items: { type: string, maxLength: 200 }
          minItems: 3
          maxItems: 12
          description: marcos temporais até submissão
        evidence_refs:
          type: array
          items: { type: integer, minimum: 0 }
          minItems: 1
          description: índices (0-based) das references que sustentam a proposta
        cross_link_refs:
          type: array
          items: { type: integer, minimum: 0 }
          minItems: 0
          description: pares (0-based) que evidenciam a pós-lacuna

    Suggestion:
      type: object
      required:
        [id, title, rationale, novelty_angle, gap_type, gap_score,
         axes, quality_tier, desdobramentos]
      properties:
        id:
          type: string
          format: uuid
          description: uuid4 gerado pelo engine
        title: { type: string, minLength: 8, maxLength: 180 }
        rationale: { type: string, minLength: 20, maxLength: 400 }
        novelty_angle: { type: string, minLength: 8, maxLength: 140 }
        gap_type: { $ref: "#/components/schemas/GapType" }
        gap_score: { type: number, minimum: 0.0, maximum: 1.0 }
        axes: { $ref: "#/components/schemas/SuggestionAxes" }
        quality_tier: { $ref: "#/components/schemas/QualityTier" }
        desdobramentos: { $ref: "#/components/schemas/SuggestionDesdobramento" }

    ForgeResponse:
      type: object
      required: [suggestions, coverage_summary, generated_at]
      properties:
        suggestions:
          type: array
          minItems: 1
          maxItems: 10
          items: { $ref: "#/components/schemas/Suggestion" }
        coverage_summary:
          type: string
          minLength: 20
          maxLength: 600
          description: resumo do que a forja cobriu e o que ficou de fora
        generated_at:
          type: string
          format: date-time
        gemini_overconfidence_count:
          type: integer
          minimum: 0
          description: nº de propostas que precisaram de calibração reversa

    ErrorBody:
      type: object
      required: [detail]
      properties:
        detail: { type: string }

  examples:

    BiotecPhdRequest:
      summary: PhD em biotec pedindo 5 sugestões
      value:
        topic: "graphene oxide synthesis via bacterial fermentation"
        user_level: "phd"
        count: 5
        language: "pt-BR"
        exclude_titles: []
        references:
          - title: "In situ Biosynthesis of Bacterial Cellulose/Graphene Oxide Composites"
            authors: "Silva, R. et al."
            year: "2023"
            venue: "ACS Nano"
            doi: "10.1021/acsnano.3c01234"
            abstract: "We report a one-pot fermentation method..."
          - title: "PETase engineering for plastic depolymerization"
            authors: "Chen, L., Park, J."
            year: "2022"
            venue: "Nature Catalysis"
            doi: "10.1038/s41929-022-00789-1"
          - title: "Mycelium-based memristor arrays"
            authors: "Kawano, S. et al."
            year: "2024"
            venue: "Advanced Materials"
            doi: "10.1002/adma.202312456"

    CsMscRequest:
      summary: Mestrado em CS pedindo 3 sugestões
      value:
        topic: "retrieval-augmented generation for academic search"
        user_level: "msc"
        count: 3
        language: "pt-BR"
        exclude_titles: ["Hybrid BM25 + dense retrieval for scholarly QA"]
        references:
          - title: "REALM: Retrieval-Augmented Language Model Pre-Training"
            authors: "Guu, K., Lee, K., Tung, Z., Pasupat, P., Chang, M."
            year: "2020"
            venue: "ICML"
            doi: "10.48550/arXiv.2002.08909"
          - title: "Dense Passage Retrieval for Open-Domain Question Answering"
            authors: "Karpukhin, V. et al."
            year: "2020"
            venue: "EMNLP"
            doi: "10.18653/v1/2020.emnlp-main.550"
          - title: "Atlas: Few-shot Learning with Retrieval Augmented Language Models"
            authors: "Izacard, G. et al."
            year: "2022"
            venue: "JMLR"
            doi: "10.48550/arXiv.2208.03299"
```

---

## 3. RESPOSTA EXEMPLO (`200 OK`)

```json
{
  "suggestions": [
    {
      "id": "f3b2e9a4-7d31-4a2c-9e88-1f6c4a0b9e22",
      "title": "Bioeletroquímica de compósitos celulose-grafeno produzidos por Komagataeibacter: rota verde para eletrodos flexíveis de baixo custo",
      "rationale": "A literatura documenta a síntese in situ de cellulose/GO, mas nenhuma das refs caracteriza desempenho eletroquímico em ciclos > 10k. A pós-lacuna entre fermentação verde e eletrônica flexível abre rota inédita.",
      "novelty_angle": "Primeiro estudo a quantificar retenção de capacitância pós-10k ciclos em compósito bio-fermentado",
      "gap_type": "metodologica",
      "gap_score": 0.78,
      "axes": {
        "difficulty": "phd",
        "relevance": 0.82,
        "innovation": 0.81,
        "estimated_months_min": 30,
        "estimated_months_max": 42
      },
      "quality_tier": "excelente",
      "desdobramentos": {
        "publication_targets": ["ACS Nano (Q1)", "Advanced Functional Materials (Q1)", "Qualis A1"],
        "required_methods": [
          "fermentação estática com Komagataeibacter xylinus",
          "voltametria cíclica",
          "espectroscopia de impedância eletroquímica",
          "MEV-FEG",
          "Raman"
        ],
        "material_resources": [
          "biorreator 5L",
          "potenciostato Autolab PGSTAT",
          "estação MEV (acesso compartilhado)",
          "GO comercial (Sigma)"
        ],
        "prerequisites": [
          "Eletroquímica fundamental",
          "Microbiologia de fermentação",
          "Bioestatística (DOE)"
        ],
        "risks": [
          "variabilidade lote-a-lote da celulose bacteriana",
          "contaminação do GO afeta reprodutibilidade",
          "tempo de cultivo (7-14 dias) extende cronograma"
        ],
        "milestones": [
          "M1-M4: padronização do meio de cultura e curva de crescimento",
          "M5-M10: incorporação de GO e otimização de razão mássica",
          "M11-M18: caracterização eletroquímica baseline (1k ciclos)",
          "M19-M28: ciclagem prolongada (10k+) e análise de degradação",
          "M29-M36: submissão Q1 + revisões",
          "M37-M42: thesis defense"
        ],
        "evidence_refs": [0, 2],
        "cross_link_refs": [0, 1]
      }
    }
  ],
  "coverage_summary": "Forjadas 5 propostas cobrindo 4 tipos de lacuna (metodológica, interdisciplinar, temporal, empírica). Tipo geográfico não disparou — nenhuma das 3 refs explicita contexto geográfico restrito.",
  "generated_at": "2026-06-05T18:34:12.481Z",
  "gemini_overconfidence_count": 1
}
```

---

## 4. INVARIANTES (TESTADOS NO `classifier.py`)

| # | Regra | Ação no engine |
|---|-------|----------------|
| I-1 | `quality_tier == "excepcional"` ⇒ `difficulty ∈ {phd, postdoc}` E `innovation ≥ 0.80` | Re-prompt até passar, máx 2 tentativas. Depois rebaixa para `excelente`. |
| I-2 | `quality_tier == "excelente"` ⇒ `difficulty ∈ {msc, phd, postdoc}` E `gap_score ≥ 0.65` | Re-prompt; depois rebaixa para `muito_bom`. |
| I-3 | `quality_tier == "regular"` ⇒ `estimated_months_max ≤ 24` | Re-prompt; depois força clamp em 24. |
| I-4 | `estimated_months_max >= estimated_months_min` | Pydantic field validator. |
| I-5 | `(months_max - months_min) ≤ 0.6 × months_max` | Re-prompt. |
| I-6 | `len(desdobramentos.evidence_refs) ≥ 1` quando `len(references) ≥ 5` | Re-prompt obrigatório. |
| I-7 | `desdobramentos.risks` não pode estar vazio | Pydantic minItems=1. |
| I-8 | índices em `evidence_refs` / `cross_link_refs` devem ser válidos (`< len(references)`) | Sanitizar após parse; drop inválidos; se zerar, re-prompt. |
| I-9 | Diversificação: em `count ≥ 3`, pelo menos 2 `gap_type` distintos | Re-prompt se violar. |
| I-10 | `exclude_titles` não pode aparecer (case-insensitive, Levenshtein ≤ 0.15) entre `suggestions[].title` | Drop e re-gerar a faltante. |

**Fórmula determinística do tier** (sempre executada após parse, sobrescreve o que o LLM disser):

```python
def compute_tier(axes: SuggestionAxes, gap_score: float) -> QualityTier:
    w = {"grad": 0.25, "msc": 0.5, "phd": 0.75, "postdoc": 1.0}
    score = (0.30 * axes.relevance
           + 0.30 * axes.innovation
           + 0.25 * gap_score
           + 0.15 * w[axes.difficulty])
    if score >= 0.73: return "excepcional"   # recalibrado — ver nota abaixo
    if score >= 0.60: return "excelente"
    if score >= 0.45: return "muito_bom"
    return "regular"
```

> **Nota de calibração (2026-06-05, ADR-001 Decisão 5).** Os limiares originais
> `0.85 / 0.70 / 0.55` **não** produziam a distribuição esperada — com eixos
> uniformes a fórmula entregava `regular ≈ 58% · muito_bom ≈ 30% · excelente ≈ 11% ·
> excepcional ≈ 1%` (a fórmula nunca havia sido simulada). Mantivemos os **pesos**
> intactos e movemos apenas os **cut-points** para `0.45 / 0.60 / 0.73` — os quantis
> empíricos 0.32 / 0.70 / 0.92 do score sob amostragem uniforme — reproduzindo a
> distribuição-alvo abaixo com exatidão. Os pesos `0.30/0.30/0.25/0.15` permanecem
> a composição auditável; só os limiares mudaram.

**Validação de sanidade Monte Carlo** (rodar uma vez no CI):
- 10 000 amostras com distribuição uniforme nos eixos
- Distribuição esperada de tiers: `regular ≈ 32 ± 3%`, `muito_bom ≈ 38 ± 3%`, `excelente ≈ 22 ± 3%`, `excepcional ≈ 8 ± 2%`
- Falhar build se a distribuição sair dos intervalos.

---

## 5. ARQUITETURA INTERNA

```
                         ┌─────────────────┐
   /forge POST  ─────►   │ FastAPI router  │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ ForgeRequest    │  ◄── Pydantic v2 validate
                         │ (validated)     │
                         └────────┬────────┘
                                  │
                                  ▼
                ┌────────────────────────────────┐
                │ engine.generate_suggestions()  │
                └──┬─────────────────────────┬───┘
                   │                         │
                   ▼                         ▼
        ┌──────────────────┐   ┌────────────────────────┐
        │ prompts.build()  │   │ classifier.compute()   │
        │ (system + user)  │   │ (deterministic tier)   │
        └────────┬─────────┘   └────────────┬───────────┘
                 │                          │
                 ▼                          │
        ┌──────────────────┐                │
        │ Gemini 2.0 Flash │                │
        │ (model.gen)      │                │
        └────────┬─────────┘                │
                 │                          │
                 ▼                          │
        ┌──────────────────┐                │
        │ engine.parse()   │                │
        │ + sanity loop    │ ◄──────────────┘
        │ (max 3 retries)  │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ ForgeResponse    │ ──► JSON 200
        └──────────────────┘
```

**Retries:** até 3 tentativas com `temperature` decrescente (0.7 → 0.5 → 0.3) se invariantes I-1, I-2, I-3, I-5, I-6, I-9 falharem. Logar `gemini_overconfidence_count` no response.

---

## 6. FIXTURES DE TESTE (criar em `suggestion-forge/tests/fixtures/`)

`sample_request.json` — request mínimo válido para smoke test:

```json
{
  "topic": "synthetic DNA data storage",
  "user_level": "phd",
  "count": 3,
  "language": "pt-BR",
  "exclude_titles": [],
  "references": [
    {
      "title": "Towards practical, high-capacity, low-maintenance information storage in synthesized DNA",
      "authors": "Goldman, N. et al.",
      "year": "2013",
      "venue": "Nature",
      "doi": "10.1038/nature11875"
    },
    {
      "title": "Random access in large-scale DNA data storage",
      "authors": "Organick, L. et al.",
      "year": "2018",
      "venue": "Nature Biotechnology",
      "doi": "10.1038/nbt.4079"
    },
    {
      "title": "DNA Fountain enables a robust and efficient storage architecture",
      "authors": "Erlich, Y., Zielinski, D.",
      "year": "2017",
      "venue": "Science",
      "doi": "10.1126/science.aaj2038"
    }
  ]
}
```

`malformed_gemini_output.json` — saída inválida do LLM para testar parser:

```json
{
  "raw": "```json\n{ \"suggestion\": { \"title\": \"X\", broken json"
}
```

`overconfident_response.json` — resposta que viola I-1 (excepcional sem PhD):

```json
{
  "suggestions": [{
    "title": "...",
    "quality_tier": "excepcional",
    "axes": { "difficulty": "grad", "innovation": 0.95, "relevance": 0.9, "estimated_months_min": 6, "estimated_months_max": 10 },
    "gap_score": 0.9
  }]
}
```

---

## 7. PROMPT SKELETON (`prompts.py`)

```python
def build_system_prompt(language: str) -> str:
    omega_id = _load_omega_section("§1")  # cached, TTL 60s
    omega_loop = _load_omega_section("§4.2 F3-F5")
    omega_cite = _load_omega_section("§6")
    research_gap_vocab = _load_research_engine_phase1()  # FASE 1 do research-engine/prompts.py

    return f"""{omega_id}

{omega_loop}

{omega_cite}

{research_gap_vocab}

Você é a SUGGESTION FORGE — capability do Omega Scholar para gerar propostas derivadas.

PROCESSO INTERNO (5 fases):

F1 — CARTOGRAFAR as referências fornecidas:
   Para cada ref, extraia mentalmente: domínio, métodos, populações, recorte temporal, lacunas explícitas.

F2 — CRUZAR PARES procurando pós-lacunas:
   Para cada par (ref_i, ref_j), pergunte: "Se i estabelece X e j estabelece Y, qual território INEXPLORADO emerge do cruzamento?"

F3 — GERAR {{count}} propostas DIVERSIFICADAS:
   Cubra pelo menos {{min_gap_types}} tipos de lacuna distintos (empirica, metodologica, geografica, temporal, interdisciplinar).
   NÃO repita títulos de exclude_titles (case-insensitive).

F4 — CALIBRAR EIXOS para cada proposta:
   • difficulty ∈ {{grad, msc, phd, postdoc}} — ancorada no esforço REAL, não no nível do usuário
   • relevance, innovation ∈ [0,1]
   • estimated_months_min, estimated_months_max ∈ [1, 120]
   • gap_score ∈ [0,1]

F5 — DESDOBRAR cada proposta:
   publication_targets, required_methods, material_resources, prerequisites,
   risks (mín 1), milestones (mín 3), evidence_refs (mín 1 quando refs ≥ 5),
   cross_link_refs.

SAÍDA: JSON puro, sem markdown, conforme ForgeResponse.
Idioma: {language}.
"""


def build_user_message(req: ForgeRequest) -> str:
    refs_block = "\n".join(
        f"[{i}] {r.title} — {r.authors} ({r.year}, {r.venue})"
        + (f" doi:{r.doi}" if r.doi else "")
        + (f"\n    abstract: {r.abstract[:300]}" if r.abstract else "")
        for i, r in enumerate(req.references)
    )
    exclude_block = ""
    if req.exclude_titles:
        joined = "\n".join(f"  • {t}" for t in req.exclude_titles)
        exclude_block = f"\nTÍTULOS PROIBIDOS:\n{joined}\n"

    return f"""TÓPICO: "{req.topic}"
NÍVEL DO SOLICITANTE: {req.user_level}
NÚMERO DE PROPOSTAS: {req.count}

REFERÊNCIAS DISPONÍVEIS:
{refs_block}
{exclude_block}
Gere {req.count} propostas conforme o processo F1-F5.
"""
```

---

## 8. CHECKLIST DE IMPLEMENTAÇÃO

Para o agente Claude Code marcar enquanto executa:

- [ ] Scaffold `suggestion-forge/` espelhando `research-engine/`
- [ ] `requirements.txt` com `fastapi, pydantic>=2, google-generativeai, python-dotenv, uvicorn[standard], pytest, httpx`
- [ ] `models.py` completo conforme §2
- [ ] `classifier.py` com `compute_tier()` + invariantes I-1 a I-10
- [ ] `prompts.py` com skeleton de §7 + loader de seções de `OMEGA_SCHOLAR.md` (cache TTL 60s)
- [ ] `engine.py` com retry loop (3 tentativas, temperature decrescente)
- [ ] `main.py` com `/health`, `/forge`, `/reforge` + CORS espelhando research-engine
- [ ] `tests/test_models.py` — 8 testes mínimos cobrindo validators
- [ ] `tests/test_classifier.py` — 10 testes cobrindo I-1 a I-10
- [ ] `tests/test_engine.py` — smoke com mock do Gemini + caso `malformed_gemini_output.json`
- [ ] `tests/fixtures/` com os 3 JSONs de §6
- [ ] CI: rodar Monte Carlo 10k de calibração e falhar se distribuição sair dos intervalos esperados (§4)
- [ ] `.env.example` com `GEMINI_API_KEY` documentado
- [ ] `README.md` curto do serviço (1 página) explicando como rodar, testar, e contratos
- [ ] Smoke manual: `curl -X POST http://localhost:8003/forge -d @tests/fixtures/sample_request.json` retorna 200 com ≥ 1 suggestion

---

## 9. VERIFICAÇÃO FINAL DO ENGINE (antes de integrar com Next)

```bash
cd suggestion-forge
python -m pytest -v --cov=. --cov-report=term-missing
# alvo: coverage ≥ 85%

# Monte Carlo de calibração
python -m pytest tests/test_classifier.py::test_monte_carlo_distribution -v -s

# Boot do serviço
uvicorn main:app --port 8003 --reload &
sleep 2
curl -s http://localhost:8003/health | jq

# Smoke E2E
curl -s -X POST http://localhost:8003/forge \
  -H 'Content-Type: application/json' \
  -d @tests/fixtures/sample_request.json | jq '.suggestions | length, .coverage_summary'
```

---

**Fim do engine spec. A partir daqui, Claude Code tem contrato fechado para implementar sem ambiguidade.**
