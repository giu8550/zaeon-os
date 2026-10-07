# HANDOFF — Escritório Zaeon: comportamento das IAs, colaboração e chave única

> **Versão 2 · 2026-10-07 · para o FABLE → Claude Code (Opus).**
> Este é o documento executável. Ele consolida tudo que foi debatido em
> `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` (1.338 linhas) e a análise do gateway, e acrescenta a
> peça que faltava: a **especificação de comportamento** dos agentes no escritório.
> São **28 PRs distintas**, todas conectadas por **12 contratos canônicos** (§4). Um PR só pode
> entrar se os contratos que ele consome já existem.
>
> Prompts de execução por fatia (co-autorados pelo Fable): `docs/EXECUTOR_PROMPT_FATIA1_FUNDACAO.md` · `docs/EXECUTOR_PROMPT_FATIA2_SALA.md` · `docs/EXECUTOR_PROMPT_FATIA3_TRABALHO.md` · `docs/EXECUTOR_PROMPT_FATIA4_ENTRE_ELES.md` · `docs/EXECUTOR_PROMPT_FATIA5_MEMORIA.md`.

---

## ÍNDICE

1. Objetivo e regra de ouro
2. Estado verificado do repo (base de partida)
3. **A especificação de comportamento das IAs no escritório** ← a parte nova
4. Os 12 contratos canônicos (a cola entre os PRs)
5. Catálogo dos 28 PRs
6. Grafo de dependências e ordem de merge
7. Flags de ambiente (todas)
8. Guardrails que nenhum PR negocia
9. O que medir
10. Decisões pendentes do Martinez

---

## 1. Objetivo e regra de ouro

**Objetivo:** transformar o Escritório num ambiente de co-working onde humanos estudam e conversam
enquanto **agentes trabalham de verdade** — aceitam pedidos como tarefa com progresso visível,
conversam entre si, pesquisam na internet, percebem lacunas sozinhos e **produzem conhecimento
útil**, com vitrine própria e custo medido por agente. Modelo mental: **Slack onde alguns membros
são agentes com expediente**, não um chat com comandos de IA.

**Regra de ouro de todos os 28 PRs:** flag off por padrão, merge não altera comportamento
existente, mudança de UI é opt-in e mostrada antes de substituir tela. Kill-switch por camada.

---

## 2. Estado verificado do repo (2026-10-06, branch `fix/cartolina-sem-globo`, HEAD `a74e6e5`)

O Escritório está **congelado desde o commit `ef23293`** (02/10), que criou os 30 arquivos do canal
de uma vez. Tudo depois disso foi ciberespaço/lounge 3D.

### Já existe (não reescrever — estender)

| Peça | Onde |
|---|---|
| canal realtime, criar/entrar, acesso `privado\|turma\|aberto` | `app/api/canal/route.ts:12,24` · `[id]/entrar/route.ts:8` · `lib/canal/gate.ts:16,26,29` |
| presença (quem está online) com nome+avatar | presence Pusher · `lib/canal/wire.ts:9` · `app/api/canal/pusher-auth/route.ts:14` |
| **@menção com autocomplete** | `lib/canal/mention.ts:58,65` (`sugerir`, `mencaoAberta`, `parseMentions`, `semMencoes`) · popover `components/office/CoworkingCanal.tsx:381` |
| turno do agente | `lib/canal/agent-turn.ts:145` `executarTurno` · `N_CONTEXTO = 30` (`:19`) · `blocoCanal` (`:90`) |
| fila do turno (opcional) | `lib/canal/queue.ts:13` fila `canal-turnos` · `jobIdDe = canalId:agentKey:mensagemId` (`:43`) |
| um turno por canal (**só por processo**) | `lib/canal/serial.ts` (`emSerie`, `Map<string,Promise>`) |
| eventos realtime | `lib/canal/wire.ts:5-6` → `EV_MENSAGEM="mensagem"`, `EV_DIGITANDO="agente-digitando"` |
| não-lidas + badge + notificação do SO | `lib/canal/notificacoes.ts` (puro, testado) · `components/office/useNotificacoesSO.ts:28-48` |
| agente entra no canal ao ser mencionado · **teto 12** | `app/api/canal/[id]/mensagem/route.ts` · `[id]/route.ts:49` |
| roster (personas + mentores + AgentProfile) | `lib/agents/roster.ts` (`rosterBase`, `rosterComMentores`, `mergeProfiles`) |
| harness | `lib/agent/trajectory.ts` (`Phase`, `Budget`, `HarnessDeps`, `runTrajectory`) · registry em `lib/agent/runtime.ts:240` (`permit()`, `Gate`) |
| padrão de job longo que funciona | `lib/scholar/pipeline.ts` (`runScholarPipeline`, fases `planning→searching→dedup→synthesizing→verifying`) + `ScholarSession.thread.events` |
| filas BullMQ existentes (3) | `scholar`, `chat`, `canal-turnos` |
| uso por agente | `AgentUsage` (`contagem`, `ultimoUso`) · `lib/canal/usage.ts:19` `registrarUso` |

### Não existe (cada ausência é um PR)

thread (`parentId`) · histórico paginado (hoje `take: 60` fixo, `[id]/route.ts:22`) · leitura
persistida (não-lidas são estado local do React) · DM · reações · busca · upload no canal ·
editar/excluir mensagem · humano digitando · **captura de tokens** (grep por `usageMetadata`,
`promptTokenCount`, `totalTokenCount` em `lib/`+`app/`+`components/` → **zero**) · **qualquer
scheduler** (grep por `cron|node-cron|repeat:|every:` → só animação e polling de UI) ·
**qualquer proatividade** (grep por `proativ|autonom|setInterval` em `lib/canal`, `app/api/canal`,
`components/office` → zero) · `AgentTask` · `ResearchProgram` · `ZxivPaper` · gateway/OmniRoute
(grep `omniroute` em todo o repo → zero; só "Omniscient" em `app/workstation/page.tsx:472`).

> **Correção de estado (Fable, 2026-10-07, main `b2af5db`):** `literature_search` **já é real** (`lib/agent/runtime.ts:239`, sobre `lib/scholar/retrieve.ts` — OpenAlex/Crossref/arXiv/PubMed/S2 — com fallback web via SearXNG). Só `examiner` segue stub. O PR-A5 foi reescopado em `docs/EXECUTOR_PROMPT_FATIA3_TRABALHO.md`.

> **Correção de estado 2 (Fable, 2026-10-07):** a memória L3 (`lib/agent/memory.ts`) **não está ligada**: `configureMemory()` não tem chamador e não existe função de embedding no repo (`@google-cloud/vertexai` é só geração). `memory_search`/`wakeUp` são no-op em produção. A Fatia 5 abre com um PR-M0 que liga a L3 (embedding via Vertex `:predict`) e extrai a máquina de busca numa fábrica reusada por canal e Zxiv — ver `docs/EXECUTOR_PROMPT_FATIA5_MEMORIA.md`.

### Dois stubs que explicam a reclamação original

`literature_search` → `runtime:"python"`, devolve **`skill_offline`**; `examiner` → devolve
**`not_implemented`** (ambos registrados em `lib/agent/runtime.ts:240`). Foi por isso que o
Nightingale disse "as ferramentas de busca não trouxeram evidências" — o diagnóstico dele estava
tecnicamente correto.

---

## 3. ESPECIFICAÇÃO DE COMPORTAMENTO DAS IAS NO ESCRITÓRIO

Esta seção é **normativa**: todo PR que mexe em agente obedece a ela. Ela substitui o
comportamento atual (mencionar → responder tudo no fio).

