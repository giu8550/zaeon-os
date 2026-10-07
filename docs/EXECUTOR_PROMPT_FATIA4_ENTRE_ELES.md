# PROMPT DE EXECUÇÃO — Claude Code (Opus) · Escritório Zaeon · **Fatia 4 · Conversa entre eles**

> **Você é o EXECUTOR.** Todo o projeto já foi decidido, pesquisado e contratado em código.
> Você NÃO redesenha, NÃO reabre decisão, NÃO re-deriva tipo, NÃO explora o repo além das
> âncoras dadas. Você integra, verifica e **para em cada gate**. Co-autorado pelo Fable em
> 2026-10-07 a partir de `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` (§3 leis 2, 3, 5; §3.2 estados;
> §3.3 gatilhos G2/G3; §3.8 freios; §4 C2/C3/C12; §5 camada 3; §8) +
> `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` (PR-A6 `:608-650`, PR-S3 `:1105-1124`, PR-S6 `:1156-1173`,
> PR-S9 `:1206-1221`) + leitura do **`zou-group/virtual-lab`** (MIT): `src/virtual_lab/run_meeting.py`
> (270 linhas) e `src/virtual_lab/prompts.py` (331 linhas), lidos na íntegra em 2026-10-07.
>
> **Esta fatia = 4 PRs, nesta ordem: S9 (status) → S3 (reações) → S6 (DM) → A6 (comitê).**
> A ordem difere da listagem do handoff (A6·S3·S6·S9) porque A6 **consome** os três: o estado
> que o comitê publica (S9), a aprovação por `👍` (S3) e a consulta fechada (S6). Nasce a parte
> `EV_AGENTE_ESTADO` de **C2**; consome **C1** (A4), **C3** (S1), **C12** (S7), **C4** (A5) e
> **C5** (A1, opcional). **Não comece sem as Fatias 2 e 3 mergeadas.**
> **Toda âncora `arquivo:linha` abaixo foi verificada em `origin/main` = `11d0732` (2026-10-07).**

---

## 0. Leia antes de codar (só isto, nesta ordem)

1. `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` — §3.1 (leis **2** "debate vive em thread", **3** "pergunta a colega é fechada", **4** "opinião de outro agente não é evidência", **5**), §3.2 (os 6 estados — S9 os publica), §3.3 (G2 reação, G3 convocação por agente), §3.5 (template "abertura de comitê"), §3.8 (rodadas 3 · trocas 6 · mesma fala no minuto), §4 (C2 — você completa; C1/C3/C4/C12 — você consome), §5 "CAMADA 3", §8.
2. `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` — PR-A6, PR-S3, PR-S6, PR-S9 (linhas acima).
3. `docs/EXECUTOR_PROMPT_FATIA2_SALA.md` §3 (C3, C12) e `docs/EXECUTOR_PROMPT_FATIA3_TRABALHO.md` §3 (C1 `AgentTask` + store `lib/canal/tarefas.ts`, C4 `Contexto.origem`).
4. **O molde do comitê está transcrito na §3.A deste prompt** (fluxo de controle + prompts do virtual-lab). Não precisa abrir o repo deles; se abrir, é só `run_meeting.py` e `prompts.py`.

## 1. Guardrails invioláveis (violar = PR rejeitado)

- **Flags off por padrão:** `CANAL_REACOES` (S3), `CANAL_DM` (S6), `CANAL_REUNIAO` (A6). S9 **não tem flag** (handoff §7 não define): publicar estado é aditivo; a UI mostra a bolinha só quando `recursos.estados === true`, que nasce `true` neste PR — com o campo ausente (clientes antigos) nada muda. Com tudo vazio: sem reação, sem DM, sem comitê, mensagens não editáveis, comportamento **byte a byte** o de hoje.
- **A UI descobre capacidade por `recursos`** do `GET /api/canal/[id]` (padrão fixado na Fatia 2): `estados`, `reacoes`, `dm`, `reuniao`. Zero `NEXT_PUBLIC_*` novo.
- **Lei 2 — o comitê vive em thread.** O fio recebe **exatamente duas** mensagens: abertura (template §3.5) e conclusão com link. Toda fala de membro/PI é resposta na thread (C3). Teste conta.
- **Lei 3 — consulta é fechada.** DM agente↔agente = **uma pergunta, uma resposta, fecha** (`Canal.fechadoEm`). O canal de origem recebe **uma** linha "consultei @B: …" (≤ 280 caracteres). A conversa do DM **nunca** entra no contexto de outro canal — por construção: o contexto do turno só lê mensagens do próprio `canalId`.
- **Lei 4 — opinião de agente não é evidência.** A resposta consultada entra no turno como `Finding{confidence:"baixa"}` com `source.title:"@B (consulta)"` e `origem:"agente"`; `contextosDe` (C4) **exclui** `origem:"agente"` da lista de chaves. Nunca ganha chave `zxc-`.
- **Lei 5 — `bloqueado`/`fora` são visíveis**, com motivo legível (`messageForError`). Loop guard travando = `bloqueado("muitas trocas entre agentes — mencione alguém pra continuar")`.
- **Ordem de fala fixa, rodadas finitas, "pass" permitido, PI sintetiza, rodada final só com o PI** — é o `run_meeting` e **não se otimiza** (zero seleção dinâmica de falante; é o que mata loop e custo). **Progress Ledger** a cada rodada (1 chamada Flash, JSON validado); estagnação encerra cedo. **Loop guard** (`lib/canal/guard.ts`): 6 trocas agente↔agente seguidas por canal/thread → pausa; menção humana reseta; mesmo agente 2× no mesmo minuto → segunda fala descartada e logada.
- **Consentimento no primeiro contato de um par de agentes** vem do dono humano (reação `👍` ou `POST …/dm/consentir`), uma vez por par; depois liberado. **Teto diário** de DMs por par (`CANAL_DM_TETO_DIA`, default 5).
- **Reação em mensagem de agente é comando** (G2) — só em `autorTipo:"agente"`, só por quem `podeEscrever`, idempotente pela unique. Reação em mensagem humana é só sinal (contador).
- **Mensagem de agente nunca some:** `DELETE` é soft (`excluidoEm`), o texto fica no banco, o fio mostra "removida". Humano edita a própria em **15 min**; `podeGerir` (`gate.ts:29`) exclui/fixa qualquer uma.
- **Não tocar:** `lib/agent/trajectory.ts`; o protocolo do cliente do chat; `lib/scholar/*`; `EstadoPod` **não vira vocabulário paralelo** — ele passa a ser derivado do novo `EstadoAgente` (PASSO 1.1).
- **Erros via `messageForError`** (`lib/agent/errors.ts`, `MESSAGES :25`): adicione `edicao_expirada`, `reacao_invalida`, `dm_consentimento`, `dm_teto`, `dm_fechado`, `loop_guard`, `reuniao_estagnada`, `reuniao_teto`.
- **Licença:** virtual-lab é MIT — porte com atribuição em `docs/FONTES_BASE.md` (seção "Reunião de comitê — virtual-lab (MIT) — ADOTAR: `run_meeting` + prompts, portados para PT-BR").
- **Verificação:** `npx tsc --noEmit` limpo + `npx vitest run` verde por PR (CI `build-test`). `generate` só com schema novo; `db push`. **Nunca `next build` no loop.**
- **1 PR por passo** (A6 pode ser dois), branch `escritorio/fatia4-<passo>-<slug>`, ≤ ~8 arquivos, descrição citando contrato e flag.

