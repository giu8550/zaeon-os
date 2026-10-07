# PROMPT DE EXECUÇÃO — Claude Code (Opus) · Escritório Zaeon · **Fatia 6 · Autonomia**

> **Você é o EXECUTOR.** Todo o projeto já foi decidido, pesquisado e contratado em código.
> Você NÃO redesenha, NÃO reabre decisão, NÃO re-deriva tipo, NÃO explora o repo além das
> âncoras dadas. Você integra, verifica e **para em cada gate**. Co-autorado pelo Fable em
> 2026-10-07 a partir de `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` (§3.7 hierarquia de voz; §3.8
> freios; §4 C10; §5 camada 5; §8.2–8.5, 8.8, 8.15; §10.1–10.2) +
> `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` (PR-A8 `:698-746`, A9 `:747-801`, A10 `:802-839`,
> A11 `:840-875`, A12 `:876-902`; decisões II.1 `:337-369`) + leitura do **Agent Laboratory**
> (`SamuelSchmidgall/AgentLaboratory`, MIT): `ai_lab_repo.py` (891 l.), `agents.py` (739 l.,
> `get_score`), `papersolver.py` (579 l.), lidos em 2026-10-07 — destilados na §3.A.
>
> **Esta fatia = 5 PRs, nesta ordem: A8 (programa + rotina) → A10 (dossiê) → A9 (pipeline das 7
> fases) → A11 (vitrine) → A12 (admin).** A10 vai antes de A9 porque o `draft`/`critique` do
> pipeline exigem o esquema e o validador do dossiê. Nasce **C10** (`ResearchProgram` +
> `ProgramCycle` + fila `programa-ciclo`) e a parte `EV_PROGRAMA` de **C2**. Consome C1 (tarefa),
> C3 (thread), C4 (chave), C5 (ledger — **obrigatório aqui**: orçamento real), C9 (Zxiv), C11
> (score/veredito), C12 (lock) e o comitê (A6). **Não comece sem as Fatias 1, 3, 4 e 5 mergeadas.**
> **Toda âncora `arquivo:linha` abaixo foi verificada em `origin/main` = `ed274d4` (2026-10-07).**

---

## 0. Leia antes de codar (só isto, nesta ordem)

1. `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` — §3.7 (o programa fala no nível 1-2-4; no fio só terminei/travei/preciso de você), §3.8 (orçamento por programa), §4 (C10 — você cria; C1/C4/C5/C9/C11/C12 — consome), §5 "CAMADA 5" (A8–A12), §8 (**8.2 rodadas finitas · 8.3 artefato antes de done · 8.4 orçamento antes do LLM · 8.5 progress ledger/stall/loop · 8.8 heartbeat local · 8.15 cancelamento cooperativo**), §10.1-10.2 (defaults adotados: PI, régua de utilidade).
2. `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` — A8–A12 e II.1 (linhas acima). *Por que o co-pilot mode é medido:* 3,8 → 4,38/10 (A9 `:775`).
3. `docs/BACKGROUND_JOBS_SALA_PESQUISA.md` — o padrão de job que `runProgramCycle` replica (`runScholarPipeline`).
4. `docs/EXECUTOR_PROMPT_FATIA{1,3,4,5}_*.md` §3 — C5, C1/C4/C11, A6 `runReuniao`, C9 `submeter`.
5. **O Agent Laboratory está destilado na §3.A** — não precisa abrir o repo deles.

## 1. Guardrails invioláveis (violar = PR rejeitado)

- **Flags off por padrão:** `PROGRAMA_SCHED` (**kill-switch da autonomia** — `""`/`"0"` = nenhum repeatable, nenhum ciclo), `PROGRAMA_WORKER`, `PROGRAMA_WORKER_CONCURRENCY=1`, `PROGRAMA_PIPELINE` (A9), `NEXT_PUBLIC_VITRINE` (A11, **build-arg**), `NEXT_PUBLIC_PROGRAMA_ADMIN` (A12, **build-arg**). Com tudo vazio: nada agenda, nada roda, nenhuma aba nova, nenhum label muda.
- **Primeiro scheduler do repo** (prospecção A8): repeatable do BullMQ com **jobId idempotente `programId:YYYY-MM-DD` no ciclo** (o mesmo dia nunca roda duas vezes), jitter por programa, **reconciliação na subida** (BullMQ perde repeatables se o Redis for limpo). Sem `REDIS_URL` **não existe** rotina — só "rodar agora" (inline). Autonomia sem fila é proibida.
- **Heartbeat é local** (§8.8): `lib/programa/heartbeat.ts` é um documento **nosso**, versionado; **nunca** baixar instrução de fora e executar.
- **Orçamento antes de qualquer LLM** (§8.4): `orcamentoTokensDia`/`Total` checados contra o **`TokenLedger` (C5) real** do programa; estourou → o ciclo **nem começa**, `status:"pausado"` + aviso no admin + 1 linha no canal se houver. Toda chamada do ciclo leva `LedgerCtx{programId, cycleId, phase}`.
- **Mentor sem dono humano não age** (II.1.3): `ownerId` obrigatório; **a régua de utilidade é obrigatória** (II.1 default): sem `problema`/`quemUsa`/`porQueAgora` o programa não salva, e o dossiê que não os amarra **reprova** (A10 §2).
- **Lease por ciclo** (deer-flow): `leaseOwner`/`leaseExpiresAt` — dois workers nunca tocam o mesmo ciclo; reaper libera lease vencida. **Cancelamento cooperativo** entre fases (§8.15). **Stall** 450s/1200s como na tarefa.
- **Progress Ledger + loop guard + rodadas finitas** herdados: comitês via `runReuniao` (A6), `papersolver` com `PAPERSOLVER_MAX_STEPS`, revisão de reviewers com **no máximo 1 volta** ao plano (`second_round`).
- **Experimento com código: não portar `mlesolver`.** Fase "viabilidade" roda **analítica** (estimativa/cálculo) e o dossiê **declara** "sem execução experimental neste ciclo"; a tool MCP `run_experiment` (`risk:"destructive"` → `REQUIRE_APPROVAL` pelo `permit()`) é **contrato futuro** — se não existir no registry, a fase não a inventa.
- **Hierarquia de voz (§3.7):** o ciclo **atualiza o card/dossiê** (nível 1) e **escreve no Zxiv** (nível 2); se o programa tiver `canalId`, no fio entram **só** abertura e entrega/travou/preciso-de-você (via `AgentTask` do PI, lei 1). Nada de narrar fase no fio.
- **Artefato antes de `done`** (§8.3): `ResearchWork` (dossiê) gravado → `ZxivPaper` submetido → **só então** `ProgramCycle.done`.
- **Nunca `next build` no loop**; `tsc` + `vitest` por PR; `generate` só com schema novo; `db push`. **`NEXT_PUBLIC_*` novas = build-arg no `Dockerfile` + `docker-compose.beta.yml` + `deploy.yml`** (lição §7).
- **Erros via `messageForError`:** adicione `programa_orcamento`, `programa_sem_novidade`, `programa_gate_humano`, `programa_lease`, `dossie_secao_vazia`, `dossie_premissa_sem_marca`, `dossie_sem_regua`.
- **Licença:** Agent Laboratory (MIT) → `docs/FONTES_BASE.md` ("Pipeline das 7 fases + papersolver + get_score — Agent Laboratory (MIT) — ADOTAR: estrutura e laço, reimplementados em TS/markdown; `mlesolver` NÃO portado").
- **1 PR por passo** (A9 pode ser dois), branch `escritorio/fatia6-<passo>-<slug>`, ≤ ~8 arquivos, descrição citando contrato e flag.

