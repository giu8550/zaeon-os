# PROMPT DE EXECUÇÃO — Claude Code (Opus) · Escritório Zaeon · **Fatia 3 · O agente trabalha**

> **Você é o EXECUTOR.** Todo o projeto já foi decidido, pesquisado e contratado em código.
> Você NÃO redesenha, NÃO reabre decisão, NÃO re-deriva tipo, NÃO explora o repo além das
> âncoras dadas. Você integra, verifica e **para em cada gate**. Co-autorado pelo Fable em
> 2026-10-07 a partir de `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` (§3 **inteira** — é a spec de
> comportamento; §4 C1/C2/C4/C11; §5 camada 2; §7; §8) + `docs/PROSPECCAO_AGENTES_AUTONOMOS.md`
> (PR-A4 `:499-557`, PR-A5 `:558-605`).
>
> **Esta fatia = 2 PRs: A5 (citação por chave + examiner) → A4 (`AgentTask`).** Ela nasce os
> contratos **C4** (citação por chave), **C11** (veredito + score), **C1** (`AgentTask`) e a parte
> `EV_TAREFA` de **C2**. A5 vai primeiro porque a entrega da tarefa (A4) só vale com lastro.
> **Consome C3 e C12 da Fatia 2** (a tarefa nasce numa thread e roda sob o lock) — **não comece
> sem a Fatia 2 mergeada.** Da Fatia 1 consome **só** `LedgerCtx` opcionalmente (`taskId` no
> ledger); se a Fatia 1 ainda não estiver no main, deixe `taskId` fora e anote.
> **Toda âncora `arquivo:linha` abaixo foi verificada em `origin/main` = `b2af5db` (2026-10-07).**

---

## 0. Leia antes de codar (só isto, nesta ordem)

1. `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` — **§3 inteira** (as sete leis, a máquina de estados, gatilhos, triagem §3.4, templates §3.5, freios §3.8 — tudo isso vira código aqui), §4 (C1, C2, C4, C11 — você os cria), §5 "CAMADA 2" (A4, A5), §8.
2. `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` — PR-A4 (`:499-557`) e PR-A5 (`:558-605`). **Correção de estado (ver §1):** o item 1 do A5 ("literature_search em TS") **já está feito** no main.
3. `docs/EXECUTOR_PROMPT_FATIA2_SALA.md` §3 — os contratos C3 (thread) e C12 (lock) que você consome.
4. `docs/BACKGROUND_JOBS_SALA_PESQUISA.md` — o padrão de job longo com fases persistidas que o `AgentTask` replica.

## 1. Guardrails invioláveis (violar = PR rejeitado)

- **Estado corrigido, não reescreva:** `literature_search` **é real** (`lib/agent/runtime.ts:218-280`: `retrievePapers` de `lib/scholar/retrieve.ts` sobre OpenAlex/Crossref/arXiv/PubMed/S2, com fallback web `buscarNaWeb` via SearXNG) e já devolve `Finding[]` com `source`. O que **falta** e esta fatia faz: chave de citação por trecho, validação determinística, `examiner` (hoje stub `not_implemented`, `:311-320`), `data_access_level`, degradação **explícita** (hoje `no_results`/`skill_error` viram beco silencioso no draft). O item "escolha de fonte por embedding (Biomni)" entra **só** se houver ≥2 conectores MCP registrados no momento da chamada; com os 4 agregadores fixos de hoje, não há o que escolher — deixe a função pronta (`escolherFontes`) e dormente.
- **Flags off por padrão:** `CANAL_TAREFAS=""` (A4), `LIT_SEARCH=""`/`EXAMINER=""` (A5). Com tudo vazio, o canal, o chat e o harness se comportam **byte a byte** como hoje: `@mentor` responde no fio, `critique` continua determinístico, nenhuma chave aparece no texto.
- **Lei 4 (sem chave, não cita):** com `EXAMINER=1`, afirmação factual sem chave `zxc-` válida é **NOT_SUPPORTED** e reprova. Opinião de outro agente (mensagem com `autorTipo:"agente"`) **nunca** vira evidência — não entra em `st.evidence`.
- **Lei 5 (diz quando não pode):** `literature_search` com `no_results`/`web_unavailable`/`skill_error` **não** some no draft: vira **uma linha declarada** no `nucleo` via `messageForError` (chaves novas abaixo), e o `Material Passport` registra "sem fonte externa: <motivo>".
- **Lei 1 (avisa uma vez, entrega uma vez):** tarefa = **exatamente duas** mensagens do agente no fio (abertura e entrega) + as de `aguardando_humano`/`bloqueado`. Progresso vai por `EV_TAREFA`, nunca por mensagem. Teste conta as mensagens.
- **Triagem sem LLM** (`lib/canal/triagem.ts`, puro). **Em dúvida, turno.**
- **Artefato gravado antes de `done`** (handoff §8.3). **Cancelamento cooperativo** entre fases, nunca `kill`. **Stall detector** 450s/1200s. **Lease** via `emSerie` da Fatia 2 (C12) — a tarefa roda **dentro** do lock do canal; `OcupadoError` = fila.
- **Guardrails de saúde** (Osler, Nightingale, Pasteur, James, Kekulé — `MentorTemplate.guardrail` já semeado): `data_access_level: "verified_only"` → só cita evidência que passou o integrity gate como `ALIGNED`.
- **Não tocar:** o protocolo do cliente do chat; `lib/agent/trajectory.ts` além dos pontos do PASSO 1.5; `lib/scholar/retrieve.ts` (a busca é consumida, não alterada); `lib/plans.ts`.
- **Erros via `messageForError`**; adicione em `lib/agent/errors.ts` (`ErrorCode` union `:9-23`): `lit_no_results`, `lit_offline`, `web_offline`, `claim_not_supported`, `tarefa_cancelada`, `tarefa_stalled`, `tarefa_aguardando`.
- **Verificação:** `npx tsc --noEmit` limpo + `npx vitest run` verde por PR (CI `build-test`). `generate` só com schema novo; `db push`. **Nunca `next build` no loop.**
- **1 PR por passo** (A4 pode ser **dois**, ver PASSO 2), branch `escritorio/fatia3-<passo>-<slug>`, ≤ ~8 arquivos cada, descrição citando o contrato e a flag.

