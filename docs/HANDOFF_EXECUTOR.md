# Handoff do Executor (Claude Code) — Aura: Harness + Tools + Memória

> **Documento de entrada do Claude Code.** Auto-contido e rico de propósito: quanto mais contexto
> comprovado aqui, menos você infere — menos token, menos erro. Você está ligando a **camada
> agêntica da Aura** (a assistente/cientista da Zaeon) POR CIMA de uma base já escrita no coworking.
>
> **Estado atual (2026-07-11): PR01–PR05 já ESCRITOS e transpilando** no branch
> `aura/base-coworking-harness` (contratos, router, runtime, motor, examiner). **Sua tarefa central
> é o §6: escrever o adaptador `HarnessDeps` (liga o motor ao Gemini/tools/memória) e fazer o
> wiring atrás da flag** — mais o PR-M3 (memória L3) e PR-M2 (world-state). O que falta é integração,
> não reinventar contratos. Se um símbolo existe em `lib/agent/*.ts`, **importe**.

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

**Contratos + motor do harness (PR01–PR05 escritos e transpilando):**
- `lib/agent/contracts.ts` (**PR01**): `IntentId`/`INTENTS`, `StructuredAnswer`+`ProvenanceRecord`, `ExaminerVerdict` (+ScholarEval), `Mode`/`AcademicMode`/`ExecMode`/`WorkKind`, `shouldRevise`/`isIntentId`/`academicModeForSurface`.
- `lib/agent/router.ts` (**PR02**): `classify()` (geminiJson + fallback heurístico) + `__tests__/router.test.ts`.
- `lib/agent/runtime.ts` (**PR03**): `ToolDef`/`ToolResult`/`ToolCtx`, `permit()` deny-by-default, `runTool` (nunca lança), registry (`registerTool`/`schemasFor`).
- `lib/agent/trajectory.ts` (**PR04**): `runTrajectory()` + `HarnessDeps` (interface) + `TrajectoryState` + stop conditions.
- `lib/agent/examiner.ts` (**PR05**): `critique()` = `checkSemFonte` (determinístico) + ScholarEval (geminiJson).
- `lib/plans.ts`: `planRank`/`planAtLeast`/`PLAN_ORDER` (gating do permit).
- `lib/agent/memory.ts`: `MemoryAPI` (`wakeUp/search/write`), `createMongoMemory()` (Atlas Vector), `nullMemory`, `wingFromSurface`/`isMemorable` — **contrato pronto; ligar no PR-M3**.
- `components/study/CoworkComposer.tsx`: toggle **Auto ⚡ / Guiado 🧭** (`execMode` em `localStorage`) — casca à espera do PR07.

**Ações que só o dono/executor faz no PR #1 (infra):** rodar `npx prisma db push` (Mongo — **sem** arquivos de migração) para criar as coleções `conversations`/`chat_messages`; smoke-test do endpoint `/api/ai/transcript` logado (POST anexa, GET devolve). O índice do Atlas Vector **só** entra no PR-M3.

---

## 2. Regras invioláveis (protegem produção e teu orçamento)

1. **Harness LIGADO POR PADRÃO em TODAS as salas (decisão do Martinez, 2026-07-11).** O laço é o
   caminho **default** de todo chat de IA — **estudos, pesquisa, aula, projetos, lounge**. A flag
   `AURA_HARNESS` é um **kill-switch**, não um opt-in: **ligado a menos que `AURA_HARNESS === "0"`**
   (emergência/rollback). O tool-loop Fase 0 vira o **fallback** que o `runTrajectory` já aciona
   sozinho (nunca lança). ⇒ A segurança NÃO vem mais de "flag off"; vem de **(a)** o harness responder
   no MESMO formato que os chats já consomem (sem tocar o cliente) e **(b)** o fail-safe do motor.
   **Não** existe sala com IA fora do harness — se um chat de IA não passa pelo `runTrajectory`, é bug.
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