## 2. Importe, não reescreva (símbolo existente = import)

| O que | Onde (verificado) |
|---|---|
| Vocabulário de estado hoje | `lib/office/mapa.ts` — `EstadoPod = "ocioso" \| "trabalhando" \| "falando"` (`:32`) |
| Canal (model + criação) | `prisma` `model Canal :1061-1070` (`ownerId :1063`, `titulo :1064`, `acesso :1065`, `membros :1066`, `agentes :1067`) · `app/api/canal/route.ts` (`POST` com `primeiro :33`, `create :38-39`, `normalizarAcesso`) |
| Gate | `lib/canal/gate.ts` — `podeLer :16`, `podeEscrever :26`, `podeGerir :29`, `Acesso :6` |
| Mensagem (rota + wire) | `app/api/canal/[id]/mensagem/route.ts` (`POST :17`, `create :34`, `publicarPusher :44`, `dispararTurnos :46`) · `lib/canal/wire.ts` (`EV_MENSAGEM`, `EV_DIGITANDO`, `MensagemWire`; após S1: `parentId`; após A4: `EV_TAREFA`) · `lib/canal/realtime.ts` `publicarPusher` |
| Turno | `lib/canal/agent-turn.ts` — `TurnoInput :21-28` (`canalId`, `agentKey`, `userId`, `mensagemId`; após S1 `parentId`), `GerarArgs :47`, `executarTurno :145`, `blocoCanal` (onde as fixadas entram), mensagem efêmera |
| Tarefa (C1, Fatia 3) | `lib/canal/tarefas.ts` (`criarTarefa`, `marcarFase`, `pedirHumano`, `responderHumano`, `concluir`, `falhar`) · `lib/canal/tarefa-run.ts` (`runTarefa`) · `lib/queue/tarefas.ts` |
| Thread (C3, Fatia 2) | `CanalMensagem.parentId` · `GET /api/canal/[id]/thread/[msgId]` · `components/office/ThreadPanel.tsx` · `components/office/Composer.tsx` |
| Lock (C12, Fatia 2) | `lib/canal/serial.ts` `emSerie`, `OcupadoError` |
| Citação (C4, Fatia 3) | `lib/agent/citacao.ts` `Contexto.origem`, `contextosDe` |
| Memória L3 (gravar `🔖` e o resumo do comitê) | `lib/agent/memory-provider.ts` — `getMemory() :44`, `isMemoryConfigured :41` · `lib/agent/memory.ts` — `Drawer :38-50` (`userId`, `wing`, `room`, `kind`, `text` **verbatim**, `sourceRef`, `meta`), `DrawerKind :30` (`"nota"`), `WingKind :29` (`"agente"`) · `prisma` `model MemoryDrawer :750` |
| Roster | `lib/agents/roster.ts` — `AgentView :40`, `publicView :156`, `rosterBase` · `lib/ai/personas.ts` (`PERSONAS`, `buildPersona`; **não existe `zion`** — ver §5.1) · `lib/agent/mentors-server.ts` `resolveMentor` |
| Cliente do canal | `components/office/CoworkingCanal.tsx` — `online :36,304` (presença humana), chips de agentes `:377-390` (`presentes`/`outros :269-270`, `digitando`), `function Bolha :426`, `aoChegar :145`, binds `:116-118` |
| Envelope/ledger (C5, opcional) | `lib/llm/envelope.ts` `gerar({ctx:{surface:"canal", phase:"reuniao", taskId}})` — só se a Fatia 1 existir |
| Padrão de rota testada | `app/api/canal/[id]/mensagem/route.test.ts` (IDOR A/B/C com `vi.mock("@/lib/canal/server")`) |

## 3. Os contratos que esta fatia CRIA ou COMPLETA (texto final — copie, não reinterprete)

### C2 (parte S9) · `EV_AGENTE_ESTADO`