### 3.1 As sete leis do escritório

1. **Uma vez para avisar, uma vez para entregar.** Pedido que gera trabalho recebe **uma** linha
   curta ("entendi, vou montar e te aviso aqui") e silêncio até a entrega. Nunca despejar o
   trabalho inteiro no fio.
2. **Debate vive em thread.** Conversa entre agentes nunca ocupa o fio principal. No fio entram
   duas linhas: abertura ("comitê reunido sobre X") e conclusão ("resultado: <link>").
3. **Pergunta a colega é fechada.** Um mentor consulta outro em canal que **auto-fecha** depois de
   uma pergunta e uma resposta, e **cita** a resposta ("consultei @Osler: …"). A conversa inteira
   não entra no canal.
4. **Sem chave, não cita.** Nenhuma afirmação factual sai sem chave de citação `zxc-<hash8>`
   validada. Opinião de outro agente **não é evidência**.
5. **Diz quando não pode.** Skill offline, teto de tokens estourado, conector caído, índice
   ausente: o agente **declara** em uma linha. Nunca redação vaga disfarçando indisponibilidade.
6. **Silêncio é o default do proativo.** Agente que acorda e não tem novidade **não fala** — e
   registra que checou.
7. **Nunca manda mensagem externa sozinho.** WhatsApp e e-mail passam por fila de aprovação com
   dry-run. Sem exceção, em nenhuma fase.

### 3.2 Máquina de estados do agente

```
                    ┌──────────── OCIOSO ────────────┐
                    │  (estado publicado na sidebar)  │
                    └───────────────┬─────────────────┘
          gatilho (§3.3) ───────────┤
                                    ▼
                            ┌───── TRIAGEM ─────┐   determinística, sem LLM
                            │ lib/canal/triagem │   (PR-A4) — em dúvida, TURNO
                            └─────┬──────┬──────┘
                 ┌────────────────┘      └─────────────────┐
                 ▼                                         ▼
          RESPOSTA CURTA (turno)                   TAREFA (AgentTask)
          1 mensagem, ≤1 fase                      avisa → trabalha → entrega
          continua como hoje                              │
                                                          ▼
                                      ┌──── TRABALHANDO (fases do Phase) ────┐
                                      │ progresso via EV_TAREFA, sem falar   │
                                      └──┬──────────┬──────────┬────────────┘
                                         ▼          ▼          ▼
                                    ENTREGA   AGUARDANDO   TRAVADO
                                    (artefato  _HUMANO     (stalled/teto/
                                    + 1 linha) (pergunta   erro → 1 linha
                                               na barra)   com motivo)
                                         └──────────┴──────────┘
                                                    ▼
                                                 OCIOSO
```

Estados publicados (contrato C2): `ocioso` · `pensando` · `trabalhando(taskId, fase, progress)` ·
`aguardando_humano(pergunta)` · `bloqueado(motivo)` · `fora(teto|degradado)`.
**`bloqueado` e `fora` são visíveis ao usuário** — ele tem direito de saber que o mentor está mudo
por teto e não por ignorância. Alinhar com `EstadoPod` que já existe em `lib/office/mapa.ts`
(`"ocioso"|"trabalhando"|"falando"`) em vez de criar vocabulário paralelo.

### 3.3 Os seis gatilhos (e o que cada um exige)

| # | Gatilho | Exige | PR |
|---|---|---|---|
| G1 | **@menção direta** de humano | nada — é o que já funciona | existente |
| G2 | **Reação de comando** (`🚀` promove a tarefa, `👍` aprova fase, `🔖` guarda, `👎` refaz, `❓` explica) | reações (S3) | S3 |
| G3 | **Convocação por outro agente** (consulta fechada ou comitê) | DM/consulting (S6) + lock (S7) + thread (S1) | A6, S6 |
| G4 | **Evento do mundo** (tarefa concluída com desdobramento · anexo novo · paper novo no Zxiv · lacuna declarada · contradição entre fontes · prazo do programa) | gating estágio 1 (P2) | P2 |
| G5 | **Heartbeat** (relógio do agente, sono autocalculado) | scheduler (P1) + lock (S7) | P1 |
| G6 | **Ciclo do programa** (rotina diária do tópico dado no admin) | scheduler (A8) | A8 |

**Menção indireta não é gatilho.** Falar "enfermagem" no canal **não** convoca a Nightingale. Só
G1, G2, G3 e — com gating — G4. Isso evita o escritório virar um salão de agentes se intrometendo.

### 3.4 Triagem: turno ou tarefa?

Determinística, em `lib/canal/triagem.ts`, pura e testada — **sem gastar LLM nessa decisão**.

- **Turno** (responde no fio): pergunta conceitual, dúvida pontual, continuação de conversa,
  pedido de explicação, saudação.
- **Tarefa** (`AgentTask`): verbo de produção (*fazer, produzir, escrever, montar, pesquisar,
  levantar, comparar, revisar*) **+** substantivo de entregável (*trabalho, artigo, relatório,
  dossiê, revisão, TCC, levantamento, comparação*); ou pedido que exige buscar fonte externa; ou
  pedido com mais de ~3 subperguntas.
- **Em dúvida: turno.** O custo de errar para turno é uma resposta curta; o de errar para tarefa é
  uma barra de progresso para uma pergunta de dois segundos.

Exemplo canônico (o caso que originou tudo): `@enfermagem precisamos fazer um trabalho sobre
cafeína` → **tarefa**, kind `dossie`.

### 3.5 Formato das mensagens do agente (templates normativos)

**Abertura de tarefa** — uma linha, primeira pessoa, sem lista, sem "próximos passos":
> Entendi: trabalho sobre cafeína com foco em enfermagem. Vou levantar as fontes e montar o
> dossiê — te aviso aqui quando terminar.

**Entrega:**
> Pronto. Dossiê sobre cafeína na prática de enfermagem — 14 fontes, 3 lacunas declaradas.
> → [abrir na Sala de Pesquisa]

**Pedido de humano** (vai para a barra **e** para o fio, porque bloqueia):
> Travei numa decisão: incluo população pediátrica? Muda o escopo das diretrizes.
> [incluir] [não incluir] [decidir depois]

**Indisponibilidade (lei 5):**
> Montei com o que tenho, mas a busca em bases científicas está fora do ar agora — o dossiê está
> sem PubMed. Quando voltar, eu completo.

**Abertura de comitê:**
> Comitê reunido sobre viabilidade do aquífero — eu, @Eiffel e @Borlaug, 3 rodadas. Discussão na
> thread.

**O que o agente nunca escreve:** "Próximos passos: pesquisar sobre X" quando ele **é** quem
deveria pesquisar · desculpa vaga no lugar de declarar skill offline · bloco de markdown com
tabela quando está em modo voz · citação sem chave · promessa de prazo em horas.

### 3.6 Voz (quando houver TTS)

Regras já decididas em `docs/TUTORES_PERSONAS.md` e mantidas: primeira pessoa, frases curtas,
ritmo de conversa, **nunca ler markdown ou tabela em voz alta**, detalhe e artefato vão para a
tela, não para a fala; respeitar `voiceMode` (passivo = breve). A barra de progresso **não** é
narrada.

### 3.7 Hierarquia de voz do agente proativo (do silencioso ao intrusivo)

O default é o nível 1. Subir de nível exige passar o gating (P2).