**PR02 · Router `classify()`** → `lib/agent/router.ts` — ✅ **JÁ FEITO** (transpila; heurística 6/6).
- Devolve `{ intent, mode, academicMode, kind? }`; `classify()` tenta `geminiJson` (Flash, temp 0, timeout 8s) e **cai na `heuristicClassify`** em qualquer falha/inválido — nunca lança. `mode`/`academicMode` sempre derivados dos contratos.
- Exports úteis pro resto: `heuristicClassify`, `detectWorkKind`, `isQuickPrompt`, `ClassifyCtx`.
- **Gate:** `lib/agent/__tests__/router.test.ts` (rode `npx vitest run` no teu mac — no sandbox o rollup nativo falta). Valide antes de seguir pro PR03.

**PR03 · Runtime das tools** → `lib/agent/runtime.ts` — ✅ **JÁ FEITO** (transpila).
- Pronto: `ToolDef`/`ToolResult`/`ToolCtx`, `permit()` deny-by-default (`planAtLeast` + GPU + risk×execMode), `runTool` (nunca lança, `withTimeout`), registry (`registerTool`/`getTool`/`listTools`/`schemasFor`).
- **O que falta (seu):** REGISTRAR as tools reais como `ToolDef` — `studio_generate`/`research_generate` (de `tools.ts`, runtime `ts`), `memory_search` (runtime `ts`, `minPlan:"free"`), depois `literature_search` (python, F2). Escreva o `vitest` do gate (runTool nunca lança; permit nega < minPlan).

**PR04 · Motor `runTrajectory`** → `lib/agent/trajectory.ts` — ✅ **JÁ FEITO** (transpila).
- Pronto: o laço completo (`route→quick?→plan→loop{gather‖→reason→draft→critique→shouldRevise}→finalize`), `TrajectoryState`, stop conditions (`aprovado/maxIter/orcamento/erro`), `finalize` com provenance + `persistMemory`. **Nunca lança.** Toda I/O entra por `HarnessDeps` (interface exportada).
- **O que falta (seu):** implementar `HarnessDeps` — é o **§6** abaixo. E o `vitest` das stop conditions com deps mockado.

### TRILHA B — experiência (paralela após PR04)

**PR05 · Examiner** → `lib/agent/examiner.ts` — ✅ **JÁ FEITO** (transpila).
- Pronto: `critique(input, {heavy?})` = camada barata determinística `checkSemFonte` (cruza `draft`×`evidencia`, sem LLM) + ScholarEval via `geminiJson` (dims adaptativas por intenção), funde issues, **nunca lança** (fallback conservador). `heavy` usa o Pro.
- **O que falta (seu):** ligar `critique` como o `HarnessDeps.critique` (§6) e o `vitest` do `checkSemFonte`.
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
(1) gate binário do §13 passou; (2) **transpila** (Apêndice A); (3) **sem regressão com o harness ligado (default)** — cada sala responde igual-ou-melhor; `AURA_HARNESS="0"` = fallback legado;
(4) 1 linha de CHANGELOG citando o contrato encarnado (§8/§11); (5) vitest onde há lógica pura.
Nada mergeia com gate vermelho — a Zaeon de produção fica sempre verde.

---

## 6. SUA TAREFA CENTRAL — o adaptador `HarnessDeps` + wiring (PR-Wire)

O motor (`runTrajectory`) está pronto mas é **puro**: toda I/O entra por `HarnessDeps`
(exportada em `lib/agent/trajectory.ts`). Escreva **`lib/agent/aura-harness.ts`** que monta as deps
com Gemini/tools/memória, e ligue no `/api/ai/chat` atrás da flag. Cada método mapeia assim:

```ts
// lib/agent/aura-harness.ts  (NOVO — o "cola" entre motor e a stack real)
import { runTrajectory, type HarnessDeps, type TrajectoryState } from "@/lib/agent/trajectory";
import { classify } from "@/lib/agent/router";
import { critique as examinerCritique } from "@/lib/agent/examiner";
import { runTool, getTool, schemasFor, type ToolCtx } from "@/lib/agent/runtime";
import { INTENTS, type StructuredAnswer } from "@/lib/agent/contracts";
import { geminiJson } from "@/lib/scholar/gemini";
// import { createMongoMemory } from "@/lib/agent/memory"  // PR-M3

export function buildAuraDeps(ctx: ToolCtx, emit: (s:any)=>void): HarnessDeps {
  return {
    classify: (obj) => classify(obj, ctx),                         // → router.ts (§C2 usa geminiJson)
    plan:     async (st) => planSteps(st),                         // geminiJson → Step[] (tools da intenção: INTENTS[st.intent].tools)
    runTool:  (name, args) => { const d = getTool(name); return d ? runTool(d, args, ctx) : Promise.resolve({ok:false,error:"tool desconhecida",provenance:{}}); },
    reason:   async (st) => geminiJson<{reasoning:string}>(SYS_REASON, JSON.stringify({obj:st.objective,ev:st.evidence})).then(r=>r.reasoning).catch(()=>""),
    draft:    async (st) => geminiJson<StructuredAnswer>(SYS_DRAFT(st), draftPrompt(st)).catch(()=>({nucleo:""})),  // schema = INTENTS[st.intent].required
    critique: (st) => examinerCritique({ objective: st.objective, intent: st.intent, academicMode: st.academicMode, draft: st.draft ?? {nucleo:""} }, { heavy: st.mode==="research" }),
    emit,                                                          // → adaptador do action bus (ver GOTCHA §C4)
    persistMemory: async (writes) => { /* PR-M3: createMongoMemory(...).write(drawers derivados) */ },
  };
}
```

**Regras do adaptador:** `plan`/`reason`/`draft` são as ÚNICAS chamadas de geração; `plan` e
`critique` são as fatias "deep-think" do reasoning-sandwich (use `GEMINI_MODEL_PRO` se
`deepThinkEnabled`, senão Flash). O `draft` deve devolver os campos que `INTENTS[intent].required`
exige. Nada de LLM fora desses três + examiner + router.

**Wiring no `/api/ai/chat/route.ts` (ponto: após :220, antes dos branches :334/:385):**
```ts
// LIGADO POR PADRÃO (kill-switch): só desliga se AURA_HARNESS === "0".
if (process.env.AURA_HARNESS !== "0" && agentKey === "aura") {
  const toolCtx = { userId, plan: userPlan, execMode, surface, traceId };  // surface: estudos|pesquisa|aula|projetos|lounge
  const emit = (s) => { /* mapeia TrajectoryStep → AgentStep do action bus (GOTCHA §C4) e/ou stream */ };
  const { answer } = await runTrajectory(prompt, toolCtx, buildAuraDeps(toolCtx, emit));
  // responder: se answer.artifacts → emitir STUDIO_SENTINEL/RESEARCH_SENTINEL (mesma sentinela de hoje);
  //            senão → streamar answer.nucleo (+ desenvolvimento/…) como texto (datilografia do cliente já trata).
  return /* Response no MESMO formato que os chats já consomem */;
}
// AURA_HARNESS === "0" (kill-switch) → cai no fluxo atual como fallback.
```
**Compatibilidade de saída é obrigatória:** o `StudyCoworkChat`/`ResearchChat` já sabem ler texto
puro (datilografia) e as sentinelas `@@STUDIO_ACTION@@`/`@@RESEARCH_ACTION@@`. Faça o harness
responder NESSE formato — não mude o cliente. `userId` via `resolveUserId()`/`studioUid()` (§C5);
`userPlan` via `effectivePlan`/`normalizePlan` (`lib/plans.ts`).

### 6.0 · COBERTURA — o harness em TODAS as salas (incl. Projetos)
O laço é o default de **todo chat de IA**. Garanta cobertura por superfície:
- **estudos / pesquisa / aula / lounge** — passam pelo `/api/ai/chat` com `agent:"aura"`; o branch acima já cobre. Confirme que cada chat manda `surface` correto (o `classify` usa pra `academicMode`).
- **projetos (Zaeon Code)** — hoje tem fluxo próprio (single-file, sem continuidade de chat, [[zaeon-code-continuidade]]). **Faça o chat de IA dos Projetos também passar pelo `runTrajectory`** com `surface:"projetos"`: se ele usa outra rota/endpoint, aplique o MESMO wiring lá (ou redirecione pro `/api/ai/chat` com `agent:"aura"`, `surface:"projetos"`). A execução de código continua sendo uma **tool/handoff** dentro da trajetória (não sai do laço). Nenhuma sala com IA pode ficar fora do harness.
- **Regra de aceite de cobertura:** faça um grep por chamadas a modelos de IA (`/api/ai/chat`, `getGeminiChatModel`, `generateContentStream`, `geminiJson` em superfícies de chat) e confirme que TODO chat de usuário com IA entra no `runTrajectory`. Chat de IA fora do laço = bug a corrigir nesta PR.