## 2. Importe, não reescreva (símbolo existente = import)

| O que | Onde (verificado) |
|---|---|
| Busca real + web fallback | `lib/agent/runtime.ts` — `LITERATURE_MAX :224`, `papersToFindings :225`, `literatureSearchDef :239-280`, `buscarNaWeb :283`, `webSearchDef :296`, **`examinerDef` (stub) `:311-320`**, `permit :89`, `registerTool :123`, `runToolByName :128` · `lib/scholar/retrieve.ts` `retrievePapers :21` (devolve `Paper[]` com `title/authors/year/url/doi/abstract/sources`) · `lib/scholar/fulltext.ts` `resolveFullText :19` · `lib/search/web.ts` (`WebSearchFail.code`) |
| Contratos do crítico | `lib/agent/contracts.ts` — `IntentId :89`, `INTENTS :109-116` (`tools`, `critic`, `required`, `reviseThreshold`, `maxRevisions`), `IssueTipo :125`, `Issue :132`, `ScholarDim :135`, `EvidenceLevel :140`, `ExaminerDecision :148`, `ExaminerVerdict :149-160` (tem `integrity: IntegrityFinding[]` **já previsto**), `ProvenanceRecord :46-55`, `StructuredAnswer :71-85`, `Source :27` |
| Crítico determinístico de hoje | `lib/agent/examiner.ts` — `checkSemFonte :70`, `checkLacuna :83`, `critique :145-182` (`integrity: []` em `:176`), `critiqueForState :184` |
| Laço do harness | `lib/agent/trajectory.ts` — gather `:244-256` (`st.evidence.push(...toFindings(res))`, A3 degradado `:253`), draft `:262`, critique `:269-280` (`d.critique(st)`, stop por `decision`/`reviseThreshold`), `runTrajectoryTraced :216`, `TrajectoryState` (`evidence`, `draft`, `critique`, `score`, `degraded`) |
| Adaptador (onde o modelo recebe a lista de chaves) | `lib/agent/aura-harness.ts` — `evidenceBlock` (monta "(1) claim — fonte <url>"), `draft` (schema JSON pedido ao modelo), `normalizeAnswer`, `critique: (st) => critiqueForState(st)` |
| Padrão de job longo que funciona | `lib/scholar/pipeline.ts` (`runScholarPipeline`, fases + `thread.events`) · `lib/agent/chat-turn-store.ts` (`createTurn :30`, `markRunning :43`, `savePartial :47`, `saveDone :51`, `saveError :58`, `getTurnForUser :68`) · `prisma` `model ChatTurn :507-522` (o molde de `AgentTask`) · `lib/queue/chat.ts` (`CHAT_QUEUE`, `enqueueChatJob :44`, `CHAT_JOB_OPTIONS :24`) · `lib/queue/reaper.ts` (`STUCK_MS :13`, `ReaperDb :16`, `reapStuckJobs :21`) · `instrumentation-node.ts` (`iniciarWorkers :20`, chat worker `:94-98`) |
| Fila do canal (molde da `agent-tasks`) | `lib/canal/queue.ts` (`filaLigada`, `jobIdDe`, `dispararTurnos`, `depsReais`, `iniciarWorkerCanal`) · `lib/canal/serial.ts` (`emSerie` — **C12 da Fatia 2**) |
| Turno do canal | `lib/canal/agent-turn.ts` — `executarTurno`, `montarObjetivo`, `montarHistorico`, `blocoCanal`, mensagem efêmera, `TurnoInput.parentId` (**C3 da Fatia 2**) |
| Progresso (rótulos PT já existem) | `lib/agent/progresso.ts` (`Progresso :18`, `serializarProgresso :39`, `faseCorrente :106`) · `lib/agent/trajectory.ts` `PHASE_LABEL` · polling retomável `lib/chat/turnoRetomavel.ts` (`POLL_TURNO_MS = 1500 :11`, `esperarTurno :41`) · rotas-molde `app/api/ai/chat/turns/route.ts` + `[id]/route.ts` (+ `turns-routes.test.ts`) |
| Realtime | `lib/canal/wire.ts` (`EV_MENSAGEM`, `EV_DIGITANDO`, `MensagemWire` c/ `parentId`), `lib/canal/realtime.ts` `publicarPusher` · cliente `components/office/CoworkingCanal.tsx` (`subscribe :116`, `bind(EV_MENSAGEM) :117`, `bind(EV_DIGITANDO) :118`, `aoChegar :145`, `digitando`) |
| Artefato de entrega | `prisma` `model ResearchWork :527-544` (`secoes Json?`, `rev`, `workType`, `scopeId`) · `lib/tcc/secoes.ts` (`Secao :13`, `OPS :15`, `OpSecao :24`) · `model StudioArtifact :689-703` |
| Mentores (data_access_level) | `prisma` `model MentorTemplate :801-818` (`guardrail :813`) · `lib/agent/mentors.ts` `MENTOR_SEED` (5 de saúde com `guardrail`) · `lib/agent/mentors-server.ts` `resolveMentor` |
| MCP (fontes futuras) | `lib/agent/mcp.ts` — `registerMcpConnector :195`, `mcpToolToToolDef`, `riskFromAnnotations :56` · `model Connector :777` |
| Ledger (Fatia 1, opcional) | `lib/llm/envelope.ts` `LedgerCtx.taskId` — só se existir |