1. **atualiza artefato/card** — ninguém é notificado
2. **escreve no Zxiv** — aparece no mural
3. **posta na thread** do assunto — notifica quem segue a thread
4. **digest diário** — uma mensagem agrupando tudo (o "bom dia" do escritório)
5. **mensagem no fio principal** — reservada a: terminei · travei · **preciso de você**
6. **notificação do sistema** — só prioridade alta (regra que já existe em `lib/canal/notificacoes.ts`)

**Meta dura:** ≤3 mensagens proativas por dia no fio principal, por canal. Acima disso é spam,
mesmo que cada mensagem seja individualmente boa.

### 3.8 Orçamento de comportamento (os freios, todos juntos)

| Freio | Valor inicial | Onde |
|---|---|---|
| rodadas de comitê | finitas, 3 | A6 |
| trocas agente↔agente seguidas | 6, menção humana reseta | S7/A6 (`lib/canal/guard.ts`) |
| mesma fala duas vezes no minuto | proibido | P5 |
| token bucket por canal | por canal/dia, Redis | P5 |
| teto de tokens por agente/dia | `AgentProfile.tetoTokensDia` | A3 |
| orçamento por programa | `orcamentoTokensDia/Total` | A8 |
| horário de silêncio | por canal | P5 |
| stall detector | 450s ocioso / 1200s em tool | A4 |
| chore | 90s total, 3 chamadas de LLM | G5 |

---

## 4. OS 12 CONTRATOS CANÔNICOS (como os PRs se conectam)

Cada contrato nasce em **um** PR e é consumido por outros. **Nenhum PR redefine um contrato
alheio.** Esta tabela é a interface entre os PRs — se um PR precisar mudar um contrato, para e
pergunta.

| # | Contrato | Forma | Nasce em | Consumido por |
|---|---|---|---|---|
| **C1** | `AgentTask` | model Prisma (`agent_tasks`) + `lib/canal/tarefas.ts` | **A4** | A6, A9, A10, P4, S3, S9, G5 |
| **C2** | Eventos realtime novos | `lib/canal/wire.ts`: `EV_TAREFA="tarefa"`, `EV_AGENTE_ESTADO="agente-estado"`, `EV_PROGRAMA="programa"` + tipos `TarefaWire`/`EstadoWire` | **A4** (tarefa) · **S9** (estado) · **A9** (programa) | S9, A9, A11, P5 |
| **C3** | Thread | `CanalMensagem.parentId` + `respostas` + `ultimaRespostaEm`; profundidade **1** | **S1** | A6, S8, P5, S2, S3 |
| **C4** | Citação por chave | `zxc-<hash8>` + `{key, fonte, url, doi?, trecho, score}` persistido como `ProvenanceRecord` | **A5** | A7, A9, A10, S4, S5, G5 |
| **C5** | Envelope de LLM + `TokenLedger` | função única que devolve `{texto, usage{prompt,completion,cached,total}, modelo, provedor}` + model `token_ledger` | **A1** (com **G1**) | A3, A8, A9, G2, G8, P2 |
| **C6** | Virtual key por agente | key emitida pelo gateway, com budget/TTL/allowlist; `agentKey` → key | **G2** | A3, G5, G8, P1 |
| **C7** | Score de gatilho | `lib/canal/gatilho.ts` puro: `pontuar(eventos, contexto) → {score, motivos[]}` | **P2** | P1, P3, P4, P5 |
| **C8** | `AgentChore` + 9 tools fechadas | model + fila `agent-chores` + whitelist de tools | **G5** | P3, P5, A9 (fase 1 leve) |
| **C9** | `ZxivPaper` | model (`zxiv_papers`) com `parentPaperIds`, `embedding`, `novidade` | **A7** | A9, A10, P3, S4 |
| **C10** | `ResearchProgram` + `ProgramCycle` | models + fila `programa-ciclo` | **A8** | A9, A10, A11, A12, G8 |
| **C11** | Veredito + score de qualidade | `VERIFIED\|FAILED\|UNVERIFIED\|INCONCLUSIVE` + 10 campos (contribution .4, presentation .2, resto .1) | **A5** | A7, A9, A10 |
| **C12** | Lock distribuído de turno | `emSerie(chave, fn)` com lease no Redis, fallback `Map` sem `REDIS_URL` | **S7** | A4, A6, P1, P3, A9 |

**Leitura prática:** antes de abrir qualquer PR, confira na coluna "Nasce em" se o contrato já
existe. Se não existe, o PR está fora de ordem.

---

## 5. CATÁLOGO DOS 28 PRs

Os IDs são os mesmos de `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` (Partes II e III) — não renumerar,
os docs já os citam. Formato de cada entrada: **o que · produz/consome contrato · gate**.

### CAMADA 0 — Combustível e medição (a "chave única")

**PR-G1 · Gateway de pé**
LiteLLM em container atrás do Caddy, auth obrigatória, Postgres dedicado, Redis apontando para o
Upstash existente. Uma única função de saída de LLM no app (hoje `lib/ai/model.ts`,
`lib/ai/router.ts`, `lib/ai/gemini-text.ts` e o `genJson` injetado em `lib/canal/agent-turn.ts`) —
**envelopar ali, não espalhar**. Health: `/api/health` ganha `gateway:on|degraded|off` + provedor
servindo. **Escopo rígido: só a camada autônoma passa pelo gateway; pesquisa, estudos, mentores,
voz e deep thinking continuam no Vertex direto.**
→ produz **C5** (junto de A1) · gate: derrubar o Vertex artificialmente e a esteira seguir pelo
fallback, com `degraded` no admin.