```ts
// lib/canal/estado.ts (PURO) + lib/canal/wire.ts (aditivo)
export type EstadoAgente =
  | { estado: "ocioso" }
  | { estado: "pensando"; parentId?: string | null }
  | { estado: "trabalhando"; taskId: string; fase: string; progress: number; rotulo?: string }
  | { estado: "aguardando_humano"; taskId?: string; pergunta: string }
  | { estado: "bloqueado"; motivo: string }       // texto já passado por messageForError
  | { estado: "fora"; motivo: "teto" | "degradado" | "desativado"; detalhe?: string };
export const EV_AGENTE_ESTADO = "agente-estado";
export type EstadoWire = { canalId: string; agentKey: string } & EstadoAgente & { at: string };
export function paraEstadoPod(e: EstadoAgente): import("@/lib/office/mapa").EstadoPod; // ocioso→ocioso · pensando→falando · trabalhando→trabalhando · demais→ocioso
export function rotuloDoEstado(e: EstadoAgente): string;  // "trabalhando · reunindo fontes · 45%", "fora · limite diário", …
```
```prisma
model AgentEstado {            // persistido: sobrevive a reload; 1 linha por (canal, agente)
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  canalId   String   @db.ObjectId
  agentKey  String
  estado    String
  detalhe   Json?
  updatedAt DateTime @updatedAt
  @@unique([canalId, agentKey])
  @@map("agent_estados")
}
```
`lib/canal/estado-store.ts`: `publicarEstado(db, canalId, agentKey, e)` = upsert + `publicarPusher(canalId, EV_AGENTE_ESTADO, wire)`; `estadosDoCanal(db, canalId)`. **`EV_DIGITANDO` continua existindo** (compat) e passa a ser emitido **junto** com `pensando`/`ocioso`.

### S3 · Mensagens de primeira classe + reações

```prisma
// model CanalMensagem (aditivo)
  editadoEm  DateTime?
  excluidoEm DateTime?          // soft delete; texto permanece
  fixadoEm   DateTime?
  fixadoPor  String?   @db.ObjectId
  taskId     String?   @db.ObjectId   // mensagem que uma tarefa postou (abertura/pergunta/entrega) — alvo de 👍/👎
model CanalReacao {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  msgId     String   @db.ObjectId
  canalId   String   @db.ObjectId
  userId    String   @db.ObjectId
  emoji     String                       // só o set abaixo
  createdAt DateTime @default(now())
  @@unique([msgId, userId, emoji])
  @@index([msgId])
  @@map("canal_reacoes")
}
```
```ts
// lib/canal/reacoes.ts (PURO)
export const REACOES = ["👍", "👎", "🔖", "🚀", "❓"] as const;
export type Reacao = (typeof REACOES)[number];
export type Comando = "aprovar" | "refazer" | "guardar" | "promover" | "explicar";
export const COMANDO: Record<Reacao, Comando> = { "👍": "aprovar", "👎": "refazer", "🔖": "guardar", "🚀": "promover", "❓": "explicar" };
export function comandoDe(emoji: string, msg: { autorTipo: string }): Comando | null;  // null se não é do set ou a msg não é de agente
// MensagemWire ganha: editadoEm?, excluidoEm?, fixadoEm?, taskId?, reacoes: { emoji: string; n: number; minha: boolean }[]
```

### S6 · DM + consulta fechada

```prisma
// model Canal (aditivo)
  tipo       String   @default("canal")   // "canal" | "dm"
  par        String[] @default([])        // 2 participantes: "<userId>" ou "agent:<agentKey>", ordenados
  parChave   String?  @unique             // par.join("|") — a unique que o Mongo respeita
  fechadoEm  DateTime?                    // DM agente↔agente fecha após 1 pergunta + 1 resposta
model ConsentimentoPar {                  // dono humano autorizou o par de agentes a conversar (1× por par)
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  ownerId     String   @db.ObjectId
  parChave    String
  canalOrigem String?  @db.ObjectId
  createdAt   DateTime @default(now())
  @@unique([ownerId, parChave])
  @@map("consentimentos_par")
}
```
```ts
// lib/canal/dm.ts
export function parChave(a: string, b: string): string;                 // ordena e junta com "|"
export function ehDmDeAgentes(canal: { tipo: string; par: string[] }): boolean;
export async function acharOuCriarDm(db, ownerId: string, par: [string, string]): Promise<CanalRow>; // acesso forçado "privado"; membros = humanos do par
// lib/canal/consulta.ts — a consulta fechada (lei 3)
export type ConsultaInput = { de: string; para: string; pergunta: string; canalOrigemId: string; ownerId: string; taskId?: string | null };
export type ConsultaResult =
  | { ok: true; resposta: string; dmId: string; citacao: string }       // citacao = `consultei @${para}: ${resumo ≤ 280}`
  | { ok: false; motivo: "consentimento" | "teto" | "ocupado" | "erro"; pendente?: { parChave: string } };
export async function consultar(input: ConsultaInput, deps): Promise<ConsultaResult>;
```
Tool registrada com `CANAL_DM=1`: `consultar_mentor { agentKey, pergunta }` (`runtime:"ts"`, `risk:"read"`, `minPlan:"free"`) — disponível **só** em turno/tarefa de canal (o `hctx.canalId` existe); devolve `Finding{claim: citacao, source:{title:"@B (consulta)"}, confidence:"baixa"}` com `provenance.origem:"agente"`.

### A6 · Reunião de comitê

```ts
// lib/reuniao/run.ts — porte de run_meeting (virtual-lab, MIT)
export type ReuniaoParams = {
  tipo: "comite" | "critico";
  pauta: string; perguntas: string[]; regras: string[];
  piAgentKey: string;             // "comite": quem convoca e sintetiza
  membros: string[];              // "comite": ordem de fala FIXA; "critico": [agente] (o crítico é implícito)
  rodadas: number;                // default 3, teto 5
  summariesAnteriores: string[]; contextos: string[];
  temperatura?: number;           // default 0.2 (CONSISTENT_TEMPERATURE)
};
export type Fala = { quem: string; texto: string; rodada: number; papel: "pi" | "membro" | "critico" | "sistema" };
export type ProgressLedger = { completou: boolean; progresso: boolean; emLoop: boolean; proximo?: string; instrucao?: string };
export type ReuniaoDeps = {
  falar(agentKey: string, historico: Fala[], prompt: string): Promise<string>;   // persona do agente + histórico linear compartilhado + prompt do turno
  ledger?(historico: Fala[], rodada: number): Promise<ProgressLedger>;         // Flash, JSON validado; ausente = sem estagnação
  emit(ev: { tipo: "fala" | "ledger" | "fim"; fala?: Fala; ledger?: ProgressLedger; motivo?: string }): void;
  cancelado?(): boolean;
};
export type ReuniaoResult = { falas: Fala[]; resumo: string; secoes: Record<"Agenda" | "Team Member Input" | "Recommendation" | "Answers" | "Next Steps", string>; rodadasExecutadas: number; encerradaPor: "fim" | "estagnacao" | "cancelada" | "teto" };
export function runReuniao(p: ReuniaoParams, d: ReuniaoDeps): Promise<ReuniaoResult>;
export const CRITICO: { agentKey: "critico"; nome: "Crítico Científico"; systemPrompt: string }; // porte do SCIENTIFIC_CRITIC
export function extrairSecoes(resumo: string): ReuniaoResult["secoes"];   // PURO: parse dos "### …"; seção ausente = ""
```

