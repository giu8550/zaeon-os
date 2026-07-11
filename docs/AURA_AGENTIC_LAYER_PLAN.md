# Aura Agêntica — Camada Inteligente (Harness + Ferramentas + Memória)

> Objetivo: elevar a **Aura** de um chat que raciocina sobre contexto para uma **cientista agêntica nível doutorado** — capaz de planejar, usar ferramentas/conectores e lembrar através do tempo para cumprir objetivos de estudo/pesquisa.
>
> Documento de **planejamento e prioridade**. Nenhuma linha de produção foi alterada por ele. Ancorado no que o zaeon-os já tem (Gemini único, `AgentContext`, action bus, Studio, Redis).
>
> Criado 2026-07-10. Fontes estudadas: SakanaAI/AI-Scientist, awesome-harness-engineering, MemPalace.

---

## 1. Os três repositórios — o que replicar (e o que NÃO)

### 1.1 SakanaAI/AI-Scientist — *o formato do cientista*
Pipeline fim-a-fim de descoberta automática: **ideação → checagem de novidade (busca na literatura) → experimentos (agente de código) → gráficos → redação (LaTeX) → revisão por pares automática (reflexão + ensemble, nota 1–10, accept/reject)**. Templates padronizados (`experiment.py`, `plot.py`, `prompt.json`, `seed_ideas.json`, `latex/template.tex`). Suporta Gemini.

**Replicar (adaptado à Sala de Estudos/Pesquisa da Zaeon, não a treino de redes neurais):**
- O **pipeline por estágios** com artefatos intermediários (o zaeon-os já tem `WORK_SECTIONS`/`buildDocFromDraft` na Sala de Pesquisa — é o mesmo espírito).
- O **loop de reflexão** e o **revisor-crítico** (um "Examiner"/reviewer que pontua e devolve fraquezas) — a Zaeon já tem o agente `examiner`; ele vira o *critic* do loop.
- A **checagem de novidade via literatura** (Semantic Scholar / OpenAlex) como **ferramenta** da Aura.

**NÃO replicar:** execução de código arbitrário LLM-escrito em GPU, LaTeX/`texlive-full`, templates de ML. O nosso "experimento" é pesquisa acadêmica/estudo, não `experiment.py`.

### 1.2 awesome-harness-engineering — *a engenharia do laço*
Taxonomia de primitivas de harness. As que importam pra nós, em ordem de impacto:
- **Agent Loop** — ReAct (Pensamento/Ação/Observação); um passo = observar→planejar→agir→verificar; *stop conditions* determinísticas + orçamento de tokens; **"reasoning sandwich"** (concentrar raciocínio no planejamento e na verificação). Lição central do repo: *"o harness é o carro, o modelo é o motor"* — mudanças só de harness levaram um agente do rank 30 ao top 5 sem trocar o modelo.
- **Middleware/Hooks** — interceptar cada etapa (`before_model`, `wrap_tool_call`, `after_model`) para guardrails determinísticos, injeção de contexto e HITL, sem sujar a lógica do agente.
- **Planning & Execute** — um *planner* gera a lista de passos uma vez; um *executor* percorre, replanejando só quando falha (`Plan.md` como estado).
- **Context Delivery** — contexto é recurso finito e curado; **retrieval-como-ferramenta** (A-RAG: expor busca como tool e deixar o agente puxar sob demanda) em vez de despejar tudo no prompt; regras críticas ficam no *system prompt*, não na compactação.
- **Tool Design** — nomes/esquemas/erros bons; anotações de risco (`readOnly`/`destructive`/`idempotent`); **code-execution-with-MCP** (o agente escreve código que chama tools → até ~98% menos tokens).
- **Permissions** — menor privilégio, *deny-by-default*, decisão determinística ALLOW/DENY/REQUIRE_APPROVAL/MASK antes de cada ação.

### 1.3 MemPalace — *a memória*
Memória **local-first**: guarda o histórico **verbatim** (não resume) e recupera por **busca semântica**, num índice estruturado — **wings** (pessoas/projetos), **rooms** (tópicos), **drawers** (conteúdo original). Backend plugável (ChromaDB por padrão; interface em `backends/base.py`). 96.6% R@5 no LongMemEval **sem chamada de LLM**. Tem **grafo de conhecimento temporal** (SQLite, com janelas de validade), **servidor MCP (29 tools)**, **wing + diário por agente**, e embeddings **`embeddinggemma-300m`** (multilíngue, 100+ idiomas — casa com nosso i18n PT/EN/ES).

**Replicar (conceito, não necessariamente o binário Python):** o **modelo palace** (wing/room/drawer) como esquema da memória da Aura; recuperação semântica barata; grafo temporal de entidades. Como o zaeon-os é Node/Next + Mongo + Redis, avaliamos **duas rotas** (ver Fase 3): (a) rodar o MemPalace real como microserviço via seu **MCP server**, ou (b) reimplementar o esquema palace sobre o que já temos (Mongo + `embeddinggemma` via Vertex/embeddings). `embeddinggemma` alinha com a nossa stack Gemini.

---

## 2. Onde o zaeon-os já está (base a reaproveitar)

| Peça | Arquivo | Estado |
|---|---|---|
| IA única (Gemini Flash / Vertex) | `lib/ai/model.ts`, `lib/ai/vertex-credentials.ts` | ✅ |
| Rota de chat + function-calling | `app/api/ai/chat/route.ts` (`summon_agent`, `open_room`, `updateSchedule`) | ✅ (tools por agente; **aura hoje sem tools**) |
| Streaming (output aos poucos) | `app/api/ai/chat/route.ts` (`stream:true`) | ✅ recém-adicionado |
| Contexto durável do agente | `lib/agent/context.ts`, `src/models/AgentContext.ts` | ✅ (world-state injetado no prompt) |
| Action bus (plano visível) | `lib/agent/actions.ts` (`AgentStep`/`startPlan`) | ⚠️ hoje só narra navegação, não executa tools |
| Studio (geração de artefatos) | `lib/studio/*`, `/api/studio/*`, `StudioDock`, `StudioPalette` | ✅ (guia/mapa/flashcards/faq/imagem/podcast/vídeo) |
| Cache + rate-limit | Redis Upstash (`lib/ai/contextCache.ts`, helpers) | ✅ |
| Docs de harness já iniciados | `docs/AGENT_CONTEXT_AND_EXECUTION.md`, `AGENT_FINALIZATION_LOOP.md`, `AGENT_STATUS_E_GAPS.md` | ✅ |

**Leitura:** já temos *plano visível* e *contexto durável*. Faltam os três saltos: (1) **loop real com tool-calling** para a Aura, (2) **catálogo de ferramentas/conectores** de verdade, (3) **memória** persistente e recuperável.

---

## 3. Arquitetura-alvo (visão)

```
                ┌─────────────────────────── AURA HARNESS ───────────────────────────┐
  usuário  →    │  Planner (Gemini)  →  Executor loop (ReAct)  →  Critic/Reviewer     │  → resposta + artefatos
                │        │                    │  observe→act→verify        │           │
                │        │                    ▼                            │           │
                │        │            Tool Registry (function-calling)     │           │
                │        │      ┌───────────┬───────────┬───────────────┐  │           │
                │        │      │ Studio     │ Literatura │ Conectores MCP │ │           │
                │        │      │ (gerar)    │ (S2/OpenAlex)│ (OSS)        │ │           │
                │        │      └───────────┴───────────┴───────────────┘  │           │
                │        ▼                                                 ▼           │
                │   AgentContext (world-state)               Memória (palace: wing/room/drawer + grafo) │
                └──────────── guardrails / permissões / hooks (middleware) ───────────┘
```

Três pilares, um harness. Cada pilar entra em fases de prioridade.

---

## 4. Plano por etapas (ordem = prioridade)

> Regra de ouro tirada do harness-engineering: **primeiro o laço e os guardrails, depois mais ferramentas, por último a memória sofisticada.** Ferramenta sem loco confiável vira caos; memória sem loop não tem o que lembrar.

### Fase 0 — Fundação do harness (1 tool real na Aura) · *prioridade máxima*
Transformar a Aura de "sem tools" para "com function-calling", reusando o padrão que já existe (`summon_agent`).
- Dar à Aura um `tools: [functionDeclarations]` na `chat/route.ts` (hoje `undefined` para aura).
- Primeira tool: **`studio_generate`** (kind + topic) — liga o `StudioPalette` ao Studio de verdade: pedir "gere um podcast sobre X" faz a Aura **chamar** a função e o artefato cai na conversa (fecha o gap que deixamos aberto na Fase 1 da UI).
- Loop mínimo ReAct no servidor: se vier `functionCall` → executa (chama `/api/studio/*` ou `lib/studio/*`) → devolve `functionResponse` ao modelo → texto final. Streaming preservado para a parte textual.
- **Guardrail**: `studio_generate` é `openWorld` mas não-destrutiva; exige um `spaceId`/tópico válido. Sem efeitos colaterais fora do caderno.
- **Verificação**: teste de que "gere um mapa mental sobre fotossíntese" produz um `StudioBlock` de mapa na conversa, com o loop server-side; unit test do parser de `functionCall`.

Entregável: `lib/agent/tools.ts` (registry) + branch de tool-loop em `chat/route.ts`. **É o menor passo que já muda a natureza da Aura.**

### Fase 1 — Loop robusto + guardrails + observabilidade
Solidificar o laço antes de multiplicar tools.
- **Executor loop** com: limite de iterações, orçamento de tokens, *stop conditions* determinísticas, detecção de repetição (loop-detection).
- **Middleware/hooks** (`before_model`/`wrap_tool_call`/`after_model`) para: injeção de `AgentContext`, redação de PII, e ponto único de **permissão** (ALLOW/DENY/REQUIRE_APPROVAL) por tool — aproveitando o `deepThinkEnabled`/roles que já existem.
- **Tracing**: cada passo do loop vira um `AgentStep` no action bus atual (`lib/agent/actions.ts`) — o cockpit já sabe mostrar; agora mostra *tools rodando*, não só navegação.
- **Reasoning sandwich**: usar o *deep thinking* (já gateado por admin) concentrado no planejamento e na verificação.
- **Verificação**: um teste de "tarefa multi-step" (ex.: "faça um guia e depois um FAQ do mesmo tema") percorre 2 tools sem vazar contexto nem travar; logs do trace conferem.