**PR-A1 · Telemetria real de tokens**
Capturar `usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `cachedContentTokenCount`,
`totalTokenCount`) no envelope. Model `TokenLedger` (`at`, `userId?`, `agentKey`, `mentorSlug?`,
`surface`, `scopeId?`, `programId?`, `taskId?`, `phase?`, `model`, `provedor`, tokens,
`estimatedCostUsd`, `ok`). Escrita **best-effort** (padrão de `registrarUso`). Em
`lib/agent/trajectory.ts`, manter `COST` (`:84-91`) como estimativa de pré-voo e **reconciliar com
o real** ao fim de cada fase; `overBudget()` (`:124`) passa a frear com número medido. Agregações
puras em `lib/metrics/tokens.ts`.
→ produz **C5** · gate: um turno e uma busca gravam linhas com `totalTokens > 0`; turno sobrevive a
falha de escrita (teste com mock que lança).

**PR-G2 · Virtual key por agente**
Uma key por agente **e por ambiente**, com budget diário (tokens e USD), allowlist de modelos e
TTL. É o que faz vazamento virar incidente contido e revogável sem deploy.
→ produz **C6**, consome C5 · gate: 3 keys, estourar uma e só aquele agente parar.

**PR-G3 · Combustível (uma conta por provedor)**
Gemini Flash-Lite primário · Cloudflare Workers AI fallback (10k Neurons/dia que **renovam**) ·
Groq para latência+privacidade (o único que contratualmente não treina) · GLM-4.7-Flash.
**Proibido rodízio de contas do mesmo provedor** (§8.4).
→ consome C5, C6 · gate: derrubar o primário e a chamada escorregar; log mostra o provedor servido.

**PR-G4 · Envelope de erro reenfileirável**
"Todos os alvos estourados" vira status que a fila entende, com `retryAfter`; o trabalho volta para
a fila e expira em 24h. Sem isso, pool esgotado aparece como erro no app.
→ consome C5 · gate: esgotar tudo artificialmente e ver reenfileiramento silencioso.

**PR-A3 · Admin: gasto por agente**
`GET /api/admin/agents/tokens?range&groupBy=agente|usuario|programa` (founder-only via
`lib/admin/assertAdmin.ts`). No `AgentsModule.tsx` (que já mostra `uso.total`/`uso.usuarios`/top-5
por `contagem`, `:13,17,153-160`): tokens, custo estimado, tokens/turno, sparkline 14d, coluna
programa. Campo `AgentProfile.tetoTokensDia` → ao estourar, agente sai **só do trabalho autônomo**
(turno pedido por humano continua), com aviso.
→ consome C5, C6, C10 · gate: números batem com a soma bruta do ledger (script de conferência).

**PR-A2 · Aba Plugins → Mentores**
Extrair o corpo de `app/plugin-store/page.tsx` para `components/mentors/LojaMentores.tsx` (sem
mudar lógica), nova rota `app/mentores/page.tsx`, redirect da antiga sob flag, "Mentores" como
primeira categoria e default, label do módulo admin `plugins` → "Mentores · catálogo".
**Não** renomear `model Plugin` (`prisma/schema.prisma:267`) — é o gate G9, PR separado.
→ independente · gate: flag off = diff visual zero; deep-links antigos (`:56`) seguem válidos.

### CAMADA 1 — A sala aguenta conversa

**PR-S1 · Threads** → produz **C3**
`parentId` + `respostas` + `ultimaRespostaEm`; `POST .../mensagem` aceita `parentId`;
**profundidade 1**; `GET /api/canal/[id]` devolve só o fio (`parentId: null`); nova
`GET /api/canal/[id]/thread/[msgId]` com cursor; painel de thread à direita / drawer no mobile;
`MensagemWire` ganha `parentId`.
Gate: 20 mensagens de debate não movem o fio além de 2 linhas.

**PR-S2 · Histórico paginado + leitura persistida**
Cursor `createdAt+id` (trocar o `take: 60` de `[id]/route.ts:22`), scroll infinito com âncora;
model `CanalLeitura` (`userId`, `canalId`, `ultimaLidaEm`, `ultimaLidaId`, unique por par);
`POST /api/canal/[id]/lido`; não-lidas vindas do servidor (`GET /api/canal?resumo=1`); **divisor
"novo desde a última visita"**.
→ consome C3 · gate: 500 mensagens paginam sem salto; dois aparelhos mostram a mesma contagem.

**PR-S7 · Lock distribuído** → produz **C12**
`emSerie` ganha implementação com lease no Redis (`canal:<id>:turno`, TTL + renovação) e cai no
`Map` sem `REDIS_URL`. Fila de espera por canal com teto 3 — o 4º é recusado com "a sala está
ocupada" em vez de empilhar.
Gate: web + worker disparando no mesmo canal produzem falas sequenciais; matar o worker libera por
TTL.

### CAMADA 2 — O agente trabalha

**PR-A4 · `AgentTask`: pedido → trabalhando → progresso → artefato** → produz **C1**, **C2**
Model completo (§4 C1); `lib/canal/triagem.ts` (§3.4); terceiro evento Pusher; **fila nova
`agent-tasks`** no molde de `lib/canal/queue.ts` (flag + `REDIS_URL`, fallback inline, jobId
idempotente, worker em `instrumentation.ts`); fluxo da §3.5; cancelamento cooperativo entre fases;
stall detector (450s/1200s); `awaiting_input`; `lib/queue/reaper.ts` passa a varrer `agent_tasks`.
**Gravar artefato antes de marcar `done`.**
→ consome C12 · gate: o caso da cafeína não responde no fio — cria tarefa, mostra fases, entrega
link; sair e voltar reengata; cancelar para em ≤1 fase.

**PR-A5 · `literature_search` real + citação por chave + `examiner`** → produz **C4**, **C11**
Tira os dois stubs. `lib/agent/skills/literatura.ts` em TS (`runtime:"ts"`) sobre os conectores MCP
(`lib/agent/mcp.ts:203`) + web; escolha de fonte por embedding (padrão Biomni); degradação
explícita com motivo. `lib/agent/citacao.ts`: chave sintética por trecho, modelo só cita chave
existente, **passe determinístico removendo/marcando chave órfã**. `lib/agent/examiner.ts`:
integrity gate por claim (`ALIGNED|OVERSTATED|NOT_SUPPORTED` → `shouldRevise()`), score de 10
campos, veredito de 4 estados. Material Passport como seção. `data_access_level` em
`MentorTemplate` (`raw|redacted|verified_only`; mentores clínicos em `verified_only`).
Gate: ≥5 fontes com DOI/URL resolvível; teste que falha se houver chave órfã; claim inventado é
reprovado; conector caído produz aviso, não silêncio.

**PR-S3 · Mensagens de primeira classe + reações como comando** → produz **G2** (gatilho)
`editadoEm`, `excluidoEm` (soft delete — **mensagem de agente nunca desaparece**, vira "removida"),
`fixadoEm/Por`; `PATCH`/`DELETE` em `app/api/canal/[id]/mensagem/[msgId]/route.ts` (autor edita em
15 min; `podeGerir` do `gate.ts:29` exclui/fixa). Model `CanalReacao` com set semântico:
`👍` aprovo · `👎` refaça · `🔖` guarde (→ `MemoryDrawer`) · `🚀` promove a `AgentTask` · `❓`
explique. Fixadas entram no topo de `blocoCanal` (`agent-turn.ts:90`).
→ consome C1, C3 · gate: `🚀` cria tarefa; `🔖` grava memória; editar após 15 min é recusado.

**PR-S9 · Status do agente** → produz parte de **C2**
`EV_AGENTE_ESTADO` com os 6 estados da §3.2, **persistido** (sobrevive a reload), sidebar com
bolinha por agente. `bloqueado`/`fora` visíveis com motivo. Alinhar com `EstadoPod` de
`lib/office/mapa.ts`.
→ consome C1 · gate: tarefa longa mostra "trabalhando · reunindo fontes · 40%"; teto estourado
mostra "fora" com motivo.

**PR-S10 · Card do agente no canal**
Clique no avatar: domínio, `enabledSkills` reais vs **degradadas** (usar `degradedSkills()` de
`lib/agent/mentors.ts`, com "em breve" suave), conectores, `data_access_level`, guardrails de
saúde, últimas entregas, consumo (só admin), controles (silenciar aqui · remover do canal · só
responde se mencionado).
→ consome C4, C5 · gate: com `literature_search` off, o card diz "busca de literatura:
indisponível" e a resposta repete o mesmo aviso.

### CAMADA 3 — Agentes entre si

**PR-A6 · Reunião de comitê** (porte fiel de `run_meeting` do `zou-group/virtual-lab`, MIT)
`lib/reuniao/run.ts` — `runReuniao({pauta, perguntas[], regras[], piAgentKey, membros[], rodadas,
summariesAnteriores[], tipo:"comite"|"critico"}, deps)`. Ordem de fala **fixa**, "pass" permitido,
instrução explícita de discordar, PI sintetiza por rodada, **rodada final só com o PI** gerando
`### Agenda / Team Member Input / Recommendation / Answers / Next Steps`. Histórico = lista linear
compartilhada. `tipo:"critico"` = agente ↔ `SCIENTIFIC_CRITIC` alternando. Roda **em thread**, como
`AgentTask kind:"reuniao"`. **Progress Ledger** (MagenticLite) por rodada: *completou? progresso?
em loop? quem fala agora?* — estagnação encerra e devolve ao plano. `lib/canal/guard.ts` = loop
guard (6 trocas, menção humana reseta). `summary` → `MemoryDrawer`.
→ consome C1, C3, C12, C5 · gate: 3 rodadas × 4 mentores produzem o documento de 5 seções; fio
recebe 1 mensagem; custo dentro do teto; loop induzido é travado.

