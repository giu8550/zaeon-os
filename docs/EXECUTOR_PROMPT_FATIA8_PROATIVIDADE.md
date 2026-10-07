# PROMPT DE EXECUÇÃO — Claude Code (Opus) · Escritório Zaeon · **Fatia 8 · Proatividade**

> **Você é o EXECUTOR.** Todo o projeto já foi decidido, pesquisado e contratado em código.
> Você NÃO redesenha, NÃO reabre decisão, NÃO re-deriva tipo, NÃO explora o repo além das
> âncoras dadas. Você integra, verifica e **para em cada gate**. Co-autorado pelo Fable em
> 2026-10-07 a partir de `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` (§3.1 lei 6; §3.3 gatilhos G4/G5;
> §3.7 hierarquia de voz; §3.8 freios; §4 **C7**; §5 camada 6 P1–P5; §7 flags `PROATIVO*`; §8.5,
> 8.8, 8.10; §9 "escritório") + `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` (Eixo D `:106-126` —
> thunlp/ProactiveAgent, leomariga/ProactiveAgent, Smallville, arXiv 2605.30152; PR-S10
> `:1222-1236`; Bloco C `:1237-1309`). As referências externas **já estão destiladas** nos dois
> docs e na §3.A deste prompt — nada a ler fora do repo.
>
> **Esta fatia = 6 PRs, nesta ordem: P2 (gating, nasce C7) → P5 (voz e freios) → P1 (heartbeat) →
> P3 (watcher) → P4 (reflexão) → S10 (card do agente).** A ordem inverte P1↔P2/P5 de propósito:
> **nada acorda antes de existir o porteiro e a voz com freio** — um relógio sem porteiro é spam
> agendado. Nasce **C7** (`lib/canal/gatilho.ts`). Consome C1 (tarefa), C2 (eventos), C3 (thread),
> C4 (chave), C5 (ledger — orçamento real), C6 (key), C8 (chore — o watcher delega leitura web),
> C9 (Zxiv), C10 (programa), C12 (lock), reações (S3), estado (S9), guard (A6), teto por agente
> (A3, `origem:"autonomo"` — **é aqui que o freio dormente da Fatia 1 acorda**). **Não comece sem
> as Fatias 1–7 mergeadas.** **Toda âncora `arquivo:linha` abaixo foi verificada em `origin/main` =
> `96a3bc6` (2026-10-07).**
>
> **O que esta fatia entrega ao Martinez:** mentores que acordam sozinhos, percebem o que mudou e
> propõem trabalho — com **≤3 mensagens proativas por dia no fio principal, por canal**, o resto em
> digest/thread/Zxiv, "ignorar" ensinando o agente a falar menos, kill-switch `PROATIVO=0`, e um
> card do agente que diz o que ele cobre e **o que está indisponível**.

---

## 0. Leia antes de codar (só isto, nesta ordem)

1. `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` — **§3.1 (lei 6: silêncio é o default)**, §3.3 (G4 evento do mundo, G5 heartbeat), **§3.7 (os 6 níveis de voz — vira enum)**, §3.8 (freios, todos), §4 (C7 — você cria; C1/C2/C3/C8/C9/C12 — só consome), §5 **P1–P5**, §7 (`PROATIVO`, `PROATIVO_SILENCIO`), §8.5 (ledger + stall + loop guard sempre), §8.8 (heartbeat local), §8.10, §9 "Escritório" (as 5 medidas).
2. `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` — Eixo D (`:106-126`), PR-S10 (`:1222-1236`), Bloco C (`:1237-1309`, inclui o **gate do bloco**).
3. `docs/EXECUTOR_PROMPT_FATIA4_ENTRE_ELES.md` — §3 (reações `REACOES`/`comandoDe`, `EstadoAgente`, `lib/canal/guard.ts` `registrarFala`) — você consome os três.
4. `docs/EXECUTOR_PROMPT_FATIA6_AUTONOMIA.md` — §3 `lib/queue/programa.ts` (`patternDe`, `agendar`, `reconciliar`) e PASSO 1.2 (`heartbeat.ts` local do programa): o heartbeat do agente segue **o mesmo molde**, não o reinventa.
5. `docs/EXECUTOR_PROMPT_FATIA7_ESTEIRA_LEVE.md` — §3 C8 (`criarChore`, `ChoreCursor`, tipos `feed_novos`/`checar_pagina`): o watcher **delega** leitura web a chores.

## 1. Guardrails invioláveis (violar = PR rejeitado)

- **Flag off por padrão; merge não muda comportamento.** `PROATIVO=""` → nenhum heartbeat, nenhum repeatable, nenhuma fala proativa, nenhum digest; `pontuar()` e `escolherSaida()` existem mas ninguém os chama. **Dupla opt-in:** além da env, o **dono do canal** liga `Canal.proativo` (default `false`) e o admin marca `AgentProfile.proativo` (default `false`). Sem os três, o agente não acorda naquele canal.
- **Silêncio é o default (lei 6).** Abaixo do limiar o heartbeat **não acorda** — e grava `AgentHeartbeat{acordou:false}`. Watcher sem novidade **não fala** e incrementa `checagens`. O caso comum é esse e os testes exigem que seja.
- **Estágio 1 sem LLM (C7).** `lib/canal/gatilho.ts` é **puro**: entrada = eventos já coletados + calibração; saída = `{score, motivos, acorda}`. Nenhum `gerar()` antes do limiar. O estágio 2 (classificação na taxonomia de 4 classes) só roda para o que passou — e **no Vertex** (`rota:"vertex"`), porque lê conteúdo do canal (§8.10). O pool grátis da Fatia 7 **não** entra nesta fatia, salvo via chore do watcher (que só lê web pública).
- **≤3 mensagens proativas/dia no fio principal, por canal** (`PROATIVO_FIO_DIA=3`), token bucket no Redis (fallback `Map`). A 4ª **rebaixa de nível** (vira thread ou digest), nunca estoura. Mesmo agente **não fala duas vezes no mesmo minuto** (`registrarFala` do guard). **Horário de silêncio** por canal (`Canal.silencio ?? PROATIVO_SILENCIO`, default `23:00-07:00`, tz `America/Fortaleza`) → só níveis 1–2. **Orçamento antes de LLM:** `foraPorTeto(agentKey)` com `AGENT_TETO_ENFORCE` e `origem:"autonomo"` — fora = não acorda (o freio da Fatia 1, enfim com quem frear).
- **Ignorar é sinal.** Toda fala proativa carrega `meta.proativo = {classe, score, motivos, nivel}`. `👍` = útil, `👎` = não útil, **sem reação em 24h = ignorado**. A calibração sobe o limiar daquele agente naquele canal pela taxa de ignorado; `👍` desce devagar. **Teste obrigatório:** 100 eventos sintéticos → ≤5 passam o estágio 1; 5 ignorados seguidos → limiar sobe de forma observável.
- **Heartbeat é local (§8.8).** `lib/canal/heartbeat.ts` é constante TS versionada; teste proíbe `fetch`/`import()` dinâmico/`eval`. O agente **calcula o próprio sono** entre `min` e `max` (teto duro) — nunca abaixo de `PROATIVO_HB_MIN`.
- **Uma saída por reflexão (P4).** Cruzou o limiar de importância → **uma** de três: pergunta objetiva na thread · proposta de `AgentTask` com `🚀` · paper curto no Zxiv (pelo `gateDeSubmissao`, C9). Nunca as três. Nunca no fio principal.
- **Rodadas finitas, lock, cancelamento cooperativo.** Heartbeat roda dentro de `emSerie(`hb:${canalId}`)` (C12). Nenhum laço "até achar algo".
- **Não tocar:** `lib/agent/trajectory.ts` · `lib/agent/memory.ts` além de **ler** `importance` · `permit()` · `lib/canal/triagem.ts` · `REACOES` (S3) — o "ignorar" **não** é reação nova, é ausência de reação · os workers das filas existentes (o heartbeat tem a sua).
- **Erros via `messageForError`** — chaves novas: `proativo_silencio`, `proativo_teto_fio`.
- **Verificação:** `npx tsc --noEmit` + `npx vitest run` verdes a cada PR; `prisma generate`/`db push` só com schema; **nunca `next build` no loop**; o mac **não tem `python`**.
- **1 PR por passo**, branch `escritorio/fatia8-<passo>-<slug>`, ≤ ~8 arquivos (P1 e S10 podem partir em a/b), descrição citando o contrato (C7) e a flag.