## 2. Importe, não reescreva (símbolo existente = import)

| O que | Onde (verificado) |
|---|---|
| Padrão de job longo | `lib/scholar/pipeline.ts` — `ScholarRunParams :23`, **`runScholarPipeline(sessionId, params, emit) :34`** (fases `planning → searching → dedup → synthesizing → verifying`) · `lib/scholar/types.ts` `ScholarEvent :77-85` (`{type:"phase"} \| {type:"answer"} \| {type:"done"} \| {type:"error"}`) · worker + `persistEvent` em `instrumentation-node.ts` (`iniciarWorkers :20`) |
| Filas (molde) | `lib/queue/chat.ts` (`CHAT_JOB_OPTIONS :24`, `enqueueChatJob :44`) · `lib/canal/queue.ts` (`filaLigada`, `jobIdDe`, `depsReais`, worker) · `lib/queue/scholar.ts` (`getRedisConnection :33`, `isQueueEnabled`) · `lib/queue/reaper.ts` (`STUCK_MS :13`, `ReaperDb :16`, `reapStuckJobs :21`) |
| Harness | `lib/agent/trajectory.ts` — `Phase :33` (`route\|plan\|gather\|reason\|draft\|critique\|finalize`), `PHASE_LABEL :96`, `runTrajectoryTraced` · `lib/agent/aura-harness.ts` `buildHarnessDeps` (`HarnessOpts.ledger`, `systemContext`, `genJson`) |
| Tarefa (C1) / comitê (A6) / Zxiv (C9) / citação (C4) / score (C11) | `lib/canal/tarefas.ts` · `lib/reuniao/run.ts` `runReuniao` + `lib/reuniao/tarefa.ts` `convocarReuniao` · `lib/zxiv/store.ts` `submeter`, tool `zxiv_search` · `lib/agent/citacao.ts` (`Contexto`, `contextosDe`, `passaporte`) · `lib/agent/examiner.ts` (`scorePaper`, `integrityGate`, `veredito`) |
| Ledger (C5) | `lib/llm/envelope.ts` `gerar/gerarJson({ctx: LedgerCtx})` · `lib/metrics/tokens.ts` `porPrograma`, `totalizador` · `GET /api/admin/agents/tokens?groupBy=programa` |
| Seções do dossiê | `lib/tcc/secoes.ts` — `Secao :13`, `OpSecao :24`, `MAX_SECOES :40`, `MAX_CORPO :41`, `readSecoes :67`, `novasSecoes :84`, `secoesParaMarkdown :104`, `secoesDeMarkdown :113`, `aplicarOps :192`, `diffSecoes :233` · `prisma` `model ResearchWork :527` (`secoes`, `rev`, `workType`, `scopeId`), `model TccRevisao :548` (histórico `op/origem/antes/depois`) |
| Memória entre ciclos | `lib/agent/memory-provider.ts` `getMemory()`, `isMemoryConfigured()` · `lib/agent/memory.ts` `WingKind "projeto" :29`, `wingFromSurface(…, {projectId}) :110` |
| Imagem de capa | `lib/studio/imagen.ts` — `imagenAvailable() :20`, `generateImage() :25` · `lib/studio/storage.ts` `writeStudioFile :32` · `model StudioArtifact :689` |
| Vitrine (molde) | `components/mentors/MentoresGrid.tsx:130-197` (card: borda gradiente `:135`, brilho `:139`) · capa com imagem `app/plugin-store/page.tsx:373-374` (`object-cover`) · `lib/canal/vidro.ts` · `components/mobile/estilo.ts` · `components/agents/AgentAvatar.tsx` |
| Abas do lab | `lib/research/unifiedRoom.ts` — `LabTab :22`, **`LAB_TABS :37`**, `resolveLabTab :53` · `app/research-lab/page.tsx` — `UNIFIED :132`, `PROJETOS = projetosOn() :134`, `lastTab :694,:1453`, botão `projetos :2533-2545` (ícone `Code2`, label "Projetos"), render `projetos :2998`, cabeçalho das abas sem meta `:2626`, `getTabMeta` (case `"escritorio" :2413`) |
| Admin | `app/workstation/admin/page.tsx:171-181` (render dos módulos; `agents` com `agentsAdmin()`) · `lib/admin/assertAdmin.ts` · `app/workstation/admin/modules/AgentsModule.tsx` (molde de módulo) · `prisma` `model MentorTemplate :801` |
| Flags | `lib/canal/flags.ts` (`on()`, `escritorioCowork :11`, `agentsAdmin :12`) — adicione as desta fatia aqui |
| Realtime | `lib/canal/wire.ts` (`EV_TAREFA`, `EV_AGENTE_ESTADO`), `lib/canal/realtime.ts` `publicarPusher`, `lib/collab/realtime.ts` `triggerSafe` (canal arbitrário: `programa-<id>`) |

## 3. Os contratos que esta fatia CRIA (texto final — copie, não reinterprete)

### C10 · `ResearchProgram` + `ProgramCycle` + fila `programa-ciclo` (+ `EV_PROGRAMA` de C2)