### Fase 2 — Catálogo de ferramentas & conectores (o "usa ferramentas para cumprir objetivo")
Agora sim, expandir capacidades — cada tool com esquema, anotação de risco e erro estruturado.
- **Pesquisa acadêmica (núcleo doutorado):** tool `literature_search` via **OpenAlex** (sem API key) e/ou **Semantic Scholar** — replicando a checagem de novidade do AI-Scientist. Vira a ponte pra Sala de Pesquisa que já existe.
- **Retrieval-como-ferramenta (A-RAG):** expor `search_study`/`read_drawer` sobre a memória (Fase 3) e sobre o caderno atual, em vez de despejar tudo no prompt.
- **Conectores OSS via MCP:** adotar **MCP** como protocolo de tools externas (o ecossistema — Composio p/ SaaS, servers oficiais — encaixa aqui). Começar com 1 conector read-only de baixo risco.
- **code-execution opcional:** para tarefas com muitos passos de tool, avaliar o padrão "escrever código que chama tools" (grande economia de tokens) — só depois do loop maduro.
- **Verificação:** cada tool tem teste de contrato (schema in/out) + anotação de risco; `literature_search` retorna citações reais checáveis.

### Fase 3 — Memória (palace) · *o que dá continuidade à cientista*
Dar à Aura memória de longo prazo recuperável — o pilar MemPalace.

> **⚑ ATUALIZADO (2026-07-11) — fonte-da-verdade da memória = `docs/MEMORY_AND_PERSISTENCE.md`.**
> Duas decisões do Martinez **sobrepõem** o que estava aqui: (1) memória avançada é **STANDARD
> para TODAS as contas** (não é gate de plano; o plano gateia só compute de geração); (2) a rota
> é **NATIVA no Next/Mongo (Atlas Vector Search)**, **NÃO** o MemPalace-repo via MCP (o `agent-gateway`
> é a jogada de WhatsApp, fica parado — ver o doc). A memória vira a **escada L0→L3**; o **L1
> (transcrição durável) já foi construído** localmente como base. `embeddinggemma-300m` continua
> como alternativa multilíngue **se** hospedarmos o modelo; o default pragmático é
> `gemini-embedding-001` (API, sem hosting). Contrato TS pronto: `lib/agent/memory.ts`.
- **Esquema palace**: `wing` (usuário/curso/projeto) → `room` (tópico/matéria) → `drawer` (trecho verbatim: mensagens, citações destacadas, artefatos). Modelar em Mongo (já temos) + índice vetorial.
- **Embeddings**: `embeddinggemma-300m` (multilíngue, casa com PT/EN/ES e com a stack Gemini) para busca semântica barata; recall sem depender de LLM (lição de custo do MemPalace).
- **Recall como tool** (`memory_search`) + **wake-up** no início da sessão (injeta no `AgentContext` o que é relevante do palace).
- **Grafo temporal** (opcional, fase tardia): entidades/relações com janela de validade (SQLite/Mongo) para "o que era verdade quando".
- **Decisão de rota**: (a) rodar o **MemPalace real** como microserviço e falar com ele via **MCP** (reusa 96.6% R@5 e 29 tools prontas) — recomendado se aceitarmos um serviço Python ao lado (temos precedente: voice-engine/abnt-service); ou (b) reimplementar o esquema em Node. **Recomendação inicial: (a)** por custo/benefício e por já termos a cultura de microserviço.
- **Verificação**: "o que decidimos semana passada sobre X" recupera o drawer certo; benchmark de recall interno.

### Fase 4 — Cientista completa (pipeline + crítico) · *o "nível doutorado"*
Compor as fases num fluxo de pesquisa autônomo-assistido.
- **Pipeline por estágios** (à la AI-Scientist, no domínio acadêmico): ideação → novidade (`literature_search`) → esboço/estrutura (`WORK_SECTIONS` que já existe) → produção (Studio + redação) → **revisão pelo `examiner`** (reflexão + nota) → iterar.
- **Critic loop**: o `examiner` pontua e devolve fraquezas; a Aura replaneja. É o loop de reflexão do AI-Scientist mapeado nos nossos agentes.
- **Human-in-the-loop** nos pontos de decisão (aprovar tema, aprovar gasto de geração pesada — podcast/vídeo).
- **Verificação**: um trabalho de ponta-a-ponta (tema → artefatos → revisão) roda com aprovação humana nos gates; qualidade avaliada pelo revisor.

---

## 5. Ordem de prioridade (resumo executivo)

1. **Fase 0** — 1 tool real na Aura (`studio_generate`) + tool-loop mínimo. *Maior mudança pelo menor esforço.*
2. **Fase 1** — loop robusto, guardrails/permissões, tracing no action bus.
3. **Fase 2** — ferramentas de verdade: `literature_search` (OpenAlex/S2), retrieval-como-tool, 1º conector MCP.
4. **Fase 3** — memória palace (MemPalace via MCP recomendado) + recall/wake-up.
5. **Fase 4** — pipeline de pesquisa + crítico (`examiner`) = a cientista nível doutorado.

## 6. Riscos & princípios
- **Custo/latência**: Gemini Flash + cache Redis + retrieval sem-LLM (MemPalace) seguram o custo; deep thinking só nos gates (já gateado por admin).
- **Segurança**: *deny-by-default*, anotações de risco por tool, aprovação humana em ações destrutivas/caras; nada de execução de código arbitrário (ao contrário do AI-Scientist bruto).
- **Não regredir**: cada fase é aditiva; a Aura de chat continua funcionando enquanto o harness cresce por baixo. UI nova só opt-in (política do projeto).
- **i18n**: `embeddinggemma` multilíngue mantém memória/recall coerentes em PT/EN/ES.

## 7. Fundamentação do harness — a resposta como TRAJETÓRIA TIPADA (multi-step)

> Ponto de inflexão: o "resultado" da Aura **não é um texto**. É o **estado final de um processo estruturado**. O harness existe para impor essa estrutura por fora do modelo — é assim que modelos SOTA produzem respostas elaboradas: eles gastam compute variável decompondo, coletando, raciocinando, se criticando e revisando, em vez de cuspir uma completon única.

### 7.1 A abstração central — `AuraTrajectory` (estado tipado do turno)
Cada turno da Aura opera sobre um objeto de estado tipado que flui pelas fases. É o "caderno de trabalho" do turno — inspirado no *typed-state + checkpointing* do LangGraph, nos artefatos por estágio do AI-Scientist e nos *drawers verbatim* do MemPalace.

```ts
type Finding = { claim: string; source?: Source; confidence: "alta"|"média"|"baixa" };
type Issue   = { tipo: "sem-fonte"|"lacuna"|"impreciso"|"confuso"; onde: string; sugestao: string };

type AuraTrajectory = {
  objective: string;              // o que o usuário quer, normalizado
  mode: "quick"|"elaborated"|"research";  // compute adaptativo (ver 7.4)
  budget: { maxIter: number; maxTokens: number; deadlineMs?: number };
  plan: Step[];                   // sub-perguntas / ações (planner, 1x)
  evidence: Finding[];            // de tools (literatura/memória/caderno) — SEMPRE com fonte
  reasoning: string;              // raciocínio ligado às evidências
  draft: StructuredAnswer;        // resposta candidata (ver 7.3)
  critique: Issue[];              // do crítico (examiner)
  score: number;                  // 1..10 do revisor
  final?: StructuredAnswer;       // resposta aprovada
  artifacts: StudioRef[];         // Studio gerados no caminho
  memoryWrites: Drawer[];         // o que persistir no palace (Fase 3)
};
```

O resultado que o usuário vê é o `final` renderizado; tudo o mais é o processo auditável que o produziu. **Cada resultado intermediário é tipado, não texto solto** — é isso que dá "lógica estrutural" às respostas.

### 7.2 O turno como laço (fases) — ReAct + Plan-Execute + crítico
```
route → plan → gather → reason → draft → critique → (revise ↺) → finalize+persist
```
1. **Route/Triage** (barato) — classifica complexidade → escolhe `mode` e `budget`. Compute adaptativo, como SOTA: pergunta trivial não paga o loop inteiro.
2. **Plan** (raciocínio pesado) — decompõe o `objective` em sub-perguntas/passos e decide quais tools. É o *planner* do plan-and-execute (roda 1x; replaneja só se falhar).
3. **Gather** (ReAct: act→observe) — chama tools (literatura, memória, caderno), preenchendo `evidence` com *findings com fonte*. Paraleliza quando dá.
4. **Reason/Synthesize** — conecta as evidências num raciocínio; nada de afirmar sem lastro em `evidence`.
5. **Draft** — produz a resposta seguindo o **schema de saída** (7.3).
6. **Critique** (raciocínio pesado) — o agente **`examiner`** revisa: cada afirmação tem suporte? há lacunas? está claro? Devolve `critique[]` + `score` (reflexão + revisor do AI-Scientist).
7. **Revise** — se `score < limiar` e há orçamento → volta pra *gather* ou *draft*. Senão finaliza. *Stop conditions* determinísticas: `maxIter`, orçamento, limiar de score, loop-detection.
8. **Finalize + persist** — streama o `final`; grava `memoryWrites` no palace; oferece artefatos/próximos passos.

### 7.3 O schema de saída — por que a resposta fica "melhor elaborada"
A elaboração não é enfeite de formatação empurrado no usuário — é um **contrato interno de completude**. Para uma resposta de estudo, o `StructuredAnswer` garante os campos:
- **núcleo** — a resposta direta primeiro;
- **desenvolvimento** — o porquê / a derivação, passo a passo;
- **conceitos-chave** — as âncoras do tema;
- **evidência** — fontes reais (quando a tool de literatura entra);
- **próximos passos** — artefato sugerido (guia? mapa? flashcards?) / o que estudar a seguir.

O modelo é obrigado a preencher o schema (estilo *structured outputs* — outlines/instructor); a superfície pode ser prosa fluida. A diferença é entre "despejo" e "resposta que fecha o assunto". Campo sem lastro em `evidence` é marcado como *sem-fonte* pelo crítico, não afirmado com confiança — padrão de honestidade nível doutorado (anti-alucinação).

### 7.4 Compute adaptativo (os "modos") — como SOTA
- **quick** — 1 passada, sem tools (conversa/trivial).
- **elaborated** — plan → reason → draft → auto-checagem leve (1 revisão), sem tools externas.
- **research** — laço completo com tools + crítico + iterações. É o modo "cientista".

O *router* decide pelo custo/complexidade; o usuário pode forçar ("pesquise a fundo"). Assim gastamos compute proporcional à dificuldade, sem pagar o loop inteiro em toda pergunta.

### 7.5 O "reasoning sandwich" (princípio fundacional)
Concentrar o *deep thinking* nas pontas — **plan** e **critique** — e manter o miolo (gather/draft) barato. É o resultado central do harness-engineering (mudança só de harness levou um agente do rank 30 ao top 5). Casa direto com o `deepThinkEnabled` que já gateamos por admin: pensamento caro só onde muda o resultado.

### 7.6 Mapa para o zaeon-os (nada disso é do zero)
- `AuraTrajectory` = objeto efêmero por turno + extensão do `AgentContext` durável (`lib/agent/context.ts`).
- Fases streamam como `AgentStep` no action bus (`lib/agent/actions.ts`) → o usuário vê "planejando / buscando / verificando".
- **Critic = agente `examiner`** (já existe) — vira o revisor do laço.
- Tools = registry da Fase 2; Persist = memória da Fase 3; Router/modos = classificador barato antes do laço.
- Streaming (já implementado) entrega o `final` aos poucos; os passos anteriores aparecem como trace.