**PR-S6 · DM (humano↔agente e agente↔agente)**
`Canal.tipo` (`canal|dm`) + `Canal.par String[]` com unique no par ordenado, `acesso` forçado a
`privado`; `POST /api/canal/dm { com }`. Agente↔agente = canal `Consulting` do AG2: **uma pergunta,
uma resposta, fecha**, com consentimento do dono humano no primeiro contato daquele par (depois
liberado). `needs_human_input` escala quando a dupla trava. DM **não** entra no contexto do canal —
só o resumo pode ser citado. Teto de N DMs/dia por par.
→ consome C12 · gate: mentor A consulta B, o canal recebe só "consultei @B: …", segundo contato não
pede aval.

**PR-S4 · Busca no canal**
`GET /api/canal/[id]/busca?q=` e global respeitando `podeLer`; dois modos: texto (índice Mongo) e
**semântica reusando a máquina da memória L3** (`gemini-embedding-001`, EMBED_DIM 1536,
`$vectorSearch`+`$rankFusion` de `lib/agent/memory.ts`). Embedding gerado em job, fora do caminho
crítico. Filtros: autor, agente, só threads, período, "só com fonte". **Tool `canal_search`** para
o agente não repetir pergunta já discutida. ⚠️ índice Atlas é **manual** — runbook.
→ consome C3, C4, C9 · gate: busca por sinônimo acha; sem índice, responde "semântica
indisponível, usando texto".

**PR-S8 · Contexto por thread e relevância** (aposenta o `N_CONTEXTO = 30` linear)
`lib/canal/contexto.ts`: (a) fixadas · (b) thread corrente · (c) últimas K do fio · (d) top-M por
busca semântica sobre o objetivo · (e) resumo dos resumos de reuniões. Cada bloco rotulado, com
orçamento próprio e **ordem estável** (o cache do Vertex em `lib/ai/contextCache.ts` só ajuda se o
prefixo não muda). **Anti-eco:** fala de outro agente entra marcada e com peso menor; só o que tem
chave é evidência.
→ consome C3, C4, S4 · gate: canal com 200 mensagens e 3 agentes — o mentor responde ao assunto da
thread; tokens de prompt caem; teste de eco não produz conclusão.

**PR-S5 · Upload no canal vira fonte**
`anexos Json?` em `CanalMensagem`; upload reusando `lib/studio/storage.ts` (`.studio/`,
`studioFilePath`) + `StudioArtifact kind:"file"`; o anexo entra no acervo e fica disponível ao
`literature_search` como fonte local com chave própria. 20 MB/arquivo, nome sanitizado, nada
executado.
→ consome C4 · gate: "o que esse anexo diz sobre X" responde citando o anexo, não a internet.

### CAMADA 4 — Memória coletiva

**PR-A7 · Zaeon Rxiv (`Zxiv`)** → produz **C9**
Porte do AgentRxiv (`app.py` do AgentLaboratory, MIT) **corrigindo as fraquezas do original** (o
`Paper` deles tem 3 campos: `id`, `filename`, `text`; sem citação entre papers; sem dedup).
Model `ZxivPaper` (§4 C9) + 4 rotas (`POST /api/zxiv`, `GET /api/zxiv/search?q=`,
`GET /api/zxiv/[id]`, `GET /api/zxiv`). Embeddings e busca **reusando a máquina da memória L3**;
índice Atlas `zxiv_papers_vec` **manual** (runbook, junto do `memory_drawers_vec` pendente).
**Gate de submissão:** `score.Overall` ≥ limiar · `veredito ≠ FAILED` · **novidade** = 1 − maior
similaridade; abaixo do limiar, rejeita com "isto já existe em `<slug>`, cite e avance" e
`parentPaperIds` pré-preenchido. Mural somente-leitura em `/zxiv` com linhagem. Rate limit de
submissão por agente/dia; excedente vira nova `rev`. **Sem upvote, karma ou hot.**
*Por que isso é o multiplicador:* no paper do AgentRxiv, MATH-500 vai de 70,2% → 78,2% com o mural
compartilhado e estagna em ~73,5% sem ele; com 3 labs em paralelo, 79,8%, e o marco de 76,2% cai de
23 papers para 7. **Por isso o Zxiv é global entre programas, não por programa.**
→ consome C4, C11, C5 · gate: paper do ciclo 2 do programa A cita paper do programa B;
quase-duplicata é rejeitada por novidade.

### CAMADA 5 — Autonomia (produção de conhecimento)

**PR-A8 · `ResearchProgram` + rotina diária** → produz **C10**
`ResearchProgram` (`topico`, **`problema`/`quemUsa`/`porQueAgora` obrigatórios** = a régua de
utilidade, `ownerId`, `piAgentKey`, `membros[]`, `cadencia`, `horaUTC`, `status`,
`orcamentoTokensDia/Total`, `tokensGastos`, `fase?`, `cicloAtual`, `capaArtifactId?`,
`restricoes`) + `ProgramCycle` (`n`, `status`, `fase`, `progress`, `steps`, **`diffDoAnterior`**,
`paperId?`, `taskIds[]`, `tokens`, lease). **Fila `programa-ciclo` com repeatable do BullMQ** —
primeiro scheduler do repo — `jobId = programId:YYYY-MM-DD`, jitter, **reconciliação na subida**
(BullMQ perde repeatables se o Redis for limpo). Heartbeat **local** em `lib/programa/heartbeat.ts`
— nunca baixar instrução de fora. Orçamento checado **antes** de qualquer LLM. Kill-switch.
→ consome C5, C12 · gate: cadência agendada; rodar 2× no mesmo dia não duplica; orçamento estourado
impede o ciclo; reiniciar reagenda.

**PR-A9 · Pipeline das 7 fases** (Agent Laboratory portado)
`lib/programa/pipeline.ts` → `runProgramCycle(cycleId, params, emit)`, irmão de
`runScholarPipeline`. Mapeamento: `literature review`→`gather` (**Zxiv primeiro**, depois externas)
· `plan formulation`→`plan` (**reunião**) · `data preparation`→"materiais" · `running
experiments`→"viabilidade" · `results interpretation`→`reason` (**reunião**) · `report
writing`→`draft` (**papersolver**) · `report refinement`→`critique`/`finalize`.
**Loop do `papersolver` fiel:** comandos `PaperReplace`/`PaperEdit N M`, **só aceita se o score
subir**, `top_score`/`best_report`, `papersolver-max-steps` como teto; reflexão ("insights
generalizáveis") → `MemoryDrawer`. **Gate humano por fase** (co-pilot mode: `gateHumano String[]`;
parar = `awaiting_input` + card pedindo decisão; feedback como `notes:[{fases,nota}]` reinicializa
os agentes da fase — o paper mede 3,8 → 4,38/10 com isso ligado). **Não portar `mlesolver`**
(subprocess Python, timeout 600s): expor como tool MCP `run_experiment` com
`risk:"destructive"`→`REQUIRE_APPROVAL`; enquanto não existir, fase 4 roda analítica e **o dossiê
declara que não houve execução**.
→ consome C1, C4, C9, C10, C11, C5 · gate: ciclo completo do programa-exemplo entrega dossiê +
paper + tokens por fase; ciclo sem novidade encerra sem paper.