### §3.A · O molde (transcrição fiel do virtual-lab — isto é o que `runReuniao` implementa)

**Fluxo (`run_meeting.py`):**
1. `tipo:"comite"`: `time = [PI, ...membros]`; valida PI ∉ membros, membros únicos, ≥1 membro. `tipo:"critico"`: `time = [agente, CRITICO]`.
2. Histórico = **uma lista linear compartilhada** `messages`. Cada chamada ao modelo = `[system do agente] + messages` (todos leem tudo).
3. `comite`: `messages` começa com a **mensagem de abertura** (abaixo). Loop `for rodada in 0..rodadas` (**rodadas+1 iterações**): para cada agente do `time`, na ordem: PI na rodada 0 → prompt inicial; PI na última (`rodada == rodadas`) → prompt final; PI no meio → síntese intermediária; membro → prompt de membro (com "pass"). Cada resposta é appendada em `messages` como `assistant`. **Na última iteração, só o primeiro do `time` (o PI) fala e o loop quebra.**
4. `critico`: sem abertura separada; rodada 0 → o agente recebe o prompt de início com pauta/perguntas/regras/contextos/summaries; nas seguintes, alternam **crítico** (prompt de crítica) e **agente** (prompt de revisão); na última iteração só o agente fala.
5. Temperatura constante (0.2). Tokens contados por fala (aqui: `LedgerCtx.phase:"reuniao"` quando houver C5). Resumo = **a última mensagem** (`get_summary`).

**Prompts (`prompts.py`, portados para PT-BR mantendo os cabeçalhos `###` em inglês por serem parseados):**
- **Abertura (`team_meeting_start_prompt`):** "Este é o início de uma reunião de equipe para discutir o projeto. Reunião com o líder, {PI}, e os membros: {lista na ordem}.\n\n[Contexto: `[begin context N] … [end context N]`]\n[Resumos das reuniões anteriores: `[begin summary N] … [end summary N]`]\nPauta:\n\n{pauta}\n\n[Perguntas da pauta que precisam ser respondidas: lista numerada]\n[Regras da pauta que precisam ser seguidas: lista numerada]\n{PI} abre a reunião. Depois, cada membro dá sua opinião, um por um, na ordem acima. Quando todos tiverem falado, {PI} vai **sintetizar os pontos de cada membro, tomar decisões sobre a pauta com base nas contribuições e fazer perguntas de acompanhamento**. Isso se repete por {rodadas} rodadas. Ao final, {PI} vai **resumir a reunião em detalhe para discussões futuras, dar uma recomendação específica sobre a pauta e responder às perguntas da pauta (se houver), seguindo estritamente as regras (se houver)**."
- **PI inicial:** "{PI}, dê suas ideias iniciais sobre a pauta e as perguntas que vão guiar a discussão entre os membros."
- **Membro (rodada r de R):** "{membro}, dê sua opinião sobre a discussão (rodada {r} de {R}). **Se não tiver nada novo ou relevante a acrescentar, pode dizer \"pass\".** Lembre que você **pode e deve (educadamente) discordar** dos outros membros se tiver uma perspectiva diferente."
- **PI intermediário:** "Isso encerra a rodada {r} de {R}. {PI}, por favor sintetize os pontos de cada membro, tome decisões sobre a pauta com base nas contribuições e faça perguntas de acompanhamento."
- **PI final:** "{PI}, por favor resuma a reunião em detalhe para discussões futuras, dê uma recomendação específica sobre a pauta e responda às perguntas da pauta (se houver), seguindo estritamente as regras (se houver).\n\n[Lembrete da pauta / perguntas / regras]\n\nSeu resumo deve ter esta forma:\n\n`### Agenda` — reformule a pauta com suas palavras.\n`### Team Member Input` — resuma todos os pontos importantes de cada membro (preserva detalhes para reuniões futuras).\n`### Recommendation` — sua recomendação de especialista: considere cada membro, mas use sua expertise para **decidir e escolher uma opção** entre as discutidas; pode contrariar membros se bem justificado; clara, específica, acionável, justificada.\n[`### Answers` — para cada pergunta: `Answer:` resposta específica baseada na recomendação · `Justification:` breve justificativa] (só se houver perguntas)\n`### Next Steps` — próximos passos da equipe."
- **Crítico (`individual_meeting_critic_prompt`):** "{Crítico}, critique a resposta mais recente de {agente}. Na crítica, sugira melhorias que atendam diretamente à pauta e às perguntas. Priorize soluções simples sobre as desnecessariamente complexas, mas exija mais detalhe onde faltar. Valide se a resposta segue estritamente a pauta e as perguntas, e corrija se não seguir. **Só dê feedback; não implemente a resposta você mesmo.**"
- **Agente após crítica:** "{agente}, modifique sua resposta para atender ao feedback mais recente de {Crítico}. Seu objetivo final é melhorar o atendimento à pauta."
- **`SCIENTIFIC_CRITIC` (porte):** título "Crítico Científico"; expertise "dar feedback crítico a pesquisa científica"; objetivo "garantir que projetos e implementações propostos sejam rigorosos, detalhados, viáveis e cientificamente sólidos"; papel "dar feedback crítico para identificar e corrigir todos os erros e exigir respostas científicas maximamente completas e detalhadas, porém simples e não excessivamente complexas". Persona só para o `falar` da reunião (não entra no roster público).

**Aditivos da Zaeon sobre o molde** (handoff A6, não estão no virtual-lab): Progress Ledger por rodada (MagenticLite) · loop guard · thread (lei 2) · `AgentTask kind:"reuniao"` · resumo → `MemoryDrawer` · teto de tokens/rodadas.

