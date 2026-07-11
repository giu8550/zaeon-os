# Handoff do Executor — Aura: Harness + Tools + Memória

> **Documento de entrada do agente de implementação.** Auto-contido e rico de propósito:
> quanto mais contexto comprovado aqui, menos você infere — menos token, menos erro.
> Você está construindo a **camada agêntica da Aura** (a assistente/cientista da Zaeon) POR CIMA
> de uma base que já foi escrita no coworking e será comitada como o **PR #1** antes de você começar.

---

## 0. Contexto do produto (leia — orienta cada decisão)

A **Zaeon** é uma plataforma educacional (Next.js + Prisma/**MongoDB** + **Gemini/Vertex** como IA única).
A **Aura** é a agente que vive nas salas — hoje ela já responde e já tem um **tool-loop de 1 passo**
(Fase 0): quando o aluno pede "gere um podcast sobre X" / "faz um artigo sobre Y", o Gemini faz
function-calling, o servidor emite uma **sentinela** no stream (`@@STUDIO_ACTION@@` / `@@RESEARCH_ACTION@@`),
e o cliente executa a geração (Studio/documento). Seu trabalho é transformar esse loop de 1 passo
num **harness de verdade** (trajetória tipada multi-step, tools com runtime/permissão, memória
recuperável) — mantendo tudo atrás de flag e sem quebrar o que existe.

**Fontes-da-verdade (leia antes de codar, nesta ordem):**
1. `docs/AURA_AGENTIC_LAYER_PLAN.md` — o plano. **§8** contratos (intenção/saída/crítico), **§11** spec de engenharia (motor/tools/memória/execMode), **§13** runbook de PRs.
2. `docs/MEMORY_AND_PERSISTENCE.md` — a **escada de memória L0→L3** e as decisões (memória = standard; Atlas Vector nativo; agent-gateway parado).
3. Contratos TS já escritos (importe, não reinvente): `lib/agent/contracts.ts`, `lib/agent/memory.ts`, `lib/agent/transcript.ts`, `lib/agent/transcriptClient.ts`, `lib/agent/tools.ts`, `lib/agent/context.ts`, `lib/agent/actions.ts`.

---

## 1. O que JÁ ESTÁ PRONTO (o PR #1 — a base; parta daqui)

Tudo abaixo foi escrito no coworking, **transpila** e está no branch `aura/base-coworking-harness`.

**Memória L0 (UI não some):** `components/research/ResearchChat.tsx` persiste thread (`zaeon.research.thread.v1`)
e rascunho (`zaeon.research.draft.v1`) em localStorage e reidrata no mount — antes a Sala de Pesquisa
zerava ao trocar de aba. Paridade com `StudyCoworkChat` (`zaeon.cowork.thread.v1`).

**Memória L1 (transcrição durável — o ALICERCE):**
- `prisma/schema.prisma`: models `Conversation` e `ChatMessage`.
- `lib/agent/transcript.ts` (server): `resolveUserId()` (sessão→email→id), `ensureConversation()`, `appendMessages()`, `getRecent()`.
- `app/api/ai/transcript/route.ts`: `GET` hidrata por `(surface, scopeId)`, `POST` anexa turno. **Best-effort** (nunca derruba o chat).
- `lib/agent/transcriptClient.ts` (client): `appendTranscript()` fire-and-forget (`keepalive`), `hydrateTranscript()`.
- Fiado nos dois chats: append ao fim do turno + hidratação-fallback (L0 localStorage → L1 DB quando vazio).

**Contratos do harness:**
- `lib/agent/contracts.ts` (**PR01 já feito**): `IntentId`/`INTENTS`, `StructuredAnswer`+`ProvenanceRecord`, `ExaminerVerdict` (+ ScholarEval), `Mode`, `AcademicMode`, `ExecMode`, `WorkKind`, helpers `getIntentSpec`/`isIntentId`/`shouldRevise`/`academicModeForSurface`.
- `lib/agent/memory.ts`: `MemoryAPI` (`wakeUp/search/write`), `createMongoMemory()` (Atlas Vector), `nullMemory`, helpers `wingFromSurface`/`isMemorable`.
- `components/study/CoworkComposer.tsx`: toggle **Auto ⚡ / Guiado 🧭** (`execMode` em `localStorage "zaeon.execMode"`) — casca à espera do laço (PR07).

**Ações que só o dono/executor faz no PR #1 (infra):** rodar `npx prisma db push` (Mongo — **sem** arquivos de migração) para criar as coleções `conversations`/`chat_messages`; smoke-test do endpoint `/api/ai/transcript` logado (POST anexa, GET devolve). O índice do Atlas Vector **só** entra no PR-M3.

---

## 2. Regras invioláveis (protegem produção e teu orçamento)

1. **Flag + rollback.** Todo comportamento novo do laço atrás de `process.env.AURA_HARNESS` (server) /
   `localStorage "zaeon.harness"` (client). **Flag off ⇒ idêntico a hoje.** A rota `/api/ai/chat`
   (tool-loop Fase 0) continua intacta; o harness roda em paralelo até você virar a chave.
2. **Verificação SEM build.** O ambiente não builda Next e o macOS do dono **não tem `python`**.
   Verifique com `ts.transpileModule` (snippet no Apêndice A) — `category===1` = erro de sintaxe,
   bloqueia. Onde houver lógica pura (router, permit, stop conditions, examiner), escreva **vitest**.
   Prisma: `npx prisma db push` (Mongo, sem migração).
3. **UI é opt-in e preserva o ⟁ (U+27C1).** Nunca troque tela/aba inteira de uma vez; UI nova = toggle.
   Jamais substitua o ⟁ por ícone lucide. Feedback do dono vale como lei.
4. **Contratos ricos > inferência.** Se o tipo/símbolo existe em `lib/agent/*.ts`, **importe**. Cada
   tool tem teste de contrato (schema in/out) + anotação de risco.
5. **Provenance desde já.** Todo `ToolResult` carrega `provenance` (§10.1/10.2). Memória verbatim (nunca resumida por LLM na escrita).
6. **Memória = STANDARD.** `memory_search` é runtime `ts` + `minPlan` **free**. NUNCA gateie memória por plano — o gate de plano é só compute pesado (tiers de artefato T0–T3).

---

## 3. Sequência de PRs (caminho crítico serial → depois paraleliza)

> Detalhe canônico em `AURA_AGENTIC_LAYER_PLAN.md §13`. Cada PR: branch `aura/harness-prNN-slug`,
> ≤ ~6 arquivos, gate binário, DoD (§5). Nada mergeia com gate vermelho.

### TRILHA A — o motor (SERIAL, um destrava o outro)

**PR01 · Contratos como código — ✅ JÁ FEITO** (`lib/agent/contracts.ts`). Só valide que transpila e que `INTENTS` tem as 7 intenções.

**PR02 · Router `classify()`** → `lib/agent/router.ts`
- Objetivo: dado `(objective, ctx)`, devolver `{ intent: IntentId, mode: Mode, academicMode, kind? }`.
- Como: 1 chamada **Gemini Flash** com JSON forçado (schema das 7 intenções) + **fallback heurístico** sem rede: `isQuickPrompt` (≤8 palavras → `conversa`/`duvida_rapida`), verbos de geração ("gere/cria/faz um…" → `gerar_artefato`/`criar_trabalho`). `academicMode = academicModeForSurface(ctx.activeTab)`.
- Importe de `contracts.ts`: `IntentId`, `Mode`, `AcademicMode`, `INTENTS`, `isIntentId`.
- **Gate:** vitest cobrindo a heurística **sem** chamar rede (frase curta→quick; "gera um artigo sobre X" na pesquisa→`criar_trabalho`+`enforced`).
- Pitfall: o classificador é BARATO (temp baixa). Não use deep-think aqui.

**PR03 · Runtime das tools** → `lib/agent/runtime.ts`
- Implemente `ToolDef`/`ToolResult`/`runTool` (§11.2): middleware `permit()` **deny-by-default** (`ALLOW|DENY|REQUIRE_APPROVAL`) → `withTimeout` → `run` → **normaliza (nunca `throw`)**.
- Registre as tools que já existem como `ToolDef` runtime `ts`: `studio_generate`, `research_generate` (de `lib/agent/tools.ts`). Deixe stubs registráveis p/ `memory_search` (runtime `ts`, `minPlan` free), `literature_search` (runtime `python`, F2), `examiner`.
- `permit()` considera: `risk` × `ctx.plan` (`minPlan`) × curso × `demandGpu` × **`ctx.execMode`** (guiado eleva o limiar).
- **Gate:** vitest provando que `runTool` nunca lança (tool que estoura → `{ok:false,error}`) e que `permit` nega por padrão quando o plano não cobre `minPlan`.

**PR04 · Motor `runTrajectory`** → `lib/agent/trajectory.ts`
- Implemente o laço do §11.1: `route → (quick? draft→finalize) → plan → loop{ gather(Promise.all) → reason → draft → critique → shouldRevise? } → finalize`.
- Use `shouldRevise(verdict, spec, iter)` de `contracts.ts` (já pronto) para a stop-condition de revisão; some as outras (`orcamento`, `loop`, `maxIter`).
- `emit(step)` → action bus (`lib/agent/actions.ts`). `finalize` grava provenance + chama `memory.write` (via `MemoryAPI`; use `nullMemory` enquanto L3 não liga).
- Injete `HarnessDeps` (classify/plan/runTool/reason/draft/critique/emit/persistMemory) — mantém testável.
- **Atrás da flag `AURA_HARNESS`.** Flag off, a rota atual segue.
- **Gate:** vitest das stop conditions com `HarnessDeps` mockado (orçamento estoura→`orcamento`; `iter≥maxRevisions`→`maxIter`); reasoning sandwich só em `plan`+`critique`.

### TRILHA B — experiência (paralela após PR04)

**PR05 · Examiner** → `lib/agent/examiner.ts`: implementa `critique(): ExaminerVerdict` (ScholarEval adaptativo por intenção; `sem_fonte` = 1ª checagem barata, cruza `draft`×`evidencia`). Importe os tipos de `contracts.ts`.
**PR06 · Trace real** no `⟁`/`AuraThinking`: a UI passa a ler os `AgentStep` reais do action bus (troca o timer mockado). Flag off = frases adaptativas de hoje.
**PR07 · `execMode` dirige o laço**: `permit()` considera `ctx.execMode`; insere `await approvalGate(phase, st)` (após `plan`, antes de tool `write`/cara, antes de `finalize`) quando `guiado`. O toggle do composer **já existe** — aqui ele passa a agir.

### TRILHA C — memória / agentes / skills (paralela após PR04)

**PR-M2 · L2 wiring**: as salas alimentam o `AgentContext` durável de verdade (`setAgentContext`/`pushAgentAction`) nas transições (entrou na sala, abriu estudo, gerou artefato). Hoje o `StudyCoworkChat` monta contexto ad-hoc.
**PR-M3 · L3 memória semântica (STANDARD)**: ligue `lib/agent/memory.ts` —
  - model `MemoryDrawer` (bloco pronto em `MEMORY_AND_PERSISTENCE.md §4.3`) + `npx prisma db push`.
  - **Atlas Vector Search index** sobre `memory_drawers.embedding` (dims = `EMBED_DIM`, similaridade `cosine`, `filter` em `userId`).
  - `embed` via `gemini-embedding-001` (`output_dimensionality = EMBED_DIM`).
  - tool `memory_search` (runtime `ts`, free) no runtime (PR03).
  - `wakeUp` no início da sessão → injeta drawers relevantes no `AgentContext` (L2).
  - `write` no `finalize` da trajetória, **derivando do L1** (cada `ChatMessage`/citação/artefato de peso vira `Drawer` com `provenance`).
  - **Gate:** `search` filtra por `userId` sempre; `write` persiste verbatim + embedding; recall sem LLM.
**PR09 · Persona por curso** (add-on barato): injeta persona (9.1/9.6) no `systemContext`.
**PR10 · Microserviço Python** (`paper-lookup`/`scholar-evaluation`/`statistical-analysis`, molde `voice-engine`/`abnt-service`) — roda em CI/VPS, **não** no macbook.
**PR11 · Sala de Skills marketplace** — casa com o PR Plugin→Skill do `PLANO_SKILLS_PRS.md`.

**Ordem/paralelismo:** `PR01→PR02→PR03→PR04` serial (crítico). Depois PR05/06/07 e PR-M2/M3/09 em paralelo. PR10/PR11 fecham a cauda.

---

## 4. Decisões cravadas (NÃO reabrir — poupa rodada)

- **Memória = STANDARD** p/ toda conta; gate de plano é só compute de geração (tiers T0–T3), nunca memória.
- **Infra de memória = Mongo Atlas Vector Search**, nativo. **NÃO** ressuscitar `agent-gateway` (é a jogada de WhatsApp, parada) nem subir Postgres/pgvector p/ o app.
- **Persistência fica FORA do `/api/ai/chat`** (rota stateless/hot-path/sem sessão) — vive no endpoint dedicado `/api/ai/transcript`.
- **Camadas de memória L0→L3 ≠ tiers de compute T0–T3.** `L1` é o alicerce; `L3` deriva do `L1`.
- **Embedding:** default `gemini-embedding-001` (API, dim 1536, sem hosting); `embeddinggemma-300m` (768) só se hospedarmos o modelo.
- **Gemini é a IA única.** Sem OpenAI/Anthropic no runtime.

---

## 5. DoD de cada PR
(1) gate binário do §13 passou; (2) **transpila** (Apêndice A); (3) **flag off = idêntico a hoje**;
(4) 1 linha de CHANGELOG citando o contrato encarnado (§8/§11); (5) vitest onde há lógica pura.
Nada mergeia com gate vermelho — a Zaeon de produção fica sempre verde.

---

## Apêndice A — Verificar transpile (rode a cada arquivo tocado)
```bash
node -e '
const ts=require("typescript"),fs=require("fs");
for(const f of process.argv.slice(1)){
  const o=ts.transpileModule(fs.readFileSync(f,"utf8"),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}});
  const e=o.diagnostics.filter(d=>d.category===1);
  console.log((e.length?"ERR ":"ok  ")+f+(e.length?" :: "+e.map(x=>ts.flattenDiagnosticMessageText(x.messageText,"\n")).join("; "):""));
}
' lib/agent/router.ts lib/agent/runtime.ts   # etc.
```

## Apêndice B — Mapa de arquivos do harness (onde cada coisa mora)
| Peça | Arquivo | Estado |
|---|---|---|
| Contratos (intenção/saída/crítico) | `lib/agent/contracts.ts` | ✅ pronto |
| Memória L1 (server/endpoint/client) | `lib/agent/transcript.ts`, `app/api/ai/transcript/route.ts`, `lib/agent/transcriptClient.ts` | ✅ pronto |
| Memória L3 (contrato) | `lib/agent/memory.ts` | ✅ contrato; ligar no PR-M3 |
| Tools registry (Fase 0) | `lib/agent/tools.ts` | ✅ pronto |
| World-state durável | `lib/agent/context.ts` | ✅ existe; alimentar no PR-M2 |
| Action bus (trace) | `lib/agent/actions.ts` | ✅ existe; usar em PR04/PR06 |
| Router | `lib/agent/router.ts` | ⏳ PR02 |
| Runtime das tools | `lib/agent/runtime.ts` | ⏳ PR03 |
| Motor do laço | `lib/agent/trajectory.ts` | ⏳ PR04 |
| Examiner | `lib/agent/examiner.ts` | ⏳ PR05 |