## 2. Importe, não reescreva (símbolo existente = import)

| O que | Onde (verificado em `96a3bc6`; símbolos de fatias anteriores marcados com a fatia) |
|---|---|
| Envelope/ledger/teto (C5/C6/A3) | **Fatia 1:** `lib/llm/envelope.ts` (`gerar`, `gerarJson`, `LedgerCtx`) · `lib/llm/teto.ts` (`foraPorTeto`) · `lib/canal/agent-turn.ts` `TurnoInput.origem` (`"humano"` \| `"autonomo"`) · `lib/metrics/tokens.ts` (`desde`) |
| Thread/lock/leitura (C3/C12) | **Fatia 2:** `CanalMensagem.parentId` · `lib/canal/serial.ts` (`emSerie`, `OcupadoError`) · `CanalLeitura` (`ultimaLidaEm` — é como se sabe "pergunta sem resposta") |
| Tarefa/triagem (C1) | **Fatia 3:** `lib/canal/tarefas.ts` (`criarTarefa`, `listarDoCanal`) · `AgentTask.status/artifactId` (evento "tarefa concluída") |
| Reações/estado/guard/consulta (S3/S9/A6) | **Fatia 4:** `lib/canal/reacoes.ts` (`REACOES`, `comandoDe`; `CanalMensagem.taskId`) · `lib/canal/estado-store.ts` (`publicarEstado`) · `lib/canal/estado.ts` (`EstadoAgente`) · `lib/canal/guard.ts` (`registrarFala` → `{ok} | {motivo:"loop"|"repetida"}`) · `lib/reuniao/run.ts` (`ProgressLedger`) |
| Zxiv/busca/anexos/contexto (C9/S4/S5/S8) | **Fatia 5:** `lib/zxiv/store.ts` (`submeter`, feed) · `lib/zxiv/gate.ts` (`gateDeSubmissao`, `LIMIAR_SCORE`, `TETO_SUBMISSOES_DIA`) · `lib/busca/semantica.ts` (`criarBusca`) · `CanalAnexo` (`lidoPor`/`createdAt` — "anexo não lido") · `lib/canal/contexto.ts` |
| Programa (C10) e **molde do scheduler** | **Fatia 6:** `lib/queue/programa.ts` (`patternDe`, `agendar`, `reconciliar`, `schedLigado`) · `lib/programa/heartbeat.ts` (o documento local — copie o padrão e o teste anti-`fetch`) · `ResearchProgram.proximoCicloEm`/`ProgramCycle.awaiting_input` (eventos "prazo" e "lacuna") · dossiê: `pedidosHumanos(secoes)` (lacunas declaradas) |
| Chore (C8) | **Fatia 7:** `lib/chore/store.ts` (`criarChore`, `cursorDe`, `jobIdDe`) · `ChoreCursor` · tipos `feed_novos`, `checar_pagina` · `lib/queue/reenfileirar.ts` (`decidir`) |
| Memória L3 (importância) | `prisma` `model MemoryDrawer :750-772` (**`importance :764`**, `wingKind :753` = `"agente"`, `room :755`, `at :761`, `kind :756`) · `lib/agent/memory.ts` (`Drawer :38`, `MemoryAPI :69`, `DrawerCollection :81`; só **ler**) |
| Mentores (card S10) | `lib/agent/mentors.ts` — `MentorSkill :18`, `RUNTIME_SKILLS :37`, `ALL_MENTOR_SKILLS :38`, `mentorBySlug :183`, **`degradedSkills :211`** · `lib/agent/mentors-server.ts` (`resolveMentor`) · `prisma` `model MentorTemplate :801-818` (`guardrail :813`, `enabledSkills`) · `lib/agent/mcp.ts` (`MCP_CATALOG :217`, `ConnectorStatus :38`) |
| Fila/worker (molde) | `lib/canal/queue.ts` (`filaLigada :16`, `jobIdDe :43`, `iniciarWorkerCanal :72`) · `lib/queue/scholar.ts` (`getRedisConnection :33`, `loadBullmq :42`) · `instrumentation-node.ts` (`iniciarWorkerCanalOpcional :13` — padrão "nunca lança") · `lib/queue/reaper.ts` |
| Canal/UI | `lib/canal/wire.ts` (`EV_MENSAGEM :5`, `MensagemWire :16`) · `lib/canal/realtime.ts` (`publicarPusher`) · `lib/canal/notificacoes.ts` (`prioridadeDe :29`, `deveNotificar :41`) · `components/office/useNotificacoesSO.ts` (`notificar :44`, `silent: prioridade !== "alta" :48`) · `components/office/CoworkingCanal.tsx` (`Agente :22`, avatares online `:304`, lista de membros `:331`, menu ⚙ `:312`; `recursos` do `GET /api/canal/[id]` — padrão da Fatia 2) · `components/agents/AgentAvatar.tsx` · `lib/canal/vidro.ts` |
| Admin | `lib/admin/assertAdmin.ts` · `lib/canal/flags.ts` (`agentsAdmin`) · `app/api/admin/agents/[agentKey]` (PATCH — ganha `proativo`) · `app/workstation/admin/modules/AgentsModule.tsx` (card `:114`) |
| Erros | `lib/agent/errors.ts` (catálogo `:26-40`, `messageForError :61`) |
| Env | `.env.example` (`CANAL_QUEUE/CANAL_WORKER :184-185` — formato) |

## 3. O contrato que esta fatia CRIA (texto final — copie, não reinterprete)

