# HARNESS DA AURA — Plano canônico (fonte única)

> **Este é o documento único do harness.** Consolida e substitui a papelada dispersa
> (`HANDOFF_EXECUTOR`, `MASTER_HARNESS_ACTIVATION`, `ACTIVATE_HARNESS_NOW`, `CLAUDE_CODE_*`,
> `PLANO_NOVO_SERVER_*`) — esses viram **referência histórica**; a verdade operacional é aqui.
> Detalhe de contratos/tipos continua em `AURA_AGENTIC_LAYER_PLAN.md` (§8 contratos, §11 spec).
> Atualizado 2026-08. **Ressalva:** estado abaixo é do último sync do git (11/jul, `16b6f48`);
> reconfirme com `git fetch` antes de executar (Passo 0).

---

## 1. O que é o harness (em uma tela)

A Aura deixa de "responder texto" e passa a operar uma **trajetória tipada** por turno:
`route → plan → gather → reason → draft → critique → (revise) → finalize`. Cada resultado
intermediário é tipado (evidência com fonte, rascunho, veredito do crítico), não texto solto.

Bases que inspiram cada peça (todas permissivas):
- **Laço/guardrails/reasoning-sandwich** → awesome-harness-engineering.
- **Pipeline por estágios + crítico com reflexão** → SakanaAI/AI-Scientist.
- **Estado tipado + checkpoint** → LangGraph.
- **Crítico ScholarEval (8 dims + soundness/contribution)** → K-Dense scientific-writer.
- **Memória verbatim wing/room/drawer + recall barato** → MemPalace (nativo no Mongo Atlas).
- **Provenance + grading de evidência** → ai4s-research/open-science.
- **error-as-observation / retry numa camada** → smolagents/OpenHands, LangGraph.

Decisões travadas: Gemini única IA; memória STANDARD (todas as contas); harness default-on
(kill-switch `AURA_HARNESS="0"`); UI mantém ⟁ + liquid glass; verificação por `transpileModule`+`vitest`
(sem `next build`); Prisma `db push` (Mongo, sem migração).

## 2. Estado atual (verificado — reconfirmar no Passo 0)