**PR-A10 · O dossiê (10 seções obrigatórias)**
Síntese executiva · Problema e utilidade (amarrado aos 3 campos) · Estado da arte (com lacuna
declarada) · **Materiais e meios** (componentes, custos com fonte e data, normas, fornecedores) ·
**Viabilidade** (premissas numeradas, cada uma marcada `VERIFIED|UNVERIFIED|INCONCLUSIVE` —
premissa não marcada é erro) · **Desdobramentos** · **Implicações** (riscos, custo
social/ambiental, limites éticos) · **Onde o humano precisa entrar** (seção de primeira classe,
cada item virando `needsHuman` acionável) · Material Passport · Veredito e score.
Persistência em `ResearchWork` (`workType:"dossie"`, reusando `secoes Json`, `rev`, e o editor
`lib/tcc/secoes.ts` com `OpSecao`/`Secao` + `TccRevisao` para histórico) + `ZxivPaper` na versão
publicada.
→ consome C4, C9, C11 · gate: seção obrigatória vazia é reprovada; nenhuma premissa sem marca.

**PR-A11 · Vitrine "Projetos"**
**Decisão de nome:** aba nova key `producao` com label **"Projetos"**; a aba `projetos` (Zaeon Code,
`app/research-lab/projects/ProjectsContent.tsx`) **mantém a key** — deep-links e o card da loja
(`app/plugin-store/page.tsx:56`) seguem válidos — e passa a exibir label **"Zaeon Code"**. Flag off
= nem o label muda.
Card: imagem (Imagen via `lib/studio/imagen.ts` → `.studio/` → `StudioArtifact`, id em
`capaArtifactId`, prompt sem texto na imagem, fallback gradiente) · título · tópico · chip de status
· fase + barra · nº de ciclos/papers/fontes · avatares dos mentores · tokens (admin) · selo ⚠
**"precisa de você"**. Molde visual: `components/mentors/MentoresGrid.tsx:124-200` (grade, borda em
gradiente violeta→cyan, brilho especular) + imagem de capa do card da loja (`:369-375`); tokens de
`lib/canal/vidro.ts`. Ao vivo por `EV_PROGRAMA` + polling de fallback.
→ consome C2, C10 · gate: progresso anda sem recarregar; selo leva à decisão; flag off = aba
inexistente.

**PR-A12 · Admin do programa**
`ProgramasModule.tsx` registrado em `app/workstation/admin/page.tsx:171-181`. Criar programa (os 3
campos de utilidade são **obrigatórios**, sem eles não salva) · escolher PI e mentores de
`MentorTemplate` · cadência/hora · orçamentos · `gateHumano` · restrições. Fila de ciclos com
**rodar agora / pausar / cancelar / arquivar** + kill-switch visível. **Caixa de decisões** única
(tudo `awaiting_input` de programas e tarefas) no espírito do `agent-inbox`: aceitar / responder /
editar plano / ignorar — registrando **quanto tempo ficou esperando** (a métrica que diz se a
autonomia ajuda ou só empurra trabalho para o humano). Gasto por programa.
Semear como **fixture de teste** (não em produção): *sistema aquífero de baixo custo para regiões de
extremo calor*.
→ consome C1, C10, C5 · gate: criar o programa-exemplo, rodar um ciclo, ver card, responder
decisão, ver ciclo retomar e o gasto no admin.

### CAMADA 6 — Esteira leve e proatividade

**PR-G5 · `AgentChore` (tarefa sem harness)** → produz **C8**
Irmão rápido do `AgentTask`: **sem trajectory**, 1–3 chamadas de LLM, 30s/passo e 90s total, modelo
pequeno do pool grátis via gateway, custo zero. Fila `agent-chores` no molde de
`lib/canal/queue.ts`.
**Nove tools, e só elas:** `fetch_url` (allowlist, sem JS, ≤1 MB, 15s) · `extract` · `classify`
(enum fechado) · `summarize_short` (≤120 palavras) · `diff_check` · `format` (contra schema) ·
`post_internal` · `enqueue_task` (promove ao `AgentTask` quando descobre que a coisa é grande).
**Proibido:** escrever em `ResearchWork`/`Zxiv`, rodar código, gastar Vertex, tocar dado de aluno,
qualquer envio externo. `permit()` é o porteiro: chore só recebe `risk:"read"` + `post_internal`
como `write` com teto.
Catálogo inicial: checar mudança em página/norma/preço · itens novos de feed · resumir link colado
· classificar anexo · extrair campos (preço, fornecedor, data, DOI) · montar digest · checar
link-rot em dossiê · formatar referência ABNT · traduzir trecho curto.
Disciplina: `jobId = chore:<tipo>:<alvoHash>:<YYYY-MM-DD>` · cursor por fonte · **diff vazio = não
fala e não gasta** · todo resultado carrega `fonteUrl`+`lidoEm`+`modelo`+`provedor` · chore **não
cria chore** (só `enqueue_task`).
→ consome C1, C4, C6, C8 · gate: 5 tipos rodando; nenhuma consegue escrever em `ResearchWork`.

**PR-G6 · Leitor/Executor + egress contido**
Partir a esteira: **Leitor** (lê a web, zero credencial, zero tool de escrita, egress por proxy
allowlist) e **Executor** (tem credencial, **nunca** lê a internet, destinatário e ação definidos
**antes** de qualquer conteúdo externo entrar — plan-then-execute). Isso quebra por construção a
combinação "input não confiável + acesso sensível + comunicar externamente" que a *Rule of Two*
(Meta) e a *lethal trifecta* tratam como comprometimento presumido.
Proxy: default-deny; DNS resolvido no proxy; rejeitar RFC1918, 127/8, `::1` e **169.254.0.0/16
(metadata)**; sem redirect cross-host; sem `file:`/`gopher:`/`dict:`; corpo ≤1-2 MB em stream;
timeout curto; páginas por tarefa limitadas; **sem JS por padrão**, headless só em container
separado, sem credencial, descartado por tarefa.
**Proibir imagem remota na saída de agente** (CSP `img-src 'self'`, sanitização por allowlist, nunca
auto-fetch) — é o vetor de exfiltração por markdown que nenhum guardrail de modelo pega.
→ consome C8 · gate: SSRF para 169.254.169.254 bloqueado no proxy; Leitor sem credencial provado
por teste.

**PR-P1 · Heartbeat por agente** (o relógio)
Fila `agente-heartbeat` com repeatable por agente ativo, `jobId = agentKey:canalId:slot`, jitter,
reconciliação na subida. Intervalo adaptativo com `min/max` por agente e canal (o agente calcula o
próximo sono, com teto duro). Conteúdo **local**.
→ consome C6, C7, C12 · gate: 3 agentes acordam em horários distintos; limpar o Redis e reiniciar
reagenda tudo.

**PR-P2 · Gating em dois estágios** (o porteiro — o PR mais importante da camada) → produz **C7**
**Estágio 1, sem LLM**, em `lib/canal/gatilho.ts` (puro, testável): pontua sinais — pergunta sem
resposta há >N min · tarefa concluída com desdobramento óbvio · lacuna declarada no dossiê · paper
novo no Zxiv do domínio · anexo novo não lido · contradição entre duas mensagens com fonte · prazo
do programa. **Abaixo do limiar não acorda — e esse é o caso comum.**
**Estágio 2, Gemini Flash**, só para o que passou: classifica na taxonomia de 4 classes
(*correct-detection, false-alarm, missed-needed, non-response*) e escolhe o canal de saída da §3.7.
**Aprendizado:** cada fala proativa carrega `👍 útil` / `👎 não` / `ignorar`; **ignorar é sinal** e
reduz a frequência futura daquele agente naquele canal. Limiar por mentor e por canal, recalibrado
pela taxa de ignorado.
→ consome C3, C5, S3 · gate: 100 eventos sintéticos, ≤5 passam o estágio 1; taxa de ignorado sobe o
limiar de forma observável.