```prisma
model ResearchProgram {
  id                   String   @id @default(auto()) @map("_id") @db.ObjectId
  slug                 String   @unique
  titulo               String
  topico               String
  problema             String                      // régua de utilidade — os 3 são OBRIGATÓRIOS (II.1)
  quemUsa              String
  porQueAgora          String
  ownerId              String   @db.ObjectId       // humano responsável (II.1.3)
  piAgentKey           String                      // default "zaeon" (§10.1 — ver Fatia 4 §5.1)
  membros              String[] @default([])       // mentor slugs
  canalId              String?  @db.ObjectId       // opcional: onde abertura/entrega/pedidos aparecem
  cadencia             String   @default("diaria") // diaria | semanal | pausado
  horaUTC              Int      @default(9)
  status               String   @default("rascunho") // rascunho | ativo | aguardando_humano | pausado | concluido | arquivado
  orcamentoTokensDia   Int      @default(150000)
  orcamentoTokensTotal Int      @default(3000000)
  tokensGastos         Int      @default(0)        // cache (verdade = TokenLedger por programId)
  gateHumano           String[] @default([])       // fases que param: "plan" | "viabilidade" | "draft" | "finalize"
  restricoes           Json?                       // ex.: { semGpu: true, semExperimentoFisico: true }
  notes                Json     @default("[]")     // [{ fases: string[], nota: string, at }] — feedback humano (co-pilot)
  fase                 String?
  cicloAtual           Int      @default(0)
  capaArtifactId       String?  @db.ObjectId
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([ownerId, status])
  @@index([status, cadencia])
  @@map("research_programs")
}

model ProgramCycle {
  id             String    @id @default(auto()) @map("_id") @db.ObjectId
  programId      String    @db.ObjectId
  n              Int
  status         String    @default("queued")   // queued | running | awaiting_input | done | failed | cancelled
  fase           String?                        // FaseCiclo (§3.A)
  progress       Int       @default(0)
  steps          Json      @default("[]")       // [{ at, fase, label, tokens?, ledger? }]
  diffDoAnterior String?                        // THE LOOP: o que mudou vs. ciclo n-1 ("nada novo" = encerra sem paper)
  needsHuman     Json?                          // { fase, pergunta, opcoes? }
  resposta       Json?
  paperId        String?   @db.ObjectId         // ZxivPaper
  workId         String?   @db.ObjectId         // ResearchWork (dossiê)
  taskIds        String[]  @default([])         // AgentTasks criadas no ciclo (comitês, abertura/entrega no canal)
  tokens         Int       @default(0)
  leaseOwner     String?
  leaseExpiresAt DateTime?
  lastProgressAt DateTime  @default(now())
  cancelRequested Boolean  @default(false)
  idempotencyKey String    @unique              // "<programId>:<YYYY-MM-DD>" (ou ":manual:<ts>" em "rodar agora")
  iniciadoEm     DateTime?
  terminadoEm    DateTime?
  erro           String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([programId, n])
  @@index([status, updatedAt])
  @@map("program_cycles")
}
```
```ts
// lib/queue/programa.ts
export const PROGRAMA_QUEUE = "programa-ciclo";
export type ProgramaJob = { programId: string; dia: string /* YYYY-MM-DD */; manual?: boolean };
export function schedLigado(): boolean;                       // PROGRAMA_SCHED === "1" && REDIS_URL
export function patternDe(p: { cadencia: string; horaUTC: number; id: string }): string | null; // "<jitterMin> <horaUTC> * * *" | "… * * 1" | null (pausado) — jitterMin = hash(id) % 50
export async function agendar(programa): Promise<void>;       // upsert do repeatable (key "programa:<id>"); pausado/arquivado → remove
export async function reconciliar(db): Promise<{ adicionados: number; removidos: number }>; // na subida: programas ativos ↔ getRepeatableJobs()
export async function rodarAgora(programId): Promise<{ via: "fila" | "inline"; cycleId: string }>;
export async function iniciarWorkerPrograma(): Promise<boolean>; // concorrência PROGRAMA_WORKER_CONCURRENCY (1)
// lib/canal/wire.ts (aditivo)
export const EV_PROGRAMA = "programa";
export type ProgramaWire = { programId: string; cycleId: string; n: number; status: ProgramCycle["status"]; fase: string | null; progress: number; label?: string | null; needsHuman?: ProgramCycle["needsHuman"]; paperSlug?: string | null; workId?: string | null; at: string };
// publicado via triggerSafe(`programa-${programId}`, EV_PROGRAMA, wire) e, se houver canalId, também no `canal-<id>`
```

### A10 · Dossiê (esquema + validador)

```ts
// lib/dossie/esquema.ts (PURO)
export const SECOES_DOSSIE = [
  { id: "sintese", titulo: "Síntese executiva", obrigatoria: true },
  { id: "problema", titulo: "Problema e utilidade", obrigatoria: true },      // amarra os 3 campos
  { id: "estado-da-arte", titulo: "Estado da arte", obrigatoria: true },      // chaves zxc- + lacuna declarada
  { id: "materiais", titulo: "Materiais e meios", obrigatoria: true },
  { id: "viabilidade", titulo: "Viabilidade", obrigatoria: true },            // premissas numeradas e MARCADAS
  { id: "desdobramentos", titulo: "Desdobramentos", obrigatoria: true },
  { id: "implicacoes", titulo: "Implicações", obrigatoria: true },
  { id: "humano", titulo: "Onde o humano precisa entrar", obrigatoria: true },// cada item vira needsHuman
  { id: "passaporte", titulo: "Material Passport", obrigatoria: true },
  { id: "veredito", titulo: "Veredito e score", obrigatoria: true },
] as const;
export const MARCA_RE = /\[(VERIFIED|UNVERIFIED|INCONCLUSIVE)\]/;
export type ProblemaDossie = { secaoId: string; code: "dossie_secao_vazia" | "dossie_premissa_sem_marca" | "dossie_sem_regua" | "dossie_sem_fonte"; detalhe: string };
export function esqueletoDossie(): Secao[];                                            // 10 seções com corpo "" (reusa novasSecoes)
export function validarDossie(secoes: Secao[], programa: { problema: string; quemUsa: string; porQueAgora: string }): ProblemaDossie[];
//   vazia obrigatória → dossie_secao_vazia · "problema" sem os três marcadores `**Problema:**` `**Quem usa:**` `**Por que agora:**` → dossie_sem_regua
//   "viabilidade": toda linha que começa com `N.` (premissa numerada) precisa terminar com MARCA_RE → senão dossie_premissa_sem_marca
//   "estado-da-arte" sem nenhuma chave `zxc-` **e** sem a frase "Lacuna:" → dossie_sem_fonte
export function pedidosHumanos(secoes: Secao[]): { pergunta: string; opcoes?: string[] }[]; // cada "- " de "humano" vira um pedido
export function premissas(secoes: Secao[]): { n: number; texto: string; marca: "VERIFIED" | "UNVERIFIED" | "INCONCLUSIVE" | null }[];
export function dossieParaIssues(problemas: ProblemaDossie[]): Issue[];                // → Issue{tipo:"lacuna", onde: secaoId, porque, sugestao} (C11 reprova)
```