### 6.1 · PR-M3 (memória L3) — o `persistMemory` e o `memory_search`
- `prisma db push` do model `MemoryDrawer` (bloco em `MEMORY_AND_PERSISTENCE.md §4.3`).
- **Atlas Vector index** `memory_drawers_vec` (dims=`EMBED_DIM`=1536, `cosine`, filter `userId`).
- `createMongoMemory({ drawers, embed })` (`lib/agent/memory.ts`): `embed` = `gemini-embedding-001`
  (`output_dimensionality:1536`); `drawers` = coleção Mongo. Registre `memory_search` como `ToolDef`
  (runtime `ts`, `minPlan:"free"`) cujo `run` chama `memory.search`.
- **Recall HÍBRIDO (lição Hermes/agent-gateway):** funda `$vectorSearch` + índice `$text` do Mongo.
- `persistMemory(writes)` no `finalize`: cada `Finding`/mensagem/artefato de peso vira `Drawer`
  (verbatim; `wingFromSurface`; `isMemorable`) — **deriva do L1** (`conversationId` em `sourceRef`).

### 6.2 · PR-M2 (world-state) — alimentar o `AgentContext`
Nas transições das salas, chame `setAgentContext({...})` / `pushAgentAction(kind, detail)`
(`lib/agent/context.ts`, §C3) — entrou na sala, abriu estudo, gerou artefato. Hoje o `StudyCoworkChat`
monta contexto ad-hoc; passe a usar o store durável para o `wakeUp` da memória injetar recall nele.

### 6.3 · Ordem sugerida pro Claude Code
1. **PR-Wire** (§6 + §6.0): `aura-harness.ts` + registrar tools + branch no route **ligado por padrão** em TODAS as salas (incl. Projetos). Gate: com o harness on (default), cada superfície responde SEM regressão (1 turno de texto responde igual ou melhor + 1 pedido de artefato dispara a sentinela); `AURA_HARNESS="0"` cai no fallback legado.
2. **PR-M3** (§6.1): memória real (db push + Atlas + memory_search + persistMemory). Gate: `memory_search` filtra por `userId`; recall volta drawer certo.
3. **PR-M2** (§6.2): world-state. 4. **PR06/PR07** (trace real + execMode). 5. **PR09/10/11** (persona/skills python/marketplace).
Cada um: vitest onde há lógica + `transpileModule` + flag off idêntico + 1 linha de CHANGELOG.

---

## 7. Matriz de ESTADOS DE UX (obrigatória) — o que existe hoje × o que falta

> Auditoria 2026-07-11 dos chats (`StudyCoworkChat`, `ResearchChat`, `AuraThinking`, `StudioBlock`,
> `CoworkComposer`). Cada fase do motor e cada tool PRECISA de um reflexo no chat. Legenda:
> ✅ existe · ⚠️ parcial · ❌ falta. Os ❌/⚠️ são **entregáveis de UX** (parte da PR-Wire / PR06 / novas PRs de UX).

