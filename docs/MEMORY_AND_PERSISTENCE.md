# Memória & Persistência da Zaeon — a escada (fonte-da-verdade)

> **Passar a limpo** toda a persistência das salas, num modelo único, e cravar o que é o
> mecanismo de memória avançada da Zaeon. Escrito a partir de um inventário factual do código
> (2026-07-11). Companheiro: `AURA_AGENTIC_LAYER_PLAN.md` §11.3 + runbook §13 (PR08).

> ## ⚑ Decisão de produto (2026-07-11, Martinez)
> **Memória avançada é STANDARD — para TODAS as contas, todos os planos.** Não é perk de tier.
> A memória (incl. a semântica/MemPalace) é capacidade-base do organismo Zaeon: toda conta
> lembra. O que o **plano** gateia é **COMPUTE de geração** (os *tiers de artefato* T0–T3 do
> `AURA_AGENTIC_LAYER_PLAN.md` §10.3/§9.10 — moléculas, GPU, best-of-N), **nunca a memória**.
> Para não confundir com aqueles tiers T0–T3, as **camadas de memória** deste doc são **L0–L3**.

---

## 0. A ideia central: memória não é uma coisa, é uma ESCADA

O erro clássico é tratar "memória" como um bloco só e ir direto pro embedding. Na prática são
**4 camadas** (L0–L3) com tempos de vida, meio, custo e propósito DIFERENTES. Cada uma depende
da de baixo. A memória semântica (L3) é o **telhado**, não o alicerce — e é **standard**, não
premium.

| Camada | O que guarda | Meio | Vive quanto | Embedding? | Gating por plano? | "Frase do Martinez" |
|--------|--------------|------|-------------|-----------|-------------------|---------------------|
| **L0 · UI efêmera-persistente** | rascunho do input, aba aberta, execMode, scroll, foco | `localStorage`/`sessionStorage` | sessão / reload | Não | Não | "caracteres numa janela que não foi fechada" |
| **L1 · Transcrição durável** | cada mensagem user/assistant, por sala/sessão | Mongo | permanente | Não | Não | "manter o contexto da conversa entrando na sala" |
| **L2 · World-state de trabalho** | sala/aba/estudo/objetivo/ações recentes | Mongo (`AgentContext`) | permanente, resumido | Não | Não | "a Aura sabe ONDE eu estou e o que faço" |
| **L3 · Memória semântica** | trechos verbatim recuperáveis por significado | Mongo + Atlas Vector Search | permanente, cross-sala/sessão | **Sim** | **Não (standard!)** | "você me disse semana passada que…" |

**Regra de ouro:** recall (L3) só existe se houver o que recuperar (L1). Você não "lembra" o
que nunca gravou. A ordem de construção é de baixo pra cima — e hoje **falta o L1**.

---

## 1. L0 — UI efêmera-persistente (o "não perde o que digitei")

**Propósito:** ninguém perde texto/estado por trocar de aba ou dar reload. UX pura,
determinístico, zero custo, client-only.

**Hoje:** Sala de Estudos salva `zaeon.cowork.thread.v1` (últimas 60 msgs; sobrevive a reload
e a troca de aba porque o container fica `hidden`, não desmonta). Também `zaeon.execMode`,
`zaeon.study.lastSpace`, voz, idioma, etc.

**Lacunas:** (1) **`ResearchChat` não persiste e DESMONTA ao trocar de aba** (render `&&`) →
a conversa da Sala de Pesquisa **zera**; (2) **rascunho do input não é salvo** em nenhuma sala.

**✅ FEITO (PR-M0, local 2026-07-11):** `ResearchChat` agora espelha thread (`zaeon.research.thread.v1`,
últimas 60) + rascunho (`zaeon.research.draft.v1`) no localStorage e reidrata no mount (paridade
com a Sala de Estudos). Decisão de risco: **NÃO** forcei o `&&`→`hidden` (montar o `ResearchShell`
pesado sempre tem efeitos colaterais) — a restauração ao voltar vem da **hidratação** (localStorage
L0 → DB L1), não de manter montado. O `&&`→`hidden` fica como polimento opcional.