### §3.A · O Agent Laboratory, destilado (o que `runProgramCycle` e `papersolver.ts` implementam)

**Fases (`ai_lab_repo.py` `perform_research :139-205`):** `literature review → plan formulation → data preparation → running experiments → results interpretation → report writing → report refinement`. Cada fase roda `while repeat: repeat = fase()`; `repeat` vem do **gate humano** (`human_in_loop :~430`): apresenta o produto da fase, "Y" segue, "N" pede **nota**, `reset_agents()` e **`notes.append({phases:[fase], note})`** — a fase roda de novo com a nota. `report refinement` chama **3 reviewers** (`ReviewersAgent.inference`) e decide: "n" = projeto completo; "y" = **volta ao `plan formulation`** com `second_round=True` e `prev_report/prev_exp_results/prev_interpretation` guardados — **uma vez** (as fases 2-7 são zeradas e `perform_research()` reentra). `max_steps` por fase = orçamento de compute. **AgentRxiv:** na `literature review`, se `agentRxiv` e `num_papers() > 0`, a busca `SUMMARY` consulta o mural **antes** do arXiv e `FULL_TEXT AgentRxiv:ID` lê o paper do mural; o relatório final é copiado para `uploads/` (vira paper do mural).

**`get_score` (`agents.py :36-180`):** prompt de reviewer (herdado do AI Scientist, formato NeurIPS): `THOUGHT:` + `REVIEW JSON:` com `Summary, Strengths, Weaknesses, Originality(1-4), Quality(1-4), Clarity(1-4), Significance(1-4), Questions, Limitations, Ethical Concerns(bool), Soundness(1-4), Presentation(1-4), Contribution(1-4), Overall(1-10), Confidence(1-5), Decision(Accept|Reject)`; normaliza cada um (`/4`, `/10`, `/5`) e pondera: **`contribution 0.4`, `presentation 0.2`**, os outros **0.1** (`clarity, quality, overall, soundness, confidence, originality, significance`) → `score = soma/max_score × 10`; `attempts=3` com re-prompt se o JSON falhar. **É exatamente o `scorePaper` do C11** (Fatia 3) — reuse; aqui entra só o **prompt do reviewer em PT-BR** e o `Decision`.

**`PaperSolver` (`papersolver.py :237-579`):** `initial_solve` → `gen_initial_report`: gera o **scaffold** com placeholders `[ABSTRACT HERE]`… e preenche **seção a seção** (`abstract, introduction, related work, background, methods, experimental setup, results, discussion`) via comando `REPLACE`; o scaffold **compila** (LaTeX) ou é rejeitado; score inicial = `get_score`. `solve()` (`:269-306`): a cada passo, parte de **um dos `best_report`** (`random.choice`), pede **um comando** (`EDIT N M` substitui as linhas N..M por novas linhas; `REPLACE` troca tudo), executa, **compila** (falhou → "Paper was reverted back"), **pontua**; aceita o candidato do passo só se `score > top_score`; repete até `min_gen_trials` **e** ter um score; **entra no `best_report` só se superar o pior dos top-`max_papers`** (lista ordenada por score). Reflexão (`reflect`) após o passo. `papersolver_max_steps` passos no total (`report_writing :255`).

**O que mantemos:** scaffold fixo → preenchimento por seção → laço de edição por comandos com **aceite só por score** → `best_report` top-k → teto de passos → reflexão → 3 reviewers → no máximo 1 volta ao plano → gate humano com `notes` que reinicializam a fase. **O que mudamos:** LaTeX → **markdown por seções** (`lib/tcc/secoes.ts`); "compila" → **`validarDossie` sem problemas** (dossiê inválido = edição revertida); 8 seções ICLR → **as 10 do A10**; `get_score` → `scorePaper` (C11) + `integrityGate`; `mlesolver` → **não portado** (fase analítica declarada); `notes` → `ResearchProgram.notes`; `uploads/` → `submeter` no Zxiv (C9) com gate de novidade.

## 4. OS PASSOS (ordem executável; pare e reporte 1 linha em cada gate)