| # | Estado / função | Fase do motor | Hoje no chat | Ação |
|---|---|---|---|---|
| A | Composer ocioso | — | ✅ ⟁ "respira" (`CoworkComposer`) | manter |
| B | Digitando input + rascunho | — | ✅ draft L0 (localStorage) | manter |
| C | **Pensando (pré-1º token)** | route→plan→gather→reason | ⚠️ `AuraThinking` existe mas as fases correm **por TEMPO**, não pelas fases REAIS | **PR06:** ligar `AuraThinking.phases` aos `TrajectoryStep` do `emit` (mapa fase→rótulo: route/plan="Planejando", gather="Buscando fontes", reason="Raciocinando", draft="Elaborando", critique="Verificando") |
| D | **"Escrevendo…" (streaming)** | draft (stream) | ✅ datilografia letra-a-letra é o "escrevendo" | manter; garantir que o harness **streame** o `nucleo`/seções (não devolva tudo de uma vez) |
| E | Tool síncrona rápida (guia/mapa/faq) | gather | ⚠️ vira texto estático "Gerando o artefato…" | cartão com estado "gerando" curto |
| F | **Tool ASSÍNCRONA longa (podcast/vídeo, 10–12 min)** | gather | ✅ **RESOLVIDO** — `StudioGeneratingCard` (emoji+barra indeterminada+cronômetro mm:ss); no `StudyCoworkChat` a msg vira `kind:"studio-pending"` e o `onEmbed` troca pelo `StudioBlock` quando fica pronto | replicar na Sala de Pesquisa (O) |
| G | Artefato pronto | finalize | ✅ `StudioBlock` cai na conversa | manter |
| H | **Resposta ESTRUTURADA** (nucleo/desenvolvimento/conceitos/próximos_passos) | draft/finalize | ⚠️ **componente pronto** — `components/study/StructuredAnswerView.tsx` (liquid glass: aurora + vidro fosco + brilho especular; núcleo/dev com formatador inline; `conceitos`→chips; `proximos_passos`→sugestões clicáveis via `onNext`). Falta o **executor renderizar** msgs de resposta com ele **E** o `draft` do PR-Wire PREENCHER os campos (senão não há o que separar) | PR-Wire + render |
| I | **Citações / fontes** (`evidencia[].source`) | gather/finalize | ⚠️ **no mesmo componente** — rodapé "Fontes" com citações numeradas + link clicável (`sourceLabel`) | idem H |
| J | **Crítico + revisão** (revise loop) | critique→revise | ❌ invisível | fase "Revisando" no `AuraThinking`; p/ trabalhos, selo "revisado ✓" + score no rodapé |
| K | **Modo GUIADO (HITL): aprovar plano / tool cara / draft** | approvalGate | ⚠️ **componente pronto** — `components/study/ApprovalCard.tsx` (Aprovar/Editar/Redirecionar, 3 kinds: plano/ferramenta/rascunho). Falta o **PR07 ligar** no `runTrajectory` (`await approvalGate(phase,st)` + `REQUIRE_APPROVAL` do `permit`) e renderizar o cartão como uma msg do chat | PR07 |
| L | Recall de memória (`wakeUp`) | route | ❌ sem sinal | opcional: chip sutil "usando memória" quando drawers entram no contexto |
| M | **Erros / stop reasons** (orçamento/maxIter/erro/timeout/cota) | stop | ⚠️ só genérico ("Falha de rede", "Sem resposta agora") | mensagens específicas: orçamento→"entreguei o melhor até aqui"; timeout de geração→"demorou, tenta de novo"; tool negada por plano→CTA de upgrade; 429→"muitos pedidos, aguarde" |
| N | **Interromper / parar** | qualquer | ✅ **RESOLVIDO** — `CoworkComposer` ganhou prop `onStop`; quando `busy`+`onStop`, o enviar vira ⏹; `AbortController` fiado em ambos os chats (aborta → "⏹ Parado.") | manter |
| O | Geração de TRABALHO na pesquisa | gather/finalize | ⚠️ "Gerando o trabalho…" estático, aí fecha o chat | dar progresso (igual F) antes de fechar; ou manter o chat com status até o doc montar |
| P | Trace / "ver raciocínio" | todas | ❌ trace some em 4s, sem histórico | opcional: "ver passos" expansível no rodapé da resposta (lê os `AgentStep` do turno) |
| Q | Anexos (upload) | — | ⚠️ botão 📎 existe mas `onFiles` NÃO está fiado | fiar `onFiles`→enviar `fileData` (a rota já aceita `fileData`); chip "arquivo anexado" |
| R | Auto/Guiado toggle | execMode | ✅ casca (localStorage) | ligar comportamento no PR07 (K) |

**Já entregue no coworking (2026-07-11, transpila):** **F** (`StudioGeneratingCard` + estado `studio-pending` no `StudyCoworkChat`), **N** (botão ⏹ + `AbortController` nos 2 chats), e o **componente** do **K** (`ApprovalCard`, falta o PR07 ligar). **Falta implementar:** **H/I** — renderizar resposta estruturada + citações (senão o valor do harness "some" no texto plano); **C/J** — fases reais + revisão visível (PR06); **K** ligar no laço (PR07); **M** — erros específicos; **O** — replicar o cartão de geração na pesquisa; **Q** — fiar upload (`onFiles`→`fileData`). Distribua: **C/J**→PR06; **K/R**→PR07; **H/I**, **M**, **O**, **Q** como PRs de UX curtas aditivas.