## 3. Os contratos que esta fatia CRIA (texto final — copie, não reinterprete)

### C4 · Citação por chave

```ts
// lib/agent/citacao.ts (PURO)
export type Contexto = { key: string; fonte: string; url?: string; doi?: string; trecho: string; score: number; origem: "academico" | "web" | "anexo" | "memoria" };
export const CHAVE_RE = /\bzxc-[0-9a-f]{8}\b/g;
export function chaveDe(fonte: { url?: string; doi?: string; title: string }, trecho: string): string;  // "zxc-" + sha256(doi|url|title + "|" + trecho.slice(0,200)).slice(0,8) — determinística
export function contextosDe(findings: Finding[]): Contexto[];                                        // 1 Finding → 1 Contexto (claim = trecho); dedup por key
export function blocoDeChaves(ctx: Contexto[]): string;                                              // o que vai no prompt: "[zxc-a1b2c3d4] Fonte (ano) — trecho…" (ordem estável)
export function validarChaves(texto: string, ctx: Contexto[]): { texto: string; orfas: string[]; usadas: string[] }; // passe determinístico: chave órfã → removida do texto e listada
export function passaporte(ctx: Contexto[], usadas: string[], acessadoEm: string): Secao;            // "Material Passport": fontes USADAS com chave, url/doi, acesso, o que sustenta
```
`ProvenanceRecord.sources` (`contracts.ts:46`) passa a carregar `key` opcional em cada `Source` (aditivo: `key?: string`). `StructuredAnswer.evidencia[].source.key` idem. Persistência = o `ProvenanceRecord` que já existe no `StructuredAnswer.provenance` + a seção `Material Passport` em `ResearchWork.secoes` (A4).

### C11 · Veredito + score de qualidade

