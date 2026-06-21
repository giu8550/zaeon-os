# Contexto Persistente + Execução Agêntica — ADR

Objetivo (Martinez): a Zaeon precisa ter **contexto real de todo o projeto** (não só
da conversa) e oferecer a **experiência agêntica** — o usuário ver o agente abrindo
abas, digitando, criando projetos e pesquisas, do jeito que ele faria. Por voz ou texto.

## Conceitos (dois subsistemas distintos)

1. **World-state (a "memória do projeto")** — fonte única e DURÁVEL do estado do
   workspace do aluno: em que sala/aba está, qual estudo/pesquisa/projeto está aberto,
   qual o objetivo atual, e as ações recentes. Persistido no Mongo (sobrevive a reload,
   troca de device) e **injetado no prompt a cada turno**, pra IA sempre saber onde a
   pessoa está e o que está fazendo. É a evolução durável do `mission`/`handoff` (hoje
   efêmeros em sessionStorage).

2. **Action bus (as "mãos" que se vê agir)** — um protocolo de AÇÕES tipadas que o
   agente EMITE (navegar, abrir aba, focar input, digitar, clicar, criar estudo/
   pesquisa/projeto) e um RUNNER global na UI que executa essas ações **visivelmente**
   (cursor-fantasma, digitação animada, log de passos), usando as funções reais do app.

> Decisão: **ações semânticas**, não puppeteering de DOM. O agente diz a INTENÇÃO
> ("create_study topic=X", "open_tab pesquisa", "type '...'") e a UI executa pelas
> funções reais + uma camada de animação que dá o "efeito humano". É rápido, confiável
> e seguro — driver de DOM (Selenium-like) seria frágil e pesado. Rejeitado.

## Por que NÃO precisa de engine dedicada (agora)

O LLM é stateless; "memória" = reenviar contexto. World-state no Mongo + injeção no
prompt resolve o contexto de projeto sem engine. Memória semântica de longo prazo
(embeddings + pgvector, já no docker-compose/agent-gateway) é um tier futuro, só quando
quisermos "lembrar do aluno entre meses".

## Fases

### Fase 1 — World-state durável  ✅ (esta entrega)
- `src/models/AgentContext.ts` (Mongoose, 1 doc por usuário).
- `GET/PUT /api/agent/context` — lê/grava o estado.
- `lib/agent/context.ts` — store reativo no cliente (hidrata do servidor, atualiza
  local, sync debounced ao servidor). Campos: activeRoom, activeTab, currentStudyId,
  currentResearchId, currentProjectId, currentGoal, recentActions[].
- `/api/ai/chat` e `/api/ai/deepthink` passam a receber `agentContext` do cliente e a
  carregar o persistido, injetando ambos no system instruction (a IA "conhece o projeto").

### Fase 2 — Action bus visível (as mãos)
- `lib/agent/actions.ts` — tipos de ação + fila reativa (store, como o mission).
- Tool `execute_plan` no chat: a Zaeon retorna uma LISTA de passos (não só 1 summon).
- `<AgentActionRunner/>` global: consome a fila, executa passo a passo com cursor-
  fantasma + digitação animada + narração; cada passo chama a função real
  (navegar, criar estudo via /api/study/agent, criar pesquisa, etc.).
- Salas expõem "command handlers" registráveis (ex.: a Sala de Estudos registra
  `create_study`, `add_item`), pro runner disparar de qualquer página.

### Fase 3 — Persistência de conversas (Mongo)
- `src/models/Conversation.ts` (mensagens por usuário/sala) + rota.
- O widget hidrata o histórico do servidor (sobrevive a reload/device) em vez de só
  manter em estado de página. Liga no `sanitizeHistory` que já existe.

### Tier futuro — memória semântica
- Embeddings das conversas/estudos → pgvector (agent-gateway). Recall de longo prazo.

## Contrato de dados (Fase 1)

```ts
type AgentContext = {
  activeRoom?: string;        // "research-lab" | "workstation" | ...
  activeTab?: string;         // "pesquisa" | "sala-de-estudos" | "projetos" | ...
  currentStudyId?: string;
  currentResearchId?: string;
  currentProjectId?: string;
  currentGoal?: string;       // objetivo declarado pelo usuário ("estudar metaprog")
  recentActions?: { kind: string; detail?: string; at: number }[]; // últimas ~15
  updatedAt?: number;
};
```

Persistência: Mongo (durável) + espelho em sessionStorage (latência zero no reload).
Sincronização: PUT debounced (~800ms) quando o estado muda.