## 4. OS PASSOS (ordem executável; pare e reporte 1 linha em cada gate)

### PASSO 1 — PR-S9 · Status do agente (completa C2)
Branch `escritorio/fatia4-s9-estado`. Sem flag (ver §1).
1. **`lib/canal/estado.ts`** (§3, puro) + `lib/office/mapa.ts`: `EstadoPod` passa a ser **`ReturnType<typeof paraEstadoPod>`** (mesmos 3 valores) — vocabulário único, o 3D legado continua compilando. **Schema** `AgentEstado` → `generate` + `db push`. **`lib/canal/estado-store.ts`** (`publicarEstado`, `estadosDoCanal`). `wire.ts`: `EV_AGENTE_ESTADO` + `EstadoWire`.
2. **Quem publica:** `executarTurno` (`agent-turn.ts:145`) → `pensando` ao começar (junto do `EV_DIGITANDO`), `ocioso` no `finally`; `runTarefa` (Fatia 3) → `trabalhando{taskId, fase, progress}` a cada `marcarFase`, `aguardando_humano{pergunta}` em `pedirHumano`, `ocioso` em `concluir`/`falhar`; teto (`lib/llm/teto.ts`, Fatia 1, se existir) → `fora{motivo:"teto"}` quando `foraPorTeto` barra um turno autônomo; `OcupadoError` do lock → **não** muda estado (é fila, não bloqueio); `AgentProfile.ativo=false` → `fora{motivo:"desativado"}` ao ser consultado. Erro de LLM classificado `auth|billing` (Fatia 1) → `fora{motivo:"degradado"}`.
3. **Rota:** `GET /api/canal/[id]` ganha `estados: EstadoWire[]` e `recursos.estados = true`.
4. **UI** (`CoworkingCanal.tsx`): nos chips `:377-390`, **bolinha** por agente (cinza ocioso · azul pulsando pensando · âmbar trabalhando · roxo aguardando · vermelho bloqueado · cinza riscado fora) + `title`/rótulo `rotuloDoEstado`; para `trabalhando`, o rótulo aparece ao lado do nome ("reunindo fontes · 45%"); `bloqueado`/`fora` mostram o **motivo** ao tocar. `bind(EV_AGENTE_ESTADO)` ao lado de `:118`; estado inicial de `estados` do GET (**reload mantém**). Vidro claro===escuro.
5. **Testes:** `estado.test.ts` (`paraEstadoPod` cobre os 6; `rotuloDoEstado` com e sem progresso); `estado-store.test.ts` (upsert + publish; 2 canais não se misturam); `agent-turn.test.ts` (sequência `pensando → ocioso`, inclusive no erro); `tarefa-run.test.ts` (fases viram `trabalhando` com progress crescente; `pedirHumano` → `aguardando_humano`).
**Gate S9:** mentor em tarefa longa mostra "trabalhando · reunindo fontes · 45%" ao vivo; forçar `foraPorTeto` (ou `ativo=false`) mostra "fora · limite diário" com motivo legível; **reload mantém** o estado (vem do GET); cliente antigo sem `recursos.estados` não muda. **Reporte:** `PASSO 1: verde/vermelho + sequência de EV_AGENTE_ESTADO de uma tarefa`.

### PASSO 2 — PR-S3 · Mensagens de primeira classe + reações como comando (G2)
Branch `escritorio/fatia4-s3-reacoes`. Flag `CANAL_REACOES` (gate de tudo deste PR; `recursos.reacoes`).
1. **Schema** (§3): campos em `CanalMensagem` + `CanalReacao` → `generate` + `db push`. `paraWire` (`lib/canal/server.ts`) preenche `editadoEm/excluidoEm/fixadoEm/taskId/reacoes` (agrega por emoji; `minha` pelo `userId` da sessão); mensagem com `excluidoEm` sai com `texto: ""` e `excluidoEm` (o cliente mostra "removida"). **Fatia 3:** `tarefa-run` passa a gravar `taskId` nas 2-4 mensagens que posta.
2. **Rotas** `app/api/canal/[id]/mensagem/[msgId]/route.ts`: `PATCH { texto }` — autor humano, `createdAt` há ≤ 15 min (senão 403 `edicao_expirada`), republica `EV_MENSAGEM` com a wire atualizada (mesmo `id` → cliente substitui); `DELETE` — autor (15 min) **ou** `podeGerir`; soft; republica; `POST …/[msgId]/fixar` / `DELETE …/fixar` — `podeGerir`. **`POST/DELETE …/[msgId]/reacao { emoji }`** — `podeEscrever`, emoji ∈ `REACOES`, unique; republica a wire; se `comandoDe(emoji, msg)` ≠ null (msg de agente) → executa o comando **best-effort** (nunca falha a reação):
   - `promover` (🚀): `criarTarefa` (C1) com `objetivo = msg.texto` (se a msg tiver `taskId` e a tarefa estiver `awaiting_input`, equivale a `aprovar`), `requesterId = eu`, `kind` pela triagem forçada a tarefa, `parentId = msg.parentId ?? msg.id` (nasce em thread) → enfileira.
   - `aprovar` (👍): se `msg.taskId` e tarefa `awaiting_input` → `responderHumano(taskId, {aprovado: true, por: eu})`; senão só contador. **É o `co-pilot mode` de um clique** (Agent Laboratory) e é o consentimento da S6.
   - `refazer` (👎): `dispararTurnos([{… agentKey: msg.autorId, mensagemId: msg.id, parentId: msg.parentId ?? msg.id, instrucao: "refaça"}])` — `TurnoInput.instrucao?: "refaça" | "explique"` (aditivo) → `montarObjetivo` prefixa "REFAÇA a resposta anterior, corrigindo o que estiver fraco: …" / "EXPLIQUE melhor, mais simples e com exemplo: …"; a resposta vai na thread da mensagem.
   - `explicar` (❓): idem com `"explique"`.
   - `guardar` (🔖): `getMemory().write([{ userId: eu, wing: {kind:"agente", label: msg.autorId + "/" + eu}, room: canal.titulo, kind: "nota", text: msg.texto /*verbatim*/, sourceRef: msg.id, meta: {canalId, reacao: "🔖"} }])` — best-effort; `isMemoryConfigured()` false → só contador + `console.warn`.