```ts
// lib/agent/examiner.ts (estender; contracts.ts ganha os tipos abaixo, aditivos)
export type IntegrityClass = "ALIGNED" | "OVERSTATED" | "NOT_SUPPORTED";
export type IntegrityFinding = { claim: string; classe: IntegrityClass; chaves: string[]; porque: string }; // substitui o `IntegrityFinding` vazio de hoje se ele não tiver campos
export type Veredito = "VERIFIED" | "FAILED" | "UNVERIFIED" | "INCONCLUSIVE";
export type ScorePaper = { originality: number; quality: number; clarity: number; significance: number; soundness: number; presentation: number; contribution: number; overall: number; confidence: number; decision: "accept" | "reject" };
export const PESOS_SCORE = { contribution: 0.4, presentation: 0.2, originality: 0.1, quality: 0.1, clarity: 0.1, significance: 0.1 } as const; // soundness entra em `overall` só como teto (NOT_SUPPORTED ⇒ overall ≤ 4)
export function integrityGate(claims: string[], ctx: Contexto[], juiz: Juiz): Promise<IntegrityFinding[]>;   // 1 chamada de modelo (Flash) por rascunho, saída JSON validada; sem `juiz` → heurística (claim com chave válida = ALIGNED, sem chave = NOT_SUPPORTED)
export function shouldRevise(findings: IntegrityFinding[]): boolean;                                          // qualquer NOT_SUPPORTED
export function veredito(args: { findings: IntegrityFinding[]; ctx: Contexto[]; degraded: boolean }): Veredito; // FAILED se NOT_SUPPORTED; UNVERIFIED se degraded/sem contexto; INCONCLUSIVE se só OVERSTATED; senão VERIFIED
export function scorePaper(campos: Omit<ScorePaper, "overall" | "decision">): ScorePaper;                      // overall = soma ponderada (PESOS_SCORE), decision = overall ≥ 7 && soundness ≥ 6
```
`ExaminerVerdict` (`contracts.ts:149`) ganha, aditivo: `veredito?: Veredito` e `scorePaper?: ScorePaper`; `integrity` passa a ser `IntegrityFinding[]` com os campos acima. **"Não deu para verificar" (UNVERIFIED/INCONCLUSIVE) não é reprovação nem aprovação** — o laço só reprova em `FAILED`.

### C1 · `AgentTask` (+ `EV_TAREFA` de C2)

```prisma
model AgentTask {
  id              String    @id @default(auto()) @map("_id") @db.ObjectId
  canalId         String?   @db.ObjectId
  parentId        String?   @db.ObjectId   // root da thread onde a tarefa vive (C3)
  programId       String?   @db.ObjectId
  cycleId         String?   @db.ObjectId
  requesterId     String?   @db.ObjectId   // null = autônomo
  agentKey        String
  mentorSlug      String?
  objetivo        String
  kind            String                   // resposta | dossie | revisao | reuniao | monitoramento
  status          String    @default("queued") // queued | running | awaiting_input | done | failed | cancelled
  phase           String?                  // Phase do harness
  progress        Int       @default(0)    // 0..100 derivado da fase (ver PASSO 2.3)
  steps           Json      @default("[]") // append-only: {at, phase, label, tokens?}
  artifactKind    String?                  // research_work | studio_artifact | zxiv_paper
  artifactId      String?   @db.ObjectId
  needsHuman      Json?                    // {pergunta, opcoes?: string[]}
  resposta        Json?                    // resposta humana ao needsHuman
  error           String?
  cancelRequested Boolean   @default(false)
  leaseOwner      String?
  leaseExpiresAt  DateTime?
  lastProgressAt  DateTime  @default(now())
  idempotencyKey  String    @unique        // canalId:agentKey:mensagemId
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([canalId, createdAt])
  @@index([status, updatedAt])
  @@index([programId, createdAt])
  @@index([requesterId, createdAt])
  @@map("agent_tasks")
}
```
```ts
// lib/canal/wire.ts (aditivo)
export const EV_TAREFA = "tarefa";
export type TarefaWire = { taskId: string; canalId: string; parentId: string | null; agentKey: string; status: AgentTask["status"]; phase?: string | null; progress: number; label?: string | null; artifact?: { kind: string; id: string; titulo: string; href: string } | null; needsHuman?: { pergunta: string; opcoes?: string[] } | null; at: string };
```
```ts
// lib/canal/tarefas.ts (store, molde de chat-turn-store) — assinatura pública
export function criarTarefa(db, input): Promise<AgentTaskRow>;           // idempotente por idempotencyKey (P2002 → devolve a existente)
export function marcarFase(db, id, phase, label, extra?): Promise<void>; // append em steps + progress + lastProgressAt + publica EV_TAREFA
export function pedirHumano(db, id, needsHuman): Promise<void>;          // status awaiting_input + publica
export function responderHumano(db, id, resposta): Promise<void>;        // volta a queued (re-enfileira)
export function concluir(db, id, artifact): Promise<void>;               // GRAVA artifactId e só então status done + publica
export function falhar(db, id, motivo): Promise<void>;
export function cancelar(db, id): Promise<void>;                         // cancelRequested=true (cooperativo)
export function listarDoCanal(db, canalId, ids?): Promise<AgentTaskRow[]>;
```

## 4. OS PASSOS (ordem executável; pare e reporte 1 linha em cada gate)