### 7.7 Fundamentação (por que é alinhado ao SOTA)
ReAct (Pensamento/Ação/Observação) · Plan-and-Execute · LangGraph (estado tipado + checkpoint) · reasoning sandwich (harness > modelo) · reflexão + revisor-ensemble (AI-Scientist) · structured outputs (outlines/instructor) · retrieval-como-tool (A-RAG) · compute adaptativo (modelos de raciocínio SOTA).

---

## 8. Contratos: IntentRegistry, StructuredAnswer e ExaminerVerdict

> O vetor-mestre é a **intenção**. Ela seleciona o *modo*, o *schema* exigido, as *tools* liberadas e a *severidade do crítico*. Taxonomia fechada com o Martinez (2026-07-10).
>
> **Princípio:** estes contratos são deliberadamente **completos e auto-documentados** (tipos, comentários, defaults, rastreabilidade vetor→origem). Quanto mais contexto **comprovado** vive aqui, menos o agente de implementação precisa inferir/perguntar — **menos tokens e menos erro** ao executar o plano. Tratar como fonte-da-verdade dos tipos ao codar.

### 8.1 Taxonomia de intenções (final)

| # | Intenção | Modo | Tools | Crítico |
|---|---|---|---|---|
| 1 | `conversa` | quick | — | off |
| 2 | `duvida_rapida` | quick | memory | off |
| 3 | `explicar_conceito` | elaborated | memory, literatura | leve |
| 4 | `gerar_artefato` (Studio: mapa/flashcards/podcast…) | elaborated | studio_generate | leve |
| 5 | `criar_trabalho` — família `kind`: **estudo · pesquisa · artigo · tcc · relatorio** | research (estágios) | literatura, memory, studio, caderno | full |
| 6 | `pesquisar_fontes` | elaborated | literature_search | leve |
| 7 | `revisar` (o examiner virado pro usuário: "revisa/argui meu material") | research | examiner, memory | é o próprio crítico |

`criar_trabalho` é **uma intenção com subtipo `kind`** (template-por-domínio, vetor do AI-Scientist): cada `kind` resolve seu framework de seções (reusa `WORK_SECTIONS` da Sala de Pesquisa). `estudo` cria um StudySpace/caderno; `pesquisa/artigo/tcc/relatorio` são os worktypes acadêmicos; **`aula`** gera uma aula rica (liga à Sala de Aula / área do professor). Todo `kind` "de peso" obedece o **Padrão de qualidade (8.7)**.

### 8.2 `StructuredAnswer` — contrato de saída (campos opcionais; a intenção exige um subconjunto)

```ts
type Source = { title: string; url?: string; authors?: string; year?: number };
type WorkKind = "estudo" | "pesquisa" | "artigo" | "tcc" | "relatorio" | "aula";

// PROVENANCE (padrão open-science: todo artefato/afirmação rastreia sua origem).
// Barato de gravar, transforma reprodutibilidade em diferencial. Casa com o palace.
type ProvenanceRecord = {
  by: string;            // agente que gerou (StudentAgent.id)
  intent: IntentId;      // intenção que disparou
  toolsUsed: string[];   // tools/skills chamadas (slugs)
  sources: Source[];     // fontes consultadas (literatura/memória/caderno)
  model: string;         // modelo + versão (ex.: "gemini-flash@2026-07")
  at: string;            // ISO timestamp
  traceId: string;       // liga ao AuraTrajectory / aos AgentStep do action bus
  inputsHash?: string;   // hash dos inputs (reprodutibilidade)
};

type StructuredAnswer = {
  nucleo: string;                                   // resposta direta (sempre)
  desenvolvimento?: string;                         // derivação / passo a passo
  conceitos?: string[];                             // âncoras do tema
  evidencia?: { claim: string; source: Source }[];  // afirmações COM fonte (vetor MemPalace)
  proximos_passos?: string[];                       // artefato sugerido / o que estudar
  artifacts?: StudioRef[];                          // Studio gerados (cada um com provenance)
  work?: { kind: WorkKind; sections: { title: string; body: string }[] }; // criar_trabalho
  sources?: Source[];                               // pesquisar_fontes
  provenance?: ProvenanceRecord;                    // origem rastreável (open-science)
};
```

### 8.3 `IntentRegistry` — a intenção declara o resto

```ts
type Mode = "quick" | "elaborated" | "research";
type CriticLevel = "off" | "leve" | "full";
type IntentId =
  | "conversa" | "duvida_rapida" | "explicar_conceito" | "gerar_artefato"
  | "criar_trabalho" | "pesquisar_fontes" | "revisar";

type IntentSpec = {
  id: IntentId;
  mode: Mode;
  tools: string[];                            // tools liberadas nesta intenção
  critic: CriticLevel;
  required: (keyof StructuredAnswer)[];       // campos obrigatórios do schema
  reviseThreshold?: number;                   // score mínimo p/ aceitar (critic != off)
  maxRevisions?: number;                      // teto de iterações do laço
  reflections?: number;                       // auto-reflexões do crítico (AI-Scientist)
  ensemble?: number;                          // reviews agregados (variância; só no pesado)
};

const INTENTS: Record<IntentId, IntentSpec> = {
  conversa:          { id:"conversa",          mode:"quick",      tools:[],                                              critic:"off",  required:["nucleo"] },
  duvida_rapida:     { id:"duvida_rapida",     mode:"quick",      tools:["memory_search"],                               critic:"off",  required:["nucleo"] },
  explicar_conceito: { id:"explicar_conceito", mode:"elaborated", tools:["memory_search","literature_search"],           critic:"leve", required:["nucleo","desenvolvimento","conceitos","proximos_passos"], reviseThreshold:7, maxRevisions:1 },
  gerar_artefato:    { id:"gerar_artefato",    mode:"elaborated", tools:["studio_generate"],                             critic:"leve", required:["nucleo","artifacts"], reviseThreshold:7, maxRevisions:1 },
  criar_trabalho:    { id:"criar_trabalho",    mode:"research",   tools:["literature_search","memory_search","studio_generate","notebook_read"], critic:"full", required:["nucleo","work","evidencia","proximos_passos"], reviseThreshold:7, maxRevisions:2, reflections:2, ensemble:2 },
  pesquisar_fontes:  { id:"pesquisar_fontes",  mode:"elaborated", tools:["literature_search"],                           critic:"leve", required:["nucleo","sources"], reviseThreshold:6, maxRevisions:1 },
  revisar:           { id:"revisar",           mode:"research",   tools:["examiner","memory_search"],                    critic:"full", required:["nucleo","evidencia"], reflections:2 },
};
```

### 8.4 `ExaminerVerdict` — o contrato do crítico

Forma vinda do `perform_review` do AI-Scientist (`Overall` 1–10 + `Decision` + `Weaknesses`), enriquecida com o **diagnóstico de causa** (harness-engineering) e a **checagem de procedência** (MemPalace).

```ts
type IssueTipo =
  | "sem_fonte"       // afirmação sem lastro em evidencia[] (verificável, do MemPalace)
  | "lacuna"          // faltou cobrir parte do pedido / do schema
  | "impreciso"       // afirmação factualmente frágil
  | "confuso"         // clareza/estrutura ruim
  | "raso";           // profundidade abaixo do modo/intenção

type Issue = { tipo: IssueTipo; onde: string; porque: string; sugestao: string };

// Rubrica = ScholarEval (K-Dense, arXiv:2510.16234), aplicada de forma ADAPTATIVA
// por intenção: dúvida/conceito usam um subconjunto; criar_trabalho/revisar usam tudo.
type ScholarDim =
  | "problema"      // formulação/pergunta clara, relevante, factível
  | "literatura"    // cobertura + síntese crítica (não só resumo) + lacunas
  | "metodologia"   // adequação/rigor/reprodutibilidade
  | "dados_fontes"  // qualidade, credibilidade e representatividade das fontes
  | "analise"       // rigor, coerência lógica, alinhamento resultados×afirmações
  | "resultados"    // clareza, interpretação, implicações
  | "escrita"       // organização, tom acadêmico, fluidez
  | "citacoes";     // completude/precisão/normas/equilíbrio de perspectivas
type ExaminerRubric = Partial<Record<ScholarDim, number>>;   // cada dim 1–5 (escala ScholarEval)

// Grading de evidência em 4 níveis + auditoria de integridade (open-science
// integrity-auditor): eleva o crítico de "opinião" a "achado auditável".
type EvidenceLevel = 1 | 2 | 3 | 4;   // 1 fraca · 2 indireta · 3 sólida · 4 forte/reproduzível
type IntegrityFinding = {
  tipo: "imagem" | "numero" | "logica" | "citacao"; // classe do achado
  onde: string;
  nivel: EvidenceLevel;                             // força da evidência que sustenta a afirmação
  nota: string;
};

type ExaminerVerdict = {
  // dois critérios-meta do ScholarEval (retrieval-augmented, ancorado na literatura):
  soundness: number;                               // 1-10 — validade empírica ante a literatura
  contribution: number;                            // 1-10 — avanço relativo ao que já existe
  score: number;                                   // 1-10 agregado (ponderado por intenção)
  decision: "aprovado" | "revisar" | "reprovado";
  rubric: ExaminerRubric;                          // só as dims aplicáveis à intenção
  evidenceLevel: EvidenceLevel;                    // grading global da evidência (open-science)
  integrity: IntegrityFinding[];                   // achados de imagem/número/lógica/citação
  issues: Issue[];
  reflections?: number;                            // quantas auto-reflexões rodou
  ensemble?: number;                               // quantos reviews foram agregados
};
```