3. **Fixadas no prompt:** `blocoCanal` (`agent-turn.ts`) ganha, no topo, `=== FIXADAS (briefing do canal) ===` com até 10 mensagens `fixadoEm != null` (ordem de fixação).
4. **UI:** na `Bolha :426`, barra de reações (os 5 emojis, ≥44px no toque, contadores, `minha` destacada) só em `recursos.reacoes`; menu "⋯" com editar (15 min, no próprio balão) / remover / fixar (quando `souDono`); fixadas ganham um pino e a lista do canal mostra uma faixa "fixadas (n)" expansível no topo; "removida" em itálico mudo no lugar do texto. Reação em mensagem de agente mostra um toast de 1 linha do que aconteceu ("tarefa criada", "guardado na memória", "pedi pra refazer").
5. **Erros:** `edicao_expirada` ("Já passou da janela de 15 minutos pra editar."), `reacao_invalida`.
6. **Testes:** `reacoes.test.ts` (`comandoDe` só para agente e só o set); `[msgId]/route.test.ts` (IDOR A/B/C nas 5 operações; edição 14 min ok / 16 min 403; `DELETE` soft preserva `texto` no banco; `🚀` cria tarefa com `requesterId` certo e `parentId` da thread; `👍` em msg com `taskId` em `awaiting_input` chama `responderHumano`; `🔖` chama `getMemory().write` com texto verbatim; `👎` dispara turno com `instrucao:"refaça"`; reação repetida é no-op pela unique); `agent-turn.test.ts` (fixadas no topo do `blocoCanal`; `instrucao` muda o objetivo).
**Gate S3:** `🚀` numa proposta de agente cria a tarefa (barra aparece na thread); `🔖` grava `MemoryDrawer` com o texto exato; editar após 15 min é recusado com a mensagem do catálogo; mensagem de agente excluída aparece "removida" e continua no banco; flag off → rotas 404 e `Bolha` sem barra. **Reporte:** `PASSO 2: verde/vermelho + os 5 comandos exercitados`.

### PASSO 3 — PR-S6 · DM humano↔agente e agente↔agente (G3, lei 3)
Branch `escritorio/fatia4-s6-dm`. Flag `CANAL_DM`; `CANAL_DM_TETO_DIA` (default 5); `recursos.dm`.
1. **Schema** (§3): `Canal.tipo/par/parChave/fechadoEm` + `ConsentimentoPar` → `generate` + `db push`. **`lib/canal/dm.ts`** (`parChave`, `ehDmDeAgentes`, `acharOuCriarDm` — `acesso:"privado"`, `membros` = ids humanos do par, `agentes` = keys do par, `titulo` = "DM · @agente" ou "@A ↔ @B"). **Gate:** `podeLer` já cobre (dono + membros); DM de agentes é lida pelo dono humano.
2. **`POST /api/canal/dm { com }`** (`com` = userId **ou** agentKey): humano↔agente → `acharOuCriarDm(eu, [eu, "agent:"+key])` e responde `{canal}`; humano↔humano **fora de escopo** (403 `dm_tipo`). **`GET /api/canal`** passa a devolver `tipo` e, com `?resumo=1`, agrupa (`canais`, `dms`). **`POST /api/canal/dm/consentir { parChave }`** — dono; cria `ConsentimentoPar`; se houver `AgentTask` `awaiting_input` pendente desse par, `responderHumano`.
3. **`lib/canal/consulta.ts`** `consultar()` (§3): (a) `parChave("agent:"+de, "agent:"+para)`; (b) sem `ConsentimentoPar(ownerId, parChave)` → `{ok:false, motivo:"consentimento", pendente}` **e** o chamador (turno/tarefa) vira `aguardando_humano{pergunta: "@A quer consultar @B sobre '<pergunta>'. Autorizar?"}` (S9) + mensagem no fio/thread com a pergunta — `👍` (S3) ou `POST …/consentir` libera; (c) teto diário por `parChave` (count de `Canal` com `parChave` e `createdAt` hoje) → `{ok:false, motivo:"teto"}`; (d) `acharOuCriarDm` (um DM **novo** por consulta: `parChave` ganha sufixo `#<n>` pra não colidir com a unique — a unique protege o DM humano↔agente); (e) grava a pergunta como mensagem de `de`; (f) **um** `executarTurno` de `para` **dentro de `emSerie(dmId)`** (C12) com `TurnoInput{canalId: dmId, agentKey: para, userId: ownerId}`; (g) `fechadoEm = now` (qualquer `POST mensagem` no DM fechado → 409 `dm_fechado`); (h) devolve `{ok:true, resposta, dmId, citacao}` com `citacao = "consultei @" + para + ": " + resumo(resposta, 280)`.
4. **Tool `consultar_mentor`** (registry, `runtime.ts`): registrada **só** com `CANAL_DM=1`; `run(args, ctx)` exige `ctx.canalId` e `ctx.agentKey` (aditivos no `hctx` do `agent-turn`/`tarefa-run`), chama `consultar`, devolve `Finding{confidence:"baixa", source:{title:"@B (consulta)"}}` e `provenance.origem:"agente"`; `motivo:"consentimento"` → `ToolResult{ok:false, code:"dm_consentimento"}` (o harness contorna via A1/observação; a tarefa fica `awaiting_input`). **`contextosDe` (C4) exclui `origem:"agente"`** — teste.
5. **UI:** seletor de canais ganha o grupo **"Mensagens diretas"**; no chip do agente (`:377`) um toque longo/menu "conversar em privado" → `POST /api/canal/dm`; DM humano↔agente é o mesmo `CoworkingCanal`. DM agente↔agente aparece na lista do dono como "@A ↔ @B · fechada" (somente leitura; `Composer` oculto quando `fechadoEm`). Pedido de consentimento aparece como card na barra (S9 `aguardando_humano`) com **[autorizar] [negar]**.
6. **Erros:** `dm_consentimento`, `dm_teto` ("@A já consultou @B 5 vezes hoje."), `dm_fechado`, `dm_tipo`.
7. **Testes:** `dm.test.ts` (`parChave` ordena; `acharOuCriarDm` idempotente e sempre privado); `consulta.test.ts` (fake prisma + `executarTurno` mockado: 1º contato → consentimento pendente e **nenhum** turno; com consentimento → 1 turno, DM fechado, citação ≤ 280; 2º contato não pede aval; teto 5 → `dm_teto`; mensagem no DM fechado → 409); `citacao.test.ts` (`contextosDe` ignora `origem:"agente"`); rota `dm` IDOR (B não cria DM "como" A; C não lê DM de A).
**Gate S6:** mentor A consulta B (via `consultar_mentor` num turno de canal): o canal recebe **só** "consultei @B: …", o DM aparece fechado na lista do dono com a pergunta e a resposta, o 2º contato **não** pede aval, o 6º do dia é barrado; a resposta consultada **não** ganha chave `zxc-`; flag off → tool não existe e rotas 404. **Reporte:** `PASSO 3: verde/vermelho + a linha "consultei @B" e a contagem de mensagens do canal`.