### PASSO 1 — PR-A5 · Citação por chave + `examiner` real (nasce C4 e C11)
Branch `escritorio/fatia3-a5-citacao-examiner`. Flags `LIT_SEARCH` (muda **só** a degradação explícita e a chave nas fontes) e `EXAMINER` (integrity gate + veredito no laço). `lib/canal/flags.ts` ganha `litSearch()`/`examiner()`.
1. **`lib/agent/citacao.ts`** (C4, puro, testado): `chaveDe` determinística (mesma fonte+trecho = mesma chave em qualquer processo), `contextosDe` (dedup por key; `origem` pelo `provenance.toolsUsed` — `literature_search`→`academico`, `web_search`→`web`), `blocoDeChaves` (ordem estável = cache-friendly), `validarChaves` (remove órfãs do texto, devolve `orfas`/`usadas`; **não** reescreve nada além da chave), `passaporte` (→ `Secao` de `lib/tcc/secoes.ts`).
2. **Adaptador** (`lib/agent/aura-harness.ts`): com `LIT_SEARCH=1`, `evidenceBlock` passa a ser `blocoDeChaves(contextosDe(st.evidence))` e o prompt do `draft` ganha a instrução **"cite SÓ chaves da lista, no formato [zxc-xxxxxxxx]; afirmação sem chave disponível = diga que não encontrou fonte"**; o schema JSON pedido mantém `evidencia[{claim, source}]` e passa a exigir `source.key`. Depois do `normalizeAnswer`, **passe determinístico** `validarChaves` sobre `nucleo`, `desenvolvimento`, `work.sections[].body`: órfãs removidas e registradas em `answer.provenance.inputsHash`? **Não** — em `st.critique` como `Issue{tipo:"sem_fonte", onde:"<campo>", porque:"chave órfã zxc-…"}` (reusa `IssueTipo` existente). `answer.provenance.sources[].key` preenchido.
3. **Degradação explícita (lei 5):** em `literatureSearchDef.run` (`runtime.ts:239`), com `LIT_SEARCH=1`, `no_results`/`web_unavailable`/`skill_error` continuam `ok:false` **mas** o adaptador (`runTool` wrapper em `aura-harness.ts`, que já guarda `observations` — A1 do E2E) injeta no `draft` **uma frase obrigatória** via `messageForError(codigo)` (`lit_no_results`: "Não achei fonte indexada sobre isso — respondo pelo que sei e marco como não verificado."; `lit_offline`/`web_offline`: "A busca em bases científicas está fora do ar agora — sem PubMed/OpenAlex neste texto."). Teste: resposta contém a frase e `veredito === "UNVERIFIED"`.
4. **`examiner`** (`lib/agent/examiner.ts` + `examinerDef` em `runtime.ts:311`): `integrityGate` (1 chamada Flash via `genJson`/`gerarJson` injetável; prompt pede `[{claim, classe, chaves, porque}]` só com chaves da lista; **sem juiz = heurística pura**), `shouldRevise`, `veredito`, `scorePaper` (PESOS_SCORE). `critique()` (`:145`) ganha, com `EXAMINER=1`: extrai claims de `nucleo`+`desenvolvimento`+`evidencia[].claim` (sentenças com chave ou com verbo factual), roda o gate, preenche `integrity`, `veredito`; `decision = "reprovado"` se `shouldRevise` (**não** se UNVERIFIED/INCONCLUSIVE). `examinerDef.run` deixa de ser stub: recebe `{draft, contextos}` e devolve `ToolResult{ok:true, findings:[], provenance}` com o veredito em `provenance` (é a tool que A9/A7 chamam). **`verified_only`:** antes do `draft`, para mentor com `data_access_level === "verified_only"`, `st.evidence` é filtrada para contextos que **já** passaram num gate prévio (`integrityGate` dos claims = trechos) — custa 1 chamada a mais só para os 5 de saúde.
5. **Laço** (`lib/agent/trajectory.ts`, mínimo): em `:269-280`, após `const v = await d.critique(st)`, **só** isto: `if (v.veredito === "FAILED") { /* revisa */ } else if (v.decision === "aprovado" || …)` — ou seja, FAILED força revisão mesmo com score alto; UNVERIFIED/INCONCLUSIVE seguem a regra atual. `st.degraded` já existe (`:254`) e alimenta `veredito()`.
6. **`data_access_level`**: `MentorTemplate.dataAccessLevel String @default("raw")` (`raw|redacted|verified_only`) → `generate`+`db push`; `MENTOR_SEED` e `ensureMentorSeed` marcam os 5 de saúde (`medicina`, `enfermagem`, `veterinaria`, `psicologia`, `farmacia`) como `verified_only`; `resolveMentor` devolve o campo; `ResolvedMentor.dataAccessLevel` chega ao `hctx` (`runChatTurn.ts` e `agent-turn.ts`) e ao adaptador.
7. **`escolherFontes`** (Biomni, dormente): `lib/agent/skills/fontes.ts` — dado `query` e a lista de tools de busca registradas (`listTools().filter(t => t.name.startsWith("mcp:") && /search|papers|arxiv|pubmed/i.test(t.name))`), com ≥2 candidatas escolhe top-2 por similaridade de embedding entre `query` e `schema.description` (reusa o `embed` de `configureMemory` se configurado; sem embed → todas). `literatureSearchDef.run` chama só quando `LIT_SEARCH=1` **e** há candidatas MCP; hoje devolve "nenhuma" e nada muda.
8. **Testes:** `citacao.test.ts` (chave determinística; dedup; `validarChaves` remove órfã e preserva o resto; passaporte lista só usadas); `examiner.test.ts` (fixture com claim inventado → NOT_SUPPORTED → `decision:"reprovado"`; só OVERSTATED → INCONCLUSIVE não reprova; `degraded` → UNVERIFIED; `scorePaper` pesos somam 1 e `contribution` pesa 4× `clarity`); `aura-harness.test.ts` (caso novo: draft com chave órfã sai sem ela + Issue; `lit_no_results` injeta a frase); `trajectory.test.ts` (FAILED com score 9 ainda revisa; flag off = comportamento antigo); `runtime.test.ts` (`examinerDef` não é mais `not_implemented` com flag on; com flag off continua stub); `mentors.test.ts` (5 de saúde = `verified_only`).
**Gate A5:** pergunta de enfermagem sobre cafeína (`@enfermagem …` no canal, com `LIT_SEARCH=1`) devolve **≥5 fontes com DOI/URL** cada uma com chave `zxc-`; **teste automatizado que procura chave órfã** no texto final passa (zero órfãs); rascunho-fixture com claim inventado é **reprovado** pelo integrity gate; `SEARXNG_URL` vazio + bases mockadas vazias → resposta traz a frase de indisponibilidade e `veredito:"UNVERIFIED"`, nunca vazia; flags off → `vitest` antigo intacto. **Reporte:** `PASSO 1: verde/vermelho + nº de fontes com chave e nº de órfãs`.