---

## 2. L1 — Transcrição durável (O ALICERCE QUE FALTA)

**Propósito:** entrar na sala (de qualquer device) e a conversa estar lá. Histórico real no
servidor, independente do navegador. **Fundação de tudo acima.**

**Hoje:** `/api/ai/chat` (chat principal da Aura) **não grava mensagem nenhuma** — o cliente
reenvia `history[]` a cada turno. Única exceção: `PastResearchChat` (só `/api/research/chat/[researchId]`,
que **já** faz `create` + `update` — é só generalizar). Sem model `Conversation`/`ChatMessage` de IA.

**Consequência:** sem L1, o localStorage é a única verdade → limpou o navegador, trocou de
máquina ou passou de 60 msgs = esqueceu. E o L3 não teria de onde derivar os drawers.

**Modelo (Mongo/Prisma) — bloco pronto pra colar em `prisma/schema.prisma`:**
```prisma
model Conversation {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  surface   String   // "estudos" | "pesquisa" | "aula" | "projetos" | "lounge"
  scopeId   String?  // studyId | researchId | projectId (a "sala concreta")
  agentId   String?  // qual agente do roster (Aura, Revisor, Escritor)
  title     String?
  pinned    Boolean  @default(false)
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
  @@index([userId, surface, scopeId])
  @@map("conversations")
}

model ChatMessage {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  conversationId String   @db.ObjectId
  role           String   // "user" | "assistant"
  text           String
  meta           Json?    // artifacts, studioAction, citations, provenance
  at             DateTime @default(now())
  @@index([conversationId, at])
  @@map("chat_messages")
}
```
**✅ FEITO (PR-M1, local 2026-07-11):** models `Conversation`/`ChatMessage` no schema; helper
`lib/agent/transcript.ts` (resolveUserId por sessão→email→id; `ensureConversation`/`appendMessages`/
`getRecent`); **endpoint dedicado** `app/api/ai/transcript` (GET hidrata por `surface`+`scopeId`;
POST anexa turno). Cliente `lib/agent/transcriptClient.ts` (`appendTranscript` fire-and-forget com
`keepalive`; `hydrateTranscript`). Fiado nos dois chats: append ao fim do turno + hidratação-fallback
(L0 localStorage → L1 DB quando vazio).

> **Decisão de arquitetura (desvio do "gravar no /api/ai/chat"):** a rota `/api/ai/chat` é
> **stateless, hot-path e sem sessão no corpo** (voz, agenda, estudo, pesquisa). Gravar inline ali
> exigiria injetar `getServerSession` + writes no caminho quente e não há `userId`. Optei por um
> **endpoint dedicado** que os chats chamam fire-and-forget → a rota de geração continua **pura**,
> a persistência nunca derruba o stream, e o L3 (memory.ts) deriva do mesmo store. **Sem embedding**
> — restaurar = `findMany` por `at`.

---

## 3. L2 — World-state de trabalho (JÁ EXISTE, só subalimentado)

**Propósito:** a Aura sabe o *contexto de situação* — sala/aba, estudo/pesquisa aberto, objetivo,
últimas ações. Resumo pequeno e durável, não a transcrição.

**Hoje:** existe e é durável — `AgentContext` (`lib/agent/context.ts` + Mongoose
`src/models/AgentContext.ts` + `GET/PUT /api/agent/context`, upsert por email, `recentActions`
`$slice:-15`), injetado no prompt via `formatAgentContext`. Sobrevive a reload/device.