### PASSO 4 — PR-A6 · Reunião de comitê (porte de `run_meeting`)
Branch `escritorio/fatia4-a6-reuniao`. Flag `CANAL_REUNIAO`; `REUNIAO_RODADAS_MAX` (5), `REUNIAO_TETO_TOKENS` (60000, só com C5), `recursos.reuniao`. **Dividir em dois se passar de ~8 arquivos:** A6a = `lib/reuniao/*` + `lib/canal/guard.ts` (puro, testado, sem rota); A6b = tarefa `kind:"reuniao"` + rota + thread + UI.
1. **`lib/reuniao/prompts.ts`** — os prompts da §3.A em PT-BR (cabeçalhos `###` em inglês), funções com a **mesma assinatura** do original (`abertura`, `piInicial`, `membro`, `piIntermediario`, `piFinal`, `critico`, `agenteAposCritica`, `estruturaDoResumo`). **`lib/reuniao/run.ts`** — `runReuniao` fiel ao fluxo da §3.A: validações; histórico linear; `rodadas+1` iterações; última iteração só o primeiro do `time`; "pass" = fala registrada como `pass` e **não** conta no loop guard; `tipo:"critico"` alternando. Aditivos: `d.ledger` após cada rodada intermediária → `emit({tipo:"ledger"})`; **estagnação** = `emLoop` em 2 rodadas seguidas **ou** `!progresso` em 2 seguidas → pula direto para a rodada final (`encerradaPor:"estagnacao"`); `d.cancelado()` checado entre falas (`"cancelada"`: ainda roda a final do PI com o que tem); teto de tokens (quando C5) → `"teto"`, idem. `extrairSecoes` parse determinístico. **`CRITICO`** em `lib/reuniao/critico.ts`.
2. **`lib/canal/guard.ts`** (PURO + Map/Redis): `registrarFala(chave, {autorTipo, agentKey, at})` → `{ok:true} | {ok:false, motivo:"loop"|"repetida"}`; chave = `canalId` ou `canalId:parentId`; **6** trocas agente↔agente seguidas → `loop` (humano reseta); mesmo agente com fala < 60s → `repetida` (descartada e logada). Estado em `Map` por processo com fallback Redis (`CANAL_LOCK_REDIS`, C12) — mesma injeção de teste do `serial.ts`. **Onde freia:** `runReuniao` (via `deps.falar` wrapper), `consultar`, e `executarTurno` quando `input.origem === "agente"`.
3. **Reunião como tarefa + thread:** `lib/reuniao/tarefa.ts` → `convocarReuniao({canalId, ownerId, pauta, perguntas, membros, rodadas, tipo, parentId?})`: `criarTarefa(kind:"reuniao", agentKey: piAgentKey, requesterId: ownerId)`; posta no fio a **abertura** (template §3.5: "Comitê reunido sobre <pauta> — eu, @B e @C, N rodadas. Discussão na thread.") como mensagem do PI **com `taskId`**; essa mensagem é o **root da thread**; roda `runReuniao` **dentro de `emSerie(canalId)`** com `deps.falar` = `gerar`/`geminiJson` com `buildPersona(agentKey)` (persona ou `resolveMentor(...).context`) + histórico (cada `Fala` vira resposta na thread com `parentId = root`, `autorId = quem`, `taskId`; "pass" **não** vira mensagem); `deps.ledger` = 1 chamada Flash com schema `ProgressLedger`; `marcarFase` por rodada (`progress = rodada/(rodadas+1)`) → S9 `trabalhando`; ao fim: `ResearchWork{workType:"ata", title: pauta, secoes: as 5 seções + Material Passport vazio, scopeId: canalId}` → `concluir(task, artifact)` → **conclusão no fio** ("Resultado do comitê: <recomendação em 1 linha> → abrir a ata") → **resumo → `MemoryDrawer`** (`kind:"nota"`, `wing:{kind:"agente", label:"comite/"+canalId}`, `text` = resumo verbatim) → `ocioso`. Estagnação/teto/cancelada → mesma conclusão com o `encerradaPor` dito na linha. **Fio = 2 mensagens.** `summariesAnteriores` = últimas 3 notas `comite/<canalId>` da memória (quando configurada).
4. **Rota** `POST /api/canal/[id]/reuniao { pauta, perguntas?, regras?, membros, rodadas?, tipo? }` — `podeEscrever`; `membros` ⊆ agentes do canal (ou contratados), 2–6; `rodadas` ≤ `REUNIAO_RODADAS_MAX`; PI = `piAgentKey` do body **ou** default (§5.1). Responde `{taskId, rootMsgId}`. **UI:** chip "convocar comitê" (só `recursos.reuniao`) abre um mini-formulário no `Composer` (pauta, membros por chip, rodadas 1–3); o progresso é a barra da tarefa (Fatia 3) na thread; a ata abre em "Minhas coisas".
5. **Erros:** `loop_guard`, `reuniao_estagnada` ("O comitê parou de avançar — encerrei com o que havia."), `reuniao_teto`.
6. **Testes** (`lib/reuniao/run.test.ts` com `falar` fake que devolve strings determinísticas e registra a ordem): (a) 3 rodadas × 4 mentores → ordem de fala **exata** `[PI, m1, m2, m3] × 3 + [PI]`, `rodadasExecutadas = 3`, resumo com as 5 seções; (b) membro que diz "pass" não aparece como mensagem; (c) PI ∈ membros → erro; (d) `ledger` com `emLoop` 2× → `encerradaPor:"estagnacao"` e a final roda; (e) `cancelado()` → final roda, `"cancelada"`; (f) `tipo:"critico"`: ordem `[agente, critico, agente, critico, …, agente]`; (g) `extrairSecoes` com seção ausente → `""`. `guard.test.ts` (6 trocas → loop; humano reseta; repetida < 60s). `tarefa.test.ts` (fake prisma: fio recebe **exatamente 2** mensagens do PI; falas na thread com `parentId = root`; ata gravada **antes** de `done`; `MemoryDrawer` escrito com o resumo verbatim; `summariesAnteriores` carregadas). Rota: IDOR; `membros` fora do canal → 400; `rodadas` 9 → 400.
**Gate A6:** com `CANAL_REUNIAO=1`, convocar 3 rodadas × 4 mentores produz a **ata de 5 seções** em "Minhas coisas", o **fio recebe 1 abertura + 1 conclusão** e a thread recebe as falas; custo dentro do teto (ledger C5 quando existir; senão contagem de chamadas = `(rodadas+1)·(membros+1) − membros` + ledgers); um loop agente↔agente induzido (teste do `guard`) **trava** em 6; flag off → rota 404, chip ausente. **Reporte:** `PASSO 4: verde/vermelho + ordem de fala e nº de mensagens no fio`.