### PASSO 2 — PR-A4 · `AgentTask`: pedido → trabalhando → progresso → artefato (nasce C1 e `EV_TAREFA`)
Branch `escritorio/fatia3-a4-agent-task`. Flag `CANAL_TAREFAS` (+ `TAREFAS_WORKER` no worker). **Se passar de ~8 arquivos, divida:** A4a = schema + store + triagem + fila + worker + rotas; A4b = UI (barra, decisão, cancelar).
1. **Schema** (C1 da §3) → `generate` + `db push`. `lib/canal/wire.ts`: `EV_TAREFA` + `TarefaWire`. `lib/canal/tarefas.ts` (store da §3; `publicarPusher(canalId, EV_TAREFA, wire)` em **toda** transição; `concluir` grava `artifactId` **antes** de `status:"done"`).
2. **Triagem** `lib/canal/triagem.ts` (PURO): `triar(objetivo, {intent?: IntentId}) → { tipo: "turno" | "tarefa"; kind?: "dossie" | "revisao" | "resposta"; motivos: string[] }` — regra §3.4: verbo de produção (`fazer|faça|produz|escrev|mont|pesquis|levant|compar|revis|elabor`) **E** entregável (`trabalho|artigo|relat[óo]rio|dossi[êe]|revis[ãa]o|tcc|levantamento|compara[çc][ãa]o|monografia`) → tarefa; `intent === "criar_trabalho"` → tarefa; ≥3 `?` → tarefa; senão **turno**. `kind`: `revis` → `revisao`, senão `dossie`. Teste com os exemplos canônicos (`"@enfermagem precisamos fazer um trabalho sobre cafeína"` → tarefa/dossie; `"o que é cafeína?"` → turno; `"revisa esse parágrafo"` → turno — sem entregável).
3. **Fila `agent-tasks`** `lib/queue/tarefas.ts` (molde `lib/canal/queue.ts`): `filaLigada = CANAL_TAREFAS==="1" && REDIS_URL`; fallback inline fire-and-forget; `jobId = idempotencyKey`; `attempts: 1` (tarefa não se repete sozinha — `awaiting_input` re-enfileira explicitamente); worker em `instrumentation-node.ts` sob `TAREFAS_WORKER=1`, **dentro de `emSerie(canalId, …)`** (C12). `lib/queue/reaper.ts`: `ReaperDb` ganha `agentTask.updateMany`; presos em `queued|running` com `updatedAt < cutoff` → `failed` (`error: "reaper: …"`); `awaiting_input` **não** é preso.
4. **Execução** `lib/canal/tarefa-run.ts` → `runTarefa(taskId, deps)`: carrega a tarefa; `marcarFase` por fase do harness (**progresso = índice da fase**: `route 10 · plan 25 · gather 45 · reason 60 · draft 75 · critique 90 · finalize 100`, rótulos de `PHASE_LABEL`), via `onStep` do `buildHarnessDeps` (já emite `AgentStep` por fase); **cancelamento cooperativo**: `onStep` relê `cancelRequested` e lança `CanceladaError` → `falhar(id, "cancelada")`; **stall**: `lastProgressAt` atualizado em cada fase; o reaper e um `setTimeout` de guarda (450s sem fase / 1200s dentro de `runTool`) marcam `failed:"stalled"`; `LedgerCtx.taskId` se a Fatia 1 existir. **Entrega:** `ResearchWork` (`workType: "dossie"`, `userId = requesterId`, `scopeId = canalId`, `title`, `secoes` = seções do `answer.work` **+ seção "Material Passport"** de `passaporte()`, `content` = espelho markdown) → `concluir(id, {kind:"research_work", id, titulo, href: "/research-lab?tab=pesquisa&work=<id>"})`. **`awaiting_input`:** quando o `draft` devolver `proximos_passos` começando com `"PERGUNTA:"` **ou** o `critique` acusar `lacuna` de escopo (`Issue.tipo:"lacuna"` com `onde:"escopo"`), `pedirHumano(id, {pergunta, opcoes})` e **sai** sem concluir; `responderHumano` injeta a resposta no `systemContext` e re-enfileira.
5. **Mensagens no fio (lei 1, templates §3.5):** na criação, **1 mensagem** de abertura do agente (gerada por template determinístico, **sem LLM**: `"Entendi: <objetivo resumido>. Vou levantar as fontes e montar o <kind> — te aviso aqui quando terminar."`), na **thread** se `parentId`, senão no fio; na conclusão, **1 mensagem** de entrega (`"Pronto. <título> — <n> fontes, <m> lacunas declaradas. → abrir na Sala de Pesquisa"` com `href`); em `awaiting_input`, 1 mensagem com a pergunta (vai **também** pro `needsHuman` da barra); em `failed`, 1 mensagem com `messageForError(tarefa_stalled|tarefa_cancelada|…)`. **Nada mais.** Mensagens de agente da tarefa carregam `mencoes: []` e nunca disparam novo turno.
6. **Rota de mensagem** (`app/api/canal/[id]/mensagem/route.ts`): com `CANAL_TAREFAS=1`, para cada `@agente` mencionado, `triar(semMencoes(texto))`: `tarefa` → `criarTarefa` + enfileirar (em vez de `dispararTurnos`); `turno` → como hoje. Resposta inclui `tarefas: [{taskId, agentKey}]`. **Rotas novas:** `GET /api/canal/[id]/tarefas?ids=` (`podeLer`; lista/polling), `POST /api/canal/[id]/tarefas/[taskId]/cancelar` (requester ou `podeGerir`), `POST …/[taskId]/responder { resposta }` (requester ou `podeGerir`; só em `awaiting_input`). `recursos.tarefas = canalTarefas()` no `GET /api/canal/[id]`.
7. **UI** (`CoworkingCanal.tsx` + `components/office/BarraTarefa.tsx`): `bind(EV_TAREFA)` ao lado de `:118`; estado `tarefas: Record<taskId, TarefaWire>`; **barra** abaixo da lista de mensagens (ou no painel da thread quando `parentId`) com avatar do agente, rótulo da fase, barra de progresso (CSS), botão **cancelar** (≥44px), e em `awaiting_input` o card de decisão (pergunta + opções como botões + campo livre); **polling de fallback** `GET …/tarefas?ids=` a cada `POLL_TURNO_MS` (1500ms) só enquanto houver tarefa `queued|running` e o Pusher não entregou nada há >5s; **reengate**: ao abrir o canal, `GET …/tarefas` traz as em andamento. Vidro de `lib/canal/vidro.ts`, claro===escuro.
8. **Testes:** `triagem.test.ts` (canônicos + "em dúvida, turno"); `tarefas.test.ts` (store: idempotência P2002; `concluir` grava artifact antes de done — teste observa a ordem das chamadas; `responderHumano` só em `awaiting_input`); `tarefa-run.test.ts` (fake prisma + harness mockado emitindo fases: progresso cresce monotônico; cancelar entre fases para em ≤1 fase; stall marca failed; entrega cria `ResearchWork` com `Material Passport`; **exatamente 2 mensagens do agente** no caminho feliz); `mensagem/route.test.ts` (flag on + pedido de trabalho → cria tarefa e **não** dispara turno; flag off → turno como sempre; IDOR nas 3 rotas novas); `reaper.test.ts` (varre `agent_tasks`, poupa `awaiting_input`).
**Gate A4:** `@enfermagem precisamos fazer um trabalho sobre cafeína` **não responde no fio**: 1 linha de abertura, barra com fases, entrega com link para um `ResearchWork` visível em "Minhas coisas" com a seção Material Passport; **sair e voltar reengata** a barra; **cancelar** para em ≤1 fase e posta 1 linha; `awaiting_input` mostra a pergunta na barra e no fio, responder retoma; contagem de mensagens do agente no caminho feliz = **2**; flag off → `@enfermagem …` responde no fio como hoje. **Reporte:** `PASSO 2: verde/vermelho + sequência de EV_TAREFA (status/phase/progress) e a contagem de mensagens`.