**Lacuna:** as salas **alimentam pouco** — `StudyCoworkChat` monta `agentContext` ad-hoc em vez
de usar/atualizar o store; não há `pushAgentAction` nos fluxos de conversa. Fix: as salas chamam
`setAgentContext`/`pushAgentAction` nas transições (entrou em X, abriu estudo Y, gerou artefato Z).
**Sem embedding.**

---

## 4. L3 — Memória semântica: o mecanismo e o veredito

### 4.1 O mecanismo (o que roubar do MemPalace)
Quatro decisões, todas transferíveis:
1. **Verbatim, não resumido por LLM.** O "drawer" guarda o trecho **literal**. Escrita sem LLM → sem alucinação composta; cita exatamente o que foi dito.
2. **Recall por embedding, SEM LLM.** Buscar = comparar o vetor da query com os dos drawers (cosine). Barato e rápido; o "96.6% R@5 sem LLM" deles é a prova de que o vetor sozinho acha o trecho — tratar como **princípio**, não promessa nos nossos dados.
3. **Hierarquia wing → room → drawer.** Estreita a busca e dá estrutura — e **já é a estrutura da Zaeon**: `User → Curso/Sala → StudySpace/ResearchDoc → mensagem/citação/artefato`.
4. **Write no `finalize`, recall no `wakeUp`.** Grava drawers ao finalizar a trajetória; no início da sessão o `wakeUp` traz os relevantes pro `AgentContext` (L2). A memória "acorda" com você.

### 4.2 Veredito: adotar o MECANISMO, nativo, e para TODOS
- **Standard, não premium** (decisão do topo). Toda conta tem L3. Sem gate de plano na memória.
- **Nativo no Next/Mongo**, não o repo MemPalace via MCP (desktop/Python, 29 tools, grafo temporal — 20% do valor, 100% do peso). Roubar o mecanismo, implementar em casa.
- **Infra decidida: Mongo Atlas Vector Search.** Zero infra nova (o Mongo já é o DB). Sem subir Postgres/pgvector, sem chamar serviço Python a cada leitura/escrita de uma feature **standard** (latência + dependência de deploy = tradeoff ruim pra "todas as contas").
- **Grafo temporal fica pra tardio** (a parte chique e menos necessária no começo).

### 4.3 O drawer DERIVA do L1 (não é 2ª fonte da verdade)
No `finalize`, cada `ChatMessage`/citação/`StudioArtifact` de peso vira um `Drawer` com
`embedding` + `provenance`. `wing`/`room` saem de `surface`/`scopeId`/curso. L3 é uma **projeção
indexada** do L1. Bloco Prisma pronto:
```prisma
model MemoryDrawer {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId          // isolamento multi-tenant — SEMPRE filtrar por isto
  wingKind  String   // "usuario" | "curso" | "projeto" | "agente"
  wingLabel String
  room      String   // tópico/matéria
  kind      String   // "mensagem" | "citacao" | "artefato" | "nota"
  text      String   // VERBATIM
  sourceRef String?  // conversationId/messageId/studyId de origem (deriva do L1)
  embedding Float[]  // 768 (embeddinggemma) ou 1536 (gemini-embedding-001) — ver memory.ts
  meta      Json?    // provenance
  at        DateTime @default(now())
  @@index([userId, wingKind, room])
  @@map("memory_drawers")
}
```
> **Índice vetorial (Atlas):** criar um *Vector Search index* sobre `memory_drawers.embedding`
> (dims = EMBED_DIM do `memory.ts`, similaridade `cosine`), com `filter` em `userId`.
> O contrato TS (`MemoryAPI`) vive em `lib/agent/memory.ts` (provider-agnóstico, ver §6).

---

## 5. O `agent-gateway` — "o motor que você acha que abandonou"
**O que é:** um **assistente de WhatsApp** (Python FastAPI+arq, espelho do `zenith-warmer`) que
hospeda a Aura de pesquisa por Zap, gated a Plus. Docs: `WHATSAPP_AGENT_PLAN.md` + `SPRINT_VPS_PLAN.md`.
**Não é o motor do harness do app** — é um **canal/transporte**.