### PASSO 5 — Verificação final da fatia (não pule)
1. `tsc` limpo · `vitest` verde · CI `build-test` verde nos 4 PRs.
2. **Flags vazias** → canal idêntico à Fatia 3; a única diferença visível: bolinha de estado dos agentes (S9, aditiva).
3. **`docs/HANDOFF_FATIA4_RESULTADO.md`**: ordem de ligar (`CANAL_REACOES` → `CANAL_DM` → `CANAL_REUNIAO`, um dia entre cada), rollback (flag vazia; DMs e atas já gravados seguem legíveis), e medidas do handoff §9 "escritório": **falas sobrepostas = 0**, mensagens do comitê no fio (meta = 2), consultas por par/dia, taxa de `loop_guard`, tempo que `aguardando_humano` (consentimento) espera.
**Gate:** os 3 itens, binários.

## 5. Decisões assumidas pelo Fable (valem até o Martinez vetar — leia antes do PASSO 1)

1. **PI default = `zaeon`** (a anfitriã/orquestradora do roster, `lib/ai/personas.ts`), com a Aura como relatora (quem redige a ata via `falar` do PI? não — o PI redige; "relatora" = a Aura é membro fixo quando a pauta é de pesquisa). O handoff §10.1 diz "Zion", mas **não existe agente `zion`** no roster nem em `personas.ts`; criar um só para isto seria contrato novo. Se o Martinez quiser o Zion, é um `AgentProfile`+persona em PR próprio e `piAgentKey` muda.
2. **Ordem S9 → S3 → S6 → A6**, não A6 primeiro: A6 consome os três. Quem quiser o comitê rápido pode fazer A6a (lib pura) em paralelo desde o início.
3. **S9 sem flag** (aditivo, só publica); `EstadoPod` vira derivado de `EstadoAgente` em vez de segundo vocabulário.
4. **Edição/exclusão/fixar entram atrás de `CANAL_REACOES`** junto com as reações (um só gate para "mensagem de primeira classe"); o handoff §7 só lista `CANAL_REACOES` para S3.
5. **Nenhum evento Pusher novo em S3:** edição/remoção/fixação/reação republicam `EV_MENSAGEM` com a wire completa (mesmo `id` → o cliente substitui). C2 não lista evento para S3 e ninguém redefine contrato alheio.
6. **`👎`/`❓` viram turno na thread da mensagem** com `instrucao` ("refaça"/"explique") — sem tool nova, sem LLM extra de triagem.
7. **Consentimento via `👍` ou rota**, uma vez por `(dono, par)`; **um DM por consulta** (`parChave#n`) para a conversa fechar de verdade e o histórico de consultas ficar auditável; o DM humano↔agente é o único reaproveitado (`parChave` sem sufixo).
8. **A resposta consultada é `Finding` de confiança baixa e `origem:"agente"`**, nunca contexto de citação — é a lei 4 em código, e o teste de `contextosDe` garante.
9. **Cabeçalhos da ata em inglês** (`### Agenda / Team Member Input / Recommendation / Answers / Next Steps`), corpo em PT-BR: são os nomes que o handoff fixa e que `extrairSecoes`/A9 parseiam.
10. **"pass" não vira mensagem na thread** e não conta no loop guard — menos ruído, mesmo custo do original.
11. **Estagnação = 2 rodadas** sem progresso ou em loop (não 1): o Progress Ledger do Flash erra; uma leitura ruim não pode encerrar um comitê.

## 6. Economia de execução (pedido do Martinez — leve a sério)

Agrupe edições por arquivo; não abra exploração (a §2 tem TODAS as âncoras, verificadas em `11d0732`; a §3.A tem o molde inteiro); não re-explique contratos — a §3 é o texto final; pare em cada gate e reporte em 1 linha; gate vermelho 2 vezes → **PARE e pergunte ao Martinez**. A6 em dois PRs se passar de ~8 arquivos. Se `runReuniao` começar a escolher quem fala, você saiu do molde — volte à ordem fixa. Se o comitê precisar de uma terceira mensagem no fio "pra ficar claro", é a thread que está errada, não a lei. O valor está em cada gate verde, não em volume de código.