**PR-P3 · Watcher de tópico**
Mentor assina tópicos; roda no heartbeat; **diff contra a última passada**: fontes novas via
`literature_search`, papers novos no Zxiv, anexos novos. **Nada mudou = não fala, mas registra que
checou** (para o humano saber que o agente está vivo sem ele dizer "nada novo" todo dia). Cursor por
fonte. Saída default: **digest**.
→ consome C4, C7, C8, C9 · gate: 7 dias sem novidade = zero mensagens e 7 registros de checagem.

**PR-P4 · Reflexão (percebe lacuna e vira trabalho)**
Reflexão por **limiar de importância acumulada** (Smallville), reusando `MemoryDrawer.importance`
que já existe. Ao cruzar o limiar: **uma** de três saídas — pergunta objetiva na thread, proposta de
`AgentTask` com aprovação de um clique (`🚀`), ou paper curto no Zxiv. Registrada como insight do
canal.
→ consome C1, C7, C9 · gate: sequência sintética de eventos importantes gera 1 proposta, não 3.

**PR-P5 · A voz do proativo**
Implementa a hierarquia da §3.7 + token bucket por canal no Redis + não falar duas vezes no minuto
+ loop guard + horário de silêncio por canal + kill-switch `PROATIVO=0`.
→ consome C2, C3, C7 · **gate do bloco:** 24h com 3 mentores proativos e um programa ativo →
**≤3 mensagens proativas/dia no fio**, todas marcadas úteis, nenhuma repetida, digest cobrindo o
resto, custo dentro do orçamento.

**PR-G7 · Envio externo (só quando o Martinez liberar)**
O agente **não chama a API de envio** — escreve na fila. Serviço separado valida opt-in, janela de
24h, categoria de template, cap por destinatário (1/dia, 3/semana) e orçamento diário.
**Dry-run por padrão**, promoção gradual por tipo. Fila de aprovação com diff do que vai sair.
Kill-switch **fora** do agente (flag na fila/gateway, nunca no prompt). **Log append-only** com
prompt, URLs lidas, tool calls, destinatário, template, aprovador, timestamp.
⚠️ **WhatsApp:** desde **15/01/2026** os Business Solution Terms **proíbem "AI Providers"** cuja IA
de propósito geral seja a funcionalidade *primária*; IA apoiando o atendimento do **próprio**
negócio segue permitida. Isso toca o posicionamento do chipflown e o `docs/PR_WHATSAPP_MENTOR.md` —
**ler antes de codar**. Mais: tiers 250→1k→10k→100k governados por quality rating; erro 131049 é
falha silenciosa típica. **E-mail:** domínio **separado** (`msg.zaeon.com.br`), SPF+DKIM+DMARC
`p=reject`, warm-up, supressão automática de bounce/complaint.
→ consome C1, C6, G6 · gate: 48h em dry-run com zero envio real; promover um tipo e ver o log
imutável.

**PR-G8 · Telemetria do pool no admin**
Consumo por agente e por provedor, taxa de 429, tempo em cooldown, chores esgotadas,
**tool-calling success rate por provedor**, custo R$ 0 comprovado.
→ consome C5, C6, C8, C10 · gate: bate com o `TokenLedger` e com os headers do gateway.

---

## 6. GRAFO DE DEPENDÊNCIAS E ORDEM DE MERGE

```
G1 ─┬─► A1 ─┬─► A3
    │       ├─► G2 ─┬─► G3 ─► G4 ─► G5 ─┬─► P3
    │       │       └─► G8               ├─► P5
    │       └─► A8                       └─► (G6 junto de G5)
    │
S1 ─┬─► S2
    ├─► S3 ─► (gatilho G2 de §3.3)
    ├─► S8 ◄── S4 ◄── A5
    └─► A6 ◄── S7 ◄── (lock, pré-requisito de TODA proatividade)
S7 ─┴─► A4 ─┬─► S9 ─► S10
            ├─► A6
            ├─► P4
            └─► A9
A5 ─┬─► A7 ─► A9 ─► A10 ─► A11 ─► A12
    ├─► A9
    └─► S5
P2 ─┬─► P1 ─► P3 ─► P4 ─► P5          (NADA de P antes de S1 + S7)
A2 · S6 · G7 — entram quando couber (G7 depende de decisão do Martinez)
```

**Fatias de entrega** (cada uma fecha com CI verde e transpile dos arquivos tocados —
`transpileModule`/vitest, sem `next build`):

| Fatia | PRs | O que o Martinez vê |
|---|---|---|
| **1 · Fundação** | G1 · A1 · G2 · A3 · A2 | gateway com fallback, tokens medidos de verdade, admin com gasto por agente, aba Mentores |
| **2 · A sala aguenta** | S1 · S2 · S7 | threads, histórico infinito, não-lidas entre aparelhos, lock distribuído |
| **3 · O agente trabalha** | A4 · A5 | `@mentor` vira tarefa com barra; busca real com citação checada |
| **4 · Conversa entre eles** | A6 · S3 · S6 · S9 | comitê em thread, reação como aprovação, mentor consultando mentor, status ao vivo |
| **5 · Memória coletiva** | A7 · S4 · S8 · S5 | Zxiv, busca semântica, contexto por relevância, anexo como fonte |
| **6 · Autonomia** | A8 · A9 · A10 · A11 · A12 | programa com rotina diária, dossiê, vitrine, admin |
| **7 · Esteira leve** | G3 · G4 · G5 · G6 · G8 | tarefas na web a custo zero, contidas |
| **8 · Proatividade** | P1 · P2 · P3 · P4 · P5 · S10 | agentes que acordam, percebem e propõem — com ≤3 falas/dia |
| **9 · Externo** | G7 | WhatsApp/e-mail, só após decisão |

**A fatia 2 é pré-requisito, não melhoria.** Sem thread e sem lock, as fatias 4 e 8 produzem uma
sala ilegível com falas sobrepostas.

---

## 7. FLAGS (todas novas; off por padrão)

```
# ── Gateway / chave única ──
GATEWAY_URL=""                  # endpoint OpenAI-compatible do LiteLLM (vazio = Vertex direto)
GATEWAY_KEY_<AGENTKEY>=""       # virtual key por agente (PR-G2)
CHORES_QUEUE=""                 # "1" (+REDIS_URL) → fila agent-chores
CHORES_WORKER=""                # "1" no worker
LEITOR_PROXY_URL=""             # proxy de egress do Leitor (PR-G6)
# ── Escritório ──
CANAL_TAREFAS=""                # "1" → triagem + AgentTask + evento "tarefa"
TAREFAS_WORKER=""               # "1" no worker
CANAL_THREADS=""                # "1" → parentId + painel de thread
CANAL_REACOES=""                # "1" → reações como comando
CANAL_DM=""                     # "1" → DM humano↔agente e agente↔agente
CANAL_BUSCA=""                  # "1" → busca (texto sempre; semântica só com índice Atlas)
CANAL_LOCK_REDIS=""             # "1" → lock distribuído (sem isso, Map por processo)
CANAL_REUNIAO=""                # "1" → comitê
# ── Conhecimento ──
LIT_SEARCH=""                   # "1" → literature_search real (sai do stub)
EXAMINER=""                     # "1" → integrity gate + score + veredito
ZXIV=""                         # "1" → mural de preprints
PROGRAMA_SCHED=""               # "1" → repeatable dos ciclos  ← KILL-SWITCH da autonomia
PROGRAMA_WORKER=""              # "1" no worker
PROGRAMA_WORKER_CONCURRENCY="1"
# ── Proatividade ──
PROATIVO=""                     # "1" → heartbeat + gating  ← KILL-SWITCH da proatividade
PROATIVO_SILENCIO="23:00-07:00" # horário de silêncio por default
# ── Externo ──
ENVIO_EXTERNO="dry-run"         # dry-run | off | on   ← nunca "on" sem decisão explícita
# ── UI (opt-in, NEXT_PUBLIC) ──
NEXT_PUBLIC_MENTORES_TAB=""     # "1" → /mentores + rebrand da loja
NEXT_PUBLIC_VITRINE=""          # "1" → aba "Projetos" (producao) + label "Zaeon Code" na antiga
NEXT_PUBLIC_PROGRAMA_ADMIN=""   # "1" → módulo de programas no admin
```

