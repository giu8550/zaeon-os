# Prospecção — agentes autônomos, colaborativos e proativos (2026-10-02)

> **Pedido do Martinez:** hoje no escritório `@enfermagem` responde no próprio fio. O fluxo
> correto é: humano pede → agente avisa que está trabalhando → **barra de progresso na sala** →
> agente tem tempo de produzir o documento → documento aparece na Sala de Pesquisa → agente avisa
> e a barra termina. Depois: agentes conversando **entre si** e produzindo conhecimento sem ordem
> humana. Este doc é a **prospecção de repos** que serve de base para isso — não é plano de obra.

---

## 1. Diagnóstico — por que o Nightingale respondeu no chat

Não é bug de prompt, é **falta de um tipo de trabalho**. O canal só conhece *turno*:

- `app/api/canal/[id]/mensagem` → `parseMentions` (`lib/canal/mention.ts`) → `dispararTurno`
  (`lib/canal/queue.ts`, fila `canal-turnos`, `jobId = canalId:agentKey:mensagemId`) →
  `executarTurno` (`lib/canal/agent-turn.ts`) → `runTrajectory` → publica **`EV_MENSAGEM`** no
  Pusher e grava `CanalMensagem`. Fim.
- Os dois únicos eventos do canal (`lib/canal/realtime.ts` / `wire.ts`) são `mensagem` e
  `agente-digitando`. **Não existe evento de tarefa, nem de progresso.** "Digitando" é o máximo
  de feedback que a sala sabe dar — daí a resposta sair inteira no fio.
- O harness já tem as fases (`Phase = route|plan|gather|reason|draft|critique|finalize` em
  `lib/agent/trajectory.ts`) e já existe serialização de progresso
  (`lib/agent/progresso.ts`, `PROGRESS_SENTINEL = "@@PROGRESS@@"`) — mas isso só é consumido pelo
  chat de estudos (`separarProgresso`/`faseCorrente` no `StudyCoworkChat.tsx`), **não pelo canal**.
- O padrão de trabalho longo **já existe e funciona** na Sala de Pesquisa:
  `docs/BACKGROUND_JOBS_SALA_PESQUISA.md` — `ScholarSession` como fonte da verdade, fila
  `scholar` (BullMQ), `thread.events` por fase, cliente pollando a cada 1,5s, `reapStuckJobs`
  com `STUCK_MS = 15min`. `VoiceJob` até tem `progress Int @default(0)`.
- A tool que produz o documento **já está registrada**: `research_generate` (`lib/agent/tools.ts`
  + registry em `lib/agent/runtime.ts`), que grava `ResearchWork` (`tccStatus`), e
  `studio_generate` → `StudioArtifact`. `literature_search` e `examiner` são **stubs**
  (`skill_offline` / `not_implemented`) — é aí que a busca na internet morre e o Nightingale diz
  "as ferramentas de busca não trouxeram evidências".

**Resumo honesto:** falta (a) um **model de tarefa de canal** com progresso, (b) um **evento
Pusher de tarefa**, (c) ligar `research_generate` ao canal, e (d) tirar `literature_search` do
stub. Nenhuma peça de infra nova é necessária — BullMQ, Redis, Pusher, poll e reaper já estão lá.

---

## 2. Eixo A — pedido → "estou trabalhando" → progresso → artefato

O padrão convergente nos quatro repos abaixo é sempre o mesmo: **handle imediato → estado durável
fora do request → canal de progresso separado → evento de conclusão injetado como nova mensagem →
artefato por referência, nunca payload inline.**