**Regra do laço (revise):** roda o crítico conforme `intent.critic`; se `decision !== "aprovado"` **e** `score < intent.reviseThreshold` **e** ainda há `maxRevisions` → volta a *gather*/*draft* com os `issues` como guia; senão finaliza. `sem_fonte` é a issue mais barata e objetiva (é só cruzar `draft` × `evidencia`), então é a primeira checagem — barata antes das caras (reflexão/ensemble). Calibração contra viés de positividade: crítico com `temperature` baixa e instrução "severo, porém construtivo" (lição direta do AI-Scientist).

### 8.5 Vetores → contrato (rastreabilidade)
- **template-por-domínio** (AI-Scientist) → `criar_trabalho.kind` + `IntentRegistry`.
- **structured outputs** (harness) → `StructuredAnswer.required` forçado por intenção.
- **compute adaptativo / loops** (harness) → `IntentSpec.mode`.
- **review dict + reflection + ensemble** (AI-Scientist) → `ExaminerVerdict` + `reflections`/`ensemble`.
- **guardrail diagnóstico** (harness) → `Issue{ tipo, onde, porque, sugestao }`.
- **procedência verbatim** (MemPalace) → `evidencia[].source` + issue `sem_fonte`.
- **ScholarEval 8 dims + soundness/contribution** (K-Dense) → `ExaminerRubric` + `ExaminerVerdict`.

### 8.6 K-Dense (scientific-agents / -skills / -writer) — o que encaixamos AGORA

Três repos analisados (todos MIT). O que dá pra pegar já, e o que fica pra depois:

**(a) ScholarEval → o crítico [ENCAIXADO AGORA, contrato].** O `scholar-evaluation` do scientific-writer é o framework ScholarEval (arXiv:2510.16234): **8 dimensões** (problema, literatura, metodologia, dados/fontes, análise, resultados, escrita, citações) + dois critérios-meta **soundness** (validade ante a literatura) e **contribution** (avanço relativo). É *retrieval-augmented* — o crítico consulta a literatura pra pontuar, o que casa com nossa evidência-com-fonte. Já reescrevemos o `ExaminerRubric`/`ExaminerVerdict` (8.4) com isso. Aplicação **adaptativa**: `dúvida_rapida` não roda ScholarEval; `criar_trabalho`/`revisar` rodam as 8 dims.

**(b) Perfis de especialista `AGENTS.md` → persona da Aura por curso [ADOTAR AGORA, barato].** O `scientific-agents` traz **503 perfis** de "pensar como um especialista sênior" (um `AGENTS.md` por profissão — bioinformata, epidemiologista clínico…), no padrão aberto agents.md. Vetor novo e forte: em vez de uma Aura genérica, **injetar no system prompt o perfil de especialista conforme o curso/sala do aluno** (já temos `getRoomForCourse`). Barato (é texto/persona) e transforma a qualidade do raciocínio por domínio. Entra como uma camada de persona no `finalSystemInstruction`, adaptativa por intenção pesada.

**(c) Agent Skills como a camada de tools [DECISÃO AGORA, código na Fase 2].** O `scientific-agent-skills` (138 skills) e o writer seguem o **padrão aberto Agent Skills (agentskills.io)** — o MESMO que Cowork/Claude Code usam. Decisão: em vez de hand-roll, **adotar skills prontas** como nossas tools da Fase 2 — em especial `paper-lookup` (10 bases: PubMed, arXiv, OpenAlex, Crossref, Semantic Scholar, CORE, Unpaywall…) = nosso `literature_search`/`pesquisar_fontes`; `scholar-evaluation` = nosso `examiner`; e candidatos: `scientific-critical-thinking`, `citation-management`, `hypothesis-generation`. São skills Python (uv) → rodam num microserviço (molde do voice-engine/abnt), então o **código** entra na Fase 2/3, mas a **arquitetura** (adotar o padrão, não reinventar) é decisão de agora.

**(d) Pipeline "pesquisar → verificar citações → escrever → avaliar → revisar" [VALIDA a Fase 4].** O scientific-writer confirma nossa `criar_trabalho`: pesquisa profunda ANTES de escrever, toda afirmação com fonte verificável, e re-avaliação por dimensão a cada revisão (rastreando a melhora do score entre versões). Sharpen direto do laço da Fase 4.

**Escopo (correção):** queremos **tudo que soma na pesquisa**. Se a skill/base está documentada, feita e reproduzível (é o caso — todas seguem o padrão Agent Skills com `SKILL.md` + exemplos), **entra, alta prioridade** — inclusive os 100+ bancos científicos e as skills Python. O que não é "não": é só um **passo de infra** (subir o runtime Python num microserviço, molde do voice-engine; e, para skills pesadas de compute, usar cloud sob demanda — o próprio ecossistema K-Dense usa Modal). LaTeX é só renderer, também reproduzível. Nada disso é descartado; é priorizado e faseado pela infra que cada um exige.

### 8.7 Padrão de qualidade das gerações (Definition of Done) — OBRIGATÓRIO

> Entendimento fechado com o Martinez antes do executor: **gerar aula / estudo / pesquisa deixa de ser "texto mastigado" de uma tacada.** As gerações "de peso" usam as ferramentas e passam pelo laço — é o que separa um blob de uma aula/pesquisa nível doutorado. O agente executor **deve** honrar este contrato.

**Regra-mãe:** `criar_trabalho` (kinds `aula/estudo/pesquisa/artigo/tcc/relatorio`) **NÃO é one-shot**. Roda a trajetória completa (`plan → gather → reason → draft → critique → revise↺ → finalize`), usa as tools (literatura, memória, Studio) e **só finaliza se passar no `ExaminerVerdict`** (score ≥ `reviseThreshold`) enquanto houver orçamento. A geração one-shot atual do Studio (`text-pipeline`) fica **só para artefatos leves** (flashcards/mapa a partir de um caderno pronto); o resto sobe pro novo bar.

**DoD — `aula` (rica, bem estruturada):**
- **objetivos de aprendizagem** explícitos (o que o aluno sai sabendo);
- **estrutura**: abertura/motivação → conceitos-chave (com âncoras) → exemplos/analogias → passo a passo/derivação → prática/exercícios → resumo → próximos passos;
- **enriquecida com artefatos embutidos** (mapa mental + flashcards + imagem/diagrama; podcast opcional) — via `studio_generate`, não descritos em texto;
- afirmações factuais **com fonte** (`evidenceLevel ≥ 2`); **adaptada ao nível** (`academicLevel`) e ao curso (persona);
- `provenance` + aprovada no `ExaminerVerdict` (dims clareza/completude/didática).

**DoD — `pesquisa`/`estudo` (rico):**
- **pergunta/objetivo bem formulado** (framing — science-superpowers);
- **fundamentação na literatura com citações REAIS** (`paper-lookup`), nunca inventadas; **síntese crítica**, não resumo;
- **estrutura por `WORK_SECTIONS`** do tipo;
- **evidência-com-fonte** em toda afirmação factual; `evidenceLevel ≥ 3` para conclusões;
- **ScholarEval** (soundness/contribution) acima do limiar; `provenance` completo.

**Gate comum (anti-alucinação):** nada "de peso" é entregue com `decision !== "aprovado"` havendo orçamento de revisão; afirmação **sem fonte é marcada** (`issue: sem_fonte`), não afirmada. Este é o **contrato de qualidade** — é ele que faz "gerar aula/pesquisa" valer o nome. **Ressalva:** o rigor total do DoD acadêmico vale conforme o **Modo acadêmico (8.8)** — pleno na Sala de Pesquisa; flexível na Sala de Estudos.

### 8.8 Modo acadêmico — escopo por sala (dimensão de primeira classe)

> Decisão do Martinez: "modo acadêmico" não é enfeite; é uma **dimensão que atravessa TODAS as implementações, ferramentas e níveis do harness**. Ele modula persona, tools, evidência e o crítico.

Campo novo no `AgentContext`/`AuraTrajectory`:
```ts
type AcademicMode = "enforced" | "flexible";   // pesquisa = enforced · estudos = flexible
```

**Sala de Pesquisa (`enforced`) — acadêmico não é opção, é a ÚNICA possibilidade:**
- persona = Escritor/Revisor científico; tom formal.
- `literature_search` restrito a **fontes acadêmicas** (paper-lookup: PubMed/arXiv/OpenAlex/Crossref/Semantic Scholar…); citações reais obrigatórias.
- `evidenceLevel` mínimo alto; `ExaminerVerdict` (ScholarEval) roda cheio; `sem_fonte` bloqueia.
- o DoD de `criar_trabalho` (8.7) vale integral.

**Sala de Estudos (`flexible`) — tudo LIGADO, mas a resposta pode ser geral:**
- persona = Aura companheira: responde com **conhecimento geral**, como uma LLM comum faria, quando o tema não exige academia.
- `literature_search` roda em **escopo amplo**: além de acadêmico, aceita **reportagens, artigos, web, enciclopédia**. **NUNCA recusar por falta de fonte acadêmica** — se não há paper, responde com o que há (e sinaliza a natureza da fonte).
- evidência-com-fonte continua sendo boa prática, mas o `sem_fonte` **não bloqueia** conversa geral; o crítico é leve (ou off) fora de `criar_trabalho`.
- as opções/artefatos do Studio seguem todas disponíveis; o rigor sobe automaticamente quando a intenção é `criar_trabalho`/`revisar`.

**Regra de resolução:** `academicMode` vem da **sala** (`activeTab`): pesquisa → `enforced`; estudos → `flexible`. A intenção pode elevar o rigor (um `criar_trabalho` na Sala de Estudos puxa o DoD acadêmico), mas nunca o contrário — a Sala de Pesquisa é sempre `enforced`.

**Onde reverbera (todas as camadas):** persona (systemContext) · `literature_search.scope` (`academic` | `broad`) · `IntentSpec` (limiares por modo) · `ExaminerVerdict` (rigor por modo) · UI (roupagem acadêmica na pesquisa; geral nos estudos).

---

## 9. Agentes do aluno + Sala de Skills (marketplace plugável)

> Visão do produto (Martinez): o aluno **cria o próprio agente conforme o curso**. Esse agente se reflete no chat da Sala de Estudos (a "Aura" personalizada) **e** na **Sala de Skills** (a antiga Sala de Plugins), um marketplace de **habilidades plugáveis** nos agentes dos alunos.

### 9.1 O agente do aluno = persona (por curso) + skills plugadas
Um agente do aluno é a soma de duas camadas, ambas no padrão aberto:
- **Persona / cérebro** — um perfil de "pensar como especialista sênior" no espírito do `AGENTS.md` (K-Dense `scientific-agents`, 503 perfis; padrão agents.md), adaptado ao curso do aluno e ao PT-BR de graduação. Injetado no `finalSystemInstruction` (aproveita `getRoomForCourse`).
- **Skills / habilidades** — capacidades plugáveis no padrão **Agent Skills** (`SKILL.md` + exemplos; agentskills.io). Cada skill vira uma ou mais tools no `IntentRegistry` daquele agente.

O `AgentContext` durável (`lib/agent/context.ts`) passa a carregar *qual agente* está ativo (persona + skills habilitadas), e o `AuraTrajectory` roda com esse conjunto. "Aura" é o agente-base; o aluno pode derivar o dele.

### 9.2 Sala de Skills = o marketplace (evolução do rename já planejado)
O `docs/PLANO_SKILLS_PRS.md` já prevê **Plugin → Skill** (rename + redirect, `@@map("Plugin")`, sem migração). Esta visão **eleva** esse rename: a Sala de Skills deixa de ser um catálogo cosmético e passa a hospedar **Agent Skills reais** (com `SKILL.md`), instaláveis/plugáveis nos agentes dos alunos.
- **Catálogo inicial**: as skills da K-Dense (MIT, reproduzíveis) — `paper-lookup`, `scholar-evaluation`, `scientific-critical-thinking`, `citation-management`, `hypothesis-generation`, `literature-review`, `database-lookup` (100+ bancos), `scientific-writing`, etc. — filtradas pelo que soma no estudo/graduação, mais as skills próprias da Zaeon (Studio, voz).
- **Modelo de dados**: estender o `model Skill` (já no plano) com os campos do padrão Agent Skills (`slug`, `manifest`/SKILL.md, `tools`, `runtime`, `risk`, `enabledForAgent`).
- **Gating** (reusa o que existe): por curso/role/founder; skills pesadas (compute) marcadas e liberadas conforme infra.

### 9.3 Runtime das skills (o passo de infra, não um "não")
Skills Python (uv) rodam num **microserviço de skills** (molde do `voice-engine`/`abnt-service`): a Aura chama a skill via HTTP/MCP, o microserviço executa em sandbox e devolve o resultado tipado (vira `evidence`/`artifact` no `AuraTrajectory`). Compute pesado → cloud sob demanda (Modal, como a própria K-Dense). Skills nativas em TS (Studio) rodam in-process. **O padrão é o mesmo; muda só onde executa.**

### 9.4 Faseamento desta camada
- **F2** — adotar o padrão Agent Skills + 1ª skill real via microserviço (`paper-lookup` = `literature_search`); Sala de Skills lista skills reais (estende o PR do rename).
- **F3** — `scholar-evaluation` (o `examiner`), `database-lookup`, memória (palace).
- **F4** — o aluno **cria/edita o próprio agente** (persona por curso + escolher skills), refletido no chat e no marketplace; skills pesadas via Modal.

Nada aqui é jogado fora: é o mesmo padrão aberto (persona `AGENTS.md` + `Agent Skills`) que já sustenta Cowork/Claude Code, agora dentro da Zaeon como produto pro aluno.

### 9.5 Modelo de dados do agente do aluno

Ancorado no schema atual (`model User` L17, `model Plugin` L253 — que o `PLANO_SKILLS_PRS.md` renomeia p/ `Skill`). Dois modelos novos/estendidos + back-relation no `User`.

**(1) `model StudentAgent`** — o agente que o aluno cria/edita.
```prisma
model StudentAgent {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  userId          String   @db.ObjectId
  name            String   @default("Aura")       // o aluno renomeia
  emoji           String?                          // "⟁" default
  course          String?                          // herda de User.course
  personaId       String   @default("aura-base")   // persona base (catálogo 9.6)
  personaExtra    String?                          // ajuste livre do aluno (opcional)
  enabledSkills   String[]                         // slugs de Skill habilitadas
  isDefault       Boolean  @default(true)          // agente ativo na Sala de Estudos
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

**(2) `model Skill`** (estende o `Plugin` renomeado, `@@map("Plugin")` → sem migração) com os campos do padrão Agent Skills:
```prisma
// campos NOVOS a somar ao model Skill do PLANO_SKILLS_PRS.md:
slug        String   @unique     // "paper-lookup"
manifest    String?              // conteúdo/URL do SKILL.md
source      String?              // "K-Dense-AI/scientific-agent-skills" | "zaeon"
tools       String[]             // tools que a skill expõe (entram no IntentRegistry)
runtime     String   @default("ts")   // "ts" (in-process) | "python" (microserviço) | "mcp"
risk        String   @default("read") // read | write | destructive (anotação de risco)
defaultOn   Boolean  @default(false)  // já vem ligada no agente novo?
courseTags  String[]                  // cursos/áreas onde é sugerida
```

**(3) `User`** ganha a back-relation e o ponteiro do agente ativo:
```prisma
studentAgents  StudentAgent[]
activeAgentId  String?   @db.ObjectId
```

No runtime: o `AgentContext` (`lib/agent/context.ts`) passa a carregar `{ persona (resolvida de personaId+course), enabledSkills }`; o `AuraTrajectory` roda com esse conjunto; o `IntentRegistry` só libera as `tools` das skills habilitadas.

**Multi-agente:** cada aluno tem um **roster** de `StudentAgent` (não um só). Na criação da conta ele já recebe um **roster seed** (9.7) e **escolhe/edita a persona base** do agente principal (decisão do Martinez). `isDefault`/`activeAgentId` dizem qual está ativo no chat; o aluno alterna entre eles (a pill "⟁ Aura" da barra de abas vira um seletor de agente).

### 9.6 Personas iniciais (por sala/curso — perfis "pensar como sênior")

Alinhadas às salas que já existem (`getRoomForCourse`: cyber, med, bio, quantic, humanities, lounge) e ao `User.academicLevel` (Graduação→Doutorado ajusta o rigor). Cada persona é um perfil curto no espírito `AGENTS.md`, em PT-BR de graduação (derivado/adaptado dos 503 perfis MIT da K-Dense, não copiado cru).

| personaId | Sala/curso | "Pensa como…" |
|---|---|---|
| `aura-base` | default / lounge | orientadora acadêmica generalista, rigorosa e didática |
| `cyber` | Cyber (Comp/Eng) | engenheiro(a) de software / cientista da computação sênior |
| `med` | MedLab | pesquisador(a) médico / epidemiologista clínico |
| `bio` | BioLab | bioinformata / biólogo(a) de bancada |
| `quantic` | Quantic | físico(a) / cientista quântico |
| `humanities` | Humanidades | metodólogo(a) de pesquisa em humanas |

O `academicLevel` modula o tom (graduação = mais didático; pós = mais crítico/denso). É o add-on barato da Fase 0 (só texto no `finalSystemInstruction`).

### 9.7 Roster inicial de agentes (seed na criação da conta)

Todo aluno já nasce com **3 agentes** — o próprio fato de existirem 3 papéis especializados que compartilham o mesmo laço **é o que justifica a camada harness** (a Aura orquestra; os outros são especialistas do mesmo motor). São `StudentAgent` seed:

| Agente | personaId | Papel | Skills habilitadas no seed |
|---|---|---|---|
| **Aura** | `aura-base` (+ curso) | orquestradora/estudo — conversa, dúvidas, gera artefato, cria trabalho | `studio`, `notebook` (F0) → +`literature`, +`memory` |
| **Revisor Científico** | `revisor` | critica/argui o material do aluno (a intenção `revisar`) | `scholar-eval` (ScholarEval), `scientific-critical-thinking`, `citation-management` |
| **Escritor Científico** | `escritor` | produz textos/trabalhos com fonte verificável (`criar_trabalho`) | `scientific-writing`, `literature`, `citation-management`, `scientific-schematics` |

O aluno **escolhe/edita a persona da Aura na criação** (curso → sugestão automática, mas editável); Revisor e Escritor vêm prontos e também são editáveis/duplicáveis. Novos agentes = derivar de um seed ou do zero.

### 9.8 Skills `defaultOn` por fase (o que fica ligado quando cada infra entra)

As skills python entram conforme o microserviço libera; até lá, o seed roda com o que é nativo/possível:

| Skill (slug) | runtime | risk | gating | Liga em |
|---|---|---|---|---|
| `studio` (guia/mapa/flashcards/faq/linha-do-tempo/imagem/podcast/vídeo) | ts | read | Livre | **F0** ✅ |
| `notebook` (caderno/StudySpace) | ts | write | Livre | **F0** ✅ |
| `literature` (`paper-lookup`) | python | read | Livre | F2 |
| `scholar-eval` (o examiner) | python | read | Alunos | F3/F4 |
| `memory` (recall do palace) | ts/mcp | read | Livre | F3 |
| `scientific-writing`, `citation-management`, `scientific-critical-thinking` | python | read/write | Alunos | F2/F4 |

### 9.9 Catálogo reaproveitável da K-Dense → Sala de Skills (MIT, filtrado p/ estudo/graduação)

Disponíveis no marketplace (nem toda `defaultOn`); risco anotado; runtime python salvo indicado.

**Pesquisa & Literatura** — `paper-lookup` (PubMed, arXiv, OpenAlex, Crossref, Semantic Scholar, CORE, Unpaywall), `literature-review`, `research-lookup`/web c/ citações, `citation-management` (BibTeX), `database-lookup` (100+ bancos — *gated por curso*).
**Escrita & Comunicação** — `scientific-writing`, `peer-review`, `scholar-evaluation`, `scientific-slides`, `scientific-schematics` (diagramas), `latex-posters`, `document-skills` (PDF/DOCX/PPTX/XLSX), `markitdown`, `infographics`.
**Metodologia & Pensamento** — `hypothesis-generation`, `scientific-critical-thinking`, `research-grants` (mais pós-graduação).
**Análise & Dados** — `statistical-analysis`, `data-visualization`/`scientific-visualization`, `EDA`.
**Packs de domínio (gated por curso, não-default)** — bio/quim/física pesados (RDKit, Scanpy, BioPython, Astropy, Qiskit…) liberados só nas salas relevantes; compute pesado via cloud (Modal).
**Nativas Zaeon (já existem)** — `studio`, `voz`, `notebook`.

Cada item vira um `Skill` (com `slug`, `manifest` do SKILL.md, `tools`, `runtime`, `risk`, `courseTags`), listado na Sala de Skills e plugável no `StudentAgent.enabledSkills`.

### 9.10 Gating por PLANO (tier de geração) — decisão do Martinez

O gating principal é **por plano** (gatilho da conta é essencial), mapeado no **tier de infra** (10.3):

| Plano | Tiers de geração | O que inclui |
|---|---|---|
| **Free** | **T0** | Studio nativo essencial (guia/mapa/flashcards/FAQ/timeline/imagem/podcast/vídeo), caderno, resposta estruturada, voz |
| **Plus** | **T0 + T1 + T2** | + navegador (Mermaid/plots/KaTeX/molécula 3D/slides/docs) + microserviço Python (literatura, stats, figuras, **molécula 2D/RDKit**, ScholarEval, database-lookup) |
| **Pro** | **T0 + T1 + T2** (mais cota/limites) | mesmo teto geracional do Plus, com mais cota de compute + os premiums que já existem (deepThink, voz avançada, Projetos) |
| **Max** | **T0 + T1 + T2 + T3** | + **compute pesado GPU por demanda (Modal)**: docking, dinâmica molecular, ADMET, proteína (AlphaFold/ESM), single-cell, quântica, materiais, astronomia |

**T3 = exclusivo do modo Max, ligado POR DEMANDA** numa infra que suporta GPU (em breve). **Deixar o essencial pronto agora** (o contrato/rotas/flag), executar quando a GPU existir. Pro **não** tem o nível geracional T3.

**Modelo de dados (extensão):**
```prisma
// User: expandir o enum do plano
plan  String @default("free")   // "free" | "plus" | "pro" | "max"

// Skill: além de slug/manifest/tools/runtime/risk/defaultOn/courseTags —
tier     String  @default("T0")   // "T0" | "T1" | "T2" | "T3"
minPlan  String  @default("free") // plano mínimo p/ usar a skill
demandGpu Boolean @default(false) // T3: liga sob demanda quando a infra GPU existir
```
Regra de resolução: uma skill roda se `planRank(user.plan) >= planRank(skill.minPlan)` **e** (`!skill.demandGpu` **ou** infra-GPU disponível) **e** o `courseTags`/`isLocked` permitem. Os campos legados (`tag` Livre/Alunos/VIP, `isLocked`, `unlockRequirement`) continuam como gating fino secundário (curso/nível), mas o **plano** é o gatilho primário. `runtime:"python"` só habilita quando o microserviço está no ar.

---

## 10. Alinhamento: science-superpowers + open-science (auditoria de estrutura)

### 10.1 K-Dense `science-superpowers` — usável AGORA (MIT, zero-dependência)
Metodologia do ciclo de pesquisa como **skills que auto-disparam** (bootstrap no início da sessão) — reimplementação do `obra/superpowers` pra ciência. Roda só com harness + shell POSIX, então **não precisa de microserviço**: é conteúdo/markdown que dá pra encaixar já.
Fases: framing-research-questions → surveying-prior-work → designing-the-analysis → **preregistering-analysis** → reproducible-setup → execute → investigating-anomalous-results → **verifying-results-before-claiming** → **red-team review** → reporting-and-archiving.
**O que pegamos agora:**
- **Pré-registro** (a "Iron Law"): travar hipótese/predição/regra de decisão **antes** de ver o resultado, e rotular *confirmatório × exploratório* (anti p-hacking/HARKing). É uma **disciplina nova** que não tínhamos — vira uma fase opcional do `criar_trabalho`/pesquisa e ensina rigor (ótimo p/ graduação/pós).
- **red-team review** = nosso `examiner`/agente **Revisor** (revisão adversarial antes de acreditar no resultado). Confirma o roster.
- **verify-before-claiming** = nossa checagem `sem_fonte` + evidência-com-fonte.
- Adoção: semear essas skills (markdown) no **Escritor/Revisor** e como fases da `AuraTrajectory`. Zero infra.

### 10.2 `ai4s-research/open-science` (Open Science Desktop) — a régua de estrutura
Workbench local-first, model-agnostic (Tauri + **OpenCode + MCP + agent skills + artefatos reproduzíveis**), #1 no ResearchClawBench. É "o app desktop" do que estamos construindo. Estrutura deles: skills = o loop de pesquisa (`ai4s-agent` encadeia `research-explorer → literature-survey → experiment-suite → paper-writer`), cada estágio solta um **artefato gradeável**; **provenance** (`.openscience/provenance.jsonl`) liga cada artefato ao código/inputs/ambiente/conversa; skills de revisão de 1ª parte (`traceability-review`, `stats-integrity`, `integrity-auditor` com **grading de evidência em 4 níveis**); conectores MCP de literatura (arXiv, PubMed, Crossref, Semantic Scholar, bioRxiv/medRxiv).

**Estamos usando a estrutura? Auditoria:**
| Elemento da estrutura open-science | Zaeon hoje/plano | Veredito |
|---|---|---|
| Skills = loop de pesquisa c/ artefato por estágio | `AuraTrajectory` + intents + Studio + `criar_trabalho` | ✅ alinhado |
| Padrão aberto Agent Skills + MCP conectores | seções 9.2/9.9 (adotar skills + `paper-lookup`/MCP) | ✅ alinhado (a implementar) |
| Revisão/integridade (auditor, grading de evidência) | `examiner` + ScholarEval (8.4) | 🟡 parcial — falta **grading 4 níveis** + auditoria de imagem/número/lógica |
| **Provenance ledger** (artefato ↔ código/inputs/conversa) | só temos `evidencia[].source` | 🔴 **GAP** — adotar um registro de proveniência |
| Reprodutibilidade (env pinado, seeds, run records, Modal) | nota do Modal (9.x) | 🟡 parcial — formalizar run records |
| Model-agnostic via OpenCode sidecar | Gemini único (decisão nossa) | ⚪ divergência intencional |
| i18n PT-BR | nativo PT (deles é "registrado, não selecionável") | ✅ à frente |

**Gaps a adotar (baratos e agora, no design):**
1. **Provenance** — estender o `AuraTrajectory`/artefato com um `provenance` (o que gerou: intent, tools/fontes usadas, agente, timestamp). Vira reprodutibilidade real e casa com o palace (MemPalace). Implementação leve; conceito entra já.
2. **Grading de evidência em 4 níveis** + auditoria (imagem/número/lógica) no `ExaminerVerdict` — enriquece o crítico além do ScholarEval.
3. **Run records** para skills de compute (quando a infra Python/Modal entrar).

Conclusão: no nível de **skills + artefatos + revisão** estamos alinhados; os dois deltas reais são **provenance** e **grading/auditoria de integridade** — ambos adotáveis já no contrato, implementáveis leves.

### 10.3 Mapa de artefatos geráveis (resposta honesta: "moléculas & cia")

**Sim, conseguimos gerar moléculas e estruturas — a questão é *qual camada de infra* cada uma exige, não *se* dá.** Honestamente:
- **Molécula 3D interativa** (girar, dar zoom): viável **cedo, em JS puro** (3Dmol.js / NGL) a partir de SMILES/PDB — buscando a estrutura no PubChem/PDB (dado) e renderizando no navegador. Não precisa de Python.
- **Molécula 2D (depiction a partir de SMILES)**: **sim**, via RDKit no microserviço de skills (Fase 2/3). Reproduzível, sem GPU.
- **Docking, dinâmica molecular, ADMET, proteína (AlphaFold/ESM)**: **sim, é possível**, mas exige **GPU/cloud (Modal)** e é **gated por curso** (quím/bio/farma) — não é default de graduação. Não é "não"; é "sim, faseado por infra e por domínio".

Ressalva sincera: não somos um desktop com kernel Jupyter como o Open Science Desktop; "rodar experimento arbitrário" e run-records reproduzíveis chegam junto com o microserviço (T2/T3). Para estudo/graduação, T0–T2 cobre a esmagadora maioria; T3 é o avançado/por-domínio.

**Tabela — tudo que a Aura poderá gerar, por tier de infra:**

| Tier | Infra | O que gera |
|---|---|---|
| **T0 — hoje** | nativo, sem infra nova | Studio: **guia, mapa mental, flashcards, FAQ, linha do tempo, imagem (Imagen), podcast/áudio (Gemini-TTS), vídeo (Veo)**; resposta estruturada; caderno/StudySpace; **TCC/artigo/relatório** (WORK_SECTIONS); voz |
| **T1 — JS no navegador** | sem Python (dá pra somar cedo) | **diagramas (Mermaid)**, **gráficos/plots (Chart.js/Plotly/D3)**, **fórmulas (KaTeX)**, tabelas, **molécula 3D interativa (3Dmol.js/NGL)**, mapas, infográficos SVG, **slides**, **documentos (docx/pdf/pptx/xlsx)** |
| **T2 — microserviço Python** | uv/sandbox, sem GPU (Fase 2/3) | **busca de literatura + citações/BibTeX**, análise estatística, **figuras publication-quality (matplotlib)**, **molécula 2D (RDKit)**, EDA, conversão de docs (MarkItDown), schematics científicos, relatórios **peer-review/ScholarEval**, geração de hipóteses, **database-lookup (100+ bancos)** |
| **T3 — compute pesado + cloud** | GPU/Modal — **modo Max, por demanda** (+ curso relevante) | **docking (DiffDock)**, **dinâmica molecular (OpenMM/MDAnalysis)**, **ADMET/propriedades (DeepChem)**, **proteína (AlphaFold/ESM)**, single-cell/genômica (Scanpy), **circuitos quânticos (Qiskit/PennyLane)**, materiais (Pymatgen), astronomia (Astropy) |

Cada artefato, independente do tier, sai com `provenance` (8.2) e — quando for trabalho/pesquisa — passa pelo `ExaminerVerdict` com `evidenceLevel`/`integrity` (8.4). O tier é só *onde executa*; o **contrato de saída é o mesmo**.

### 10.4 Scan de cobertura de ferramentas (todos os repos) — o que já temos vs. o que passou batido

Cruzei os 8 repos (AI-Scientist · awesome-harness · MemPalace · scientific-agent-skills · scientific-agents · scientific-writer · science-superpowers · open-science) contra o plano.

**✅ Já coberto** (mapeado no plano): busca de literatura + conectores MCP; citações/BibTeX; peer-review/ScholarEval; escrita científica; geração de hipóteses; pensamento crítico; schematics/diagramas; slides/pôsteres; processamento de documentos (docx/pdf/pptx/xlsx/MarkItDown); infográficos; estatística; data-viz; molécula 2D/3D; docking/MD/ADMET/proteína (T3); bancos (100+); provenance; pré-registro; red-team/integrity + grading; persona `AGENTS.md`; marketplace Agent Skills; mindmap; auto-trigger de skill (≈ router/IntentRegistry); literature-review; research-grants.

**🟡 Passou batido — 3 lacunas reais a somar:**
1. **Registro de VIEWERS de artefato (o lado da renderização).** O open-science tem visualizadores ricos inline — **molécula, malha 3D, tabela CSV com gráficos, genome tracks, FITS, bandas/DOS, mapas de anomalia**. Nós *geramos*, mas o `StudioBlock` renderiza pouco. Falta um **`ArtifactViewer` registry extensível** (mesmo espírito do StudioBlock) pra mostrar esses tipos no chat. Barato no T1 (viewers JS). → **adicionar como capacidade da camada de UI.**
2. **Artefato de EXPERIMENTO/execução de código** (o `experiment-suite`/`experiment.py`: código roda → `results.json` + figuras + provenance). É distinto de gerar artefato estático — e **conecta com a sala Projetos / Zaeon Code que já existe** ([[zaeon-projetos-ide]]). → **integrar: a Aura faz handoff "rode esta análise" pra um skill de code-exec (Projetos) que devolve resultado+figuras+provenance.**
3. **Investigações paralelas / subagentes** (science-superpowers `dispatching-parallel-investigations`; open-science `subagent-driven-analysis`; harness dynamic workflows). Citado na fundamentação, mas não explícito nas fases. → **formalizar na Fase 4 (o pipeline pode fan-out em subagentes com verificação).**

**⚪ Fora de escopo por ora (consciente):** notebooks `.ipynb` + kernels Jupyter (vive melhor em Projetos, não no chat); `!` shell mode / `/` commands (poder-usuário); runtime model-agnostic via OpenCode (somos Gemini único por decisão).

**Veredito:** na parte de **ferramentas de geração** temos essencialmente tudo mapeado. As 3 lacunas são de **eixos vizinhos** (renderização, execução de código, paralelismo) — nenhuma é "ferramenta científica faltando", são integrações de plataforma. Registradas aqui pra não passarem batido.

**OpenClaudeScience / InternAgentS (MIT — avaliado 2026-07-11, só README):** clone open-source do "Claude Science" sobre **DeepAgents + LangGraph** (Next.js UI, model-agnostic: OpenAI-compat/DeepSeek/local). Mesma **categoria** do ai4s open-science → é **referência/benchmark**, não peça pro nosso harness de estudo (é desktop local-first Python/LangGraph; somos Next/Gemini único). README é crível e detalhado (rotas de API reais, catálogos de skill, MCP/SCP), mas **não auditei o código** e alguns recursos são "experimental" (SSH compute Linux-only). Reforços úteis: (1) **cartões de aprovação (HITL)** pra jobs de compute remoto — padrão a adotar no nosso **gate do Max/T3 sob demanda** (GPU/custo); (2) skills + conectores MCP/SCP (reforça 9.9); (3) **provenance + previews de artefato científico** (reforça a lacuna #1 do viewer + o `provenance`); (4) DeepAgents/LangGraph como opção de runtime, se um dia quisermos framework (hoje Gemini único por decisão). Nada fundamentalmente novo além do que o open-science já deu.

**ShinkaEvolve (Sakana, Apache-2.0 — avaliado 2026-07-11):** framework de **evolução de programas** (LLM-como-mutação + busca evolutiva com verificador/score). **Fora do escopo do harness de estudo** (evolui código pra bater métrica; precisa de verificador/GPU/Slurm — é T3 avançado, não gera aula/estudo/pesquisa). Duas transferências honestas: (1) **best-of-N com o crítico como fitness** — para gerações de peso no **modo Max**, gerar N rascunhos e deixar o `ExaminerVerdict`/ScholarEval escolher o melhor (intensifica o `revise`; caro em tokens → on-demand/Max). (2) **ShinkaEvolve como skill T3 da sala Projetos/Zaeon Code** ([[zaeon-projetos-ide]]) pra CS/engenharia evoluir/otimizar algoritmos (gated Max + curso; `npx skills add SakanaAI/ShinkaEvolve`). Reforça: padrão Agent Skills, disciplina de orçamento (`max_api_costs`), dedup por embedding (casa com MemPalace).

---

## 11. Especificação de engenharia do harness (motor · tools · memória)

> Isto tira o harness do conceitual e o deixa **buildável**. Tipos e esqueletos são fonte-da-verdade pro executor — quanto mais completo aqui, menos ele infere.

### 11.1 O motor do laço — `runTrajectory`

```ts
type Phase = "route"|"plan"|"gather"|"reason"|"draft"|"critique"|"finalize";
type StopReason = "aprovado"|"orcamento"|"maxIter"|"loop"|"erro";

type TrajectoryState = AuraTrajectory & {
  phase: Phase; iter: number; spent: { tokens: number; ms: number }; stop?: StopReason;
};

interface HarnessDeps {
  classify(objective: string, ctx: AgentContext): Promise<{ intent: IntentId; mode: Mode; academicMode: AcademicMode; kind?: WorkKind }>;
  plan(st: TrajectoryState): Promise<Step[]>;
  runTool(name: string, args: any, ctx: AgentContext): Promise<ToolResult>;   // 11.2
  reason(st: TrajectoryState): Promise<string>;          // conecta evidence → reasoning
  draft(st: TrajectoryState): Promise<StructuredAnswer>;
  critique(st: TrajectoryState): Promise<ExaminerVerdict>;  // o examiner (ScholarEval)
  emit(step: AgentStep): void;                            // action bus (lib/agent/actions.ts) + stream
  persistMemory(drawers: Drawer[]): Promise<void>;        // 11.3
}

async function runTrajectory(objective: string, ctx: AgentContext, d: HarnessDeps): Promise<StructuredAnswer> {
  d.emit(mk("route"));
  const r = await d.classify(objective, ctx);                 // barato: intenção + modo + academicMode
  const spec = INTENTS[r.intent];
  const st = seedState(objective, r, spec);                   // budget = budgetFor(spec, r.mode)

  if (r.mode === "quick") { st.draft = await d.draft(st); return finalize(st, d); }

  d.emit(mk("plan"));  st.plan = await d.plan(st);            // reasoning-heavy (fatia 1 do sandwich)

  for (;;) {
    st.iter++;
    d.emit(mk("gather"));
    await Promise.all(nextTools(st, spec).map(async s => {    // paraleliza tools independentes
      const res = await d.runTool(s.tool, s.args, ctx);
      st.evidence.push(...toFindings(res));
      st.artifacts.push(...(res.artifact ? [res.artifact] : []));
    }));
    d.emit(mk("reason"));  st.reasoning = await d.reason(st);
    d.emit(mk("draft"));   st.draft     = await d.draft(st);

    if (spec.critic === "off") { st.stop = "aprovado"; break; }
    d.emit(mk("critique"));
    const v = await d.critique(st);                            // reasoning-heavy (fatia 2 do sandwich)
    st.critique = v.issues; st.score = v.score;
    if (v.decision === "aprovado" || st.score >= (spec.reviseThreshold ?? 7)) { st.stop = "aprovado"; break; }
    if (st.iter >= (spec.maxRevisions ?? 1)) { st.stop = "maxIter"; break; }
    if (overBudget(st)) { st.stop = "orcamento"; break; }
    // senão: revisa — os issues viram guia do próximo gather/draft.
  }
  return finalize(st, d);   // grava provenance + persistMemory(st.memoryWrites) + stream do final
}
```
**Stop conditions determinísticas:** `aprovado` (decisão/score), `maxIter` (spec.maxRevisions), `orcamento` (tokens/tempo), `loop` (detecção de repetição). **Reasoning sandwich:** deep-think só em `plan` e `critique` (casa com `deepThinkEnabled`). **Trace:** cada fase emite um `AgentStep` (`lib/agent/actions.ts`) → cockpit + o `AuraThinking`/⟁ leem os passos REAIS (troca o timer da UI).

### 11.2 Runtime das tools + router

```ts
type ToolRuntime = "ts" | "python" | "mcp";
type ToolRisk = "read" | "write" | "destructive";
type ToolResult = { ok: boolean; findings?: Finding[]; artifact?: StudioRef; error?: string; provenance: Partial<ProvenanceRecord> };

interface ToolDef {
  name: string; runtime: ToolRuntime; risk: ToolRisk;
  minPlan: Plan; demandGpu?: boolean;                    // gating (9.10)
  schema: FunctionDeclaration;                           // o que a LLM (Gemini) enxerga
  run(args: any, ctx: AgentContext): Promise<ToolResult>;
}

// Execução com guardrail (middleware): permissão → timeout → run → normaliza (nunca throw).
async function runTool(def: ToolDef, args: any, ctx: AgentContext): Promise<ToolResult> {
  const gate = permit(def, ctx);                          // ALLOW | DENY | REQUIRE_APPROVAL (deny-by-default)
  if (gate === "DENY") return err("permissão negada");
  if (gate === "REQUIRE_APPROVAL" && !(await approve(def, args, ctx))) return err("não aprovado");
  return withTimeout(def.run(args, ctx), timeoutFor(def)).catch(e => err(String(e)));
}
```
**Onde cada runtime executa:** `ts` → in-process (`lib/studio/*`, `studio_generate`, `notebook`, `research_generate`); `python` → HTTP pro **microserviço de skills** (molde `voice-engine`/`abnt-service`) — `paper-lookup`, `scholar-evaluation`, `statistical-analysis`…; `mcp` → cliente MCP (conectores externos). **Permissão** é o ponto único de gating (risco + plano + curso + GPU-por-demanda). **`REQUIRE_APPROVAL`** = o cartão HITL (padrão do OpenClaudeScience) pras ações caras do Max/T3.

**Router (entrada do laço):**
```ts
async function classify(objective: string, ctx: AgentContext) {
  const academicMode = ctx.activeTab === "pesquisa" ? "enforced" : "flexible";   // 8.8
  // intent + mode: 1 chamada Flash (temp baixa, JSON forçado pelo schema das intenções 8.1),
  // com heurística de fallback (isQuickPrompt, verbos de geração → gerar_artefato/criar_trabalho).
  return { intent, mode, academicMode, kind };
}
```

### 11.3 Contrato da memória (palace) — Fase 3
> **⚑ Ver `docs/MEMORY_AND_PERSISTENCE.md` (fonte-da-verdade).** Memória = STANDARD p/ todas as
> contas; infra = **Mongo Atlas Vector Search** (nativo, não MCP). Contrato TS já escrito em
> `lib/agent/memory.ts` (`MemoryAPI` wakeUp/search/write, provider-agnóstico). O `Drawer` **deriva
> do L1** (transcrição durável, já construída: models `Conversation`/`ChatMessage` + `/api/ai/transcript`).

```ts
// Estrutura MemPalace (wing/room/drawer). Backend: Mongo + índice vetorial, OU MemPalace real via MCP.
type Wing   = { id: string; userId: string; kind: "usuario"|"curso"|"projeto"|"agente"; label: string };
type Room   = { id: string; wingId: string; topic: string };                  // matéria/assunto
type Drawer = {                                                                // conteúdo VERBATIM
  id: string; roomId: string; text: string; source?: Source;
  kind: "mensagem"|"citacao"|"artefato"|"nota"; at: string;
  embedding?: number[];                                                         // embeddinggemma-300m (multilíngue)
};

interface MemoryAPI {
  wakeUp(userId: string, ctx: AgentContext): Promise<Drawer[]>;                 // recall relevante no início da sessão → AgentContext
  search(query: string, scope: { wing?: string; room?: string }, k?: number): Promise<Drawer[]>;  // = tool memory_search
  write(drawers: Drawer[]): Promise<void>;                                      // persistência no finalize (st.memoryWrites)
  // grafo temporal (tardio): add/query/invalidate entidades-relações com janela de validade.
}
```
**Recall barato** (busca por embedding, **sem LLM** — lição de custo do MemPalace, 96.6% R@5). **Escopo** pela intenção/sala (`wing`/`room`). **Write** no `finalize` da trajetória: cada mensagem/citação/artefato vira um `drawer` com `provenance`. `embeddinggemma` multilíngue mantém PT/EN/ES coerentes.

### 11.4 Modo de execução — automático × guiado (HITL, como no Claude)

> Sim, teremos os dois modos com botão no composer — é o análogo do plan-mode/auto do Claude. Não é feature nova solta: é o `permit()`/`REQUIRE_APPROVAL` (11.2) elevado a **dimensão de execução** do laço.

Dimensão `execMode: "auto" | "guiado"` no `AgentContext`/`AuraTrajectory` (persistida por sala).

- **`auto`** — o `runTrajectory` corre **ponta-a-ponta**; `permit()` retorna `ALLOW` para tools de leitura e geração; só o **destrutivo/caro** (Max/T3, gasto de GPU/dinheiro) ainda cai em `REQUIRE_APPROVAL`. Streama, não pausa (deny-by-default segue protegendo).
- **`guiado`** — o laço **pausa em gates HITL** e espera o usuário **aprovar / editar / redirecionar**:
  - após `plan` → aprovar o plano de passos (o "plan mode");
  - antes de cada tool `write`/cara → cartão de aprovação (o `REQUIRE_APPROVAL` de 11.2);
  - antes de `finalize` → aprovar/ajustar o `draft`.

**Implementação:** `permit(def, ctx)` passa a considerar `ctx.execMode` (guiado eleva o limiar → mais `REQUIRE_APPROVAL`); o loop insere `await approvalGate(phase, st)` nos pontos acima quando `guiado`. As pausas reusam o **cartão HITL** (11.2) e o **action bus** (o `AgentStep` fica "aguardando você"). Em `auto`, os gates opcionais são pulados; os destrutivos nunca.

**UI:** um toggle no composer (**Auto ⚡ / Guiado 🧭**), presente nos dois chats (estudo e pesquisa), ao lado do ⟁/mic. **Fundamentação:** taxonomia de loops (turn/goal-based) do harness-engineering + "Beyond Permission Prompts"/auto-mode (Anthropic) — é o mesmo princípio do Claude.

---

## 12. Próximo passo concreto
Implementar **Fase 0** já sob esta fundação: `lib/agent/tools.ts` (registry) + `studio_generate`, ligar `tools` da aura em `chat/route.ts`, e o **tool-loop mínimo** que é a primeira encarnação da trajetória (`plan → gather(1 tool) → finalize`), fazendo "gere um podcast sobre X" virar artefato na conversa — fechando o gap que o `StudioPalette` deixou preparado. O `IntentRegistry` (8.3) entra junto como o classificador que escolhe modo/schema/tools; o `ExaminerVerdict` (8.4) entra na Fase 1/4 quando o laço ganhar o crítico. A **persona por curso** (9.1) é o add-on barato que já melhora a Fase 0. A **Sala de Skills como marketplace real** (9.2) casa com o PR Plugin→Skill do `PLANO_SKILLS_PRS.md`. Adotar já no contrato: **provenance** e **pré-registro** (10.1/10.2).

**Status:** Fase 0 ✅ concluída e verificada (tool-loop `studio_generate`/`research_generate` nas duas salas; `execMode` com casca de Up no composer). A partir daqui, o **runbook da §13** é a fonte-da-verdade da execução.

---

## 13. Runbook de PRs — sequência de execução (fatiada, com gates)

> Esta é a folha de trabalho do **agente executor**. Cada PR é pequeno, atrás de flag, com contrato citado (§8/§11) e um **gate** binário. A ordem respeita as dependências: um PR só entra quando o anterior fecha o gate. Nada aqui reescreve tela inteira — tudo é aditivo e opt-in (feedback do Martinez: UI nova = toggle, manter o ⟁).

### 13.0 Convenções (valem para TODO PR)
- **Branch:** `aura/harness-prNN-slug` (ex.: `aura/harness-pr01-contracts`). **Escopo:** ≤ ~6 arquivos tocados; se passar, fatie mais.
- **Flag:** todo comportamento novo do laço nasce atrás de `process.env.AURA_HARNESS` (server) / `localStorage "zaeon.harness"` (client). **Rollback = flag off** — a rota atual (`/api/ai/chat` tool-loop) continua funcionando intacta.
- **Verificação (sem build no sandbox):** `ts.transpileModule` em todo `.ts/.tsx` tocado (category===1 = erro de sintaxe → bloqueia) + `vitest` onde houver lógica pura (router, permit, stop conditions). macOS do Martinez **não tem `python`** — microserviço só roda no VPS/CI, aqui valida-se só o contrato TS do cliente.
- **DoD de cada PR:** (1) gate binário passou; (2) transpila; (3) flag off = comportamento idêntico ao de hoje; (4) 1 linha no `CHANGELOG` do PR dizendo qual contrato da §8/§11 foi encarnado.
- **Provenance desde já:** todo `ToolResult` carrega `provenance` (10.1/10.2) — nunca deixar pra depois.

### 13.1 Trilha A — o motor (núcleo do harness)

**PR01 · Contratos como código** — `lib/agent/contracts.ts` (novo, só tipos + tabela, zero comportamento).
- Encarna: `IntentId`/`INTENTS` (8.1/8.3), `StructuredAnswer` + `ProvenanceRecord` (8.2), `ExaminerVerdict` (8.4), `Mode`, `AcademicMode` (8.8), `WorkKind`, e o `execMode` no `AgentContext` (11.4).
- Depende de: —. **Gate:** transpila e `INTENTS` tem as 7 intenções, cada uma declarando `mode`/`schema`/`tools`/`critic`/`maxRevisions`/`reviseThreshold`.

**PR02 · Router `classify()`** — `lib/agent/router.ts` (novo).
- Encarna: 11.2 (router). 1 chamada Flash (JSON forçado) + **fallback heurístico** (`isQuickPrompt` ≤8 palavras; verbos de geração → `gerar_artefato`/`criar_trabalho`); `academicMode` vem do `surface` (`pesquisa`→enforced, resto→flexible).
- Depende de: PR01. **Gate:** `vitest` cobrindo a heurística (frase curta→quick; "gera um artigo sobre X"→criar_trabalho+enforced na pesquisa) **sem** chamar a rede.

**PR03 · Runtime das tools** — `lib/agent/runtime.ts` (novo) + adaptar `lib/agent/tools.ts`.
- Encarna: 11.2 (`ToolDef`/`ToolResult`/`runTool`). `permit()` **deny-by-default** (risco+plano+curso+GPU) → `ALLOW|DENY|REQUIRE_APPROVAL`; `withTimeout`; `err()` normaliza (nunca `throw`). Registrar `studio_generate` e `research_generate` como `ToolDef` (runtime `ts`).
- Depende de: PR01. **Gate:** `vitest` prova que `runTool` **nunca lança** (tool que estoura vira `{ok:false,error}`) e que `permit` nega por padrão quando o plano não cobre `minPlan`.

**PR04 · Motor `runTrajectory`** — `lib/agent/trajectory.ts` (novo) + `HarnessDeps` plugável.
- Encarna: 11.1 (laço completo). Atrás da flag: `quick`→`draft→finalize` (paridade com hoje); multi-step (`plan→gather→reason→draft→critique↺→finalize`) só quando a flag e `spec.critic` pedirem. `emit` → action bus (`lib/agent/actions.ts`). **Stop conditions determinísticas** (`aprovado/maxIter/orcamento/loop`).
- Depende de: PR02, PR03. **Gate:** `vitest` das stop conditions (orçamento estoura→`orcamento`; `iter≥maxRevisions`→`maxIter`) com `HarnessDeps` mockado; flag off = rota atual intacta.

**PR05 · Crítico (examiner)** — `critique()` em `lib/agent/examiner.ts` (novo).
- Encarna: 8.4 (`ExaminerVerdict`, ScholarEval 8 dims + soundness/contribution + `evidenceLevel` + `integrity`). Alimenta o revise-loop do PR04 (`issues`→guia do próximo gather/draft; `reviseThreshold`).
- Depende de: PR04. **Gate:** verdict valida o schema; `decision==="aprovado" || score≥threshold` corta o laço; integridade (citação sem fonte) rebaixa `evidenceLevel`.

### 13.2 Trilha B — experiência (liga o motor à UI já pronta)

**PR06 · Trace real no ⟁/AuraThinking** — troca o timer da UI pelos `AgentStep` reais do action bus.
- Encarna: nota de 11.1 ("a UI lê os passos REAIS"). O `AuraThinking` passa a receber as fases emitidas (`route→…→finalize`) em vez das frases mockadas.
- Depende de: PR04. **Gate:** com a flag on, a UI mostra a fase corrente vinda do stream; flag off = frases adaptativas de hoje.

**PR07 · `execMode` ligado ao laço** — `permit()` considera `ctx.execMode`; `approvalGate(phase, st)` nos pontos HITL.
- Encarna: 11.4. `guiado` pausa após `plan`, antes de tool `write`/cara e antes de `finalize`; `auto` pula os opcionais (destrutivo nunca). O **toggle já existe** no `CoworkComposer` (Auto ⚡/Guiado 🧭) — este PR faz ele **dirigir comportamento** (hoje é casca em `localStorage "zaeon.execMode"`).
- Depende de: PR03, PR04. **Gate:** em `guiado`, o laço emite um `AgentStep` "aguardando você" e só prossegue após aprovação; em `auto`, corre ponta-a-ponta.

### 13.3 Trilha C — memória, agentes e skills (Fases 2–3, paralelizáveis após PR04)

**PR08 · Palácio de memória** — `lib/agent/memory.ts` (novo) + tool `memory_search`.
- Encarna: 11.3 (`Wing/Room/Drawer` + `MemoryAPI`: `wakeUp/search/write`). Recall **por embedding, sem LLM** (`embeddinggemma-300m`); `write` no `finalize`. Backend: Mongo + índice vetorial.
- Depende de: PR04. **Gate:** `search` devolve drawers por escopo (`wing/room`); `write` persiste com `provenance`; `wakeUp` injeta recall no `AgentContext`.

**PR09 · Persona por curso** — add-on barato: injeta a persona (9.1/9.6) no `systemContext`.
- Encarna: 9.1. Não depende do motor — melhora até a Fase 0. Reusa o roster seed (9.7).
- Depende de: PR01 (para `WorkKind`/curso). **Gate:** a Aura assume a voz do curso ativo; sem curso → persona geral (fallback).

**PR10 · Microserviço de skills Python** — `scholar-evaluation`, `paper-lookup`, `statistical-analysis` (molde `voice-engine`/`abnt-service`).
- Encarna: 11.2 (runtime `python` via HTTP) + 8.6 (K-Dense). Registrados como `ToolDef` runtime `python` com `minPlan` (9.10).
- Depende de: PR03, PR05 (o examiner consome `scholar-evaluation`). **Gate (CI/VPS):** endpoint responde contrato `ToolResult`; cliente TS transpila; **não** roda no macbook (sem `python`).

**PR11 · Sala de Skills = marketplace real** — casa com o PR Plugin→Skill do `PLANO_SKILLS_PRS.md`.
- Encarna: 9.2/9.4. `Skill extends Plugin` (rename + redirect, `@@map` sem migração); `defaultOn` por fase (9.8); catálogo K-Dense (9.9); gating por plano (9.10).
- Depende de: PR10 (skills reais pra plugar). **Gate:** skill plugável aparece no runtime e respeita `minPlan`.

### 13.4 Ordem recomendada e paralelismo
`PR01 → PR02 → PR03 → PR04` é o **caminho crítico** (serial). Depois: **PR05, PR06, PR07** (Trilha B) e **PR08, PR09** (Trilha C) podem correr em paralelo. **PR10/PR11** fecham a cauda (dependem de PR03/PR05). Regra de ouro: nenhum PR mergeia com o gate vermelho, e a flag mantém a Zaeon de produção sempre verde.