> **Regra:** o harness só entrega valor se o usuário VÊ o que ele faz. Nenhuma fase/tool pode
> rodar "muda" por mais de ~1s sem um reflexo no chat. "Escrevendo…" já resolvido pela datilografia;
> o foco é dar o mesmo cuidado ao **gerar (F)**, **revisar (J)**, **aprovar (K)** e **citar (I)**.

---

## 8. Tratamento de ERRO (ponta-a-ponta) — NÃO invente mensagens

Contrato pronto: **`lib/agent/errors.ts`** (`AuraErrorCode`, `auraError`, `messageForError`,
`codeFromThrown`, `codeFromStop`). Toda falha é TIPADA + tem mensagem PT-BR na voz do produto.
O `runTool` já retorna `{ok:false, code, error}` (nunca lança). **Use `messageForError(code)` —
não escreva strings de erro à mão.** Onde cada erro aparece:

| Ponto | Código(s) | Como o motor trata | O que o usuário vê |
|---|---|---|---|
| **Abrir tool** (permit) | `tool_denied` (plano/GPU), `tool_unapproved` (guiado recusou), `tool_unknown` | `runTool`/adaptador retorna `ToolResult.ok:false` | `tool_denied`→msg + **CTA de upgrade** (UI); `tool_unapproved`→"Ok, não fiz."; segue o laço |
| **Rodar tool** (processo) | `tool_timeout`, `tool_failed` | evidência daquela tool fica vazia; o laço **degrada** e segue com o resto | some do gather; se o draft ficar fraco, o examiner pega |
| **Chamar o modelo** | `model_failed`, `model_invalid_json` | `router`/`draft`/`examiner` já têm **fallback** (heurística/veredito conservador) | só aparece se o `draft` falhar de vez → `messageForError` |
| **Controle do laço** | `budget_exceeded`, `max_iter`, `loop_detected` | `runTrajectory.stop` ≠ "aprovado" → `codeFromStop(stop)` | entrega o melhor draft + msg suave (não é "erro vermelho") |
| **Output** | `no_output` (stream vazio) | fail-safe do `finalize` | "Não veio resposta. Tenta reformular?" |
| **Bordas** | `rate_limited` (429 do guard), `aborted` (⏹), `network` | `codeFromThrown` no catch do fetch | msg específica (429/parado/rede) |
| **Memória L3** | `memory_unavailable` | `persistMemory`/`wakeUp` em try/catch → **degrada silencioso** | **nada** (memória fora do ar não polui o chat) |

**Regra:** erro de tool/modelo/memória **degrada** (o turno ainda entrega algo); só `network`,
`no_output`, `aborted` e `model_failed` no draft são **fatais** (o turno mostra a msg e para). O
`fatal`/`retryable` de cada código está em `errors.ts`. No stream, emita a msg de erro no MESMO
formato de texto que o cliente já datilografa (não crie canal novo).

---

## 9. Prontidão E2E + plano do Fable (execute sem garimpar)

**✅ PRONTO e transpilando (não reescreva — importe):** `contracts.ts`, `router.ts`(+test),
`runtime.ts`, `trajectory.ts`, `examiner.ts`, `errors.ts`, `memory.ts`(contrato), `transcript.ts`
+ endpoint + client (L1), `plans.ts`(planRank), e a UI: `StudioGeneratingCard`, `ApprovalCard`,
`StructuredAnswerView`, botão ⏹. Âncoras de integração no **Apêndice C**.