### PASSO 1 — PR-A8 · `ResearchProgram` + rotina diária (nasce C10)
Branch `escritorio/fatia6-a8-programa-rotina`. Flags `PROGRAMA_SCHED`, `PROGRAMA_WORKER`, `PROGRAMA_WORKER_CONCURRENCY`.
1. **Schema** (§3) → `generate` + `db push`. **`lib/programa/store.ts`:** `criarPrograma` (valida os 3 campos — vazio → 400 `dossie_sem_regua`; `slug` único; `piAgentKey` default `"zaeon"`; `membros` ⊆ roster), `atualizar`, `mudarStatus`, `proximoCiclo(db, programId, idempotencyKey)` (idempotente por `P2002`), `marcarFaseCiclo`, `pedirHumanoCiclo`, `responderCiclo` (grava `resposta` + `esperouMs` em `steps`), `concluirCiclo` (**exige `workId`** antes de `done`), `falharCiclo`, `cancelarCiclo` (cooperativo). **`lib/programa/orcamento.ts`:** `orcamentoOk(db, programa, agora)` → `{ ok, usadoHoje, usadoTotal, motivo? }` lendo **`TokenLedger` por `programId`** (C5) — sem C5 no main → **o PR não entra** (pré-requisito).
2. **`lib/programa/heartbeat.ts`:** o documento **local** do ciclo (constante TS, versionada): o que um ciclo faz, os freios, o formato das mensagens — é o `systemContext` base de toda chamada do ciclo. Teste garante que **não há `fetch`/`import` dinâmico** no módulo.
3. **Fila** `lib/queue/programa.ts` (§3): repeatable por programa (`queue.add("ciclo", {programId}, { repeat: { pattern, tz: "UTC" }, jobId: "programa:" + id })`); o processador do repeatable cria o ciclo do **dia** (`idempotencyKey = programId:YYYY-MM-DD` → o segundo disparo do mesmo dia é no-op) e roda `runProgramCycle` (A9; nesta PR um `runner` **stub** que marca `done` com `diffDoAnterior:"stub"` para o gate ser testável); `reconciliar(db)` na subida (`iniciarWorkerPrograma` em `instrumentation-node.ts` sob `PROGRAMA_WORKER=1`): programas `ativo` sem repeatable → `agendar`; repeatables órfãos → `removeRepeatableByKey`. **`PROGRAMA_SCHED` vazio/`0`:** `agendar` vira no-op, `reconciliar` **remove** todos, o worker recusa jobs (log 1 linha) — kill-switch em segundos. **Lease:** o processador faz `updateMany({ id, OR: [{leaseOwner: null}, {leaseExpiresAt: {lt: now}}] }, { leaseOwner, leaseExpiresAt: now+10min })`; `count === 0` → outro worker tem o ciclo, sai. Renova a cada fase. `lib/queue/reaper.ts`: `programCycle` presos → `failed`, lease vencida → liberada; `awaiting_input` **não** é preso. `status:"aguardando_humano"` do programa **suspende** o repeatable (remove) e `responderCiclo` reagenda.
4. **Rotas (owner, não admin — o admin é A12):** `GET /api/programas` (meus: `ownerId` ou membro do `canalId`), `GET /api/programas/[id]` (+ ciclos recentes), `POST /api/programas/[id]/rodar-agora` (owner; `idempotencyKey = programId:manual:<ts>`), `POST …/ciclos/[cycleId]/responder` (owner; só `awaiting_input`), `POST …/ciclos/[cycleId]/cancelar`. Criação/edição ficam no **A12** (admin) — o owner não cria programa nesta fatia (II.1.3: autonomia é decisão de quem paga).
5. **`.env.example`** + **`docs/RUNBOOK_PROGRAMA.md`** (ligar: `REDIS_URL` → `PROGRAMA_WORKER=1` no worker → `PROGRAMA_SCHED=1`; desligar: `PROGRAMA_SCHED=0` + redeploy do worker, ou `pausado` por programa).
6. **Testes:** `patternDe` (jitter determinístico por id; semanal; pausado → null); `store.test.ts` (3 campos obrigatórios; `proximoCiclo` idempotente; `concluirCiclo` sem `workId` → erro; `responderCiclo` grava `esperouMs`); `orcamento.test.ts` (fake ledger: dia e total; estourado → `motivo`); `programa.queue.test.ts` (fake BullMQ: `reconciliar` adiciona/remove; `PROGRAMA_SCHED` vazio remove tudo; lease: segundo worker não processa; mesmo dia = 1 ciclo); `heartbeat.test.ts` (sem `fetch`/import dinâmico; texto tem os freios); rotas (IDOR; `rodar-agora` por não-owner 403).
**Gate A8:** criar programa (fixture) com cadência diária → repeatable aparece em `getRepeatableJobs()`; "rodar agora" → `ProgramCycle` nasce, roda o stub e fecha; disparar o repeatable 2× no mesmo dia → **1** ciclo; orçamento estourado (ledger fake) → ciclo não começa e programa `pausado`; `PROGRAMA_SCHED=0` + restart → zero repeatables; restart com `=1` → reagendado. **Reporte:** `PASSO 1: verde/vermelho + saída do getRepeatableJobs antes/depois`.

### PASSO 2 — PR-A10 · O dossiê (esquema + validador + persistência)
Branch `escritorio/fatia6-a10-dossie`. Sem flag (biblioteca pura + persistência aditiva).
1. **`lib/dossie/esquema.ts`** (§3, puro). **`lib/dossie/persistir.ts`:** `gravarDossie(db, { programa, cycle, secoes, passaporte, score, veredito, needsHuman })` → `ResearchWork{ userId: ownerId, workType:"dossie", scopeId: programa.slug, title, secoes, content: secoesParaMarkdown }` (**rev+1 e `TccRevisao`** por seção alterada quando já existe o dossiê do ciclo anterior — `diffSecoes :233` + `origem:"pesquisa"`); `dossieDoCiclo(db, cycleId)`.
2. **Examiner:** `critique()` (C11) ganha, quando `st.kind === "dossie"` **ou** `opts.dossie` presente: `dossieParaIssues(validarDossie(...))` somados aos `issues` → **reprova** (`decision:"reprovado"`) em `dossie_secao_vazia`/`dossie_sem_regua`/`dossie_premissa_sem_marca`. `pedidosHumanos` → cada item vira `needsHuman` acionável (A9 usa; A4 `pedirHumano` quando há `taskId`).
3. **Sala de Pesquisa:** o dossiê abre em "Minhas coisas" como `ResearchWork` normal (editor de seções do TCC já lê `secoes`) — zero UI nova; a seção "Veredito e score" renderiza o JSON do score como lista (componente mínimo `components/research/VereditoDossie.tsx`, opcional se o editor já mostrar markdown).
4. **Testes:** `esquema.test.ts` (10 seções no esqueleto; vazia obrigatória; régua ausente; premissa `3. … [VERIFIED]` ok e `4. …` sem marca → erro; `pedidosHumanos` extrai bullets; `premissas` parse); `persistir.test.ts` (rev e `TccRevisao` no 2º ciclo; `scopeId = slug`); `examiner.test.ts` (dossiê com seção vazia → reprovado; completo → não interfere no score).
**Gate A10:** dossiê-fixture completo abre na Sala de Pesquisa com as 10 seções; nenhuma premissa sem marca passa; ≥1 item de "Onde o humano precisa entrar" vira pedido visível (teste de `pedidosHumanos`); seção obrigatória vazia é **reprovada** em teste. **Reporte:** `PASSO 2: verde/vermelho + lista de problemas do fixture inválido`.