### C7 · Score de gatilho (`lib/canal/gatilho.ts`, PURO)

```ts
export type Evento =
  | { tipo: "pergunta_sem_resposta"; minutos: number; mencionado: boolean }          // msg humana com "?" sem resposta de agente nem humano
  | { tipo: "tarefa_concluida"; desdobramento: boolean }                              // AgentTask done cuja entrega lista "próximos passos"/lacunas
  | { tipo: "lacuna_dossie"; n: number }                                              // pedidosHumanos(secoes).length do último dossiê do programa
  | { tipo: "paper_novo_zxiv"; dominioBate: boolean }                                 // feed do Zxiv desde o cursor; dominioBate = tags ∩ mentor.course
  | { tipo: "anexo_nao_lido"; horas: number }                                         // CanalAnexo sem lidoPor do agente
  | { tipo: "contradicao_fontes" }                                                    // 2 msgs com chave zxc- e vereditos opostos sobre o mesmo claim (detector puro, conservador)
  | { tipo: "prazo_programa"; horas: number }                                         // proximoCicloEm − agora
  | { tipo: "fonte_nova"; n: number }                                                 // watcher (P3): literatura/feeds novos desde o cursor
  | { tipo: "digest_pendente"; itens: number };                                       // itens acumulados para o digest do dia

export const PESOS: Record<Evento["tipo"], number>;   // pergunta_sem_resposta 3 (×2 se mencionado, +1 por 30min, teto 8) · tarefa_concluida 2 (+3 se desdobramento) · lacuna_dossie 2+n (teto 6) · paper_novo_zxiv 1 (+3 se dominioBate) · anexo_nao_lido 1 (+1 por 24h, teto 4) · contradicao_fontes 5 · prazo_programa 4 se <24h, 2 se <72h, senão 0 · fonte_nova min(n,5) · digest_pendente 0 (nunca acorda sozinho; vai no digest)
export type Calibracao = { limiarBase: number; util: number; naoUtil: number; ignorado: number; falasHoje: number; ultimaFalaEm: Date | null };
export type Contexto = { agora: Date; calib: Calibracao; silencio: boolean; foraPorTeto: boolean; tetoFioDia: number };
export type Pontuacao = { score: number; limiar: number; motivos: string[]; acorda: boolean; bloqueio?: "silencio" | "teto" | "fio_cheio" | "limiar" };

export function limiarDe(c: Calibracao): number;            // limiarBase × (1 + 0.5·taxaIgnorado) × (1 + 0.25·taxaNaoUtil) × (1 − 0.1·min(taxaUtil, 0.5)); taxas sobre as últimas 20 falas; teto 3×base
export function pontuar(eventos: Evento[], ctx: Contexto): Pontuacao; // soma PESOS; acorda = score ≥ limiar ∧ !silencio ∧ !foraPorTeto; silêncio/teto rebaixam (bloqueio), não zeram o score (o digest ainda recebe)
export function dedupEventos(eventos: Evento[]): Evento[];  // mesmo tipo+alvo conta uma vez por heartbeat
```
```prisma
model AgentCalibracao {                 // 1 linha por (agentKey, canalId) — a "memória de quanto incomodo"
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  agentKey      String
  canalId       String   @db.ObjectId
  limiarBase    Int      @default(6)    // PROATIVO_LIMIAR_BASE
  util          Int      @default(0)
  naoUtil       Int      @default(0)
  ignorado      Int      @default(0)
  ultimaFalaEm  DateTime?
  historico     Json     @default("[]") // últimas 20: {at, nivel, classe, feedback: "util"|"nao_util"|"ignorado"|null}
  updatedAt     DateTime @updatedAt
  @@unique([agentKey, canalId])
  @@map("agent_calibracoes")
}
model AgentHeartbeat {                  // "registra que checou" (lei 6) — append-only, TTL 30d por índice
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  agentKey  String
  canalId   String   @db.ObjectId
  at        DateTime @default(now())
  score     Int
  limiar    Int
  motivos   Json                        // string[]
  acordou   Boolean
  bloqueio  String?
  classe    String?                     // estágio 2: correct-detection | false-alarm | missed-needed | non-response
  nivel     Int?                        // NivelVoz escolhido (1..6)
  proximoEmMs Int                       // o sono calculado
  ms        Int      @default(0)
  @@index([agentKey, canalId, at])
  @@index([at])
  @@map("agent_heartbeats")
}
```

### Aditivos (opt-in dupla + voz)