**⏳ FALTA (é o teu trabalho, nesta ordem — cada passo com gate binário):**
1. **`lib/agent/aura-harness.ts`** — `buildAuraDeps(ctx, emit)` (§6). Implementa os 8 métodos de `HarnessDeps`. `draft` PREENCHE os campos do `StructuredAnswer` (senão o `StructuredAnswerView` não tem o que separar). *Gate:* `transpileModule` ok.
2. **Registrar tools** como `ToolDef` (`studio_generate`/`research_generate` runtime `ts`; `memory_search` runtime `ts`, `minPlan:"free"`). *Gate:* `vitest` — `runTool` nunca lança; `permit` nega < minPlan.
3. **Wiring `/api/ai/chat`** (§6, após :220): branch `AURA_HARNESS !== "0" && agentKey==="aura"`, LIGADO por padrão em TODAS as salas (§6.0, incl. Projetos). Responder no formato atual (texto datilografado / sentinelas). Erros via `messageForError`. *Gate:* 1 turno de texto + 1 pedido de artefato + 1 erro (ex.: tool negada) respondem certo em cada sala; `AURA_HARNESS="0"` = fallback legado.
4. **Render** — no cliente, msg de resposta usa `StructuredAnswerView`; msg de artefato assíncrono usa o estado `studio-pending`→`StudioBlock` (já existe no `StudyCoworkChat`). *Gate:* conceitos/fontes/próximos-passos aparecem quando o `draft` os preenche.
5. **PR-M3 memória** (§6.1): `MemoryDrawer` + `prisma db push` + índice Atlas + `memory_search` + recall híbrido + `persistMemory`. *Gate:* filtra por `userId`; degrada com `memory_unavailable` se Atlas cair.
6. **PR-M2 world-state** (§6.2) · **PR06/07** (trace real + `ApprovalCard` no laço) · **PRs de UX** restantes (§7: M erros específicos, O geração na pesquisa, Q upload).

**Orçamento de token (pedido do Martinez):** os contratos acima são a fonte-da-verdade — **não
re-explique nem re-derive tipos**; importe. Verifique com `transpileModule` (barato), rode `vitest`
só nos arquivos de lógica pura. NÃO tente `next build`/`prisma generate` no loop; agrupe edições por
arquivo. Um PR por passo (1→6). Não abra exploração ampla — o Apêndice C tem as âncoras.

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
| Contratos (intenção/saída/crítico) | `lib/agent/contracts.ts` | ✅ pronto (PR01) |
| Memória L1 (server/endpoint/client) | `lib/agent/transcript.ts`, `app/api/ai/transcript/route.ts`, `lib/agent/transcriptClient.ts` | ✅ pronto |
| Memória L3 (contrato) | `lib/agent/memory.ts` | ✅ contrato; ligar no PR-M3 |
| Tools registry (Fase 0) | `lib/agent/tools.ts` | ✅ pronto |
| **Router (`classify`)** | `lib/agent/router.ts` + `__tests__/router.test.ts` | ✅ **PR02 pronto** (LLM+heurística, 6/6 casos) |
| Gating de plano (`planRank`/`planAtLeast`) | `lib/plans.ts` | ✅ **adicionado** (usar no permit do PR03) |
| World-state durável | `lib/agent/context.ts` | ✅ existe; alimentar no PR-M2 |
| Action bus (trace) | `lib/agent/actions.ts` | ✅ existe; usar em PR06 |
| **Runtime das tools** | `lib/agent/runtime.ts` | ✅ **PR03 pronto** (permit/runTool/registry) |
| **Motor do laço** | `lib/agent/trajectory.ts` | ✅ **PR04 pronto** (runTrajectory + HarnessDeps) |
| **Examiner** | `lib/agent/examiner.ts` | ✅ **PR05 pronto** (critique + sem_fonte) |
| **Adaptador HarnessDeps + wiring** | `lib/agent/aura-harness.ts` + `/api/ai/chat` | ⏳ **PR-Wire (§6) — sua tarefa central** |
| Memória L3 (ligar) | `lib/agent/memory.ts` → `MemoryDrawer`/Atlas | ⏳ PR-M3 (§6.1) |

---

## Apêndice C — MAPA DE INTEGRAÇÃO (âncoras reais — não garimpe)

### C.1 Onde plugar o `runTrajectory` em `app/api/ai/chat/route.ts`
`export async function POST` começa em **:210**. No ponto **após :220** (persona escolhida, `chatHistory` pronto) já existem montados: `prompt`, `agentKey`, `surface`, `chatHistory`, `agentContext`, e mais abaixo `finalSystemInstruction` (**:277+**) e `parts[]` (**:248–272**). Intercepte **antes** dos branches de geração (STREAM em **:334**, NÃO-stream em **:385**) sob `if (process.env.AURA_HARNESS && agentKey==="aura")`. Sentinelas: `STUDIO_SENTINEL`/`RESEARCH_SENTINEL` em **:13–14**; emissão no stream em **:354–363** (studio) e **:364–372** (research); handlers não-stream em **:417–432**. Bloco do world-state no prompt: **:296–299** (`formatAgentContext`).