### PASSO 3 — PR-A9 · Pipeline das 7 fases + `papersolver` (porte fiel)
Branch `escritorio/fatia6-a9-pipeline`. Flag `PROGRAMA_PIPELINE`; `PAPERSOLVER_MAX_STEPS` (5), `PAPERSOLVER_MIN_TRIALS` (2), `PAPERSOLVER_TOP_K` (3), `PROGRAMA_SECOND_ROUND` (1). **Dividir em dois:** A9a = `lib/programa/papersolver.ts` + `lib/programa/reviewers.ts` (puros, com `deps` injetadas, testados); A9b = `lib/programa/pipeline.ts` + worker + eventos.
1. **`lib/programa/papersolver.ts`** (porte da §3.A, markdown por seções): `resolverDossie({ programa, plano, contextos, insights, interpretacao, secoesIniciais?, notas }, deps: { gerar, pontuar: (secoes) => Promise<{score: ScorePaper; problemas: ProblemaDossie[]}>, emit, cancelado? })`: (a) **scaffold** = `esqueletoDossie()`; (b) **preenchimento por seção**, na ordem das 10, cada uma com prompt próprio (`REPLACE` da seção; `validarDossie` parcial — só a seção — como "compila"); (c) **laço de edição**: até `PAPERSOLVER_MAX_STEPS` passos; em cada passo parte de **um dos `melhores`** (top-`PAPERSOLVER_TOP_K`, escolha aleatória com seed do `cycleId` → **determinístico em teste**), pede **um comando** ao modelo sobre o dossiê **numerado por linhas** (`EDIT N M\n<linhas>` ou `REPLACE <secaoId>\n<corpo>`), aplica, **`validarDossie` sem problemas** senão "revertido", **`pontuar`**, aceita o candidato do passo só se `score.overall > top`, entra nos `melhores` só se superar o pior; `min_gen_trials`; (d) **reflexão** (1 chamada): "insights generalizáveis" → `MemoryDrawer{ wing:{kind:"projeto", label: programa.slug}, kind:"nota" }` quando `isMemoryConfigured()`; (e) devolve `{ secoes, score, problemas: [], passos, melhorPasso }`. **`lib/programa/reviewers.ts`:** `revisar(dossie, deps)` → 3 reviews (prompt do reviewer em PT-BR, mesmos campos de `get_score`, via `scorePaper`) + `decidirVolta(reviews, segundaRodadaJaFeita)` → `"completo" | "voltar_ao_plano"` (pede ao PI com o prompt do original: "Type y … to go back, n … for complete"; `PROGRAMA_SECOND_ROUND` limita a 1 volta).
2. **`lib/programa/pipeline.ts`** → `runProgramCycle(cycleId, params, emit)` (irmão de `runScholarPipeline :34`): `FaseCiclo = "literatura" | "plano" | "materiais" | "viabilidade" | "interpretacao" | "redacao" | "refinamento"` mapeadas ao `Phase` (`gather, plan, gather, reason, reason, draft, critique/finalize`) com `LedgerCtx{programId, cycleId, phase}` em **toda** chamada:
   - **literatura:** `zxiv_search` **primeiro** (C9), depois `literature_search`/`web_search` (A5) → `Contexto[]` com chave; memória do programa (`wing projeto/slug`, últimas notas + `summary` do ciclo anterior) entra no `systemContext`. **`diffDoAnterior`:** compara as chaves `zxc-` e os slugs Zxiv achados com os do ciclo `n-1` (`fontes` do dossiê anterior) + `notes` novas + `resposta` humana pendente; **nada novo → `concluirCiclo` sem paper** (`diffDoAnterior:"nada novo: 0 fontes novas, 0 notas"`, `status:"done"`, `paperId:null`, 1 linha no canal se houver — "ciclo de hoje: nada novo, sem paper") e **encerra barato** (sem comitê, sem draft).
   - **plano:** `runReuniao` (A6) `tipo:"comite"`, PI + `membros`, pauta = tópico + régua + `diffDoAnterior`, `summariesAnteriores` = resumos dos ciclos anteriores; resultado = plano do ciclo (`### Recommendation` + `### Next Steps`). **Gate humano** se `"plan" ∈ gateHumano`.
   - **materiais:** turno do harness (`criar_trabalho`, tools `literature_search`/`web_search`/`zxiv_search`) com instrução de levantar **componentes, custos com fonte e data, normas, fornecedores** → seção `materiais` (rascunho) + contextos.
   - **viabilidade:** `reason` com premissas **numeradas e marcadas**; `run_experiment` **só se** `getTool("run_experiment")` existir (→ `permit()` → `REQUIRE_APPROVAL` → `awaiting_input`); senão **analítica** e a seção declara `**Sem execução experimental neste ciclo.**`. Gate humano se `"viabilidade"`.
   - **interpretacao:** `runReuniao` `tipo:"comite"` sobre materiais + viabilidade → interpretação + desdobramentos.
   - **redacao:** `resolverDossie` (A9a) com `pontuar = scorePaper(juiz) + validarDossie`; **gate humano** se `"draft"`.
   - **refinamento:** `integrityGate` (C11) sobre o dossiê; `revisar` (3 reviewers) → `decidirVolta`: `"voltar_ao_plano"` (1×) → zera `plano…refinamento`, guarda `prev*`, reentra em `plano` com `second_round`; `"completo"` → `gravarDossie` (A10) → `passaporte` → `submeter` no Zxiv (C9; rejeição por novidade = linha no dossiê + `parentPaperIds`) → `concluirCiclo({ workId, paperId })` → **1 mensagem de entrega** no canal (se `canalId`, via `AgentTask` do PI) → `EV_PROGRAMA done`. Gate humano se `"finalize"`.
   - **Transversais:** `orcamentoOk` **antes de cada fase** (estourou no meio → `pausado` + `awaiting`? **não**: `failed:"orcamento"` com o que foi gravado); `cancelRequested` entre fases; lease renovada por fase; `marcarFaseCiclo` (progress `literatura 10 · plano 25 · materiais 40 · viabilidade 55 · interpretacao 65 · redacao 85 · refinamento 95 · done 100`) + `EV_PROGRAMA` + `EV_TAREFA`/estado S9 do PI quando houver canal; **`notes`** com `fases ∋ fase` entram no `systemContext` da fase e **reinicializam** o contexto do agente daquela fase (como `reset_agents`); `needsHuman` de "Onde o humano precisa entrar" → `pedirHumanoCiclo` **após** gravar (não bloqueia a entrega; bloqueia o **próximo** ciclo até resposta).