### PASSO 3 — Verificação final da fatia (não pule)
1. `tsc` limpo · `vitest` verde · CI `build-test` verde nos PRs.
2. **Flags vazias** → `@mentor` responde no fio como antes, nenhuma chave `zxc-` no texto, `critique` determinístico igual, `examiner` ainda `not_implemented`.
3. **`docs/HANDOFF_FATIA3_RESULTADO.md`**: como ligar (`LIT_SEARCH=1` → `EXAMINER=1` → `CANAL_TAREFAS=1` + `TAREFAS_WORKER=1` no worker — nesta ordem, com um dia entre cada), rollback (flag vazia; tarefas em andamento terminam ou caem no reaper), e as medidas do handoff §9 "conhecimento": **citações órfãs = 0**, claims `NOT_SUPPORTED` por dossiê, % de respostas `UNVERIFIED` (a taxa de "não achei fonte" é informação, não falha), e do "escritório": mensagens do agente por tarefa (meta = 2).
**Gate:** os 3 itens, binários.

## 5. Decisões assumidas pelo Fable (valem até o Martinez vetar — leia antes do PASSO 1)

1. **A5 reescopado ao estado real do main:** a busca de literatura já é real (OpenAlex/Crossref/arXiv/PubMed/S2 + SearXNG). O PR não a reescreve; cria a chave, o validador, o examiner, o `data_access_level` e a degradação explícita. O "retrieval-augmented tool pick" (Biomni) fica pronto e dormente até haver ≥2 conectores MCP de busca.
2. **Integrity gate = 1 chamada Flash por rascunho** (não por claim) com saída JSON validada, e **heurística pura sem juiz** (chave válida = ALIGNED; sem chave = NOT_SUPPORTED) para testes e para quando o modelo falhar. Custo ≤ 1 fase extra; `verified_only` custa 1 chamada a mais, só nos 5 de saúde.
3. **FAILED força revisão mesmo com score alto**; UNVERIFIED/INCONCLUSIVE não reprovam (handoff C11: "não deu para verificar não é reprovação nem aprovação"). Reprovação definitiva continua pelo `maxRevisions` do laço.
4. **Chave determinística** (`sha256(doi|url|title + trecho[:200])[:8]`): o mesmo trecho da mesma fonte tem a mesma chave em qualquer processo/dia — permite o Zxiv (A7) e o watcher (P3) deduplicarem sem tabela central.
5. **Progresso = índice da fase** (10/25/45/60/75/90/100), nunca percentual estimado por tempo. É o que a prospecção pede ("as fases do `Phase`, não percentual inventado"); a barra pode "pular", e isso é honesto.
6. **Abertura e entrega são templates determinísticos, sem LLM** — a lei 1 exige exatamente duas mensagens; gerar por modelo arrisca a terceira ("próximos passos…") que a §3.5 proíbe. O conteúdo rico mora no artefato.
7. **Entrega = `ResearchWork` em "Minhas coisas"** (`workType:"dossie"`, `scopeId = canalId`), reusando `secoes`/`rev` do TCC em vez de criar modelo novo; o dossiê de 10 seções (A10) vai preencher as seções, o Material Passport já nasce aqui.
8. **`awaiting_input` por dois sinais** (`proximos_passos` iniciado por `PERGUNTA:` ou `Issue{tipo:"lacuna", onde:"escopo"}`), sem tool de "perguntar" nova: evita mexer no registry nesta fatia; A9/A12 podem promover para tool.
9. **Tarefa de agente não dispara turno de outro agente** (`mencoes: []` nas mensagens da tarefa): G3 (convocação por agente) é da Fatia 4 (A6/S6), com lock e loop guard.

## 6. Economia de execução (pedido do Martinez — leve a sério)

Agrupe edições por arquivo; não abra exploração (a §2 tem TODAS as âncoras, verificadas em `b2af5db`); não re-explique contratos — a §3 é o texto final; pare em cada gate e reporte em 1 linha; gate vermelho 2 vezes → **PARE e pergunte ao Martinez**. A4 em dois PRs se passar de ~8 arquivos. Se o `integrityGate` começar a virar uma chamada por claim, volte a uma por rascunho. Se a abertura da tarefa precisar de LLM para "ficar natural", é sinal de que o template está errado, não de que falta modelo. O valor está em cada gate verde, não em volume de código.
