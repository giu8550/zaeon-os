# Suggestion Forge (porta 8003)

Terceiro engine FastAPI do monorepo `zaeon-os`, irmão de `research-engine` (8002) e
`abnt-service` (8001). É uma **capability stateless do Omega Scholar**: recebe um tópico +
nível acadêmico + referências verificadas e devolve **N propostas de trabalhos derivados**,
cada uma com termômetro multi-eixo (dificuldade/relevância/inovação/tempo) e um **tier de
qualidade determinístico**.

Contrato fechado: [`engine_spec.md`](./engine_spec.md). ADR: `docs/superpowers/specs/2026-06-05-suggestion-forge-adr.md`.

## Estrutura

```
suggestion-forge/
├── main.py         # FastAPI: /health, /forge, /reforge + CORS
├── models.py       # contrato Pydantic v2 (engine_spec §2)
├── classifier.py   # tier determinístico + invariantes I-1..I-10 + Monte Carlo
├── prompts.py      # loader de seções do OMEGA_SCHOLAR.md + vocabulário de lacunas + F1-F5
├── engine.py       # chamada Gemini + parser + retry loop (0.7→0.5→0.3) + calibração
├── conftest.py     # shim de sys.path para os testes
├── tests/          # models, classifier, prompts, engine, main + fixtures
└── requirements.txt
```

## Decisões-chave

- **Tier sempre recomputado pelo servidor** (`classifier.compute_tier`), sobrescreve o LLM — auditável.
- **Cut-points recalibrados** para `0.45 / 0.60 / 0.73` (ADR-001 D5): a fórmula original era
  inconsistente com sua distribuição-alvo. Pesos `0.30/0.30/0.25/0.15` inalterados.
- **Gemini** via `google-generativeai` + `GEMINI_API_KEY` (igual `research-engine`; o lado Next usa Vertex).
- **Loader do OMEGA** keyed por título de header (numeração do doc tem drift).

## Rodar

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # preencha GEMINI_API_KEY

# testes (não precisam de chave — Gemini é mockado)
python -m pytest -v --cov=. --cov-report=term-missing   # alvo: coverage >= 85%

# calibração Monte Carlo (gate de CI)
python -m pytest tests/test_classifier.py::test_monte_carlo_distribution_matches_targets -v

# servir
uvicorn main:app --port 8003 --reload
curl -s http://localhost:8003/health | jq
curl -s -X POST http://localhost:8003/forge -H 'Content-Type: application/json' \
  -d @tests/fixtures/sample_request.json | jq '.suggestions | length, .coverage_summary'
```

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/health`  | Liveness probe |
| POST | `/forge`   | `ForgeRequest` → `ForgeResponse` (N sugestões) |
| POST | `/reforge` | Igual, mas exige `exclude_titles` populado (diversificação forçada) |

Erros: `422` payload inválido · `503` Gemini indisponível/rate-limited · `500` inesperado.