**Por que parou:** 1 único commit tocou nele (2026-06-12, num commit-mãe de research-room) e
nunca iterou; o app Next **não importa nada dele** (só `lib/eduEligibility.ts` reimplementa uma
engine em TS, citando o Python como fonte). Trava em **4 bloqueios de infra**: VPS + Evolution
(Zap) + Postgres/pgvector + service-account GCP. Não foi erro — foi outra superfície de produto
(WhatsApp) que perdeu prioridade pro trabalho in-app.

**O que aproveitar:** o **contrato de RAG** dele é bom e vira **referência** do nosso L3 —
`RagBackend` (`upsert`/`search` ANN sempre filtrando `owner_id`), `embed` (`gemini-embedding-001`,
`output_dimensionality`), isolamento multi-tenant. É prior-art, não dependência.

**Veredito:** `agent-gateway` **fica parado como a jogada de WhatsApp** (revive quando esse canal
for prioridade). A memória L3 **não roda nele** — roda nativa no app (Atlas Vector). Quando o Zap
voltar, o gateway vira **cliente** do mesmo store de memória, não o dono dele. Divergência
intencional: ele é provider-agnóstico Python/pgvector; nós, Next/Mongo/Atlas Vector.

---

## 6. Como tudo conversa (um turno, com memória)
```
entra na sala → GET transcript (L1) + wakeUp recall (L3→L2) → hidrata janela + AgentContext
digita        → draft salvo (L0)
envia         → history (L1) + world-state (L2) + drawers relevantes (L3) entram no prompt
Aura responde → grava user+assistant (L1) ; pushAgentAction (L2)
finalize      → drawers verbatim + embedding (L3) ; provenance
troca de aba  → nada some (L0 hidden + L1 no DB)
volta amanhã  → wakeUp traz o que importa (L3) ; conversa restaurada (L1)
```

## 7. Ordem de construção (encaixa no runbook §13, desdobra o PR08)
De baixo pra cima (respeita a dependência L1→L3). Memória é standard → sem gate em nenhum PR.

- **PR-M0 · L0 higiene** — ✅ **feito local** (ResearchChat localStorage + draft + hidratação). `&&`→`hidden` opcional.
- **PR-M1 · L1 transcript durável (ALICERCE)** — ✅ **feito local** (models + `transcript.ts` + endpoint + fiação nos 2 chats). Falta o executor rodar `prisma db push` (Mongo, sem migração) + testar em prod.
- **PR-M2 · L2 wiring:** salas alimentam `AgentContext` (`setAgentContext`/`pushAgentAction`) de verdade. **(a fazer no harness)**
- **PR-M3 · L3 memória nativa (standard):** `lib/agent/memory.ts` (`MemoryAPI`: `wakeUp/search/write` — contrato ✅ pronto) + model `MemoryDrawer` + Atlas Vector index + tool `memory_search` + embedding (gemini-embedding-001). Deriva do L1. **(a fazer no harness)**
  - **Recall HÍBRIDO (lição do Hermes/agent-gateway):** combinar `$vectorSearch` (cosseno) **+ índice `$text` do Mongo** (full-text) e fundir os hits — melhora recall barato sem mudar o contrato. Vetor sozinho perde correspondência exata de termo; texto sozinho perde paráfrase.
  - **Curadoria com "nudge" (opcional):** no `finalize`, além do `isMemorable()` heurístico, o modelo pode propor/rotular quais drawers guardar — o **storage segue verbatim** (decisão de custo intacta).

> **Estado (2026-07-11):** L0+L1 construídos localmente = **a base a comitar como PR primeiro**.
> Harness + tools + L2/L3 vêm POR CIMA dela.

**Não inverter:** L3 antes do L1 é telhado sem parede. Contrato TS do L3 → `lib/agent/memory.ts` (§ próxima).