3. **Worker:** o `runner` stub do A8 vira `runProgramCycle` quando `PROGRAMA_PIPELINE=1`; cada evento persiste em `ProgramCycle.steps` (como `persistEvent` do scholar).
4. **Testes** (todos com `deps` fake, zero LLM): `papersolver.test.ts` (scaffold → 10 seções; edição inválida é revertida; candidato só entra com score maior; `melhores` mantém top-k ordenado; teto de passos; seed determinística; reflexão escrita quando memória configurada); `reviewers.test.ts` (3 reviews; `decidirVolta` respeita `PROGRAMA_SECOND_ROUND`); `pipeline.test.ts` (fases na ordem com progresso monotônico e `LedgerCtx.phase` certo; **nada novo → done sem paper e sem comitê**; gate humano em `plan` → `awaiting_input` e `responderCiclo` retoma **da mesma fase** com a nota no contexto; `second_round` acontece no máximo 1×; `run_experiment` ausente → fase analítica com a frase declarada; orçamento estourado entre fases → `failed:"orcamento"`; cancelamento para em ≤1 fase; `workId` gravado **antes** de `done`; entrega no canal = 1 mensagem).
**Gate A9:** um ciclo completo do programa-exemplo (**"sistema aquífero de baixo custo para regiões de extremo calor"**, fixture do A12) termina com dossiê de 10 seções + paper no Zxiv + tokens por fase no ledger; o ciclo 2 **cita** o paper do ciclo 1 (`parentPaperIds`); um ciclo sem novidade **encerra sem paper**; gate humano em `plan` para o ciclo e a resposta o retoma; flag off → o worker roda o stub. **Reporte:** `PASSO 3: verde/vermelho + tokens por fase do ciclo-exemplo e o slug citado no ciclo 2`.

### PASSO 4 — PR-A11 · Vitrine "Projetos"
Branch `escritorio/fatia6-a11-vitrine`. Flag **`NEXT_PUBLIC_VITRINE`** (build-arg no `Dockerfile` + `docker-compose.beta.yml` + `deploy.yml`, como as 3 do escritório).
1. **Aba:** `lib/research/unifiedRoom.ts` — `LabTab` ganha `"producao"` e `LAB_TABS :37` o registro (label **"Projetos"**, só com a flag); `app/research-lab/page.tsx` — botão após `projetos :2533-2545`, render `activeTab === "producao"` ao lado de `:2998`, `getTabMeta` case `"producao"` ("Projetos" / "Programas de pesquisa dos seus mentores — dossiês, papers e decisões"); **a aba `projetos` mantém a key** e, com a flag on, o label `:2540` vira **"Zaeon Code"**; off → nada muda (deep-links `?tab=projetos` e `app/plugin-store/page.tsx` card intactos).
2. **`app/research-lab/producao/VitrineProducao.tsx`:** grid `md:grid-cols-2 lg:grid-cols-3 gap-6` (molde `MentoresGrid :130-197`: borda gradiente + `VIDRO_BOLHA` + brilho); card = **capa** (`capaArtifactId` → `/api/studio/arquivo/<id>`? reuse a rota que já serve `StudioArtifact` de imagem; fallback gradiente + ⟁), título, tópico (1 linha), chip de status (`ativo · aguardando você · pausado · concluído`), **fase + barra** do ciclo corrente, contadores (ciclos · papers no Zxiv · fontes), avatares dos mentores (`AgentAvatar`), tokens (só admin, via `/api/admin/agents/tokens?groupBy=programa`), selo ⚠ **"precisa de você"** em `awaiting_input` (toque → card de decisão com as opções → `POST …/responder`). Clique no card → dossiê mais recente (`/research-lab?tab=pesquisa&work=<workId>`); painel lateral com ciclos anteriores e a **linhagem** (`parentPaperIds` → `/zxiv/<slug>`). Mobile = 1 coluna (`components/mobile/estilo.ts`).
3. **Ao vivo:** `pusher.subscribe("programa-" + id)` + `bind(EV_PROGRAMA)` por card visível; fallback `GET /api/programas?resumo=1` a cada 5s **só** com ciclo `queued|running`.
4. **Capa:** gerada no **nascimento do programa** (A12 chama `lib/programa/capa.ts`): `imagenAvailable() :20` → `generateImage()` com prompt derivado do tópico, **sem texto na imagem** ("no text, no letters"), estilo fixo da casa → `writeStudioFile` + `StudioArtifact{kind:"image"}` → `capaArtifactId`; `imagenAvailable()` false → `null` e o card usa gradiente + ⟁. Best-effort (fire-and-forget), nunca segura a criação.
5. **Testes:** `unifiedRoom.test.ts` (`producao` só com flag; `resolveLabTab("producao")` com flag off → default); `capa.test.ts` (prompt sem palavras de texto; Imagen indisponível → null); rotas `programas` (IDOR: C não vê programa de A; membro do canal vê); componente: cobertura só da lógica pura (`statusChip`, `progressoDoCiclo`).
**Gate A11:** vitrine lista programas com capa e barra; progresso anda **sem recarregar** (EV_PROGRAMA); selo "precisa de você" leva à decisão e a resposta retoma; flag off → aba inexistente e label "Projetos" na aba `projetos` como hoje. **Reporte:** `PASSO 4: verde/vermelho + os 2 estados da flag`.