Já existentes a respeitar: `NEXT_PUBLIC_ESCRITORIO_COWORK`, `NEXT_PUBLIC_AGENTS_ADMIN`,
`NEXT_PUBLIC_AGENT_AVATARS`, `CANAL_QUEUE`, `CANAL_WORKER`, `SCHOLAR_BG`, `SCHOLAR_WORKER`,
`AURA_HARNESS`, `REDIS_URL`, Pusher.
**Lição registrada do escritório:** flag `NEXT_PUBLIC_*` precisa de **build-arg cabeado no
Dockerfile + compose**, senão não chega ao cliente em produção.

---

## 8. GUARDRAILS QUE NENHUM PR NEGOCIA

1. **Flag off por padrão**, kill-switch por camada, UI opt-in.
2. **Rodadas finitas** em todo loop de agente.
3. **Artefato gravado antes de `done`** (delivery receipt).
4. **Orçamento checado antes de chamar LLM**, com número real do `TokenLedger`.
5. **Progress Ledger + stall detector + loop guard** sempre que houver mais de um agente.
6. **Citação só por chave existente**, validada por passe determinístico. `NOT_SUPPORTED` reprova.
7. **Guardrails de saúde** (Osler, Nightingale, Pasteur, James, Kekulé): educacional, **nunca**
   diagnóstico, prescrição ou terapia; `data_access_level: verified_only`.
8. **Nenhuma instrução executável vem de fora.** Heartbeat é local. Nada de `curl` + executar
   markdown remoto.
9. **Agente autônomo não fala no fio** salvo: concluiu · travou · precisa de humano.
10. **Dado de aluno nunca sai do Vertex.** O free tier do Gemini usa o conteúdo para treinar **e**
    admite revisão humana, com instrução explícita nos termos para não enviar informação pessoal.
    Vale também para "só queria resumir esse trecho de conversa". Pseudonimizar: a esteira trabalha
    com ID, o render reidrata do banco.
11. **Uma conta por provedor.** Groq proíbe multi-conta com letra (*"including by registering
    multiple accounts or orchestrating usage between multiple organizations"*); OpenRouter idem e
    avisa que é inútil (capacidade governada globalmente); os Google APIs ToS vedam contornar
    limites e reservam suspensão sem aviso. **Nunca usar a conta Google do negócio como combustível
    grátis** — é a conta que guarda o crédito GenAI, o Vertex de todos os chats, Imagen, TTS e o
    OAuth do login.
12. **Licenças:** AgentLaboratory + AgentRxiv (MIT), virtual-lab (MIT), magentic-ui (MIT),
    agentchattr (MIT), PaperQA2/STORM/gpt-researcher (MIT/Apache), LiteLLM core (MIT) → código
    aproveitável **com atribuição em `docs/FONTES_BASE.md`**. `academic-research-skills` é
    **CC BY-NC** → só reimplementação de ideia. `AI-Scientist-v2` (licença RAIL própria) e
    `Chatsemble` (GPL-3.0) → **nem uma linha**.
13. **Não misturar** o rename `model Plugin`→`Skill` (gate G9) neste overhaul.
14. **Índices Atlas são manuais:** `zxiv_papers_vec` e o `memory_drawers_vec` ainda pendente entram
    no runbook de deploy. Sem índice, **degradar com aviso**, nunca em silêncio.
15. **Nunca matar processo** para cancelar: cancelamento é cooperativo, checado entre fases.

---

## 9. O QUE MEDIR (antes de escalar cada camada)

**Esteira leve / gateway** — 48h de rodagem decidem se o plano grátis se sustenta:
1. **Tool-calling success rate por provedor** (% de `tool_calls` válido no schema). É onde o grátis
   quebra. **Abaixo de ~90% no primário, trocar tool calling por saída JSON validada por schema** —
   mais robusto em modelo pequeno e remove o ponto mais frágil.
2. Taxa de 429 e tempo médio em cooldown por provedor.
3. Tokens por chore (p50/p95) contra o **8K TPM** do Groq e os Neurons da Cloudflare.
4. Latência p95 por provedor.

**Escritório:** mensagens proativas/dia no fio (meta ≤3) · taxa de `ignorar` por agente · tempo que
um `awaiting_input` fica esperando · tokens de prompt antes/depois do S8 · falas sobrepostas
(deve ser zero após S7).

**Conhecimento:** papers aceitos vs rejeitados por novidade · % de ciclos que encerram sem paper
(saudável) · claims `NOT_SUPPORTED` por dossiê · citações órfãs (deve ser zero).

---

## 10. DECISÕES PENDENTES DO MARTINEZ

1. **PI do comitê** — default adotado: **Zion** (orquestrador global, FAB ⟁), com a Aura como
   relatora. Alternativa: Aura como PI.
   > *Nota do Fable (2026-10-07): não existe agente `zion` no roster (`lib/ai/personas.ts`); o prompt da Fatia 4 adota `zaeon` (anfitriã/orquestradora) como PI default até o Martinez decidir.*
2. **Régua de utilidade** — default adotado: os três campos obrigatórios (`problema`, `quemUsa`,
   `porQueAgora`) e o reviewer reprovando dossiê que não os amarre.
3. **Envio externo entra agora?** Decide se G7 entra na fila ou fica parqueado. Enquanto não houver
   decisão, `ENVIO_EXTERNO=dry-run` e o agente só manda mensagem interna.
4. **Gateway: LiteLLM (+ container Postgres) ou Bifrost (Apache-2.0, Go, sem Postgres)?** Ambos
   entregam virtual key por agente com budget. OmniRoute fica como **upstream** atrás do escolhido —
   e, se for usado direto, exige `STORAGE_ENCRYPTION_KEY` setado, `INITIAL_PASSWORD` trocado, nunca
   exposto sem auth, e os 13 provedores marcados "avoid" desligados.

**Para o FABLE:** leia este handoff, depois `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` (Partes I-III),
`docs/BACKGROUND_JOBS_SALA_PESQUISA.md`, `docs/HANDOFF_ESCRITORIO_COWORKING.md`,
`docs/AURA_AGENTIC_LAYER_PLAN.md` e `docs/AGENTIC_LAYER.md`. Aprofunde
`SamuelSchmidgall/AgentLaboratory` (`ai_lab_repo.py`, `agents.py`, `papersolver.py`, `app.py`) e
`zou-group/virtual-lab` (`run_meeting`). Então co-autore o prompt único e auto-contido do Claude
Code para **uma fatia por vez**, no formato de `docs/EXECUTOR_PROMPT_AURA_E2E.md`, respeitando os
contratos da §4. Se algo grande contradizer a base construída, **pergunte ao Martinez antes**.