### C.2 Gemini — chamada barata (router/examiner)
Use `geminiJson<T>(system, user, { temperature, model, timeoutMs })` de `lib/scholar/gemini.ts:59` — já força `responseMimeType:"application/json"`, timeout, limpa cercas ```` ```json ```` e faz `JSON.parse` (lança diagnóstico se vazio). Modelos: `GEMINI_MODEL_FLASH` / `GEMINI_MODEL_PRO` (`lib/ai/model.ts:23,26`). Free-text (não-JSON): `getGeminiChatModel(system, {temperature})` (`gemini.ts:29`). **O router (PR02) já usa `geminiJson`.**

### C.3 World-state (`lib/agent/context.ts`) — para o PR-M2
Exports: `type AgentContext` (**:16**, campos: activeRoom, activeTab, currentStudyId, currentResearchId, currentProjectId, currentGoal, recentActions, updatedAt); `setAgentContext(patch: Partial<AgentContext>)` (**:100**); `pushAgentAction(kind: string, detail?: string)` (**:108** — recebe **string+string**, NÃO um AgentStep; monta `{kind,detail,at}` e faz `slice(-15)`); `useAgentContext()` hook (**:131**); `contextForPrompt()` (**:118**, == `formatAgentContext` server). Sync = `PUT /api/agent/context` debounce 800ms. **PR-M2 = chamar `setAgentContext`/`pushAgentAction` nas transições das salas.**

### C.4 Action bus (`lib/agent/actions.ts`) — para PR04/PR06  ⚠️ GOTCHA
`type StepKind` é união FECHADA: **`"navigate"|"create"|"type"|"say"|"done"`** (**:16**) — **não** são as fases da trajetória (route/plan/gather…). Para o trace real (PR06), ou **estenda `StepKind`** com as fases, ou **mapeie** cada fase para um `AgentStep` (`kind:"say"`, `label:"Planejando…"` etc.). API: `startPlan(steps: AgentStep[])` (**:45**), `setStepStatus(i, status)` (**:56**), `advancePlan()` (**:62**), `finishPlan()` (**:69**, auto-limpa em 4s), `usePlan()` (**:79**). Efêmero (sem persistência).

### C.5 Auth/Prisma/userId
`authOptions` = `@/src/lib/auth` (`src/lib/auth.ts:16`); `prisma` = `@/src/lib/prisma` (`src/lib/prisma.ts:5`). **Dois** helpers equivalentes de userId: `resolveUserId()` (`lib/agent/transcript.ts:22`) e `studioUid()` (`lib/studio/auth.ts:9`). Reuse um; não crie um terceiro.

### C.6 Gating de plano — ⚠️ era GAP, já supri
Não existia comparador de tier. **Adicionei** em `lib/plans.ts`: `PLAN_ORDER`, `planRank(p)`, `planAtLeast(plan, minPlan)`. O `permit()` do PR03 usa `planAtLeast(ctx.plan, def.minPlan)`. Capabilities booleanas continuam via `planCapabilities` (`plans.ts`).

### C.7 Endpoints do Studio (o que `studio_generate` chama) — para runTool
Texto SÍNCRONO (`runTextGeneration`): `POST /api/studio/{guide|mindmap|timeline|flashcards|faq}` body `{ sourceIds?, spaceId?, force? }` → `StudioArtifact` com `status:"done"`, `meta:<json>`. Imagem SÍNCRONA: `POST /api/studio/image` `{ prompt?, sourceIds?, spaceId?, aspectRatio? }` → `{ ...artifact, dataUrl }`. ASSÍNCRONOS (queued + polling): `POST /api/studio/{podcast|video}` `{ sourceIds?, spaceId?, force?, options? }` → artefato `status:"queued"`; depois `GET /api/studio/[id]` para status/meta; binário em `GET /api/studio/[id]/file`. Todos exigem `studioUid()`. Normalização de kind: `lib/agent/tools.ts:18–53`.

### C.8 `sanitizeHistory` (`lib/ai/history.ts:11`)
`sanitizeHistory(raw:any, maxTurns=20): ChatTurn[]` onde `ChatTurn={role:"user"|"model", parts:[{text}]}`. Tolerante na entrada; começa sempre em `user`; colapsa papéis repetidos; `slice(-20)`. Pronto pra `startChat({history})`.