| Repo | Licença | O que pegar |
|---|---|---|
| **NousResearch/hermes-agent** — `delegate_task(..., background=true)`, dispatch em `tools/delegate_tool.py`; transcript ao vivo em arquivo por `delegation_id`; eventos de conclusão **drenados e injetados como nova mensagem** no chat (`gateway/run.py`) | MIT | O desenho exato do pedido do Martinez. **Subagente recebe conversa fresca; só o resumo final volta pro pai.** E o **stall detector por progresso (450s idle / 1200s dentro de tool)** → evento `stalled`. Copiar os thresholds. |
| **collaby-org/deer-flow** (fork do bytedance/deer-flow) — harness de tarefas de horas: sandbox, memória, skills, subagentes, *message gateway* | MIT | **Lease cross-worker** (`leaseOwner` + `leaseExpiresAt`) impedindo dois workers na mesma tarefa; **delivery receipt gravado ANTES de marcar `completed`**; resultado inline limitado (~64 KiB), resto é handle. |
| **pydantic/pydantic-ai-harness** (issue #38, ainda não implementado) | MIT | Checklist de API: `run_background()` → handle; `task.status()`, `task.usage()`, `task.result()`, `task.cancel()`. Bom contrato para a nossa rota. |
| **langchain-ai/agent-inbox** (Next.js/TS) · **trigger.dev** · **inngest/agent-kit** · **vercel/resumable-stream** | MIT / Apache-2.0 | `agent-inbox`: UX de "o agente precisa de você" sem guardar estado. `trigger.dev`: **run metadata** atualizada durante o run e consumida no front (é a barra de progresso). `resumable-stream`: produtor continua mesmo se o leitor cai (Redis pub/sub) — resolve "fechei a aba, a barra tem que voltar". |

**O que isso vira aqui (sem infra nova):** `CanalTarefa` no Mongo (`status: queued|running|
awaiting_input|done|failed|cancelled`, `progress`, `steps[]` append-only, `artifactRef`,
`cancelRequested`, `lease*`, `idempotencyKey` no estilo do `jobIdDe`), novo evento Pusher
`tarefa` ao lado de `mensagem`/`agente-digitando`, e poll de fallback como o do `ScholarSession`.
Barra de progresso = fases previstas do `Phase` do harness, não percentual real — é honesto e já
existe. **Regra de ouro dos quatro repos: grave o artefato antes de marcar `done`.**

---

## 3. Eixo B — agentes conversando entre si

| Repo | Licença | Mecanismo / o que pegar |
|---|---|---|
| **zou-group/virtual-lab** (Stanford, *Nature* 2025 — nanobodies SARS-CoV-2) | MIT | **A melhor referência para mentores por domínio.** `run_meeting(meeting_type, agenda, agenda_questions, agenda_rules, team_lead, team_members, summaries, num_rounds)`: ordem **fixa** (zero seleção de falante), cada membro fala uma vez por rodada e pode dizer "pass", o **PI sintetiza e decide** ao fim de cada rodada, e a **rodada final só com o PI** produz o artefato em formato fixo (*Agenda / Team Member Input / Recommendation / Answers / Next Steps*). Histórico = uma lista linear compartilhada. Loop é impossível (rodadas finitas) e o `summary` alimenta a reunião seguinte = memória grátis. Reunião individual = agente + `SCIENTIFIC_CRITIC` alternando. |
| **microsoft/magentic-ui** / Magentic-One | MIT | **Progress Ledger** reavaliado a cada passo com 4 perguntas: *completou? houve progresso? estamos em loop? quem fala agora e com qual instrução?* Estagnação acima do limiar devolve ao loop externo para **re-planejar**. + **Task Ledger** editável = co-planning com o humano, e **action guards**. É o freio contra custo explosivo — um JSON pequeno por turno, Gemini Flash dá conta. |
| **a2aproject/A2A** (Linux Foundation, spec v1.0, SDK `@a2a-js/sdk`) | Apache-2.0 | Não porte o protocolo: porte o **modelo de dados**. `AgentCard` (skills, capabilities, security) = um doc por mentor; e a máquina de estados `submitted → working → input-required → completed/failed/canceled`. **`input-required` é exatamente "o agente precisa do humano"** — encaixa no `awaiting_input` do Eixo A. |
| **ag2ai/ag2** (ex-AutoGen; v1.0 **removeu** GroupChat/Swarm) | Apache-2.0 | **Canais tipados** em vez de "todos ouvem tudo": `Conversation` (dois), **`Consulting` (pergunta→resposta, auto-fecha — mata loop por construção)**, `Discussion` (round-robin), `Workflow` (grafo de transição). Hub com *write-ahead log* ≈ coleção append-only. ⚠️ `microsoft/autogen` está em **modo manutenção** — não construir sobre ele. |
| **bcurts/agentchattr** | MIT | Agentes se `@mencionam` e o servidor **auto-dispara o alvo**; **loop guard por canal: pausa após N trocas agente↔agente, mas menção humana sempre passa e reseta.** É literalmente o guarda que falta no nosso `parseMentions`. |
| **FoundationAgents/MetaGPT** · **OpenAI Agents SDK** · **camel-ai/camel** | MIT / Apache-2.0 | MetaGPT: **message pool publish/subscribe** — cada papel *assina* tipos de mensagem e só reage ao que lhe interessa (escala sem N² de atenção). Agents SDK: handoff **é uma tool** (`transfer_to_<agent>`) com filtro de histórico + `max_turns`. CAMEL: padrão **"AI User"** — um agente faz o papel de quem pede, que é o que permite conversa sem humano. |
| **Alwurts/Chatsemble** | **GPL-3.0 ⛔** | Arquitetura parecidíssima com a nossa (agentes como membros da sala, `@mention`, threads, workflows agendados postando progresso na thread). **Ler para inspiração, não copiar código.** |

**Porte recomendado:** reunião do `virtual-lab` (é um `for` sobre turnos, cabe em TypeScript numa
tarde) rodando **em thread própria do canal**, não no fio principal; Progress Ledger como freio;
loop guard do `agentchattr`; `AgentCard` por mentor.

---

## 4. Eixo C — pesquisar na internet e entregar documento

| Repo | Licença | Mecanismo / o que pegar |
|---|---|---|
| **Future-House/paper-qa (PaperQA2)** | Apache-2.0 | **Antialucinação de citação, a melhor da lista.** `SearchPapers → GatherEvidence → GenerateAnswer`; cada trecho recuperado vira um *context* com **chave de citação sintética própria** (`pqac-…`) e o modelo **só pode citar chaves que existem**; resumos pontuados, re-ranqueados, com *cutoff* que descarta evidência fraca. Portável 100% em TS. Isto é o que o `examiner` deveria checar. |
| **stanford-oval/storm** (Co-STORM) | MIT | *Perspective discovery* → **conversas simuladas escritor↔especialista** (cada pergunta dispara retrieval) → outline hierárquico → **escrita seção-a-seção só com os documentos em mãos** → polimento. Co-STORM = moderador + especialistas + humano no turno + mind map. Retrievers plugáveis (`rm.py`) — nossos conectores arXiv/PubMed/OpenAlex entram aí. **Melhor molde para TCC/artigo.** |
| **langchain-ai/open_deep_research** (⚠️ **arquivado 21/08/2026**; sucessor `langchain-ai/deepagents`) | MIT | Quatro fases: *scoping* (brief escrito como contrato) → *research* (N sub-agentes paralelos com **contexto isolado**) → **compression** (cada sub-agente comprime antes de devolver) → relatório. Custo medido ~US$0,50–1,90/relatório. |
| **assafelovic/gpt-researcher** | Apache-2.0 | Planner → crawlers que **resumem já com a fonte amarrada ao chunk** → publisher. Exporta PDF/DOCX/MD. ~US$0,40 e ~5min por consulta no modo deep. |
| **SamuelSchmidgall/AgentLaboratory** | MIT | **Máquina de 7 fases nomeadas** (literature review → plan → data prep → experiments → interpretation → report writing → refinement) com **co-pilot mode: humano aprova cada fase**. O único da ciência autônoma de onde se *pode* copiar código. |
| **AutoSurveys/AutoSurvey** | MIT | Outline sobre ~1.500 referências, subseções em paralelo, RAG de ~60 refs por seção. Molde direto para **revisão de literatura / TCC**. |
| **lamm-mit/SciAgentsDiscovery** | Apache-2.0 | **Caminho aleatório em grafo de conhecimento** como semente de originalidade + papel explícito de *Ontologist*. Mongo serve de store do grafo. |
| **snap-stanford/Biomni** | Apache-2.0 (auditar deps) | **Retrieval-augmented planning: recupera a ferramenta certa por embedding antes de planejar.** Aplicável direto ao nosso MCP client com muitos conectores. |
| **dzhng/deep-research** | MIT | <500 linhas de **TypeScript** (Firecrawl + AI SDK). Ler como referência de arquitetura TS. Citação fraca (URLs no fim). |
| **SakanaAI/AI-Scientist-v2** | ⛔ **licença própria estilo RAIL** | Restrições de uso **virais a jusante** (inclui declarar manuscrito gerado por máquina). **Não copiar código.** Pegar só as ideias: *agentic tree search* sobre tentativas e **reviewer agent como gate de qualidade**. |
| **tsinghua-fib-lab/Awesome-AI-Scientists** | MIT | Survey-mapa para achar o que falta (ideation, experimentos, avaliação). |

**Combinação recomendada, toda em TypeScript, sem microserviço Python:** fases do
open_deep_research (brief → sub-agentes isolados → compressão → escrita) + perspectivas/outline do
STORM + **citação por chave do PaperQA2** + gate humano por fase do AgentLaboratory + reviewer
agent (o nosso `examiner`, hoje stub) como porteiro. Python só seria necessário para **executar
código/experimentos** — não é o caso de "documento como entregável".

---

## 5. Eixo D — proatividade (agir sem ordem)

| Repo / fonte | Licença | Mecanismo / o que pegar |
|---|---|---|
| **thunlp/ProactiveAgent** (ICLR 2025) | Apache-2.0 | Gatilho por **stream de eventos**, não por tempo. **Reward model** filtra a proposta antes de incomodar (F1 0,918 vs 0,67 do GPT-4o). **Taxonomia de 4 estados — *correct-detection, false-alarm, missed-needed, non-response* — é o ativo mais reutilizável.** UI com Aceitar/Rejeitar/**Ignorar**, e ignorar reduz a frequência futura. ⚠️ dados gerados com GPT-4o (restrição de termos para treino). |
| **leomariga/ProactiveAgent** | BSD-3 | Ciclo: avaliar → gerar → **calcular o próprio sono**. `min_response_interval`/`max_response_interval` (30–600s) limitam fala **e** chamadas de API. → vira `delay`/`repeat` + jitter no BullMQ, com `jobId` idempotente. |
| **joonspk-research/generative_agents** (Smallville) | Apache-2.0 (⚠️ **arte de terceiros, não redistribuir assets**) | Memory stream com recuperação **recência × importância × relevância**; **reflection disparada por acumulação de importância** (cruza o limiar → o agente para e sintetiza insights); daily plan top-down replanejado ao observar algo novo. A reflection é o gatilho natural de "virar documento". |
| **camel-ai/oasis** · **microsoft/TinyTroupe** · **sotopia-lab/sotopia** · **OpenBMB/AgentVerse** | Apache-2.0 / MIT | OASIS: **activation probability por timestep** + tabela de custo linear. TinyTroupe: **tracking de custo em 3 níveis + cache de chamadas + checkpoints** (o mais maduro em custo). Sotopia: **objetivo social próprio** como motor da ação. AgentVerse: recrutar especialistas → executar → avaliador → re-executar. |
| **sunnweiwei/PPP-Agent** | Apache-2.0 | RL em Produtividade+Proatividade+Personalização, com **custo de interação dentro da recompensa** — formaliza "perguntar demais derruba o score". Treino não é portável. |
| **arXiv 2605.30152** | paper | *Agentes proativos precisam de LLM para decidir quando acordar?* **Não.** Um modelo pequeno de grafo temporal dá probabilidade de gatilho por evento, +16,7 F1 e limiar mais estável; o LLM entra só depois. Lição: **gating em dois estágios** (estágio 1 barato e determinístico). |

**Porte recomendado:** gating em 2 estágios (score determinístico em TS sobre uma coleção de
eventos → só acima do limiar chama Gemini), taxonomia de 4 classes como juiz + registro de
Aceitar/Rejeitar/**Ignorar** recalibrando o limiar por mentor e por sala, reflection por limiar de
importância (reusa `MemoryDrawer.importance`, que já existe), **token bucket no Redis por sala**,
e **canal silencioso**: por padrão o mentor proativo **escreve documento/digest em vez de falar**
na sala; só acima de limiar alto ele fala. Conversa mentor↔mentor em thread própria, nunca no fio
principal.

---

## 6. Licenças — o mapa rápido

- **Pode copiar código (MIT/Apache/BSD):** hermes-agent, deer-flow, A2A + `@a2a-js/sdk`, AG2,
  virtual-lab, magentic-ui, agentchattr, MetaGPT, CAMEL, PaperQA2, STORM, gpt-researcher,
  open_deep_research, AgentLaboratory, AutoSurvey, SciAgents, Biomni (auditar deps),
  dzhng/deep-research, ProactiveAgent (thunlp e leomariga), generative_agents (código),
  OASIS, TinyTroupe, Sotopia, AgentVerse, agent-inbox, agent-kit, resumable-stream.
- **⛔ Não copiar:** `SakanaAI/AI-Scientist-v2` (licença própria estilo RAIL, restrições virais),
  `Alwurts/Chatsemble` (GPL-3.0), assets de arte do Smallville, pesos/datasets (licença do
  modelo base ≠ licença do repo).
- **Mortos/arquivados — ler, não adotar:** `langchain-ai/open_deep_research` (arquivado),
  `btahir/open-deep-research` (arquivado), `microsoft/autogen` (manutenção), GroupChat/Swarm
  clássicos do AutoGen (removidos no AG2 v1.0).

---

## 7. Ordem de adoção (passo a passo, como o Martinez pediu)

**Fatia 1 — colaboração dentro do escritório (a barra de progresso).**
`CanalTarefa` + evento Pusher `tarefa` + poll de fallback; `@mentor` com pedido longo vira tarefa
em vez de turno; mensagem curta "estou trabalhando nisso" no fio; progresso pelas fases do
`Phase`; `research_generate` grava `ResearchWork` → aparece na Sala de Pesquisa; mensagem de
conclusão com link do artefato; `cancelRequested` cooperativo; stall detector por
`lastProgressAt`. **Pré-requisito real:** tirar `literature_search` do stub — sem busca, o
documento nasce vazio (foi o que aconteceu com o Nightingale).

**Fatia 2 — agentes conversando entre si.**
Reunião estilo `virtual-lab` em thread própria: pauta + perguntas + regras, ordem fixa, "pass"
permitido, um mentor como PI sintetizando cada rodada, rodada final gerando o documento nas 5
seções. Canais tipados do AG2 (`Consulting` auto-fechado para "mentor pergunta a mentor"). Loop
guard do agentchattr (N trocas agente↔agente; menção humana reseta). Progress Ledger a cada turno.
`summary` da reunião vira `MemoryDrawer` e alimenta a próxima.

**Fatia 3 — autonomia fora do escritório.**
Gating em 2 estágios sobre eventos; reflection por importância acumulada; BullMQ como "sleep
calculator"; orçamento de tokens por sala/dia checado **antes** do enqueue; canal silencioso por
padrão; taxonomia de 4 classes + Ignorar recalibrando o limiar.

---

## 8. Guardrails de custo (consolidado dos quatro eixos)

1. Rodadas **finitas** sempre (virtual-lab) — nunca "até resolver".
2. Progress Ledger com `is_in_loop` + contador de estagnação (MagenticLite).
3. Contexto **isolado** por sub-agente + **compressão** antes de devolver (ODR); conversa fresca e
   só o resumo volta (hermes).
4. Orçamento por sala/dia contado antes do enqueue (OASIS/TinyTroupe) — o `Budget{tokens,ms}` do
   `trajectory.ts` já é o lugar.
5. Token bucket no Redis + digest em vez de mensagem (anti-spam).
6. Artefato por referência (`artifactRef`), nunca payload inline no evento.
7. Gravar artefato **antes** de `done` (delivery receipt).

---

## 9. Fontes

Eixo A: [hermes-agent](https://github.com/NousResearch/hermes-agent) ·
[issue #5586](https://github.com/NousResearch/hermes-agent/issues/5586) ·
[deer-flow](https://github.com/collaby-org/deer-flow) ·
[pydantic-ai-harness #38](https://github.com/pydantic/pydantic-ai-harness/issues/38) ·
[agent-inbox](https://github.com/langchain-ai/agent-inbox) ·
[trigger.dev](https://github.com/triggerdotdev/trigger.dev) ·
[agent-kit](https://github.com/inngest/agent-kit) ·
[resumable-stream](https://github.com/vercel/resumable-stream)

Eixo B: [virtual-lab](https://github.com/zou-group/virtual-lab) ·
[magentic-ui](https://github.com/microsoft/magentic-ui) ·
[A2A](https://github.com/a2aproject/A2A) · [a2a-js](https://github.com/a2aproject/a2a-js) ·
[AG2](https://github.com/ag2ai/ag2) · [agentchattr](https://github.com/bcurts/agentchattr) ·
[MetaGPT](https://github.com/FoundationAgents/MetaGPT) ·
[camel](https://github.com/camel-ai/camel) · [Chatsemble](https://github.com/Alwurts/Chatsemble)

Eixo C: [paper-qa](https://github.com/Future-House/paper-qa) ·
[storm](https://github.com/stanford-oval/storm) ·
[open_deep_research](https://github.com/langchain-ai/open_deep_research) ·
[deepagents](https://github.com/langchain-ai/deepagents) ·
[gpt-researcher](https://github.com/assafelovic/gpt-researcher) ·
[AgentLaboratory](https://github.com/SamuelSchmidgall/AgentLaboratory) ·
[AutoSurvey](https://github.com/AutoSurveys/AutoSurvey) ·
[SciAgentsDiscovery](https://github.com/lamm-mit/SciAgentsDiscovery) ·
[Biomni](https://github.com/snap-stanford/Biomni) ·
[dzhng/deep-research](https://github.com/dzhng/deep-research) ·
[AI-Scientist-v2](https://github.com/SakanaAI/AI-Scientist-v2) ·
[Awesome-AI-Scientists](https://github.com/tsinghua-fib-lab/Awesome-AI-Scientists)

Eixo D: [thunlp/ProactiveAgent](https://github.com/thunlp/ProactiveAgent) ·
[leomariga/ProactiveAgent](https://github.com/leomariga/ProactiveAgent) ·
[generative_agents](https://github.com/joonspk-research/generative_agents) ·
[oasis](https://github.com/camel-ai/oasis) · [TinyTroupe](https://github.com/microsoft/TinyTroupe) ·
[sotopia](https://github.com/sotopia-lab/sotopia) ·
[AgentVerse](https://github.com/OpenBMB/AgentVerse) ·
[PPP-Agent](https://github.com/sunnweiwei/PPP-Agent) ·
[arXiv 2605.30152](https://arxiv.org/abs/2605.30152) ·
[arXiv 2602.04482](https://arxiv.org/abs/2602.04482)

Docs internos relacionados: `BACKGROUND_JOBS_SALA_PESQUISA.md`, `HANDOFF_ESCRITORIO_COWORKING.md`,
`AURA_AGENTIC_LAYER_PLAN.md`, `AGENTIC_LAYER.md`, `FABLE_RESEARCH_BRIEF.md`.

---
---

# PARTE II — OVERHAUL: Zaeon como ambiente de produção de conhecimento agêntico

> **Atualização 2026-10-03, direção do Martinez.** A Parte I prospectou. Esta parte é o **plano de
> execução em PRs** para o FABLE → Claude Code. Objetivo declarado: *agentes autônomos de verdade,
> que conversam entre si, pesquisam na internet, orquestram eventos — com um único fim: **produzir
> conhecimento útil para os tempos atuais**.* No admin se dá um tópico ("sistema aquífero de baixo
> custo para regiões de extremo calor") e os agentes têm **rotina diária** de pesquisa, prospecção
> e construção. Não output imediato. Não resposta crua. Não documento com planejamento vago: uma
> **pesquisa completa**, com materiais, desdobramentos e implicações — inclusive onde **o humano
> precisa entrar**. A vitrine disso vive numa aba **Projetos**, em cards; o debate vive no
> **Escritório**.

## Índice

| Onda | PR | Título | Flag |
|---|---|---|---|
| 0 — medir e nomear | **PR-A1** | Telemetria real de tokens (ponto único de captura) | — (sempre on, write best-effort) |
| | **PR-A2** | Aba Plugins → **Mentores** | `NEXT_PUBLIC_MENTORES_TAB` |
| | **PR-A3** | Admin: gasto de tokens por agente | `NEXT_PUBLIC_AGENTS_ADMIN` (já existe) |
| 1 — trabalho de verdade | **PR-A4** | `AgentTask`: pedido → "trabalhando" → progresso → artefato | `CANAL_TAREFAS` |
| | **PR-A5** | `literature_search` real + citação por chave + `examiner` | `LIT_SEARCH`, `EXAMINER` |
| 2 — agentes entre si | **PR-A6** | Reunião de agentes (comitê) no Escritório | `CANAL_REUNIAO` |
| | **PR-A7** | **Zaeon Rxiv** — mural de preprints dos agentes | `ZXIV` |
| 3 — autonomia | **PR-A8** | `ResearchProgram` + rotina diária (1º scheduler do repo) | `PROGRAMA_SCHED` |
| | **PR-A9** | Pipeline das 7 fases (Agent Laboratory portado) | `PROGRAMA_PIPELINE` |
| | **PR-A10** | Dossiê: materiais, desdobramentos, implicações, passaporte | — (parte do A9) |
| | **PR-A11** | Vitrine **Projetos** (cards com imagem) | `NEXT_PUBLIC_VITRINE` |
| | **PR-A12** | Admin: criar programa, aprovar gates, kill-switch | `NEXT_PUBLIC_PROGRAMA_ADMIN` |

Regra do repo que vale para todos: **flag off por padrão**; merge não muda nada até ligar.

---

## II.0 — As referências que o Martinez passou, destiladas

**`SamuelSchmidgall/AgentLaboratory` + AgentRxiv — MIT, mesmo repo.** Os dois são a espinha deste
overhaul, e dá para copiar código.

- **As 7 fases exatas** (strings reais em `ai_lab_repo.py`): `"literature review"` →
  `"plan formulation"` → `"data preparation"` → `"running experiments"` →
  `"results interpretation"` → `"report writing"` → `"report refinement"`.
- **6 papéis** (`agents.py`): `PhDStudentAgent`, `PostdocAgent`, `ProfessorAgent`,
  `MLEngineerAgent`, `SWEngineerAgent`, `ReviewersAgent`. São **só system prompts + conjunto de
  comandos permitidos** — um provedor único (Gemini) basta.
- **`papersolver.py`** — o loop que vale ouro: comandos `PaperReplace` / `PaperEdit N M` /
  `Arxiv`, scaffold fixo de 8 seções (Abstract, Introduction, Background, Related Work, Methods,
  Experimental Setup, Results, Discussion), **só aceita a edição se o score melhorar**, guarda
  `top_score` e `best_report`. Score por LLM-juiz num JSON com Originality, Quality, Clarity,
  Significance, Soundness, Presentation, Contribution, Overall, Confidence, Decision —
  **pesos: contribution 0.4, presentation 0.2, resto 0.1**.
- **`mlesolver.py`** — mesmo padrão (`Replace` / `Edit N M`), `get_score()` 0–1, `best_codes`
  com `pop(-1)` do pior, `reflect_code()` por "generalizable insights". ⚠️ executa Python em
  subprocess com timeout 600s → **não portar; isolar como tool MCP** (ver PR-A9 §experimentos).
- **Co-pilot mode** — `copilot_mode: "true"` liga `human_in_loop_flag` nas **7 fases**; ao fim de
  cada uma pergunta `"Are you happy with the presented content? Respond Y or N"`, e o `N` anexa
  feedback em `self.notes = [{"phases": [...], "note": ...}]`, que reinicializa os agentes.
  **Papers em co-pilot: 3,8/10 → 4,38/10.** É o nosso gate de aprovação por fase, e ele *mede*.
- **Custo medido**: GPT-4o US$ 2,33 e ~1.165s por paper; o1-preview US$ 13,10.
- **AgentRxiv** é um **Flask de ~200 linhas** (`app.py`, SQLite, sem auth, porta `5000+lab_index`).
  Rotas: `/upload`, `/search`, **`/api/search` (JSON)**, `/view/<id>`, `/update`. O model `Paper`
  tem **3 campos**: `id`, `filename`, `text`. Submissão = `shutil.copyfile` do PDF para `uploads/`.
  Busca = `SentenceTransformer('all-MiniLM-L6-v2')` + `cosine_similarity`, **sem top-N**. O agente
  busca via `search_agentrxiv()` e os achados entram na revisão de literatura com id
  `"AgentRxiv:ID_{id}"`.
- **O resultado que justifica tudo:** MATH-500 **70,2% → 78,2%** com AgentRxiv (+11,4% relativo);
  **sem** o servidor estagna em ~73,5%. Com **3 labs em paralelo** compartilhando o mesmo mural:
  **79,8%**, e o marco de 76,2% cai de **23 papers para 7**. Transferência cross-domain +3,3%
  (GPQA, MMLU-Pro, MedQA). Custo US$ 3,11/paper, ~1,36h.
  **Tradução para nós: o mural compartilhado é o multiplicador. Não é enfeite — é o mecanismo.**
- **Fraquezas do original que NÃO herdamos:** sem auth, sem rate-limit, sem versionamento, **sem
  citação explícita entre papers**, sem dedup (o próprio paper relata agentes reescrevendo a mesma
  ideia), `max_codes=1` matando diversidade, e o caminho de *parallel labs* no código público
  levanta `NotImplementedError("Todo: implement parallel labs")`. Nosso `Zxiv` nasce com
  `parentPaperIds`, embedding Vertex e **score de novidade antes de aceitar a submissão**.

**`Moltbook-Official` — MIT, mas é só documentação.** Seja dito com honestidade: 2 repos, ~105 KB
(93 KB é o logo), parado desde 31/01/2026, zero código de servidor. O valor está no **protocolo
social**, em `skill.md` / `heartbeat.md` / `messaging.md`:

- **Identidade com dono humano:** `POST /agents/register` devolve key; o agente fica
  `pending_claim` **até um humano reivindicar a conta**. → *mentor sem dono não age.*
- **Mural com threading** (`parent_id`), feed `new|hot|top`, e **busca semântica em linguagem
  natural** como descoberta.
- **Rate limit como regra de qualidade:** 1 post/30min, 1 comentário/20s, teto 50/dia. → força
  síntese em vez de tagarelice. Copiar o espírito.
- **DM com consentimento:** request → aprovação do humano dono → conversa livre, e flag
  **`needs_human_input: true`** para o agente escalar ao humano. → é o nosso "preciso de você".
- **Heartbeat:** cron de 4h que faz `curl` do `heartbeat.md` e **executa markdown remoto como
  instrução**. ⚠️ Isso é prompt injection by design. **Não plugar a zaeon em moltbook.com.**
  Copiamos o conceito de relógio do agente; o conteúdo do heartbeat é **nosso e local**.
- Descartar: upvote/downvote, karma, hot/top, DM como produto.

**`Imbad0202/academic-research-skills` — ⛔ CC BY-NC 4.0.** Repo grande e maduro (4 SKILL.md
somando ~218 KB; `deep-research` com 13 agentes e 8 modos incl. systematic-review PRISMA;
`academic-pipeline` com 10 estágios e checkpoints). **NonCommercial é incompatível com a Zaeon
paga: não copiar arquivo, não dar fork comercial.** Reimplementar três ideias, que são as melhores:
**integrity gate** (classificar cada claim `ALIGNED` / `OVERSTATED` / `NOT_SUPPORTED`),
**Material Passport** (manifesto de fontes anexado ao artefato) e **`data_access_level`** por
agente (`raw` / `redacted` / `verified_only`).

**`oxbshw/watch-skill` — MIT, mas não é o que o nome sugere.** "watch" é **assistir vídeo**
(frames + OCR + transcrição Whisper), não vigiar tópico: zero ocorrência de `cron|poll|rss|feed|
monitor` no README. Dois padrões aproveitáveis, ambos bons: **veredito determinístico fora do LLM**
com **quatro** estados — `VERIFIED` / `FAILED` / `UNVERIFIED` / `INCONCLUSIVE` (porque "não sei" ≠
"não") — e **THE LOOP** observe→critique→fix→verify com **diff contra a run anterior**, que é
exatamente a semântica de "acordar só quando mudou". Mais `receipts` (recibo por tool call).

---

## II.1 — Decisões de produto tomadas aqui (e as 2 que precisam do Martinez)

**Tomadas (default adotado, pode vetar):**

1. **Conflito do nome "Projetos".** A aba `projetos` **já existe** e é o Zaeon Code — IDE no
   navegador com Monaco, clone de repo via GitHub App e deploy (`app/research-lab/projects/
   ProjectsContent.tsx`, ~1100 linhas, gating por curso em `lib/projects/access.ts`). Solução de
   menor dano: a **vitrine nasce como aba nova de key `producao` com label "Projetos"**, e a aba
   antiga **mantém a key `projetos`** (deep-links e o card da loja em
   `app/plugin-store/page.tsx:56` continuam valendo) **trocando só o label visível para "Zaeon
   Code"**. Com `NEXT_PUBLIC_VITRINE` off, nem o label muda.
2. **Plugins → Mentores é rename de UI/rota, não de schema.** `model Plugin`
   (`prisma/schema.prisma:267`) **fica**. O rename `Plugin`→`Skill` é o gate G9 declarado em
   `docs/MASTER_HARNESS_ACTIVATION.md:26` e segue sendo PR separado — **não misturar com este
   overhaul.**
3. **Mentor sem dono humano não age autonomamente** (Moltbook claim). Programa autônomo tem sempre
   um `ownerId` humano responsável.
4. **Agente só fala na sala quando tem o que dizer.** O default do agente autônomo é **escrever no
   Zxiv / atualizar o card**, não postar no fio. Fala na sala em três casos: concluiu, travou, ou
   precisa de humano (`needs_human_input`).

**Precisam do Martinez (não bloqueiam o PR-A1..A5):**

- **Quem é o PI do comitê?** O `Zion` já é o orquestrador global (FAB ⟁) e cabe no papel de
  Principal Investigator das reuniões. Alternativa: a `Aura`. *Default adotado: Zion como PI,
  Aura como relatora.*
- **A régua de utilidade.** "Conhecimento útil para os tempos atuais" precisa virar critério
  verificável, senão é subjetivo e o reviewer não reprova nada. *Default adotado: todo programa
  declara, no admin, três campos obrigatórios — **problema real**, **quem usa o resultado**,
  **por que agora** — e o reviewer reprova paper que não amarre a conclusão a esses três.*

---

## II.2 — Arquitetura-alvo em uma tela

```
ADMIN (PR-A12)                         ESCRITÓRIO (PR-A4/A6)            VITRINE "Projetos" (PR-A11)
┌──────────────────────┐               ┌───────────────────────┐        ┌────────────────────────┐
│ novo ResearchProgram │               │ @mentor pede algo     │        │ card: imagem Imagen    │
│  tópico + problema   │               │  → AgentTask          │        │ título · fase · barra  │
│  quem usa · por quê  │               │  → barra de progresso │        │ nº de papers · fontes  │
│  orçamento de tokens │               │  → "pronto: <link>"   │        │ "precisa de humano" ⚠ │
└─────────┬────────────┘               └──────────┬────────────┘        └───────────┬────────────┘
          │                                       │                                 │
          ▼                                       ▼                                 ▼
   ┌─────────────────────────────────────────────────────────────────────────────────────────┐
   │  ROTINA DIÁRIA (PR-A8)  BullMQ repeatable "programa-ciclo" — 1 ciclo/dia por programa   │
   │  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
   │  │ PIPELINE DAS 7 FASES (PR-A9) — lib/programa/pipeline.ts                           │  │
   │  │ lit review → plan → materiais → execução → interpretação → redação → refino       │  │
   │  │   ↑ gate humano opcional por fase (co-pilot do Agent Laboratory)                   │  │
   │  │   ↑ REUNIÃO DE COMITÊ (PR-A6) nas fases plan e interpretação                       │  │
   │  │   ↑ literature_search real + citação por chave (PR-A5)                            │  │
   │  │   ↓ submete no ZAEON RXIV (PR-A7) → próximo ciclo LÊ o que os outros escreveram    │  │
   │  └───────────────────────────────────────────────────────────────────────────────────┘  │
   │  Freios: Progress Ledger · orçamento real de tokens (PR-A1) · rodadas finitas · lease   │
   └─────────────────────────────────────────────────────────────────────────────────────────┘
```

O multiplicador do AgentRxiv (+11,4%, e 23→7 papers com labs em paralelo) só aparece se o **Zxiv
for compartilhado entre programas**. Então `Zxiv` é global, não por programa.

---

## ONDA 0 — medir e nomear

### PR-A1 — Telemetria real de tokens

**Por que primeiro:** hoje **não existe uma única linha** que persista tokens. `AgentUsage`
(`prisma/schema.prisma:1043`) guarda `contagem Int` e `ultimoUso` — uso, não consumo. O grep por
`usageMetadata`, `promptTokenCount`, `candidatesTokenCount`, `totalTokenCount` em `lib/`, `app/`,
`components/` dá **zero**. O que existe é **estimativa heurística em memória**:
`lib/agent/trajectory.ts:36` `Budget`, `BUDGET` por modo (`:79-82` — quick 3k / elaborated 12k /
research 40k) e `COST` fixo por fase (`:84-91` — route 300, plan 1200, gather 400, reason 1500,
draft 1800, critique 1500, finalize 200), somados em `st.spent.tokens` (`:120`) e nunca gravados.
Sem isso, o admin que o Martinez pediu é ficção e o orçamento do programa autônomo não tem freio.

**Fazer:**
1. Achar o(s) ponto(s) onde o Vertex é chamado (`lib/ai/*` — `model.ts`, `router.ts`, e o
   `genJson` injetado em `lib/canal/agent-turn.ts`) e **envelopar numa única função** que, além da
   resposta, devolve `usage` lido de `response.usageMetadata` (`promptTokenCount`,
   `candidatesTokenCount`, `cachedContentTokenCount`, `totalTokenCount`). Um só lugar — se houver
   dois caminhos de chamada, unificar antes.
2. Novo model `TokenLedger` (`@@map("token_ledger")`): `id`, `at`, `userId?`, `agentKey`,
   `mentorSlug?`, `surface` (estudos|pesquisa|canal|programa|aula|projetos), `scopeId?`,
   `programId?`, `taskId?`, `phase?` (o `Phase` do harness), `model`, `promptTokens`,
   `completionTokens`, `cachedTokens`, `totalTokens`, `estimatedCostUsd`, `ok Boolean`.
   Índices: `[agentKey, at]`, `[userId, at]`, `[programId, at]`, `[at]`.
3. Escrita **best-effort** (nunca derruba o turno — mesmo padrão do `registrarUso` em
   `lib/canal/usage.ts:19`). Tabela de preço por modelo em `lib/ai/preco.ts` (constante única,
   editável; marcar claramente que é estimativa).
4. `lib/agent/trajectory.ts`: manter `COST` como **estimativa de pré-voo** (decidir se cabe no
   orçamento antes de gastar) e passar a **reconciliar com o real** ao fim de cada fase —
   `st.spent.tokens` vira soma dos `totalTokens` medidos. `overBudget()` (`:124`) passa a frear
   com número real.
5. Agregações puras e testadas em `lib/metrics/tokens.ts`: `porAgente(range)`, `porUsuario(range)`,
   `porPrograma(range)`, `porDia(range)`, `topN()`.

**Gate:** um turno no escritório e uma busca na sala de pesquisa gravam linhas no `TokenLedger`
com `totalTokens > 0`; `lib/metrics/tokens.ts` tem teste unitário com fixture; o turno continua
respondendo se a escrita falhar (teste com mock que lança).

**Não tocar:** `lib/plans.ts` (quota por plano é outro assunto), `lib/ai/contextCache.ts`.

---

### PR-A2 — Aba Plugins → **Mentores**

**Estado:** a loja **não é aba do research-lab**, é página própria `app/plugin-store/page.tsx`,
com categorias `["Todos","Essencial","Agentes","Mentores"]` (`:69`) e mapeamento de "Mentorias"
(nome antigo no banco) → "Mentores" (`:107`). Ela monta `components/mentors/MentoresGrid.tsx`
(`:207`) para Todos/Mentores. O admin tem o módulo `plugins` → `PluginsModule`
(`app/workstation/admin/page.tsx:175`).

**Fazer (atrás de `NEXT_PUBLIC_MENTORES_TAB`):**
1. Nova rota `app/mentores/page.tsx` que **reusa o componente da loja** (extrair o corpo de
   `plugin-store/page.tsx` para `components/mentors/LojaMentores.tsx` sem mudar lógica);
   `app/plugin-store/page.tsx` passa a **redirecionar** para `/mentores` quando a flag está on, e
   segue renderizando normal quando off.
2. Nav/entradas: trocar o rótulo visível "Plugins"/"Plugin Store" por **"Mentores"** em todos os
   pontos de navegação (grep por `plugin-store` e por `Plugin` em `components/` e `app/`), sem
   mexer em nenhuma rota de API.
3. Categorias: **"Mentores" vira a primeira e o default**; "Essencial"/"Agentes" continuam.
4. Admin: módulo `plugins` muda só o **label** para "Mentores · catálogo".
5. Deep-links antigos (`?tab=projetos` da loja, `:56`) **continuam funcionando** — não tocar.

**Gate:** com a flag off, nada muda (diff visual zero); com on, `/mentores` abre a loja, o antigo
caminho redireciona, "Contratar mentor" (`MentoresGrid.tsx:188`) e o teto por papel
(`lib/mentors/limite.ts`) seguem funcionando.

**Não fazer neste PR:** renomear `model Plugin` (gate G9) nem `/api/plugins`.

---

### PR-A3 — Admin: gasto de tokens por agente

**Estado:** `AgentsModule.tsx` já lista `AgentProfile` editável (avatar `:125`, nome `:129`, bio
`:133`, ativo/ordem `:139`) e um bloco de USO com `uso.total`, `uso.usuarios`, `uso.ultimoUso` e
top-5 por `contagem` (`:13,17,153-160`), servido por `app/api/admin/agents/route.ts:39` via
`agregarUso()` (`lib/canal/usage.ts`). Falta o que o Martinez pediu: **o gasto**.

**Fazer (dentro da flag `NEXT_PUBLIC_AGENTS_ADMIN` que já existe):**
1. `GET /api/admin/agents/tokens?range=7d|30d|all&groupBy=agente|usuario|programa` consumindo
   `lib/metrics/tokens.ts` do PR-A1. Founder-only via `lib/admin/assertAdmin.ts` (padrão do repo).
2. No `AgentsModule`: por agente — `totalTokens`, prompt/completion, **custo estimado**, nº de
   turnos, tokens/turno médio, e sparkline de 14 dias. Ordenável por gasto. Um totalizador no
   topo com o gasto do dia e do mês.
3. Coluna "programa" quando o gasto vier de um `ResearchProgram` (PR-A8) — é assim que se vê qual
   pesquisa está comendo o crédito.
4. **Alerta e freio:** campo `tetoTokensDia` por agente em `AgentProfile`; ao estourar, o agente
   fica `ativo=false` automaticamente **só para trabalho autônomo** (turno pedido por humano
   continua), com aviso no admin. Nada de bloquear silenciosamente.
5. Usar o molde de chart que já existir no repo; se não houver, tabela + barra CSS. **Não**
   introduzir lib de chart nova neste PR.

**Gate:** admin mostra números que batem com a soma bruta do `TokenLedger` (checar com um script
de conferência em `scripts/`); teto estourado derruba só o autônomo; range 7d/30d confere.

---

## ONDA 1 — o agente trabalha de verdade

### PR-A4 — `AgentTask`: pedido → "estou trabalhando" → progresso → artefato

**Estado:** o canal só conhece *turno*. `app/api/canal/[id]/mensagem` → `parseMentions`
(`lib/canal/mention.ts`) → `dispararTurno` (`lib/canal/queue.ts:46`, fila `canal-turnos`,
`jobIdDe = canalId:agentKey:mensagemId` em `:43`) → `executarTurno`
(`lib/canal/agent-turn.ts:145`) → `runTrajectory` → publica `EV_MENSAGEM`. Os dois únicos eventos
existentes são `EV_MENSAGEM = "mensagem"` e `EV_DIGITANDO = "agente-digitando"`
(`lib/canal/wire.ts:5-6`), nos canais `canal-<id>` / `presence-canal-<id>` (`:8-9`).

**Fazer (atrás de `CANAL_TAREFAS`):**

1. **Model `AgentTask`** (`@@map("agent_tasks")`), desenhado a partir do consenso
   hermes/deer-flow da Parte I:
   `id`, `canalId?`, `programId?`, `cycleId?`, `requesterId?` (null = autônomo), `agentKey`,
   `mentorSlug?`, `objetivo String`, `kind` (`resposta|dossie|revisao|reuniao|monitoramento`),
   `status` (`queued|running|awaiting_input|done|failed|cancelled`), `phase?`, `progress Int`,
   `steps Json` (append-only: `{at, phase, label, tokens?}`), `artifactKind?`
   (`research_work|studio_artifact|zxiv_paper`), `artifactId?`, `needsHuman Json?`
   (`{pergunta, opcoes?}`), `error?`, `cancelRequested Boolean`, `leaseOwner?`,
   `leaseExpiresAt?`, `lastProgressAt`, `idempotencyKey @unique`, `createdAt`, `updatedAt`.
   Índices: `[canalId, createdAt]`, `[status, updatedAt]` (para o reaper), `[programId, createdAt]`.
2. **Triagem turno vs tarefa** em `lib/canal/triagem.ts` (puro, testado): dado o objetivo
   (`montarObjetivo`, `agent-turn.ts:79`) + o `IntentSpec` (`lib/agent/contracts.ts` `INTENTS`),
   decidir `turno` (resposta curta, continua como hoje) ou `tarefa` (pede documento, pesquisa,
   revisão, comparação, "faça um trabalho sobre X"). Regra conservadora: **em dúvida, turno** —
   mas a presença de verbo de produção (`fazer/produzir/escrever/montar/pesquisar`) + substantivo
   de entregável (`trabalho/artigo/relatório/dossiê/revisão/TCC`) cai em tarefa. Começar com
   heurística determinística; **não** gastar um LLM nessa decisão.
3. **Terceiro evento Pusher** em `lib/canal/wire.ts`: `EV_TAREFA = "tarefa"`, payload
   `TarefaWire = { taskId, agentKey, status, phase?, progress, label?, artifact?, needsHuman? }`.
   Publicar por `publicarPusher` (`lib/canal/realtime.ts:15`) em toda transição.
4. **Nova fila `agent-tasks`** (a 4ª do repo; as 3 atuais são `scholar`, `chat`, `canal-turnos`),
   em `lib/queue/tarefas.ts` seguindo exatamente o molde de `lib/canal/queue.ts`: `filaLigada()`
   checando `CANAL_TAREFAS==="1" && REDIS_URL`, fallback **inline fire-and-forget** quando sem
   Redis (o repo já faz isso em dois lugares), `jobId` idempotente, worker subindo em
   `instrumentation.ts` sob `TAREFAS_WORKER=1` (mesmo padrão de `SCHOLAR_WORKER`/`CANAL_WORKER`).
5. **Fluxo visível:** ao criar a tarefa, o agente posta **uma** mensagem curta no fio ("Entendi.
   Vou montar isso e te aviso aqui — acompanhe a barra") e **nunca mais fala até terminar**. A
   barra na sala vem do evento `tarefa`; fallback por polling em
   `GET /api/canal/[id]/tarefas?ids=` a cada 2s, igual ao padrão retomável que já existe
   (`lib/chat/turnoRetomavel.ts`, `POLL_TURNO_MS = 1500`). Progresso = **as fases do `Phase` do
   harness**, não percentual inventado (rótulos em português já existem em `lib/agent/progresso.ts`).
6. **Conclusão:** gravar o artefato → **depois** marcar `done` (delivery receipt do deer-flow) →
   publicar `tarefa` final → postar mensagem com link. Nunca mandar o conteúdo inteiro no evento.
7. **Cancelamento cooperativo:** `cancelRequested` checado entre fases (nunca matar processo), com
   botão na barra. **Stall detector**: `lastProgressAt` > 450s sem avanço ou > 1200s dentro de uma
   tool → `failed` com motivo `stalled` (thresholds do hermes-agent). Estender
   `lib/queue/reaper.ts` (`STUCK_MS = 15min`) para varrer `agent_tasks` também.
8. **`awaiting_input`**: quando o agente precisa de decisão humana, grava `needsHuman` e publica —
   a barra mostra a pergunta na sala, resposta destrava a tarefa. É o `input-required` do A2A
   e o `needs_human_input` do Moltbook, mesma coisa.

**Gate:** `@Nightingale precisamos fazer um trabalho sobre cafeína` **não** responde no fio: cria
tarefa, mostra barra com fases, e ao fim posta "pronto" com link para o `ResearchWork` visível na
Sala de Pesquisa. Sair da sala e voltar reengata a barra. Cancelar para a tarefa em ≤1 fase.
Com flag off, comportamento idêntico ao atual.

---

### PR-A5 — `literature_search` real + citação por chave + `examiner` que reprova

**Por que isto trava tudo:** `literature_search` está registrada como
`runtime:"python", risk:"read"` e **retorna `skill_offline`**; `examiner` retorna
`not_implemented` (ambos no registry de `lib/agent/runtime.ts:240`). Foi exatamente por isso que
o Nightingale disse "as ferramentas de busca não trouxeram evidências diretas agora" — o diagnóstico
dele estava certo. **Sem este PR, todo o resto produz prosa bonita sem lastro.**

**Fazer (atrás de `LIT_SEARCH` e `EXAMINER`):**

1. **`literature_search` em TypeScript** (`runtime:"ts"`), em `lib/agent/skills/literatura.ts`:
   - Fontes: os conectores MCP já previstos (arXiv, PubMed, OpenAlex, Crossref/S2) via
     `lib/agent/mcp.ts` (que já registra tools MCP dinamicamente, `:203`) + busca web geral.
   - **Retrieval-augmented tool pick (Biomni):** com vários conectores plugados, escolher por
     embedding qual fonte serve a pergunta antes de disparar todas.
   - Degradação explícita: conector fora → `Finding` com motivo, **nunca** silêncio (o repo já tem
     `messageForError`/`degraded` no contrato; usar).
2. **Citação por chave (PaperQA2), o item mais importante:** cada trecho recuperado vira um
   *context* com **chave sintética própria** (`zxc-<hash8>`), guardando `{key, fonte, url, doi?,
   trecho, score}`. O modelo **só pode citar chaves que existem na lista**; depois da geração,
   um passe determinístico em `lib/agent/citacao.ts` **valida que toda chave citada existe** e
   remove/marca o que não existir. Reaproveitar `ProvenanceRecord`
   (`lib/agent/contracts.ts`) como o registro persistido.
3. **`examiner` real** (`lib/agent/examiner.ts` já existe como arquivo — implementar) com duas
   funções distintas, não misturar:
   - **Integrity gate** (ARS reimplementado, não copiado): classifica **cada claim** do rascunho
     em `ALIGNED` / `OVERSTATED` / `NOT_SUPPORTED` contra as evidências recuperadas. Qualquer
     `NOT_SUPPORTED` → `shouldRevise()` true (a função já existe no contrato).
   - **Score de paper** (Agent Laboratory `get_score()`): JSON com Originality, Quality, Clarity,
     Significance, Soundness, Presentation, Contribution, Overall, Confidence, Decision, **pesos
     contribution 0.4 / presentation 0.2 / resto 0.1**. Usado como critério de aceite no
     `papersolver` (PR-A9) e na submissão ao Zxiv (PR-A7).
   - **Veredito de 4 estados** (watch-skill): `VERIFIED` / `FAILED` / `UNVERIFIED` /
     `INCONCLUSIVE`. "Não deu para verificar" **não** é reprovação, e **não** é aprovação.
4. **Material Passport:** todo artefato nasce com um manifesto anexado — lista de fontes
   efetivamente usadas, com chave, data de acesso e o que cada uma sustenta. Vai em
   `ResearchWork.secoes` como seção própria e em `meta`.
5. **`data_access_level` por mentor** (`raw` | `redacted` | `verified_only`) em `MentorTemplate`:
   mentor de saúde (Osler/Nightingale/Pasteur/James/Kekulé — guardrails já semeados) opera em
   `verified_only`, ou seja **só cita evidência que passou o integrity gate**.

**Gate:** uma pergunta de enfermagem sobre cafeína retorna ≥5 fontes reais com DOI/URL
resolvíveis; nenhuma citação no texto final sem chave correspondente (teste automatizado que
procura chaves órfãs); um rascunho com claim inventado é reprovado pelo integrity gate em teste
com fixture; conector derrubado produz degradação explícita e não resposta vazia.

---

## ONDA 2 — agentes conversando entre si

### PR-A6 — Reunião de comitê no Escritório

**O molde é o `zou-group/virtual-lab` (MIT), e ele é simples de propósito.** Porte fiel de
`run_meeting`: pauta + perguntas + regras, **ordem de fala fixa** (zero seleção de falante — é o
que mata loop e custo), cada membro fala uma vez por rodada e **pode dizer "pass"** se não tem
nada novo, instrução explícita de "você pode e deve discordar", o **PI sintetiza e decide** ao fim
de cada rodada, e a **rodada final só com o PI** produz o artefato em formato fixo:
`### Agenda / Team Member Input / Recommendation / Answers / Next Steps`. Histórico é **uma lista
linear compartilhada**; cada agente recebe `[seu system prompt] + mensagens`. O `summary` da
reunião entra como `summaries` da próxima — memória entre reuniões, de graça.

**Fazer (atrás de `CANAL_REUNIAO`):**

1. `lib/reuniao/run.ts` — `runReuniao(params, deps)` com `params = { pauta, perguntas[], regras[],
   piAgentKey, membros: string[], rodadas: number, summariesAnteriores[], tipo: "comite"|"critico" }`.
   Puro o quanto possível, com `deps` injetadas no estilo `HarnessDeps`
   (`lib/agent/trajectory.ts:56`) — assim dá teste sem LLM.
   `tipo:"critico"` = o par agente ↔ `SCIENTIFIC_CRITIC` alternando crítica/revisão (também do
   virtual-lab), usado para revisar um dossiê.
2. **Thread própria, não o fio principal.** A reunião é uma `AgentTask` de `kind:"reuniao"` e as
   falas vão para uma thread (`CanalMensagem` com `parentId`, ou `Conversation` dedicada). No fio
   principal entra **uma** linha: "comitê reunido sobre X — 4 participantes, 3 rodadas" + link.
   Isto é o anti-spam que importa: o humano estudando na sala não é soterrado pelo debate.
3. **Progress Ledger (MagenticLite)** a cada rodada: um JSON pequeno gerado por Gemini Flash
   respondendo *completou? houve progresso? estamos em loop? quem fala agora e com qual
   instrução?*. Estagnação acima do limiar → encerra a reunião e devolve ao plano, em vez de
   continuar queimando. Gravar o ledger na tarefa (`steps`).
4. **Loop guard do agentchattr** em `lib/canal/guard.ts`: contador de trocas **agente↔agente** por
   canal/thread; acima de N (começar com 6) pausa e exige menção humana; **menção humana sempre
   passa e reseta o contador**. Mais rate-limit no espírito do Moltbook (um agente não fala duas
   vezes seguidas no mesmo minuto).
5. **Mentor consultando mentor** (canal `Consulting` do AG2, que auto-fecha): um mentor pode
   chamar outro para **uma** pergunta e **uma** resposta — canal fecha sozinho, sem virar conversa.
   É o caminho barato e o default; reunião é o caminho caro, só em fase de plano/interpretação.
6. Orçamento: `rodadas` finitas sempre, teto de tokens por reunião lido do `Budget` do programa,
   e contagem real via `TokenLedger` (PR-A1) com `surface:"canal"`, `phase:"reuniao"`.

**Gate:** uma reunião de 3 rodadas com 4 mentores termina com o documento de 5 seções, o fio
principal recebe **uma** mensagem, o custo medido fica dentro do teto, e o loop guard trava uma
conversa agente↔agente artificialmente induzida.

---

### PR-A7 — **Zaeon Rxiv** (`Zxiv`): o mural de preprints dos agentes

**Esta é a peça que o AgentRxiv prova ser o multiplicador** (+11,4% de qualidade; 23→7 papers com
labs em paralelo). Nasce corrigindo as fraquezas do original: o `Paper` do Flask tem 3 campos e
nenhuma citação entre papers; o nosso tem metadados, linhagem e dedup.

**Fazer (atrás de `ZXIV`):**

1. **Model `ZxivPaper`** (`@@map("zxiv_papers")`): `id`, `slug @unique`, `titulo`, `resumo`,
   `corpo` (markdown), `secoes Json`, `autorAgentKey`, `coautores String[]`, `programId?`,
   `cycleId?`, `ownerId` (o humano responsável — Moltbook claim), `parentPaperIds String[]`
   (**a citação entre papers que o original não tem**), `fontes Json` (Material Passport),
   `metricas Json?` (o que foi medido), `score Json` (os 10 campos do `get_score`),
   `veredito` (`VERIFIED|FAILED|UNVERIFIED|INCONCLUSIVE`), `novidade Float`,
   `embedding Float[]`, `status` (`rascunho|submetido|aceito|rejeitado|superseded`),
   `supersededBy?`, `rev Int`, `createdAt`, `updatedAt`.
   Índices + **índice vetorial Atlas `zxiv_papers_vec`** (1536, cosine) — ⚠️ criação **manual** no
   Atlas, mesma pendência já registrada para `memory_drawers_vec`; sem ele a busca degrada em silêncio
   e o PR fica inerte. Listar isso no runbook de deploy.
2. **Rotas** (o `app.py` de 200 linhas vira 4 rotas Next):
   `POST /api/zxiv` (submeter), `GET /api/zxiv/search?q=` (semântica), `GET /api/zxiv/[id]`,
   `GET /api/zxiv` (feed por recência/programa). Embeddings com `gemini-embedding-001`
   (EMBED_DIM=1536, já é o padrão do repo em `lib/agent/memory.ts`) + `$vectorSearch`/`$rankFusion`
   — exatamente o que a memória L3 já faz; **reusar aquele código, não escrever outro.**
3. **Gate de submissão** (o que o original não tem e por isso duplica ideias):
   a) `score.Overall` ≥ limiar; b) `veredito ≠ FAILED`; c) **score de novidade** = 1 − maior
   similaridade contra o corpus; abaixo do limiar, o paper é rejeitado com a sugestão
   "isto já existe em <slug>, cite e avance" e os `parentPaperIds` pré-preenchidos.
4. **Leitura obrigatória antes de escrever:** a fase `literature review` do pipeline (PR-A9)
   **sempre** consulta o Zxiv antes das bases externas e injeta os achados como
   `zxiv:<slug>` junto às fontes de fora (o original usa o id `AgentRxiv:ID_n`; o nosso usa slug
   legível). É isso que faz o ciclo de amanhã começar de onde o de hoje parou.
5. **Mural visível ao humano:** página somente-leitura em `/zxiv` listando os papers com autor,
   programa, veredito e linhagem (`parentPaperIds` como grafo simples). Nada de upvote, karma,
   hot/top — isso é vaidade entre agentes e não produz conhecimento.
6. **Rate limit como qualidade** (Moltbook): no máximo N submissões por agente por dia; o
   excedente vira revisão de paper existente (nova `rev`) em vez de paper novo.

**Gate:** dois programas distintos rodando no mesmo Zxiv; o paper do ciclo 2 do programa A cita
(via `parentPaperIds`) um paper do programa B; uma submissão quase idêntica a uma existente é
rejeitada por novidade; a busca semântica devolve resultado com o índice Atlas criado e degrada
com aviso explícito quando não existe.

---

## ONDA 3 — autonomia: o programa de pesquisa

### PR-A8 — `ResearchProgram` + rotina diária (o 1º scheduler do repo)

**Atenção, achado importante:** **não existe nenhum agendamento recorrente no repo.** O grep por
`repeat:`, `cron`, `node-cron`, `every:` em `lib/`, `app/`, `scripts/` só acha `repeat: Infinity`
de animação framer-motion e `setInterval` de polling de UI. As 3 filas existentes (`scholar`,
`chat`, `canal-turnos`) são todas disparadas por ação humana. **A rotina diária é infraestrutura
nova** — e é o coração do que o Martinez pediu ("rotina diária de pesquisa, prospecção e
construção").

**Fazer (atrás de `PROGRAMA_SCHED`):**

1. **Model `ResearchProgram`** (`@@map("research_programs")`): `id`, `slug @unique`, `titulo`,
   `topico Text` (ex.: *"sistema aquífero de baixo custo para regiões de extremo calor"*),
   **`problema Text`** (que problema real resolve), **`quemUsa Text`** (quem usa o resultado),
   **`porQueAgora Text`** (a régua de utilidade — os três são **obrigatórios**),
   `ownerId` (humano responsável), `piAgentKey`, `membros String[]` (mentor slugs),
   `cadencia` (`diaria|semanal|pausado`), `horaUTC Int`, `status`
   (`rascunho|ativo|aguardando_humano|pausado|concluido|arquivado`),
   `orcamentoTokensDia Int`, `orcamentoTokensTotal Int`, `tokensGastos Int`,
   `fase?`, `cicloAtual Int`, `capaArtifactId?` (imagem do card), `restricoes Json?`
   (ex.: "sem experimento que exija GPU"), `createdAt`, `updatedAt`.
2. **Model `ProgramCycle`** (`@@map("program_cycles")`): `id`, `programId`, `n Int`, `status`
   (`queued|running|awaiting_input|done|failed|cancelled`), `fase?`, `progress`,
   `steps Json`, `diffDoAnterior Text?` (**o que mudou em relação ao ciclo anterior** — THE LOOP do
   watch-skill: se nada mudou, o ciclo encerra barato e não gera paper), `paperId?`,
   `taskIds String[]`, `tokens Int`, `iniciadoEm`, `terminadoEm`, `erro?`.
3. **Scheduler:** fila `programa-ciclo` (5ª do repo) em `lib/queue/programa.ts`, com
   **repeatable job do BullMQ** (`repeat: { pattern }`, jitter por programa para não disparar tudo
   junto) + `jobId` idempotente `programId:YYYY-MM-DD` — **o mesmo dia nunca roda duas vezes**.
   Worker em `instrumentation.ts` sob `PROGRAMA_WORKER=1`, concorrência via
   `PROGRAMA_WORKER_CONCURRENCY` (default **1** — pesquisa autônoma não precisa de paralelismo
   antes de termos custo sob controle). Reconciliação na subida: ao iniciar, reagendar os
   repeatables dos programas `ativo` (BullMQ perde repeatables se o Redis for limpo).
4. **Heartbeat (Moltbook, versão sã):** o conteúdo do heartbeat é **local e nosso** — um documento
   em `lib/programa/heartbeat.ts` com as instruções do ciclo. **Nunca** baixar instrução de fora e
   executar. Isso não é paranoia: é literalmente o furo apontado no design do Moltbook.
5. **Freios, antes de qualquer LLM ser chamado:** checar `orcamentoTokensDia` contra o
   `TokenLedger` do dia (PR-A1); se estourou, o ciclo nem começa e o admin recebe o aviso.
   `status=aguardando_humano` **suspende** o scheduler até resposta. Kill-switch global
   `PROGRAMA_SCHED=0` derruba tudo em segundos (padrão `AURA_HARNESS=0` do repo).
6. **Lease** (deer-flow): `leaseOwner`/`leaseExpiresAt` no `ProgramCycle` — dois workers nunca
   tocam o mesmo ciclo. Estender `lib/queue/reaper.ts` para liberar lease vencida.

**Gate:** criar programa no admin, cadência diária, ver o repeatable agendado; forçar um ciclo
manualmente e ver `ProgramCycle` nascer, rodar e fechar; rodar duas vezes no mesmo dia não duplica;
estourar o orçamento impede o ciclo; `PROGRAMA_SCHED=0` para tudo; reiniciar o processo reagenda.

---

### PR-A9 — Pipeline das 7 fases (Agent Laboratory portado)

**O molde:** `lib/scholar/pipeline.ts` já é a prova de que o padrão funciona aqui — exporta
`runScholarPipeline(sessionId, params, emit)` e emite fases `planning` → `searching` → `dedup` →
`synthesizing` → `verifying`, com o worker persistindo cada evento em `ScholarSession.thread.events`
(`instrumentation-node.ts`, `persistEvent()`). **O novo pipeline é irmão disso, não substituto** —
distingue-se por ser **autônomo, multi-ciclo, com memória entre ciclos e comitê**.

**Fazer (atrás de `PROGRAMA_PIPELINE`):** `lib/programa/pipeline.ts` exportando
`runProgramCycle(cycleId, params, emit)`, com as 7 fases do Agent Laboratory mapeadas ao nosso
`Phase` (`lib/agent/trajectory.ts:28`):

| # | Fase (Agent Laboratory) | Aqui | Quem conduz | Produz |
|---|---|---|---|---|
| 1 | literature review | `gather` | mentor do domínio + Aura | **Zxiv primeiro**, depois arXiv/PubMed/OpenAlex/web; contexts com chave (PR-A5) |
| 2 | plan formulation | `plan` | **reunião de comitê** (PR-A6) | plano do ciclo + perguntas a responder |
| 3 | data preparation → **"materiais"** | `gather` | engenheiro/mentor técnico | levantamento de **materiais reais**: componentes, custos, normas, fornecedores, datasets |
| 4 | running experiments → **"viabilidade"** | `reason` | mentor técnico | cálculo/simulação/estimativa; experimento de código **só** via tool MCP isolada (ver abaixo) |
| 5 | results interpretation | `reason` | **reunião de comitê** | interpretação + desdobramentos |
| 6 | report writing | `draft` | relatora (Aura) via **papersolver** | o dossiê (PR-A10) |
| 7 | report refinement | `critique` → `finalize` | `examiner` + reunião crítica | dossiê revisado, veredito, submissão ao Zxiv |

Detalhes que não podem ser perdidos:

1. **Loop do `papersolver` portado fielmente:** edição por comandos (`PaperReplace` /
   `PaperEdit N M`), **só aceita se o score subir**, guarda `top_score`/`best_report`,
   `papersolver-max-steps` como teto duro. Idem a auto-reflexão (`reflect_code` →
   nossa `reflexao`: "insights generalizáveis" gravados como `MemoryDrawer` do programa).
2. **Gate humano por fase (co-pilot mode), e ele é medido** (3,8 → 4,38/10): campo
   `gateHumano String[]` no programa listando em quais fases parar. Parar = `awaiting_input` +
   mensagem na sala + card na vitrine pedindo decisão. O feedback entra como
   `notes: [{fases, nota}]` no ciclo e **reinicializa os agentes da fase** — como no original.
3. **Experimentos que exigem código:** **não** portar `mlesolver` (subprocess Python, timeout
   600s). Expor como **uma tool MCP `run_experiment`** no sandbox já existente (a VPS Contabo com
   24GB tem folga), com `risk:"destructive"` → `REQUIRE_APPROVAL` pelo `permit()`
   (`lib/agent/runtime.ts`). Enquanto essa tool não existir, a fase 4 roda em modo
   **estimativa/analítico** e o dossiê **declara** que não houve execução — nunca finge.
4. **Memória entre ciclos:** o `summary` do ciclo + os insights viram `MemoryDrawer`
   (`wingKind:"projeto"`, `wingLabel: programa.slug`) e entram no ciclo seguinte. Mais o
   `diffDoAnterior`: **se o ciclo não achou nada novo, encerra sem gerar paper** e registra isso
   (é melhor um dia sem paper do que um paper reciclado).
5. **Emissão de progresso:** mesmo contrato do scholar (`{type:"phase", phase}` / `answer` /
   `done` / `error`), persistido em `ProgramCycle.steps`, **e** publicado no Pusher para a vitrine
   e para o canal (evento `tarefa` do PR-A4 e um novo `EV_PROGRAMA = "programa"` em
   `lib/canal/wire.ts` para a vitrine).
6. **Toda chamada de LLM passa pelo `TokenLedger`** com `programId`, `cycleId` e `phase` — é assim
   que o admin mostra qual pesquisa come o crédito.

**Gate:** um ciclo completo do programa-exemplo ("sistema aquífero de baixo custo para regiões de
extremo calor") termina com dossiê + paper no Zxiv + tokens contabilizados por fase; o ciclo 2 cita
o ciclo 1; um ciclo sem novidade encerra sem paper; o gate humano em `plan` para o ciclo e a
resposta o retoma.

---

### PR-A10 — O dossiê (o entregável que o Martinez descreveu)

Não é resposta crua nem planejamento vago. **Estrutura obrigatória** — o `papersolver` tem scaffold
fixo de 8 seções; o nosso tem estas, e o `examiner` **reprova dossiê com seção obrigatória vazia**:

1. **Síntese executiva** — o que foi descoberto neste ciclo, em 10 linhas.
2. **Problema e utilidade** — amarra explícita aos três campos do programa (`problema`,
   `quemUsa`, `porQueAgora`). Sem isso, reprovado.
3. **Estado da arte** — o que já existe, com citação por chave (`zxc-…`) e o que **não** foi
   encontrado (lacuna declarada, não omitida).
4. **Materiais e meios** — componentes, custos estimados com fonte e data, normas/regulação
   aplicável, fornecedores ou substitutos. Para o exemplo do aquífero: materiais, energia,
   manutenção, clima.
5. **Viabilidade** — cálculo/estimativa, com premissas **numeradas e cada uma marcada**
   `VERIFIED|UNVERIFIED|INCONCLUSIVE`. Premissa não verificada é permitida; premissa não
   **marcada** não é.
6. **Desdobramentos** — o que este resultado abre: próximas perguntas, variações, aplicações
   adjacentes. Vira semente de ciclo/programa novo.
7. **Implicações** — riscos, custos sociais/ambientais, limites éticos, dependências externas.
8. **Onde o humano precisa entrar** — seção de primeira classe, **não rodapé**: que decisão,
   que autorização, que experimento físico, que especialista, que dado proprietário. Cada item
   vira um pedido acionável (`needsHuman`) que aparece na sala e no card.
9. **Material Passport** — manifesto de fontes com chave, data de acesso e o que cada uma
   sustenta.
10. **Veredito e score** — os 10 campos do `get_score` + o veredito de 4 estados.

Persistência: `ResearchWork` (`research_works`, já tem `secoes Json` com `[{id,titulo,corpo}]`,
`rev` para controle otimista e `tccStatus`) com `workType:"dossie"` + `ZxivPaper` para a versão
publicada no mural. **Reusar o editor de seções que já existe** (`lib/tcc/secoes.ts` com
`OpSecao`/`Secao`, e `TccRevisao` para histórico de revisão origem/antes/depois) em vez de criar
outro formato de documento.

**Gate:** dossiê gerado abre na Sala de Pesquisa com as 10 seções; nenhuma premissa sem marca;
pelo menos um item em "onde o humano precisa entrar" vira pedido visível; seção obrigatória vazia é
reprovada em teste.

---

### PR-A11 — Vitrine **Projetos** (os cards)

**Decisão do nome, já explicada em II.1:** aba nova `producao` com label **"Projetos"**; a aba
`projetos` (Zaeon Code / IDE) **mantém a key** e passa a exibir label **"Zaeon Code"**. Com
`NEXT_PUBLIC_VITRINE` off, nem o label muda.

**Fazer:**
1. `app/research-lab/producao/VitrineProducao.tsx`, montado em `app/research-lab/page.tsx` junto
   às outras abas (`:2897-2967`), seguindo o padrão de `activeTab`/`VALID` (`:685`, `:1478`) e a
   persistência em `localStorage["zaeon.lab.lastTab"]` (`:1430`).
2. **Molde do card:** o melhor do repo é `components/mentors/MentoresGrid.tsx:124-200` — grid
   `md:grid-cols-2 lg:grid-cols-3 gap-6`, borda em gradiente violeta→cyan (padding 1.5px + inner
   `rounded-[21px] ${VIDRO_BOLHA}`), brilho especular no topo. Para a **imagem de capa**, o único
   card que já exibe imagem é `app/plugin-store/page.tsx:369-375` (`imageUrl` em
   `object-cover` com fallback por categoria) — combinar os dois. Tokens de vidro de
   `lib/canal/vidro.ts` (`VIDRO_BOLHA`, `VIDRO_CHIP`, `TXT`/`TXT_2`/`TXT_MUDO`, `TOQUE`).
3. **Conteúdo do card:** imagem representativa · título · tópico em uma linha · chip de status
   (`ativo|aguardando você|pausado|concluído`) · **fase atual + barra do ciclo** · nº de ciclos,
   nº de papers no Zxiv, nº de fontes · mentores participantes (avatares) · tokens gastos (se
   admin) · selo ⚠ **"precisa de você"** quando `awaiting_input`. Clique abre o dossiê mais
   recente; aba lateral lista os ciclos anteriores e a linhagem de papers.
4. **Imagem representativa:** gerar com Imagen no nascimento do programa — `lib/studio/imagen.ts`
   (`imagenAvailable()`, `generateImage()`) grava via `lib/studio/storage.ts` em `.studio/` e o
   metadado em `StudioArtifact` (`kind:"image"`); o id fica em `ResearchProgram.capaArtifactId`.
   Prompt da capa derivado do tópico, **sem texto na imagem** (Imagen escreve mal) e com fallback
   para gradiente + ícone quando `imagenAvailable()` for false.
5. **Ao vivo:** assinar o evento `EV_PROGRAMA` no Pusher (canal por programa) com fallback de
   polling em `GET /api/programas?resumo=1`. Mesmo padrão retomável do resto do repo.
6. **Mobile:** o grid cai para 1 coluna; usar `components/mobile/estilo.ts`.

**Gate:** vitrine lista os programas com capa e barra; o progresso anda sem recarregar a página;
o selo "precisa de você" aparece e leva à decisão; com a flag off a aba não existe e o label da
aba `projetos` permanece "Projetos".

---

### PR-A12 — Admin: criar programa, aprovar gates, kill-switch

**Fazer (atrás de `NEXT_PUBLIC_PROGRAMA_ADMIN`, founder-only via `lib/admin/assertAdmin.ts`):**
novo módulo `app/workstation/admin/modules/ProgramasModule.tsx`, registrado na lista de módulos de
`app/workstation/admin/page.tsx:171-181` (hoje: profiles, voice, invites, reports, plugins, agents,
finance-offline).

1. **Criar programa** — formulário com `topico`, e os três campos de utilidade **obrigatórios**
   (`problema`, `quemUsa`, `porQueAgora`); escolha do PI e dos mentores (de `MentorTemplate`,
   `prisma/schema.prisma:796`); `cadencia` + `horaUTC`; `orcamentoTokensDia`/`Total`;
   `gateHumano` (quais fases param); `restricoes`. Validação: sem os três campos, não salva.
2. **Fila e controle** — lista de ciclos com status/fase/tokens; botões **rodar agora**,
   **pausar**, **cancelar ciclo**, **arquivar programa**; e o kill-switch global visível.
3. **Caixa de decisões** — tudo que está `awaiting_input` (do programa e das tarefas do PR-A4) numa
   lista única, no espírito do `agent-inbox`: aceitar / responder / editar o plano / ignorar.
   Registrar a resposta e **o tempo que ficou esperando** (é a métrica que diz se a autonomia está
   ajudando ou só empurrando trabalho para o humano).
4. **Gasto por programa** — reusar `lib/metrics/tokens.ts` (PR-A1) com `groupBy=programa`.
5. **Semear o programa-exemplo** do Martinez como fixture de teste (não em produção automática):
   *sistema aquífero de baixo custo para regiões de extremo calor* — problema, quem usa e por que
   agora preenchidos de verdade, porque ele é o caso de aceitação de ponta a ponta.

**Gate:** criar o programa-exemplo, rodar um ciclo à mão, ver o card na vitrine, receber um pedido
de decisão na caixa, responder, ver o ciclo retomar, e ver o gasto do programa no admin.

---

## II.3 — Guardrails (valem para todos os PRs; o FABLE não negocia estes)

1. **Flag off por padrão**, kill-switch por onda, e nenhum PR muda comportamento existente quando
   desligado. Mudança de UI é opt-in e mostrada antes — não substituir tela existente de uma vez.
2. **Rodadas finitas** em qualquer loop de agente. Nunca "até resolver".
3. **Gravar artefato antes de marcar `done`.** Delivery receipt.
4. **Orçamento checado antes de chamar LLM**, com número real do `TokenLedger`.
5. **Progress Ledger + stall detector + loop guard** sempre ligados quando há mais de um agente.
6. **Citação só por chave existente**, validada por passe determinístico. Claim `NOT_SUPPORTED`
   reprova o dossiê.
7. **Guardrails de saúde** dos mentores clínicos (Osler, Nightingale, Pasteur, James, Kekulé)
   continuam valendo em tudo: educacional, **nunca** diagnóstico, prescrição ou terapia — e em
   `data_access_level: verified_only`.
8. **Nenhuma instrução executável vem de fora.** O heartbeat é local. Nada de `curl`+executar
   markdown remoto (o furo do Moltbook).
9. **Agente autônomo não fala no fio** salvo concluiu / travou / precisa de humano.
10. **Licenças:** Agent Laboratory + AgentRxiv (MIT) e virtual-lab/magentic/agentchattr/PaperQA2/
    STORM (MIT/Apache) **podem** ter código aproveitado com atribuição.
    `academic-research-skills` é **CC BY-NC** → só reimplementação de ideia.
    `AI-Scientist-v2` (licença RAIL própria) e `Chatsemble` (GPL-3.0) → **nem uma linha**.
    Registrar a procedência em `docs/FONTES_BASE.md`.
11. **Não misturar** o rename `model Plugin`→`Skill` (gate G9) neste overhaul.
12. **Índices Atlas são manuais:** `zxiv_papers_vec` entra no runbook de deploy junto do
    `memory_drawers_vec` pendente. Sem índice, degradar **com aviso**, nunca em silêncio.

## II.4 — Ordem de merge e por quê

```
PR-A1 (tokens) ──┬─► PR-A3 (admin de gasto)
                 └─► PR-A8 (orçamento do programa tem com que frear)
PR-A5 (busca+citação) ──► PR-A9 (pipeline)   ← SEM A5, TUDO ABAIXO PRODUZ PROSA SEM LASTRO
PR-A4 (tarefa+progresso) ──► PR-A6 (reunião é uma tarefa) ──► PR-A9
PR-A7 (Zxiv) ──► PR-A9 (fase 1 lê o mural) ──► PR-A10 (dossiê) ──► PR-A11 (vitrine)
PR-A2 (Mentores) e PR-A12 (admin) são independentes — podem entrar a qualquer momento
```

Sugestão de fatiamento para o FABLE: **A1+A2+A3** (uma entrega, mede e renomeia), **A4+A5** (a
entrega que já resolve a reclamação original do escritório), **A6+A7** (agentes entre si),
**A8+A9+A10** (autonomia), **A11+A12** (ver e comandar). Cada grupo com CI verde e transpile dos
arquivos tocados — o repo usa `transpileModule`/vitest sem `next build`.

## II.5 — Prompt de entrada para o FABLE

> Leia, nesta ordem: este documento (Parte I para contexto, Parte II para execução),
> `docs/BACKGROUND_JOBS_SALA_PESQUISA.md` (o padrão de job que vamos replicar),
> `docs/HANDOFF_ESCRITORIO_COWORKING.md` (o escritório atual, `@mention` e fila `canal-turnos`),
> `docs/AURA_AGENTIC_LAYER_PLAN.md` e `docs/AGENTIC_LAYER.md` (harness e mentores).
> Depois **aprofunde os repos** `SamuelSchmidgall/AgentLaboratory` (incl. `app.py` do AgentRxiv,
> `papersolver.py`, `agents.py`) e `zou-group/virtual-lab` (`run_meeting`), e **co-autore o prompt
> único e auto-contido** do Claude Code (Opus) para o grupo de PRs escolhido — com passos, gates,
> arquivos exatos, flags e orçamento de tokens, no formato de `docs/EXECUTOR_PROMPT_AURA_E2E.md`.
> Restrição mantida: se algo grande contradiz a base já construída, **perguntar ao Martinez antes**.
> E duas decisões de produto estão em II.1 à espera dele (PI do comitê, régua de utilidade) —
> os defaults estão adotados e podem seguir.

## II.6 — Fontes novas desta parte

[agentlaboratory.github.io](https://agentlaboratory.github.io/) ·
[AgentLaboratory (MIT)](https://github.com/SamuelSchmidgall/AgentLaboratory) ·
[agentrxiv.github.io](https://agentrxiv.github.io/) ·
[AgentRxiv — arXiv:2503.18102](https://arxiv.org/abs/2503.18102) ·
[Moltbook-Official](https://github.com/Moltbook-Official) ·
[academic-research-skills — CC BY-NC](https://github.com/Imbad0202/academic-research-skills) ·
[watch-skill (MIT)](https://github.com/oxbshw/watch-skill) ·
[virtual-lab (MIT)](https://github.com/zou-group/virtual-lab) ·
[paper-qa](https://github.com/Future-House/paper-qa) ·
[magentic-ui](https://github.com/microsoft/magentic-ui) ·
[agentchattr](https://github.com/bcurts/agentchattr)

---
---

# PARTE III — O AMBIENTE COLABORATIVO: "Slack com agentes vivos"

> **Verificação feita em 2026-10-06, direto no repo** (branch `fix/cartolina-sem-globo`, último commit
> `a74e6e5` de 04/10). Pedido do Martinez: *algo próximo do Slack, mas com agentes ativos e
> proativos que conversam entre si e não apenas aguardam comando.* Esta parte lista, um a um, o que
> será implementado — e começa pelo que a verificação revelou, porque três coisas mudam a ordem.

## III.0 — Estado verificado (não é o que a Parte I supunha em um ponto importante)

O escritório **está congelado** desde o commit `ef23293` (02/10) — que foi quem criou os 30
arquivos do canal de uma vez. Todo o trabalho dos últimos dias foi no ciberespaço/lounge 3D.
O `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` segue **untracked** (nunca comitado).

**Já é Slack hoje** (melhor do que a Parte I registrava):

| Peça | Onde |
|---|---|
| múltiplos canais, criar, entrar | `app/api/canal/route.ts:12,24` · `[id]/entrar/route.ts:8` · UI `CoworkingCanal.tsx:278-295` |
| presença (quem está online) | presence Pusher `lib/canal/wire.ts:9` + `pusher-auth/route.ts:14` (nome+avatar) |
| **@menção com autocomplete** | `lib/canal/mention.ts:58,65` (`sugerir`, `mencaoAberta`) + popover `CoworkingCanal.tsx:381` |
| não-lidas + badge no título | `naoLidas` (`:35`), `Badge` (`:415`), `tituloComBadge` (`notificacoes.ts:50`) |
| notificação do sistema | `components/office/useNotificacoesSO.ts:28-48` (tag por canal, `silent` fora de prioridade alta) |
| permissão por canal | `lib/canal/gate.ts:16,26,29` (`privado|turma|aberto`) + 403 testado |
| agente entra no canal ao ser mencionado | `[id]/mensagem/route.ts` (`novos = mencoes.filter(...)`), **teto de 12 agentes** (`[id]/route.ts:49`) |
| "digitando" | `EV_DIGITANDO` em `agent-turn.ts:178,204` — **só de agente** |
| config do canal | painel `⚙︎` (`:312-340`): acesso, convite por e-mail, remover membro, `cartolinaId` |

**Não existe** (e cada ausência tem consequência para agentes conversando entre si):

| Falta | Por que importa AGORA |
|---|---|
| **thread (`parentId`)** | sem thread, debate de agente vira enxurrada no fio principal. É o pilar, não um luxo. |
| **histórico paginado** | `take: 60` fixo em `[id]/route.ts:22`, sem cursor. Dois agentes conversando estouram 60 mensagens em minutos e o começo vira inacessível. |
| **leitura persistida** | `naoLidas` é estado **local** do React. Troca de aparelho = perde. Sem isso não existe "o que rolou enquanto eu dormia". |
| DM 1:1 | mentor↔mentor precisa de canal privado de dois (é o `Consulting` do AG2 e o DM do Moltbook). |
| reações | o `👍` no plano do agente é **aprovação barata** — hoje exige frase. |
| busca | um mural de conhecimento sem busca é um arquivo morto. |
| upload no canal | `CanalMensagem` só tem `texto`. O PDF que o humano joga na sala deveria virar fonte. |
| editar/excluir mensagem | só POST em `[id]/mensagem/route.ts`; DELETE existe só para o canal inteiro. |
| humano digitando | assimetria esquisita: o agente mostra, o humano não. |
| **qualquer proatividade** | `grep -riE "setInterval|cron|scheduler|proativ|autonom"` em `lib/canal`, `app/api/canal`, `components/office` → **zero**. O único gatilho do universo é `dispararTurnos(mencoes.map(...))`. |

**Três achados que mudam a ordem de execução:**

1. **`lib/canal/serial.ts` garante "um turno por canal" só DENTRO DE UM PROCESSO.** Ele encadeia
   promessas num `Map<string, Promise>` em memória. Hoje isso basta (um gatilho humano por vez).
   Com N agentes proativos + web + worker, **dois processos tocam o mesmo canal ao mesmo tempo** e
   a sala vira sobreposição de falas. Precisa de **lock distribuído no Redis** antes de qualquer
   proatividade — não depois.
2. **`N_CONTEXTO = 30`** (`agent-turn.ts:19`) é o histórico linear que vai pro prompt. Quando
   agentes falarem entre si, essas 30 mensagens serão **eco de agentes** e o mentor vai responder
   ao ruído dos colegas em vez do assunto. O contexto tem que virar *por thread + relevância*.
3. **O OmniRoute não existe no código.** Grep por `omniroute|omni_route|omni-route` em todo o repo:
   **zero** (só falsos positivos: "Omniscient" como label de super admin em
   `app/workstation/page.tsx:472` e "Omni-1" decorativo em `ResearchesView.tsx:46`). Como ele é a
   decisão de gateway 24/7 com fallback entre provedores, **ele é pré-requisito** de agente
   proativo: sem fallback, o primeiro 429 do Vertex derruba a sala inteira e o usuário vê mentores
   mudos sem saber por quê.

---

## BLOCO A — o canal aguenta conversa de verdade

### PR-S0 — OmniRoute como gateway único de IA (pré-requisito de 24/7)

**Por quê primeiro:** hoje toda chamada vai direto ao Vertex. Um agente reativo que falha deixa o
humano irritado; **um agente proativo que falha em silêncio, às 3h da manhã, apaga o trabalho do
ciclo** e ninguém vê. Agente autônomo precisa de fallback, retry e teto por chave.

**Fazer:**
1. Subir o OmniRoute self-host (OpenAI-compatible) e apontar **um único** ponto de saída do app
   para ele. O ponto de entrada hoje é `lib/ai/*` (`model.ts` centraliza o modelo, `router.ts` tem
   `LARGE_CONTEXT = 80_000`, `gemini-text.ts` fala com o Vertex) — envelopar ali, **não** espalhar.
2. **Gemini segue primário** (o crédito GenAI é a base da Zaeon); pool gratuito/barato como
   fallback para volume; `economia`/deep thinking continua decidindo o *tier*, não o provedor.
3. O envelope devolve `usage` normalizado — **é o mesmo envelope do PR-A1** (telemetria de tokens).
   Fazer os dois juntos: um envelope, duas saídas (ledger + resposta).
4. Classificar falha: `rate_limit` → fallback; `auth`/`billing` → alerta no admin e **pausa o
   autônomo** (não o humano); `timeout` → retry com backoff, teto 2.
5. Health: `/api/health` já responde `harness:on`; acrescentar `gateway:on|degraded|off` e qual
   provedor está servindo.

**Gate:** derrubar o Vertex artificialmente e a sala continuar respondendo pelo fallback, com o
admin mostrando `degraded`; o `TokenLedger` gravando o provedor usado.

---

### PR-S1 — Threads (o pilar)

**Fazer:**
1. `CanalMensagem` ganha `parentId String?` (+ `@@index([canalId, parentId, createdAt])`),
   `respostas Int @default(0)` (contador desnormalizado, incrementado na criação) e
   `ultimaRespostaEm DateTime?`.
2. `POST /api/canal/[id]/mensagem` aceita `parentId`. Regra: **profundidade 1** — resposta de
   resposta cai na mesma thread (igual Slack; evita árvore que ninguém lê).
3. `GET /api/canal/[id]` continua devolvendo só o **fio principal** (`parentId: null`); nova rota
   `GET /api/canal/[id]/thread/[msgId]` devolve a thread com cursor.
4. UI: painel de thread à direita (ou drawer no mobile), chip "N respostas · últimas: avatares" na
   mensagem-raiz; `EV_MENSAGEM` ganha `parentId` no `MensagemWire` para o cliente decidir se
   renderiza no fio ou só incrementa o contador.
5. **Regra de ouro dos agentes:** debate agente↔agente **só em thread**. No fio principal entra
   uma linha de abertura e uma de conclusão. É o que o `virtual-lab` faz com reunião e o que
   impede o humano de ser soterrado.

**Gate:** 20 mensagens de debate numa thread não movem o fio principal além de 2 linhas; abrir a
thread mostra tudo em ordem; contador bate.

---

### PR-S2 — Histórico paginado + leitura persistida

**Fazer:**
1. `GET /api/canal/[id]?before=<cursor>&limit=50` com cursor por `createdAt+id` (não `skip`).
   Trocar o `take: 60` fixo (`[id]/route.ts:22`) por janela + scroll infinito para cima, mantendo
   a âncora de scroll (não pular a tela ao carregar).
2. Model `CanalLeitura` (`@@map("canal_leituras")`): `userId`, `canalId`, `ultimaLidaEm`,
   `ultimaLidaId`, `@@unique([userId, canalId])`. `POST /api/canal/[id]/lido` ao focar/abrir.
3. Não-lidas passam a vir do servidor: `GET /api/canal?resumo=1` devolve contagem por canal — badge
   consistente entre aparelhos. Manter `lib/canal/notificacoes.ts` (as regras puras continuam
   valendo), só trocar a fonte do número.
4. **Divisor "novo desde a última visita"** no fio — é o que torna digerível o que os agentes
   produziram de madrugada.
5. Retenção: índice e `limit` cuidam da leitura; sem TTL de mensagem por agora (decidir depois, com
   volume real medido).

**Gate:** 500 mensagens no canal, scroll para cima carrega em páginas sem saltar; abrir num segundo
aparelho mostra a mesma contagem de não-lidas; o divisor aparece no lugar certo.

---

### PR-S3 — Mensagens de primeira classe: editar, excluir, fixar, reagir

**Fazer:**
1. `editadoEm DateTime?`, `excluidoEm DateTime?` (soft delete — mensagem de agente **nunca** é
   apagada de verdade: o rastro importa, marca "removida"), `fixadoEm`, `fixadoPor`.
2. `PATCH`/`DELETE` em `app/api/canal/[id]/mensagem/[msgId]/route.ts`: autor edita a própria em
   até 15 min; `podeGerir` (owner, `gate.ts:29`) exclui/fixa qualquer uma.
3. **Reações como sinal, não enfeite** — model `CanalReacao` (`msgId`, `userId`, `emoji`,
   `@@unique([msgId,userId,emoji])`). O set é curto e **tem semântica para o agente**:
   `👍` aprovo · `👎` refaça · `🔖` guarde isso (vira `MemoryDrawer`) · `🚀` promova a tarefa
   (`AgentTask` do PR-A4) · `❓` explique melhor. Reação em mensagem de agente **é comando**: é a
   aprovação de um clique que o `co-pilot mode` do Agent Laboratory precisa.
4. Mensagens fixadas = o briefing do canal; vão para o topo do prompt do agente
   (`blocoCanal`, `agent-turn.ts:90`) em lugar nobre.

**Gate:** `🚀` numa proposta de agente cria a tarefa; `🔖` grava na memória do canal; editar depois
de 15 min é recusado; mensagem de agente excluída aparece como "removida", não desaparece.

---

### PR-S4 — Busca no canal

**Fazer:** `GET /api/canal/[id]/busca?q=` (e `GET /api/canal/busca?q=` global, respeitando
`podeLer`) em dois modos: (a) texto, índice Mongo em `texto`; (b) **semântica**, reusando
exatamente a máquina da memória L3 — `gemini-embedding-001`, EMBED_DIM 1536,
`$vectorSearch`+`$rankFusion` (`lib/agent/memory.ts`). Embedding gerado no envio (job barato na
fila, não no caminho crítico). ⚠️ índice vetorial Atlas é **manual** — entra no runbook junto de
`memory_drawers_vec` e `zxiv_papers_vec`; sem ele, **degradar com aviso**, nunca em silêncio.
Filtros: autor, agente, só threads, período, "só mensagens com fonte".
**O agente usa a mesma busca** como tool `canal_search` — é assim que ele lembra do que a sala já
discutiu em vez de repetir pergunta.

**Gate:** buscar por sinônimo acha a mensagem; sem índice Atlas, a resposta diz "busca semântica
indisponível, usando texto".

---

### PR-S5 — Upload no canal vira fonte

**Fazer:** `anexos Json?` em `CanalMensagem` (`[{kind, nome, mime, storageRef, bytes}]`), upload
reusando `lib/studio/storage.ts` (`.studio/`, `studioFilePath`) e metadado em `StudioArtifact`
(`kind:"file"`). PDF/CSV/imagem postados no canal **entram no acervo do canal** e ficam
disponíveis ao `literature_search` (PR-A5) como fonte local com chave de citação própria
(`zxc-…`), ao lado das externas. Limites: 20 MB por arquivo, antivírus fora de escopo, sanitizar
nome, nunca executar nada.

**Gate:** jogar um PDF na sala e perguntar "@mentor o que esse anexo diz sobre X" produz resposta
com citação apontando para o anexo, não para a internet.

---

### PR-S6 — DM: humano↔agente e **agente↔agente**

**Fazer:** `Canal.tipo` (`canal|dm`) + `Canal.par String[]` (dois participantes, humano ou agente)
com `@@unique` no par ordenado; `acesso` forçado a `privado`. Criar/achar por
`POST /api/canal/dm { com }`.
- **Humano↔agente:** conversa privada com um mentor sem poluir a sala.
- **Agente↔agente:** é o canal `Consulting` do AG2 — **uma pergunta, uma resposta, fecha**; e é o
  DM do Moltbook com **consentimento**: o primeiro contato entre dois mentores precisa de aval do
  dono humano do canal (uma vez, depois fica liberado para aquele par). Flag `needs_human_input`
  escala para o humano quando a dupla travar.
- Teto duro: um par de agentes não abre mais de N DMs por dia; conversa de DM **não** entra no
  contexto do canal (isolamento), só o resumo pode ser citado.

**Gate:** mentor A consulta mentor B em DM, a resposta aparece citada no canal como "consultei
@B: …", o canal não recebe a conversa inteira, e o segundo contato não pede aval de novo.

---

## BLOCO B — agentes como membros de verdade (não como comando de chat)

### PR-S7 — Lock distribuído de turno (corrige o `serial.ts`)

`lib/canal/serial.ts` é correto e **insuficiente**: `Map<string, Promise>` só vale no processo.
Fazer: lock no Redis por `canal:<id>:turno` com TTL e renovação (lease, como no deer-flow), API
igual à atual (`emSerie(chave, fn)` ganha implementação distribuída quando `REDIS_URL` existe, e
cai no `Map` quando não existe — o repo já usa esse padrão de degradação em três lugares). Fila de
espera por canal com teto: se já há 3 turnos enfileirados no mesmo canal, o 4º é recusado com aviso
("a sala está ocupada") em vez de empilhar.

**Gate:** dois processos (web + worker) disparando turnos no mesmo canal produzem falas
sequenciais, nunca sobrepostas; matar o worker no meio libera o lock por TTL.

---

### PR-S8 — Contexto por thread e relevância (aposentar o `N_CONTEXTO = 30` linear)

Fazer `lib/canal/contexto.ts`: montar o prompt do turno com **(a)** as fixadas do canal, **(b)** a
thread corrente inteira (até um teto), **(c)** as últimas K do fio principal, **(d)** top-M por
**busca semântica** (PR-S4) sobre o objetivo do turno, **(e)** o resumo dos resumos de reuniões
anteriores. Cada bloco rotulado, com orçamento de tokens próprio e **ordem estável** (o cache de
contexto do Vertex, `lib/ai/contextCache.ts`, só ajuda se o prefixo não muda).
Regra anti-eco: fala de **outro agente** entra no contexto **marcada como tal** e com peso menor;
mentor não trata opinião de colega como evidência — só o que tem chave de citação é evidência.

**Gate:** num canal com 200 mensagens e 3 agentes ativos, o mentor responde ao assunto da thread e
não ao ruído; tokens de prompt caem em relação ao linear; o teste de eco (dois agentes
concordando entre si sem fonte) não produz conclusão.

---

### PR-S9 — Status do agente (presença de verdade)

Hoje só existe `EV_DIGITANDO` binário. Fazer `EV_AGENTE_ESTADO` com
`ocioso | pensando | trabalhando(taskId, fase, progress) | aguardando_humano(pergunta) | bloqueado(motivo) | fora(teto/degradado)`,
publicado nas transições e **persistido** (sobrevive a reload) numa coleção leve ou no próprio
`AgentTask`. Na sidebar do canal, lista de agentes com bolinha de estado — igual Slack mostra
pessoas, mas com o que o agente está fazendo. `bloqueado` e `fora` são **visíveis**: o usuário tem
direito de saber que o mentor está mudo porque estourou o teto, e não porque "não sabe".
`lib/office/mapa.ts` já tem `EstadoPod = "ocioso"|"trabalhando"|"falando"` — alinhar com este
contrato em vez de criar um segundo vocabulário.

**Gate:** mentor em tarefa longa aparece "trabalhando · reunindo fontes · 40%"; estourar o teto do
PR-A3 muda para "fora" com motivo legível; reload mantém o estado.

---

### PR-S10 — Perfil de agente dentro do canal

Clicar no avatar abre o card: o que ele cobre, `enabledSkills` reais vs **degradadas** (o repo já
tem `degradedSkills()` em `lib/agent/mentors.ts` — usar, com o aviso suave "em breve" em vez de
erro), conectores plugados, `data_access_level` (PR-A5), guardrails (saúde: educacional, nunca
diagnóstico), últimas entregas (links de `ResearchWork`/`ZxivPaper`), consumo de tokens (só admin),
e os controles: silenciar neste canal, remover do canal, "só responde se mencionado".
Isso resolve o que o Martinez viu no Nightingale: **quando a skill de busca está offline, o card
diz**. O usuário não precisa adivinhar pela redação da resposta.

**Gate:** com `literature_search` desligada, o card mostra "busca de literatura: indisponível" e a
resposta do mentor traz o mesmo aviso — nunca uma desculpa vaga.

---

## BLOCO C — proatividade (o que o Martinez quer de fato)

Sequência deliberada: **não** ligar nada disto antes de S7 (lock) e S1 (thread). Agente proativo
sem lock e sem thread não é autonomia, é spam concorrente.

### PR-P1 — O relógio: heartbeat por agente

Fila `agente-heartbeat` (6ª do repo) com **repeatable job do BullMQ** por agente ativo — o repo
**não tem nenhum scheduler hoje**, então isto é infraestrutura nova (mesma peça do PR-A8; fazer uma
vez e reusar). `jobId` idempotente `agentKey:canalId:slot`, jitter por agente para não disparar
tudo junto, e **reconciliação na subida** (BullMQ perde repeatables se o Redis for limpo).
Intervalo adaptativo no estilo do `leomariga/ProactiveAgent`: `min/max_response_interval` por
agente e por canal — o próprio agente calcula o próximo sono, com teto duro. Conteúdo do heartbeat
é **local**, em `lib/canal/heartbeat.ts`; **nunca** baixar instrução de fora (o furo do Moltbook).

### PR-P2 — O porteiro: gating em dois estágios (o PR mais importante do bloco)

O paper de 2026 (arXiv 2605.30152) mostra que **não precisa de LLM para decidir quando acordar** —
um estágio barato resolve e com limiar mais estável em produção. Então:
- **Estágio 1, determinístico, sem LLM**, em `lib/canal/gatilho.ts` (puro, testável): pontua sinais
  — pergunta sem resposta há >N min · tarefa concluída com desdobramento óbvio · lacuna declarada
  no dossiê · novo paper no Zxiv do domínio do mentor · anexo novo não lido · contradição entre
  duas mensagens com fonte · prazo do programa chegando. Abaixo do limiar: **não acorda**, e isso
  é o caso comum.
- **Estágio 2, com Gemini Flash**, só para o que passou: classifica a intenção de falar na
  **taxonomia de 4 classes do thunlp** (*correct-detection, false-alarm, missed-needed,
  non-response*) e decide o canal de saída.
- **Aprendizado do limiar:** cada fala proativa carrega as ações `👍 útil` / `👎 não` / `ignorar`
  (PR-S3). **Ignorar é sinal** — reduz a frequência futura daquele agente naquele canal. Limiar por
  mentor e por canal, recalibrado pela taxa de ignorado. É isso que separa proatividade de
  incômodo, e é medível.

### PR-P3 — Os olhos: watcher de tópico

Um mentor **assina** tópicos (do programa, do curso, do que a sala discute). O watcher roda no
heartbeat e faz **diff contra a última passada** (THE LOOP do watch-skill): fontes novas em
arXiv/PubMed/OpenAlex via `literature_search` (PR-A5), papers novos no Zxiv (PR-A7), anexos novos
no canal (PR-S5). **Se nada mudou, não fala** — e registra que checou, para o humano saber que o
agente está vivo sem precisar que ele diga "nada novo" todo dia. Cursor por fonte, para nunca
reprocessar. Saída default: **digest**, não mensagem solta.

### PR-P4 — A reflexão: o agente percebe lacuna e vira trabalho

Reflection por **limiar de importância acumulada** (Smallville): reusar `MemoryDrawer.importance`,
que já existe no schema. Quando a soma dos eventos recentes do canal/programa cruza o limiar, o
agente para, sintetiza e produz **uma** de três coisas: pergunta objetiva na thread, proposta de
`AgentTask` (PR-A4) com "aprovo?" de um clique (`🚀`), ou paper curto no Zxiv. A reflexão é
registrada como insight do canal — é o `reflect_code` do Agent Laboratory virando conhecimento em
vez de log.

### PR-P5 — A voz: como o agente proativo aparece na sala sem ser praga

Hierarquia de canais de saída, do mais silencioso ao mais intrusivo — o default é o mais silencioso:
1. **atualiza artefato/card** (ninguém é notificado);
2. **escreve no Zxiv** (aparece no mural);
3. **posta na thread** do assunto (notifica só quem segue a thread);
4. **digest diário** no canal, uma mensagem agrupando tudo (o "bom dia" do escritório);
5. **mensagem no fio principal** — reservada a: terminei o que você pediu · travei · **preciso de
   você**;
6. **notificação do sistema** (`useNotificacoesSO`) — só prioridade alta, que já é a regra em
   `lib/canal/notificacoes.ts`.
Freios somados: **token bucket por canal no Redis** · um agente não fala duas vezes seguidas no
mesmo minuto · loop guard de N trocas agente↔agente com menção humana resetando (agentchattr) ·
orçamento diário por agente (PR-A3) e por programa (PR-A8) · **horário de silêncio** por canal
(ninguém quer mentor animado às 4h) · kill-switch `PROATIVO=0`.

**Gate do bloco C (o teste que vale):** deixar a sala rodando 24h com 3 mentores proativos e um
programa ativo. Critério de sucesso: **≤3 mensagens proativas por dia no fio principal**, todas
classificadas úteis pelo humano, nenhuma repetida, o digest cobrindo o resto, e o custo dentro do
orçamento medido. Mais que isso é spam, mesmo que cada mensagem seja individualmente boa.

---

## III.1 — Ordem consolidada (Parte II + Parte III)

```
PR-S0 OmniRoute ──┬─► PR-A1 tokens ──► PR-A3 admin de gasto
                  └─► tudo que é 24/7
PR-S1 threads ────┬─► PR-A6 reunião (debate vive em thread)
PR-S2 histórico   │
PR-S7 lock ───────┴─► BLOCO C (proatividade). NADA de C antes de S1+S7.
PR-A5 busca+citação ──► PR-S4 busca no canal ──► PR-S8 contexto por relevância
PR-A4 tarefa ──► PR-S3 reações como comando ──► PR-S9 status do agente
PR-A7 Zxiv ──► PR-P3 watcher ──► PR-P4 reflexão ──► PR-P5 voz
PR-S5 upload · PR-S6 DM · PR-S10 card do agente — independentes, entram quando der
```

**Fatias sugeridas para o FABLE** (cada uma é uma entrega fechada, CI verde, flag off por padrão):

| Fatia | PRs | O que o Martinez vê no fim |
|---|---|---|
| **1. Fundação** | S0 + A1 + A3 + A2 | gateway com fallback, tokens medidos, admin mostrando gasto por agente, aba Mentores |
| **2. A sala aguenta** | S1 + S2 + S7 | threads, histórico infinito, não-lidas entre aparelhos, lock distribuído |
| **3. O agente trabalha** | A4 + A5 | `@mentor` vira tarefa com barra; busca real na internet com citação checada |
| **4. Conversa entre eles** | A6 + S3 + S6 + S9 | comitê em thread, reação como aprovação, mentor consultando mentor, status ao vivo |
| **5. Memória coletiva** | A7 + S4 + S8 + S5 | Zxiv, busca semântica na sala, contexto por relevância, anexo como fonte |
| **6. Autonomia** | A8 + A9 + A10 + A11 + A12 | programa com rotina diária, dossiê, vitrine, admin de programa |
| **7. Proatividade** | P1 + P2 + P3 + P4 + P5 + S10 | agentes que acordam, percebem, propõem — com ≤3 falas/dia no fio |

A fatia 2 é a que a verificação de hoje promoveu de "melhoria" para **pré-requisito**. Sem ela, as
fatias 4 e 7 produzem uma sala ilegível — e aí o problema não é mais técnico, é que ninguém vai
querer usar.