```prisma
// Canal (aditivo)         proativo Boolean @default(false) · silencio String? ("23:00-07:00") · digestHora Int? (hora local, default 8)
// AgentProfile (aditivo)  proativo Boolean @default(false) · hbMinMs Int? · hbMaxMs Int? (null = PROATIVO_HB_MIN/MAX)
// CanalMensagem (aditivo) meta Json? — se S5 não criou: { proativo?: {classe, score, motivos, nivel, heartbeatId}, digest?: true }
// CanalAgenteConfig       { id, canalId, agentKey, silenciado Boolean, soMencionado Boolean, removidoEm DateTime?, @@unique([canalId, agentKey]) }   // S10
model Assinatura {                      // P3 — o que o mentor vigia
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  agentKey    String
  canalId     String?  @db.ObjectId
  programId   String?  @db.ObjectId
  topico      String                     // "cafeína enfermagem" — vira query do literature_search e filtro do Zxiv
  fontes      Json                       // ["literatura","zxiv","anexos","web:<url>"] — web delega a chore feed_novos/checar_pagina
  cursor      Json     @default("{}")    // por fonte: {literatura: {ultimoDoi[]}, zxiv: {ultimoSlug}, anexos: {ultimoId}, web: {jobId}}
  checagens   Int      @default(0)
  mudancas    Int      @default(0)
  ultimaChecagemEm DateTime?
  ativo       Boolean  @default(true)
  @@index([agentKey, ativo])
  @@map("assinaturas")
}
model DigestItem {                      // P5 — o que vai no "bom dia"
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  canalId   String   @db.ObjectId
  agentKey  String
  tipo      String                       // fonte_nova | paper_novo | anexo | tarefa | lacuna | checagem
  texto     String                       // ≤ 240 chars, sem imagem, com chave quando factual
  href      String?
  at        DateTime @default(now())
  entregueEm DateTime?
  @@index([canalId, entregueEm, at])
  @@map("digest_itens")
}
```
```ts
// lib/canal/voz.ts (PURO) — §3.7 vira enum e regra
export type NivelVoz = 1 | 2 | 3 | 4 | 5 | 6;  // 1 artefato/card · 2 Zxiv · 3 thread · 4 digest · 5 fio principal · 6 notificação do sistema
export type Classe = "correct-detection" | "false-alarm" | "missed-needed" | "non-response"; // thunlp
export type Saida = { nivel: NivelVoz; motivo: string; rebaixadoDe?: NivelVoz };
export function nivelPedido(classe: Classe, eventos: Evento[]): NivelVoz;   // false-alarm|non-response → 1 · missed-needed → 4 (digest) · correct-detection: pergunta_sem_resposta mencionado → 5; contradicao|lacuna → 3; paper|fonte → 2/4; prazo <24h → 5; demais → 3
export function aplicarFreios(pedido: NivelVoz, f: { silencio: boolean; fioHoje: number; tetoFio: number; falouNoMinuto: boolean; notificavel: boolean }): Saida; // silêncio → min(pedido, 2) · fio cheio → 5→4 · falou no minuto → 5/3→4 · 6 só se notificavel (prioridade "alta" de notificacoes.ts) e pedido ≥ 5
export function horarioSilencio(agora: Date, janela: string | null, tz: string): boolean;   // "23:00-07:00" cruza meia-noite
export function templateProativo(nivel: NivelVoz, classe: Classe, corpo: string, chaves: string[]): string; // §3.5: 1ª pessoa, 1–2 linhas, sem lista, chaves no fim; nunca "próximos passos"
```
```ts
// lib/canal/freios.ts (Redis com fallback Map)
export async function tomarFichaFio(canalId: string, dia: string, teto: number): Promise<boolean>;   // INCR + EXPIRE 48h; false = cheio (não decrementa)
export async function fichasFio(canalId: string, dia: string): Promise<number>;
// lib/canal/calibracao.ts
export async function registrarFala(db, agentKey, canalId, { nivel, classe, heartbeatId, mensagemId }): Promise<void>;
export async function registrarFeedback(db, mensagemId, feedback: "util" | "nao_util"): Promise<void>;   // chamado pela rota de reação (S3) quando msg.meta.proativo existe
export async function marcarIgnorados(db, agora: Date): Promise<number>;       // falas proativas há >24h sem 👍/👎 → ignorado (idempotente por mensagemId)
export async function calibracaoDe(db, agentKey, canalId): Promise<Calibracao>;
```
```ts
// lib/queue/heartbeat.ts (P1)
export const HEARTBEAT_QUEUE = "agente-heartbeat";
export function proativoLigado(): boolean;                      // PROATIVO === "1" && REDIS_URL
export function calcularSono(p: { score: number; limiar: number; acordou: boolean; minMs: number; maxMs: number; seed: string }): number; // leomariga: acordou → min; senão min + (max−min)·(1 − min(score/limiar, 1))^2; jitter ±10% determinístico por seed; clamp [min, max]
export function slotDe(agentKey: string, canalId: string, at: Date): string;     // `${agentKey}:${canalId}:${Math.floor(at/minMs)}` — jobId idempotente
export async function agendarProximo(par: { agentKey; canalId }, emMs: number): Promise<void>;   // add("hb", par, { delay: emMs, jobId: slotDe(...) })
export async function reconciliar(db): Promise<{ adicionados: number; removidos: number }>;      // na subida: pares ativos (Canal.proativo ∧ AgentProfile.proativo ∧ agente ∈ canal.agentes ∧ !silenciado) ↔ jobs delayed/waiting; par sem job → agendar em jitter(0..min)
export async function iniciarWorkerHeartbeat(): Promise<boolean>;                                // PROATIVO_WORKER === "1"; concurrency 2
```
```ts
// lib/canal/heartbeat.ts — o DOCUMENTO LOCAL (constante versionada; teste proíbe fetch/import()/eval)
export const HEARTBEAT_VERSAO = 1;
export const HEARTBEAT: { oQueFazer: string; oQueNaoFazer: string; formato: string }; // texto base do estágio 2 e da reflexão
// lib/canal/eventos.ts — coletores (DB → Evento[]; sem LLM)
export async function coletarEventos(db, { agentKey, canalId, desde, mentor }): Promise<Evento[]>;
```

### §3.A · O que portamos de cada fonte (destilado — não leia os repos)