**✅ EM `main` (PR #113) — código, não plano:**
- Motor + wiring: `lib/agent/{trajectory,aura-harness,router,runtime,examiner,contracts,errors}.ts`; `runTrajectory` ligado no `/api/ai/chat` atrás de `AURA_HARNESS`.
- **Memória L3:** `lib/agent/{memory,memory-provider}.ts` — `MemoryDrawer`, recall híbrido (`$vectorSearch`+`$rankFusion`/RRF), `memory_search`, `wakeUp`+`write`, curadoria verbatim.
- Conectores (cliente MCP + `model Connector`) e skills marketplace core.

**❌ Falta pra ser VISÍVEL e COMPLETO:**
| # | Lacuna | Natureza | Onde |
|---|---|---|---|
| G1 | Render `StructuredAnswerView` não está em main (resposta chega espremida em texto) | código | `origin/aura/base-coworking-harness` (trazer só o componente) |
| G2 | Índices **Atlas Vector/Text** da memória não criados | infra | Atlas |
| G3 | Deploy do main confirmado + flag on | infra | VPS |
| G4 | `/api/health` sem `GIT_SHA`/`harness` (cegueira "o que está no ar") | código | patch pronto |
| G5 | Cobertura estreita (só aura/stream/!fileData; outros agentes/Projetos fora) | código | route.ts |
| G6 | `execMode`/HITL, trace real no ⟁, world-state (PR-M2) | código | — |
| G7 | Rename Plugin→Skill + UI de Opções (Skills/Conectores/MCP) | código | — |
| G8 | Molécula 3D e demais viewers ricos | feature | `RICH_ARTIFACTS_MOLECULE.md` |

## 3. Roadmap de integração (ordem por dependência)

**Fatia A — tornar o harness VISÍVEL (mínimo pra "ver funcionar"):**
- **A1 · Render** (G1): trazer `StructuredAnswerView` de `origin/aura/base-coworking-harness` (só o componente — NÃO o `route.ts` dessa branch, que regride o motor); rota emite `@@STRUCTURED@@ + JSON(answer)` no branch de texto quando há campos ricos; cliente (`StudyCoworkChat`/`ResearchChat`) renderiza. *Gate:* resposta vem com núcleo/conceitos/fontes/próximos-passos; `AURA_HARNESS=0` = texto puro.
- **A2 · Health+SHA** (G4): `/api/health` devolve `{commit, harness}`; injetar `GIT_SHA` no deploy.

**Fatia B — ligar a MEMÓRIA (código já pronto; falta infra):**
- **B1 · Índices Atlas** (G2): `prisma db push` (cria `memory_drawers`/`connectors`) + índice `memory_drawers_vec` (vector 1536, cosine, filter `userId`) + `memory_drawers_text` (search: `text`/`room`/`wingLabel`). *Gate:* `getSearchIndexes()` `queryable:true`; recall traz o drawer certo; sem índice = degrada muda (não quebra).

**Fatia C — completar (aditivo, pós-visível):**
- C1 cobertura total (G5) · C2 execMode/trace/world-state (G6) · C3 rename+UI Opções (G7) · C4 molécula/viewers ricos (G8).

**Fatia D — deploy (quando A+B estiverem verdes):**
- Confirmar deploy do main + `AURA_HARNESS` on + smoke. Comandos de detalhe: seção "Deploy" abaixo. Para um **server novo** de teste, o runbook completo está no histórico (`PLANO_NOVO_SERVER_HARNESS_MEMORIA.md`) — decidir server/DB isolado quando for a hora.

## 4. Deploy (resumo operacional)
Stack `docker-compose.beta.yml` (web+redis+caddy+voz+abnt+pdf-loader; Mongo = Atlas externo; 2vCPU/8GB).
`.env` essencial: `DATABASE_URL`/`MONGODB_URI`, `NEXTAUTH_URL`+`NEXTAUTH_SECRET`, `GOOGLE_CREDENTIALS`+`GOOGLE_PROJECT_ID` (IA + embeddings da memória), `GEMINI_MODEL*`, `AURA_HARNESS=1`.
Rollback sempre: `AURA_HARNESS=0` + `--force-recreate web` → legado em segundos, sem redeploy.

## 5. Definition of Done do harness "vivo e visível"
- [ ] Passo 0: `git fetch` — estado do main reconfirmado.
- [ ] A1 render + A2 health mergeados.
- [ ] B1 índices Atlas `queryable:true`.
- [ ] Deploy com `AURA_HARNESS` on; `/api/health` → `harness:"on"`.
- [ ] Smoke: Sala de Estudos responde estruturado + gera artefato + recall de memória + kill-switch.

## 6. Referências-base — camada ESTRUTURAL (como o agente pensa/age/renderiza)
Estas são as bases do **motor**; as bases factual/contextual vivem em `AGENTIC_LAYER.md`.
- **Laço/guardrails/reasoning-sandwich** → `awesome-harness-engineering`.
- **Pipeline por estágios + crítico/reflexão** → `SakanaAI/AI-Scientist` (+v2).
- **Estado tipado + checkpoint/retry** → `LangGraph`.
- **error-as-observation** → `smolagents` / `OpenHands`.
- **Generative UI (modelo emite → componente inline)** → `vercel/ai` (AI SDK, base preferida p/ artefatos) · `tambo` (referência de registry).
- **best-of-N com crítico como fitness** → `ShinkaEvolve`.

## 7. Camada agêntica (Tutores) — roda EM CIMA deste harness
O harness é o motor genérico. Um **tutor de domínio** (persona + skills + memória + rigor, escopados
a uma área) é uma configuração que roda no mesmo `runTrajectory`. Especificação completa, roster de
agentes e a seção "Tutores" da navbar: **`AGENTIC_LAYER.md`** (o 2º doc canônico). Regra: a camada
agêntica **não** reescreve o harness — parametriza-o via `AgentContext` (persona/skills/wing/rigor).

## 8. Como esta PR deve ser tratada
Esta PR entrega **só o plano** (este doc + `AGENTIC_LAYER.md`). Nenhuma linha de produção muda por ela.
As fatias A–D e a camada agêntica viram PRs próprias, cada uma com seu gate, revisadas contra estes documentos.