### PASSO 5 — PR-A12 · Admin do programa + caixa de decisões
Branch `escritorio/fatia6-a12-admin`. Flag **`NEXT_PUBLIC_PROGRAMA_ADMIN`** (build-arg) + `assertAdmin()`.
1. **Rotas** `app/api/admin/programas/*` (gate = `programaAdmin()` + `assertAdmin()`, 404/401/403 como `admin/agents`): `GET/POST /` (criar: **os 3 campos obrigatórios — sem eles 400 `dossie_sem_regua`**; PI e `membros` de `MentorTemplate :801`/roster; cadência/hora; orçamentos; `gateHumano`; `restricoes`; cria capa best-effort; `agendar` se `ativo`), `PATCH /[id]` (editar; mudar cadência/status reagenda), `POST /[id]/rodar-agora`, `/pausar`, `/retomar`, `/arquivar`, `POST /[id]/ciclos/[cycleId]/cancelar`, **`GET /decisoes`** (caixa única: `ProgramCycle.awaiting_input` **+** `AgentTask.awaiting_input` de todos os programas/canais, com `esperandoDesde`), `POST /decisoes/[tipo]/[id]` (`{ acao: "aceitar" | "responder" | "editar_plano" | "ignorar", resposta?, nota? }` → `responderCiclo`/`responderHumano`; **registra `esperouMs`**; `ignorar` = marca e não reagenda), `GET /[id]/gasto` (= `tokens?groupBy=programa` filtrado), **`POST /kill-switch { ligado: boolean }`** → só **reflete** `PROGRAMA_SCHED` (lê a env) e, com `ligado:false`, remove todos os repeatables **agora** (a env continua mandando no próximo boot — o módulo mostra os dois estados).
2. **`app/workstation/admin/modules/ProgramasModule.tsx`** (registrar em `admin/page.tsx:171-181` + aba, como `agents`): formulário de criação (3 campos com asterisco e bloqueio do botão), lista de programas (status, fase, ciclo, gasto dia/total vs orçamento, próximo disparo), fila de ciclos com **rodar agora / pausar / cancelar / arquivar**, **kill-switch visível** (estado da env + botão "derrubar agora"), **Caixa de decisões** (lista única; cada item: de onde veio, pergunta, opções, **há quanto tempo espera**; ações aceitar/responder/editar plano/ignorar), gasto por programa (barras CSS). Vidro claro===escuro.
3. **Fixture:** `scripts/seed-programa-exemplo.mjs` (**não** roda em produção automaticamente; `--dry-run`): *"Sistema aquífero de baixo custo para regiões de extremo calor"* com `problema` ("Comunidades em regiões semiáridas de calor extremo perdem água por evaporação e não têm armazenamento acessível…"), `quemUsa` ("agricultores familiares, escolas rurais, defesa civil municipal…"), `porQueAgora` ("ondas de calor recordes em 2025-26 e programas de fomento abertos…"), PI `zaeon`, membros `eng-civil`, `agronomia`, `eng-energias`, cadência diária 09:00 UTC, orçamento 150k/dia, `gateHumano: ["plan"]`, `restricoes: { semGpu: true, semExperimentoFisico: true }`. É o caso de aceitação ponta a ponta.
4. **Testes:** rotas (flag off 404; não-admin 403; criar sem `quemUsa` → 400; `ativo` → `agendar` chamado; `pausar` → repeatable removido; caixa de decisões une ciclos e tarefas; responder grava `esperouMs`; kill-switch remove repeatables); módulo: só lógica pura (`formatEspera`, `podeSalvar`).
**Gate A12:** criar o programa-exemplo no admin → ver o repeatable; rodar um ciclo à mão → card na vitrine → **pedido de decisão** aparece na caixa (gate `plan`) → responder → ciclo retoma → gasto do programa no admin bate com o ledger; kill-switch derruba os repeatables na hora; flag off → módulo/aba inexistentes. **Reporte:** `PASSO 5: verde/vermelho + esperouMs da decisão e gasto do ciclo`.

### PASSO 6 — Verificação final da fatia (não pule)
1. `tsc` limpo · `vitest` verde · CI `build-test` verde nos PRs; **build-args** das 2 flags `NEXT_PUBLIC_*` cabeados nos 3 arquivos.
2. **Flags vazias** → nenhum repeatable, nenhum ciclo, nenhuma aba/módulo novo, label "Projetos" intacto, Sala de Pesquisa idêntica (o dossiê só aparece se existir).
3. **`docs/HANDOFF_FATIA6_RESULTADO.md`**: ordem de ligar (`PROGRAMA_WORKER=1` no worker → `PROGRAMA_PIPELINE=1` → **`PROGRAMA_SCHED=1`** por último → `NEXT_PUBLIC_VITRINE`/`NEXT_PUBLIC_PROGRAMA_ADMIN` com rebuild), rollback (`PROGRAMA_SCHED=0` + redeploy do worker = autonomia parada em segundos; programas e dossiês ficam), e as medidas do handoff §9: **tempo médio que um `awaiting_input` espera** (a métrica da autonomia), % de ciclos encerrados sem paper (saudável), papers aceitos vs rejeitados por novidade, tokens por fase por programa, claims `NOT_SUPPORTED` por dossiê.
**Gate:** os 3 itens, binários.

## 5. Decisões assumidas pelo Fable (valem até o Martinez vetar — leia antes do PASSO 1)

1. **A10 antes do A9:** o `papersolver` precisa do "compila" (= `validarDossie`) e do esqueleto das 10 seções para existir; sem A10 o laço não tem critério de reversão.
2. **PI default `zaeon`** (mesma decisão da Fatia 4 §5.1 — não existe `zion`); `piAgentKey` é campo editável por programa.
3. **Owner não cria programa; o admin cria.** O owner roda-agora, responde decisões, cancela ciclo. Autonomia custa crédito; quem paga decide quem tem programa (II.1.3 + §8.11). Se o Martinez quiser self-service, é um `POST /api/programas` com teto por plano — PR próprio.
4. **"Nada novo" encerra antes do comitê** (não depois): economizar o `plano` quando a literatura não mudou é o ponto do `diffDoAnterior`; o custo de um ciclo vazio vira ~2 chamadas (busca + comparação).
5. **`run_experiment` é contrato futuro:** a fase `viabilidade` consulta o registry em runtime; ausente → analítica declarada. Nenhum subprocess, nenhum sandbox nesta fatia.
6. **`papersolver` escolhe o ponto de partida com seed = `cycleId`** (o original usa `random.choice`): mesmo comportamento, teste determinístico.
7. **Reviewers = 3 chamadas com o prompt do `get_score` em PT-BR**, pontuação pelo `scorePaper` (C11) — não existe um segundo scorer. `Decision` vem do JSON como no original.
8. **Pedidos de "Onde o humano precisa entrar" não bloqueiam a entrega do ciclo** — bloqueiam o **próximo** (entregar o dossiê com a seção é mais útil que segurar o dossiê por causa dela). Gates humanos de fase (`gateHumano`) bloqueiam de verdade, como no original.
9. **`EV_PROGRAMA` no canal `programa-<id>`** (um por programa) + espelho no `canal-<id>` quando houver `canalId`; a vitrine assina só os cards visíveis.
10. **Capa por Imagen é best-effort no nascimento** (nunca no ciclo): custo único, e `imagenAvailable()` false não quebra nada.
11. **`PROGRAMA_SCHED` é a env, não o banco:** o botão do admin derruba os repeatables agora, mas o estado durável é a env — evita "liguei no banco e o deploy desligou". O módulo mostra os dois.

## 6. Economia de execução (pedido do Martinez — leve a sério)

Agrupe edições por arquivo; não abra exploração (a §2 tem TODAS as âncoras, verificadas em `ed274d4`; a §3.A tem o Agent Laboratory destilado); não re-explique contratos — a §3 é o texto final; pare em cada gate e reporte em 1 linha; gate vermelho 2 vezes → **PARE e pergunte ao Martinez**. A9 em dois PRs (A9a puro primeiro). Se o pipeline começar a narrar fases no fio do canal, você violou a §3.7. Se o `papersolver` aceitar um candidato "porque melhorou a prosa" sem o score subir, você saiu do molde. Se aparecer um `child_process` ou `mlesolver`, pare. O valor está em cada gate verde, não em volume de código.