- **arXiv 2605.30152 + thunlp/ProactiveAgent:** decidir *quando* acordar **não precisa de LLM**; o LLM entra depois para classificar em 4 classes e escolher a saída. Aceitar/Rejeitar/**Ignorar** recalibra: ignorar reduz frequência. → `pontuar` puro (estágio 1), `classificar` (estágio 2), `registrarFeedback`/`marcarIgnorados`, `limiarDe`.
- **leomariga/ProactiveAgent:** avaliar → gerar → **calcular o próprio sono** entre `min`/`max`. → `calcularSono` + job `delayed` encadeado (não repeatable fixo), com `reconciliar` na subida.
- **Smallville (generative_agents):** reflection disparada por **acúmulo de importância**; o agente para, sintetiza, e o insight vira memória. → P4: `Σ MemoryDrawer.importance` desde a última reflexão ≥ `PROATIVO_REFLEXAO_LIMIAR` → 1 síntese → **uma** saída; insight gravado como `MemoryDrawer{kind:"nota", wingKind:"agente", meta.reflexao}`.
- **watch-skill (THE LOOP):** observar → **diff contra a última passada** → só agir se mudou; registrar que checou. → P3: cursor por fonte em `Assinatura.cursor`, `checagens++` sempre, `mudancas++` quando houve diff; nada mudou = `DigestItem{tipo:"checagem"}` **não** — só o contador (o digest não lista "nada novo").
- **Moltbook heartbeat:** só o conceito de relógio. O conteúdo é **local** (`lib/canal/heartbeat.ts`); nunca executar markdown remoto.
- **OASIS/TinyTroupe:** orçamento contado **antes** do enqueue. → `foraPorTeto` + ledger real no `pontuar` (`foraPorTeto` é entrada do contexto, não efeito).

## 4. OS PASSOS (ordem executável; pare e reporte 1 linha em cada gate)

### PASSO 1 — PR-P2 · Gating em dois estágios (nasce C7)
Branch `escritorio/fatia8-p2-gatilho`. Sem flag (puro + schema; ninguém chama ainda).
1. **Schema** `AgentCalibracao`, `AgentHeartbeat` (§3) → `generate` + `db push`. **`lib/canal/gatilho.ts`** (§3, puro, `PESOS` exportado e comentado linha a linha). **`lib/canal/calibracao.ts`** (§3). **`lib/canal/eventos.ts`:** `coletarEventos` — `pergunta_sem_resposta` (última msg humana com `?` ou menção ao agente, sem resposta posterior de agente **nem** de humano; `minutos` desde ela), `tarefa_concluida` (AgentTask `done` do canal nas últimas 24h cuja entrega tem seção "Onde o humano precisa entrar"/"lacunas" não vazia), `lacuna_dossie` (programa do canal: `pedidosHumanos` do último dossiê), `paper_novo_zxiv` (feed desde `Assinatura.cursor.zxiv` ou 24h; `dominioBate` por `tags ∩ mentor.course`), `anexo_nao_lido`, `contradicao_fontes` (duas msgs com a mesma chave `zxc-` e `meta.veredito` opostos — conservador: só `VERIFIED` vs `FAILED`), `prazo_programa`. Tudo consulta Prisma; **zero LLM**.
2. **Estágio 2 `lib/canal/gatilho-llm.ts`:** `classificar(eventos, contextoCanal, deps) → {classe, nivelSugerido, rascunho}` — **uma** chamada `gerarJson` (`rota:"vertex"`, `GEMINI_MODEL_FLASH`, `ctx:{agentKey, surface:"canal", scopeId: canalId, phase:"gatilho"}`), system = `HEARTBEAT` local + taxonomia das 4 classes com definição de cada uma + "em dúvida, `false-alarm`"; schema fechado (`classe` enum, `nivelSugerido` 1..5, `rascunho` ≤ 280 chars). `jsonValido` no ledger.
3. **Feedback:** rota de reação (S3, `[msgId]/reagir`) — quando `msg.meta?.proativo` existe, `👍` → `registrarFeedback("util")`, `👎` → `registrarFeedback("nao_util")` **além** do comportamento atual (aditivo, 2 linhas). `marcarIgnorados` roda no heartbeat (PASSO 3).
4. **Testes:** `gatilho.test.ts` — **fixture de 100 eventos sintéticos** (distribuição realista: 60 `anexo_nao_lido`/`paper` sem domínio, 25 `pergunta` <10min, 10 `tarefa` sem desdobramento, 5 fortes) → **≤5 acordam** com `limiarBase 6`; `limiarDe` com 5 ignorados/20 → limiar ≥ 1.125×base; 10/20 → 1.25×; `util` reduz no máximo 5%; `silencio` → `acorda:false, bloqueio:"silencio"` com score preservado; `foraPorTeto` idem `"teto"`; `dedupEventos`. `eventos.test.ts` (fake prisma: pergunta respondida por humano **não** conta; contradição só VERIFIED×FAILED). `gatilho-llm.test.ts` (`gerar` mockado: JSON inválido → `false-alarm`, nunca lança; `rota` é `vertex`). `calibracao.test.ts` (`marcarIgnorados` idempotente; histórico fecha em 20).
**Gate P2:** 100 sintéticos → ≤5 passam (número no reporte); taxa de ignorado sobe o limiar de forma observável (tabela 0/5/10/15 ignorados → limiar); `tsc`+`vitest` verdes; nenhuma chamada de LLM em `gatilho.ts` (grep). **Reporte:** `PASSO 1: verde/vermelho + quantos passaram + tabela do limiar`.

### PASSO 2 — PR-P5 · A voz do proativo (freios antes do relógio)
Branch `escritorio/fatia8-p5-voz`. Flag **`PROATIVO`** (gate de tudo que fala) + `PROATIVO_FIO_DIA=3` + `PROATIVO_SILENCIO=23:00-07:00` + `PROATIVO_TZ=America/Fortaleza`.
1. **`lib/canal/voz.ts`** + **`lib/canal/freios.ts`** (§3). **`lib/canal/falar.ts`:** `falarProativo(db, { agentKey, canalId, classe, eventos, corpo, chaves, heartbeatId, parentId? })` → (a) `pedido = nivelPedido`; (b) `saida = aplicarFreios(pedido, {silencio: horarioSilencio(...), fioHoje: fichasFio, tetoFio, falouNoMinuto: !registrarFala(...).ok, notificavel: prioridadeDe(...) === "alta"})`; (c) executa **só** o nível final: 1 = atualiza `meta` do card/artefato (nada publicado) · 2 = `submeter` no Zxiv (pelo gate C9; recusado → vira 4) · 3 = `CanalMensagem` com `parentId` (thread do assunto; sem thread → cria raiz **na thread da última msg relacionada**, nunca no fio) · 4 = `DigestItem` · 5 = `tomarFichaFio` → `CanalMensagem` raiz com `meta.proativo` → falso = rebaixa para 4 · 6 = 5 + `prioridade:"alta"` na wire (o cliente já notifica). **Texto sempre por `templateProativo` + `limparSaidaAgente`** (Fatia 7). Grava `registrarFala` (calibração) e `AgentHeartbeat.nivel`.
2. **Digest `lib/canal/digest.ts`:** `montarDigest(itens) → string` (puro: agrupa por tipo, ≤12 itens, "+n" no fim, chaves preservadas, ≤ 1200 chars) · `entregarDigest(db, canalId, agora)`: itens com `entregueEm null` → **1** mensagem raiz do agente **anfitrião do canal** (`zaeon`, ou o 1º agente proativo do canal) com `meta.digest:true`, **não consome ficha do fio** (é o "bom dia", contado à parte: 1/dia), marca `entregueEm`. Disparo: no heartbeat (PASSO 3) quando `hora local ≥ Canal.digestHora` e ainda não entregou hoje. Sem itens → **nada** (nem "nada novo").
3. **Kill-switch:** `PROATIVO !== "1"` → `falarProativo` devolve `{ok:false, motivo:"desligado"}` sem tocar o banco; `reconciliar` (PASSO 3) remove todos os jobs. **Teto por agente:** `foraPorTeto` entra no `Contexto` do `pontuar` (PASSO 3); aqui `falarProativo` **recusa** `nivel ≥ 3` se `AGENT_TETO_ENFORCE==="1"` e fora — defesa em profundidade.
4. **Erros:** `proativo_silencio` ("Horário de silêncio neste canal — deixei no resumo da manhã."), `proativo_teto_fio` ("Já falei o que dava hoje no fio — o resto vai no resumo.") — ambos **só em log/`motivo`**, nunca postados (postar "não vou falar" é falar).
5. **Testes:** `voz.test.ts` (tabela classe×eventos → nível; `aplicarFreios` — silêncio rebaixa 5→2; fio cheio 5→4; falou no minuto 3→4; 6 só com notificável); `horarioSilencio` (cruza meia-noite; tz; janela null → false); `templateProativo` (1ª pessoa, sem "próximos passos", chaves no fim, ≤2 linhas); `freios.test.ts` (FakeRedis: 3 fichas ok, 4ª false, expira); `falar.test.ts` (fake prisma: nível 5 ×3 → 3 msgs raiz; 4ª vira `DigestItem`; `PROATIVO=""` → zero writes; Zxiv recusado → digest); `digest.test.ts` (sem itens → nenhuma msg; 15 itens → 12 + "+3"; 2ª chamada no dia → nada).
**Gate P5:** com `PROATIVO=1` e um script `scripts/proativo-simular.mjs --canal <id> --falas 6 --nivel 5` → **exatamente 3** mensagens raiz, 3 `DigestItem`, digest entregue 1× ao chamar `--digest`; em horário de silêncio → 0 raiz; `PROATIVO=""` → 0 writes; `tsc`+`vitest` verdes. **Reporte:** `PASSO 2: verde/vermelho + contagem (raiz / digest / zxiv / thread)`.

### PASSO 3 — PR-P1 · Heartbeat por agente (o relógio)
Branch `escritorio/fatia8-p1-heartbeat`. Flags `PROATIVO` (+ `PROATIVO_WORKER=1` no worker, `PROATIVO_HB_MIN=900000` 15min, `PROATIVO_HB_MAX=21600000` 6h, `PROATIVO_LIMIAR_BASE=6`). **Dividir:** P1a = fila + sono + reconciliação + heartbeat local; P1b = processador + opt-in (Canal/AgentProfile) + rotas.
1. **Schema** aditivo (`Canal.proativo/silencio/digestHora`, `AgentProfile.proativo/hbMinMs/hbMaxMs`) → `generate` + `db push`. **`lib/canal/heartbeat.ts`** (documento local; teste anti-`fetch`/`import()`/`eval`/`child_process`). **`lib/queue/heartbeat.ts`** (§3): job `delayed` encadeado por par com `jobId = slotDe(...)` (o mesmo slot nunca duplica), `reconciliar` na subida (molde `lib/queue/programa.ts`), `removeOnComplete: 200`, `attempts: 1`.
2. **Processador** `lib/canal/heartbeat-run.ts` `runHeartbeat(par, deps)`, dentro de `emSerie(`hb:${canalId}`)`: (1) `PROATIVO`/`Canal.proativo`/`AgentProfile.proativo`/`CanalAgenteConfig.silenciado` → qualquer um off = **não roda e não reagenda** (reconciliar limpa); (2) `marcarIgnorados`; (3) `eventos = dedupEventos(await coletarEventos(...))`; (4) `calib = calibracaoDe`; (5) `ctx = {agora, calib, silencio: horarioSilencio(...), foraPorTeto: (await foraPorTeto(agentKey)).fora && AGENT_TETO_ENFORCE==="1", tetoFioDia}`; (6) `p = pontuar(eventos, ctx)`; (7) grava `AgentHeartbeat{acordou: p.acorda, …}` **sempre**; (8) se `p.acorda`: `classificar` (estágio 2) → `falarProativo` com o `rascunho` como `corpo` (**só** `correct-detection`/`missed-needed` falam; `false-alarm`/`non-response` → nível 1 = só o registro); (9) **digest** se hora ≥ `digestHora` e não entregue; (10) `sono = calcularSono({...p, minMs, maxMs, seed: slot})` → `agendarProximo`. Stall: `AbortSignal.timeout(60_000)`; estourou → grava `AgentHeartbeat{bloqueio:"stall"}` e reagenda em `max`. **Estado (S9):** heartbeat **não** publica `pensando` (é silencioso); só `fora(teto)` quando `foraPorTeto`.
3. **Rotas:** `PATCH /api/canal/[id]` ganha `proativo`, `silencio`, `digestHora` (dono; `recursos.proativo = proativoLigado()`); `PATCH /api/admin/agents/[agentKey]` ganha `proativo`, `hbMinMs`, `hbMaxMs` (clamp ≥ `PROATIVO_HB_MIN`); ambos chamam `reconciliar()` best-effort. `GET /api/admin/agents/heartbeats?agentKey&canalId&range` (últimos N: `at, score, limiar, acordou, classe, nivel, proximoEmMs`) — é o "está vivo?" do admin.
4. **UI mínima** (`CoworkingCanal.tsx`, menu ⚙ `:312`): toggle "mentores proativos neste canal" + hora do digest + janela de silêncio, só com `recursos.proativo`. `AgentsModule.tsx`: toggle `proativo` por agente + min/max. Vidro claro===escuro.
5. **`instrumentation-node.ts`:** `iniciarWorkerHeartbeatOpcional()` (molde `:13`) + `reconciliar()` na subida (best-effort, log).
6. **Testes:** `heartbeat.test.ts` (`calcularSono`: acordou → min; score 0 → max; score = limiar/2 → ~min+(max−min)/4; jitter determinístico; clamp); `slotDe` idempotente no mesmo slot; `reconciliar` (fake queue: par ativo sem job → adiciona em ≤min; par desligado com job → remove; `PROATIVO=""` → remove todos); `heartbeat-run.test.ts` (fake prisma + `gerar` mockado: abaixo do limiar → `AgentHeartbeat{acordou:false}` e **zero** `gerar`; acima → 1 `gerar` + 1 `falarProativo`; `false-alarm` → nível 1; stall → reagenda em max; canal `proativo:false` → não reagenda); `heartbeat.ts` anti-fetch; rotas (dono só; admin só; clamp).
**Gate P1:** 3 agentes proativos num canal → `GET heartbeats` mostra os 3 acordando em **horários distintos** (slots com jitter) e sonos diferentes; **`FLUSHALL` no Redis + restart do worker → `reconciliar` reagenda os 3** em ≤ `min`; `PROATIVO=""` + restart → zero jobs; 24h de log com a maioria `acordou:false`. **Reporte:** `PASSO 3: verde/vermelho + 3 linhas de heartbeat (agentKey, at, score, acordou, proximoEmMs)`.

### PASSO 4 — PR-P3 · Watcher de tópico
Branch `escritorio/fatia8-p3-watcher`. Flag `PROATIVO` (roda dentro do heartbeat).
1. **Schema** `Assinatura` (§3) → `generate` + `db push`. **`lib/canal/watcher.ts`:** `checar(db, assinatura, deps) → { eventos: Evento[]; itens: DigestItem[]; cursorNovo }` — por fonte: `literatura` → `retrievePapers(topico)` (o `literature_search` real, `lib/scholar/retrieve.ts`; **sem LLM**) → novos = `doi ∉ cursor.ultimoDoi[]` → `Evento{fonte_nova, n}` + `DigestItem{tipo:"fonte_nova", texto: "<título> (<ano>) · <fonte>", href}` com chave `zxc-` (C4 `chaveDe`); `zxiv` → feed desde `cursor.ultimoSlug` filtrado por `tags ∩ topico` → `paper_novo_zxiv`; `anexos` → `CanalAnexo` novos → `anexo_nao_lido`; `web:<url>` → **delega**: `criarChore({tipo: url parece feed ? "feed_novos" : "checar_pagina", alvo:{url}, destino:{canalId, parentId:null, modo:"digest"}, origemConteudo:"web", requesterId:null})` (C8) — o resultado da chore **já cai no digest** pelo `modo:"digest"` (Fatia 7), o watcher só registra o `jobId` no cursor. **Diff vazio em todas as fontes → `checagens++`, `eventos=[]`, nenhum item.**
2. **Integração no heartbeat:** passo (3) do `runHeartbeat` concatena `watcher.checar` de cada `Assinatura{agentKey, canalId|programId do canal, ativo}` **antes** do `pontuar`; `mudancas++` quando `eventos.length>0`; cursor salvo **mesmo** quando não acorda (senão o próximo heartbeat reconta).
3. **Assinar:** `POST /api/canal/[id]/assinaturas` (dono/membro: `{agentKey, topico, fontes}`; teto `PROATIVO_ASSINATURAS_CANAL=5`), `DELETE /[id]/assinaturas/[aId]`, `GET /[id]/assinaturas`. Programa (C10) assina automaticamente seu tópico com `fontes:["literatura","zxiv"]` ao ser criado **se** `Canal.proativo` (1 linha em `criarPrograma`, aditivo). Reação `🔖` numa msg de agente proativo com `meta.proativo.topico` → cria assinatura (aditivo em S3, 2 linhas) — é o "me avisa quando mudar".
4. **UI:** no card do agente (S10, PASSO 6) — aqui só a rota.
5. **Testes:** `watcher.test.ts` (fake `retrievePapers`: 2ª passada igual → `eventos=[]`, `checagens` 2, `mudancas` 1; DOI novo → `fonte_nova{n:1}` + 1 item com chave; `web:` → `criarChore` com `modo:"digest"` e `requesterId:null`, cursor guarda `jobId`; cursor salvo sem acordar); rotas (teto 5; IDOR).
**Gate P3 (= handoff):** assinatura "cafeína enfermagem" com `literatura`+`zxiv`; **7 heartbeats sem novidade (fixture fixa) → zero mensagens e `checagens = 7`**; injetar 1 DOI novo → 1 `DigestItem` e, no digest da manhã, 1 linha com chave; `web:` cria chore e **nada** no fio. **Reporte:** `PASSO 4: verde/vermelho + (checagens, mudancas, msgs)`.

### PASSO 5 — PR-P4 · Reflexão (percebe lacuna e vira trabalho)
Branch `escritorio/fatia8-p4-reflexao`. Flag `PROATIVO` + `PROATIVO_REFLEXAO_LIMIAR=150`.
1. **`lib/canal/reflexao.ts`:** `importanciaAcumulada(db, {agentKey, canalId, desde}) → {soma, drawers}` (**só lê** `MemoryDrawer` com `wingKind:"agente"`, `wingLabel: agentKey`, `room: canalId`, `at > desde`, `invalidatedAt null`; `importance ?? 1`); `desde` = `AgentCalibracao.historico` último `{reflexaoEm}` ou 7d. `refletir(db, {agentKey, canalId, drawers}, deps) → { tipo: "pergunta" | "tarefa" | "paper"; texto; justificativa; chaves: string[] }` — **uma** `gerarJson` (`rota:"vertex"`, system = `HEARTBEAT.reflexao` local + "sintetize 1 insight; escolha UMA saída; se não houver lacuna real, `tipo:"nenhuma"`"; schema fechado; `tipo:"nenhuma"` é saída válida e comum). Grava o insight como `MemoryDrawer{kind:"nota", wingKind:"agente", text: justificativa, importance: 5, meta:{reflexao:true, tipo}}` via `MemoryAPI` existente (**não** reimplementar embedding) e zera o acumulador (`historico.reflexaoEm = agora`).
2. **Uma saída:** `pergunta` → `falarProativo` nível **3** (thread da última msg relacionada; corpo = `texto` ≤ 280) · `tarefa` → mensagem nível 3 "Proponho: <texto> — 🚀 pra eu começar" com `meta.proativo.proposta = {objetivo, kind}`; o `🚀` (S3) já cria a tarefa com `requesterId = quem reagiu` (aditivo: `promover` lê `meta.proativo.proposta.objetivo` quando existir) · `paper` → `submeter` (C9) pelo gate; recusado → vira `pergunta` nível 4 (digest). **Nunca duas.**
3. **Integração no heartbeat:** passo (8b) — **só se acordou** (`p.acorda`) e `importanciaAcumulada.soma ≥ limiar`: reflexão **substitui** a fala do estágio 2 (um heartbeat fala uma vez). Ordem fixa: reflexão > estágio 2.
4. **Testes:** `reflexao.test.ts` (fake prisma: soma 149 → não reflete, zero `gerar`; 150 → 1 `gerar`; `tipo:"nenhuma"` → grava nota, zero falas; **sequência sintética de 6 eventos importantes → 1 proposta, não 3** (gate do handoff); `tarefa` → 1 msg nível 3 com `meta.proativo.proposta`, `criarTarefa` **não** chamado; `paper` recusado → digest; acumulador zera); `promover` com proposta usa o objetivo da proposta.
**Gate P4:** fixture de 6 drawers importantes no canal → heartbeat acorda, **1** proposta na thread, `🚀` do humano cria a tarefa com o objetivo da proposta (barra aparece); repetir o heartbeat → não reflete de novo (acumulador zerado); `tsc`+`vitest`. **Reporte:** `PASSO 5: verde/vermelho + (soma, tipo, nº de saídas)`.

### PASSO 6 — PR-S10 · Card do agente dentro do canal
Branch `escritorio/fatia8-s10-card-agente`. Sem flag nova: UI opt-in via `recursos.cardAgente = true` (nasce `true`, dentro de `NEXT_PUBLIC_ESCRITORIO_COWORK`). **Dividir:** S10a = rota + config; S10b = componente.
1. **Schema** `CanalAgenteConfig` (§3) → `generate` + `db push`. **`GET /api/canal/[id]/agente/[agentKey]`** (membro): `{ perfil: {nome, avatarUrl, bio, curso, tipo}, cobre: string[] (mentor: `signatureArtifacts`+`course`; persona: `bio`), skills: ALL_MENTOR_SKILLS.map(s => ({s, estado: "ativa" | "degradada" | "indisponivel"})) — degradada = `degradedSkills(mentor)`; **indisponível = checagem real**: `literature` → `webSearchConfigurada() || providers acadêmicos` ok?, `memory` → L3 ligada (M0), `studio`/`molecule` → `RUNTIME_SKILLS`, `code` → conector; conectores: `MCP_CATALOG` ∩ habilitados com `ConnectorStatus`; dataAccessLevel (A5; saúde = `verified_only`); guardrail: `MentorTemplate.guardrail`; ultimasEntregas: 5 últimas `AgentTask.done` do canal com `artifact.href` + papers do Zxiv do autor; proativo: `{ligado, ultimoHeartbeatEm, acordouHoje, falasHoje, ignoradoPct}` (de `AgentHeartbeat`/`AgentCalibracao`); assinaturas (P3); tokens: **só admin** (`assertAdmin` sem lançar → campo presente) = `tokens?range=7d` filtrado; config: `CanalAgenteConfig` }`. **`PATCH …/agente/[agentKey]`** (dono do canal): `{silenciado?, soMencionado?, remover?: true}` → `CanalAgenteConfig` upsert; `remover` tira de `canal.agentes` **e** chama `reconciliar()`; `silenciado`/`soMencionado` são lidos por `runHeartbeat` (passo 1) **e** por `mensagem/route.ts` (`soMencionado` = ignora G4; já é o default do turno — documente).
2. **`components/office/AgentCard.tsx`:** abre ao clicar no avatar do agente (`:304` online e `:331` membros — `onClick` só para `tipo === "agente"`); painel de vidro (`lib/canal/vidro.ts`), seções: cabeçalho · "O que eu cubro" · **"Habilidades"** com 3 estados (✓ ativa · ◐ "em breve" para degradada — aviso suave, não erro · ✕ **"indisponível agora: busca de literatura"** para indisponível, **mesma frase** que o mentor usa na resposta via `messageForError("skill_offline")`) · conectores · "Como eu trato dados" (`data_access_level` + guardrail de saúde quando houver: "educacional, nunca diagnóstico") · últimas entregas (links) · "Proativo neste canal" (status, último heartbeat, falas hoje/3, ignorado %) + assinaturas (lista + "+ assinar tópico") · consumo (só admin) · controles do dono: **silenciar neste canal · só responde se mencionado · remover do canal**. Mobile: sheet de baixo; desktop: painel lateral. Claro===escuro.
3. **Lei 5 fechada:** `executarTurno` já declara skill offline em 1 linha (Fatia 3); o card mostra **a mesma chave** — teste puro `estadoDaSkill(skill, ctx)` compartilhado entre rota e turno (`lib/canal/skills-estado.ts`), para o card e a resposta nunca divergirem.
4. **Testes:** `skills-estado.test.ts` (literature sem provedores → indisponível; degradada; runtime); rota (membro 200; não-membro 403; `tokens` ausente para não-admin; `remover` chama `reconciliar`; `silenciado` → heartbeat não roda — teste em `heartbeat-run.test.ts`); componente só lógica pura (`rotuloSkill`).
**Gate S10 (= prospecção):** com `literature_search` desligada (`SEARXNG_URL` vazio + provedores acadêmicos mockados fora), o card mostra **"busca de literatura: indisponível"** e a resposta do mentor traz **o mesmo aviso**; silenciar o agente → próximo heartbeat não roda e `reconciliar` remove o job; remover → sai de `canal.agentes`; claro e escuro. **Reporte:** `PASSO 6: verde/vermelho + screenshot textual do card`.

### PASSO 7 — Verificação final da fatia (não pule) — **o gate do bloco C**
1. `tsc` limpo · `vitest` verde · CI `build-test` verde em todos os PRs.
2. **Flags vazias** → nenhum job em `agente-heartbeat`, nenhuma fala proativa, nenhum digest, card do agente aparece (é leitura) mas a seção "Proativo" diz "desligado".
3. **Gate do bloco (handoff §5 P5 / prospecção):** `PROATIVO=1`, **3 mentores proativos + 1 programa ativo**, canal real por **24h** → **≤3 mensagens proativas no fio principal**, **todas marcadas úteis** pelo humano (ou pelo menos nenhuma `👎`), **nenhuma repetida** (`registrarFala` + `templateProativo` dedup), **digest cobrindo o resto** (1 por manhã), **custo dentro do orçamento** (`tokens?groupBy=agente` com `phase:"gatilho"|"reflexao"` ≤ o teto configurado), maioria dos heartbeats `acordou:false`.
4. **`docs/HANDOFF_FATIA8_RESULTADO.md`:** ordem de ligar (`PROATIVO_WORKER=1` → `AgentProfile.proativo` em 1 agente → `Canal.proativo` em 1 canal de teste → **`PROATIVO=1`** por último; 48h; então ampliar), rollback (`PROATIVO=""` + restart do worker = zero jobs em segundos; calibração e heartbeats ficam para análise), e as medidas do handoff §9 "Escritório": **mensagens proativas/dia no fio (meta ≤3)** · **taxa de `ignorar` por agente** · tempo que um `awaiting_input` espera · tokens do estágio 2 e da reflexão por agente · falas sobrepostas (zero).
**Gate:** os 4 itens, binários — o 3 é o que decide se a camada escala.

## 5. Decisões assumidas pelo Fable (valem até o Martinez vetar — leia antes do PASSO 1)

1. **P2 e P5 antes de P1.** O handoff numera P1→P5; o grafo não impõe ordem interna. Relógio antes do porteiro e da voz com freio = spam agendado durante o desenvolvimento. Nada muda no conteúdo dos PRs.
2. **Dupla opt-in** (`Canal.proativo` pelo dono **e** `AgentProfile.proativo` pelo admin) além da env. O handoff pede UI opt-in; aqui o opt-in é por canal porque proatividade é incômodo local, não global.
3. **"Ignorar" = ausência de 👍/👎 por 24h** sobre uma fala proativa — não é reação nova (o `REACOES` da S3 fica como está). É o sinal mais barato e o que o thunlp mede.
4. **Heartbeat = job `delayed` encadeado, não repeatable fixo**, porque o intervalo é adaptativo (leomariga). `reconciliar` na subida cobre o Redis limpo (mesma peça do A8).
5. **Estágio 2 e reflexão no Vertex**, nunca no pool grátis: lêem conteúdo do canal (dado de aluno, §8.10). O pool só entra via chore do watcher (web pública).
6. **Pesos iniciais do `PESOS`** são chute informado e **editáveis em um lugar**; o que importa é o teste "≤5 em 100" e a calibração por ignorado. Recalibrar pesos é PR de 1 arquivo.
7. **Digest não consome ficha do fio** (é 1/dia, previsível, e é o canal que absorve o resto). Sem itens, não existe.
8. **`false-alarm`/`non-response` nunca falam** — viram só registro (nível 1). `missed-needed` vai ao digest por default.
9. **Reflexão substitui a fala do estágio 2 no mesmo heartbeat** — um heartbeat, uma fala, no máximo.
10. **Programa assina seu tópico automaticamente** só quando o canal já é proativo — senão a assinatura dormiria sem relógio e pareceria bug.
11. **Card do agente sem flag nova** (`recursos.cardAgente`): é leitura, dentro do escritório já flaggado; os controles do dono já estão atrás do membership. O estado das skills no card e na resposta vem da **mesma função** — é o ponto da prospecção S10.
12. **`soMencionado` é o default histórico do turno** (G1 só); a opção existe para o dono **desligar** o G4 de um agente específico sem silenciá-lo. Documentado no card.
13. **Teto por agente (A3) age aqui com `origem:"autonomo"`** — primeira vez que alguém dispara `"autonomo"`. Com `AGENT_TETO_ENFORCE` off continua só avisando, como o Martinez decidiu.

## 6. Economia de execução (pedido do Martinez — leve a sério)

Agrupe edições por arquivo; não abra exploração (a §2 tem TODAS as âncoras, verificadas em `96a3bc6`; a §3.A tem as fontes destiladas); não re-explique contratos — a §3 é o texto final; pare em cada gate e reporte em 1 linha; gate vermelho 2 vezes → **PARE e pergunte ao Martinez**. P1 e S10 em dois PRs cada. Se `gatilho.ts` importar `gerar`, pare. Se um heartbeat puder falar duas vezes, pare. Se aparecer `fetch` em `lib/canal/heartbeat.ts`, pare. Se o teste "≤5 em 100" precisar de limiar 20 para passar, os pesos estão errados — não o teste. O valor está no gate do bloco (≤3 falas/dia, todas úteis), não em volume de código.
