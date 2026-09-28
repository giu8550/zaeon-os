# Handoff para agente Claude — Fase 3 (chat retomável) + App Mobile simplificado

> **Para quem executa:** você é um agente Claude rodando neste repo (`zaeon-os`, Next.js
> 14.2 App Router, Prisma/MongoDB Atlas, deploy Docker no Contabo). Entregue em PRs
> pequenos e revisáveis, atrás de flags, **sem quebrar o fluxo atual**. Padrão-ouro:
> testes com cobertura, acessibilidade, performance e critérios de aceite explícitos.
> Trabalhe na branch `aura/base-coworking-harness` (ou uma feature branch a partir dela).

## 0. Contexto que você PRECISA ler antes de tocar em código

Leia, nesta ordem:
- `docs/BACKGROUND_JOBS_SALA_PESQUISA.md` — a infra de background já existente (fase 1/2).
- `app/api/ai/chat/route.ts` — a rota do chat da Aura. O bloco do **harness** começa em
  `if (stream === true && agentKey === "aura" && process.env.AURA_HARNESS !== "0" && !fileData)`.
  Emite o sentinel `@@STRUCTURED@@` + JSON (`StructuredAnswer`). O laço agêntico é
  `runTrajectoryTraced` (`lib/agent/trajectory.ts`), montado por `buildHarnessDeps`
  (`lib/agent/aura-harness.ts`), com memória via `lib/agent/memory-provider.ts`.
- `components/study/StudyCoworkChat.tsx` — cliente do chat de Estudos. `send()` faz
  `fetch("/api/ai/chat")` + `getReader()`; parsing por `parseStructuredStream` /
  `STRUCTURED_SENTINEL` (`lib/agent/structured-client.ts`); render em
  `StructuredAnswerView` / `MagazineAnswerView`.
- `app/workstation/student/omega/OmegaScholarContext.tsx` — cliente da Sala de Pesquisa
  (já tem modo background + resume por `ScholarSession`, feito na fase 1).
- `lib/queue/scholar.ts`, `instrumentation.ts` — **fila BullMQ + worker** já existentes.
  **Reutilize esta infra.** Não crie um segundo mecanismo de fila.
- `lib/agent/transcript.ts` + `app/api/ai/transcript/route.ts` — persistência durável L1
  (a memória de conversa; L0 é localStorage no cliente).
- `prisma/schema.prisma` — modelos `ScholarSession`, `StudioArtifact` (ambos com
  `status: queued|running|done|error`). Use-os de referência de estilo.

Ferramentas do repo: testes = **vitest** (`npm run test` → `vitest run`; config em
`vitest.config.ts`; testes co-locados `*.test.ts`). Typecheck leniente no build
(`typescript.ignoreBuildErrors`), **mas você não deve depender disso** — rode
`npx tsc --noEmit` e deixe limpo. Redis já no compose; worker via `SCHOLAR_WORKER=1`.

Regra de ouro do projeto: **`evo`/segredos nunca no chat nem no git**; comentários em PT
no código PT; nada de `except`/`catch` mudo sem justificativa.

---

## PARTE A — Fase 3: Chat da Aura retomável ("sai da sala, ela continua e você reengata")

### A.1 Objetivo e comportamento esperado
Hoje o turno do harness roda dentro do stream do request: se o usuário sai da sala no meio,
o Next aborta o handler e a resposta em curso se perde. Queremos:
1. **Estar na sala:** manter o streaming ao vivo de hoje (não regredir a UX comum).
2. **Sair no meio:** o turno **continua no servidor** até terminar e é **persistido**.
3. **Voltar (mesmo device ou outro):** a conversa mostra a resposta já pronta (ou o
   progresso, se ainda rodando) — sem “buraco”.

### A.2 Modelo de dados (Prisma) — novo `ChatTurn`
Crie em `prisma/schema.prisma` (siga o estilo de `ScholarSession`):
```prisma
model ChatTurn {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  userId     String   @db.ObjectId
  surface    String   // "estudos" | "pesquisa" (co-working da Aura)
  scopeId    String?  // threadId/spaceId da conversa (agrupa turnos)
  prompt     String
  status     String   @default("queued") // queued | running | done | error
  answer     Json?    // StructuredAnswer final (mesmo shape do @@STRUCTURED@@)
  partial    String?  // texto acumulado enquanto roda (fallback/preview)
  error      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([userId, surface, scopeId, createdAt])
}
```
`npx prisma generate` + `npx prisma db push` (Atlas). Documente no PR que o db push roda no
deploy (`main.py`/pipeline já faz isso pro resto).

### A.3 Servidor
- **Extraia o turno do harness** para `lib/agent/runChatTurn.ts`:
  `runChatTurn(turnId, { prompt, surface, scopeId, userId, mentor }, emit)` — reaproveita
  `buildHarnessDeps` + `runTrajectoryTraced` (NÃO reimplemente o harness). `emit` recebe os
  mesmos eventos/sentinels de hoje; ao final grava `answer` + `status=done` no `ChatTurn`.
  Espelhe o padrão de `lib/scholar/pipeline.ts`.
- **Fila:** adicione uma fila `chat` em `lib/queue/chat.ts` (clone de `lib/queue/scholar.ts`;
  mesma conexão ioredis). `enqueueChatJob({turnId, prompt, surface, scopeId, userId, mentor})`.
- **Worker:** em `instrumentation.ts`, quando `SCHOLAR_WORKER=1` (reuse o mesmo container
  worker), suba TAMBÉM o `Worker("chat")` que chama `runChatTurn`, persistindo `partial`
  (throttle ~300ms) e `answer` final. Concurrency via `CHAT_WORKER_CONCURRENCY` (default 4).
- **Rota `POST /api/ai/chat`** (só o ramo aura+harness+stream+!file):
  - Se `CHAT_BG === "1"` e fila disponível: cria `ChatTurn(queued)`, enfileira, e **ainda
    assim** abre um stream que **tail-a o turno** (lê `partial`/`answer` do worker e repassa
    ao cliente no protocolo atual, incluindo `@@STRUCTURED@@` no fim) — assim o caso “na
    sala” continua ao vivo, e o caso “saiu” já está persistido pra reengate. Se a conexão
    cair, o worker segue; o cliente reengata por polling (A.4).
  - Caso `CHAT_BG` off / sem Redis: comportamento **idêntico ao de hoje** (fallback).
- **Endpoints de reengate:**
  - `GET /api/ai/chat/turns?surface=&scopeId=` → últimos turnos (id, status, createdAt).
  - `GET /api/ai/chat/turns/[id]` → turno completo (status, partial, answer).
  Auth por sessão (derive userId do e-mail, como em `scholar/sessions/route.ts` — nunca
  confie em id do cliente).

### A.4 Cliente (`StudyCoworkChat.tsx`)
- `send()`: se a resposta vier em modo bg (cabeçalho ou sentinel indicando `turnId`), continue
  consumindo o stream ao vivo (igual hoje); mas persista `turnId` na mensagem otimista.
- **Reengate no mount:** se houver turno `running`/`queued` para o `scopeId` atual, exiba o
  estado (spinner/partial) e faça **polling** de `GET /turns/[id]` até `done` → então
  renderiza `answer` (via `StructuredAnswerView`). Espelhe o resume já feito em
  `OmegaScholarContext.tsx` (aceitar `queued`, tetos ~10 min, render de progresso).
- Nada de puxar pro fim: respeite o ancoramento no topo já corrigido (ver `ancorar`).

### A.5 Reaper (higiene)
No boot do worker (`instrumentation.ts`), marque como `error` turnos/sessões presos:
`ChatTurn`/`ScholarSession` com `status in (queued,running)` e `updatedAt < now-15min`.
Idempotente, logado.

---

## PARTE B — App Mobile simplificado (estilo Claude/ChatGPT)

### B.1 Objetivo
Usuário no celular **não deve cair** nas salas completas (sidebar, biblioteca, studio,
abas). Ele entra num **chat de coluna única**, limpo, com um seletor Estudos ⇄ Pesquisa e
ações essenciais (gerar documento/artefato) em um menu compacto. Referência de UX: apps do
Claude e do ChatGPT (bolhas, input fixo embaixo, histórico em drawer).

### B.2 Roteamento e detecção
- Crie o hook `lib/ui/useIsMobile.ts` (SSR-safe: `matchMedia("(max-width: 767px)")`,
  estado inicial `false`, sincroniza no mount; **sem hydration mismatch**). Cubra com teste.
- Rotas novas em `app/m/` (grupo dedicado, layout próprio sem navbar/particles pesados):
  - `app/m/layout.tsx` — layout mobile (viewport-fit, safe-area, sem StarBackground/ParticleSystem).
  - `app/m/estudos/page.tsx` e `app/m/pesquisa/page.tsx` — cada uma monta `MobileChat` com a
    `surface` correspondente.
  - `app/m/page.tsx` — home mobile: dois cartões grandes (Estudos / Pesquisa) + histórico.
- **Redirecionamento suave:** no `middleware.ts` (ou no layout raiz), se `useIsMobile` /
  user-agent mobile **e** a rota for uma sala completa (`/research-lab`, `/workstation/...`),
  ofereça (não force) ir para `/m/...`. Prefira um banner “Abrir versão mobile” + preferência
  salva em cookie `zaeon:ui=mobile|full` — **nunca** prenda o usuário; deixe alternar.

### B.3 Componentes (novos, isolados — NÃO reescreva as salas)
- `components/mobile/MobileChat.tsx` — o chat de coluna única. Props: `surface: "estudos" | "pesquisa"`.
  - Reusa os **mesmos endpoints**: Estudos → `/api/ai/chat` (com o retomável da Parte A);
    Pesquisa → `/api/ai/scholar` (background da fase 1). **Não** duplique lógica de rede:
    extraia o núcleo de streaming/reengate para hooks reutilizáveis
    (`lib/chat/useAuraChat.ts`, `lib/chat/useScholar.ts`) e consuma tanto no desktop quanto no
    mobile. (Refactor incremental: mova a lógica de `StudyCoworkChat`/`OmegaScholarContext`
    para hooks, mantendo o desktop funcionando.)
  - Render de resposta: reuse `StructuredAnswerView` (Estudos) e o render de resposta da
    pesquisa — em **modo compacto** (tipografia menor, sem “revista”/`MagazineAnswerView`
    no mobile; cartões empilhados, largura total).
  - Markdown: reuse `components/study/ChatMarkdown.tsx` (já plugado).
- `components/mobile/MobileComposer.tsx` — input fixo no rodapé (safe-area), auto-grow, botão
  enviar, botão “+” que abre um **sheet** de ações (B.4). Enter envia; sem atalhos de desktop.
- `components/mobile/MobileHistory.tsx` — drawer com conversas (Estudos) e pesquisas
  (`/api/ai/scholar/sessions`, `/api/ai/chat/turns`).
- `components/mobile/MobileActionsSheet.tsx` — bottom sheet com as ações de geração (B.4).

### B.4 Funcionalidades essenciais (simplificadas p/ caber no celular)
Inclua, mas enxuto:
- **Gerar documento/artefato** reusando o Studio já existente (fire-and-forget + poll, ver
  fase 2): mapa mental, guia, FAQ, flashcards, imagem, podcast, molécula. No mobile, mostre
  um **cartão de progresso** (“Gerando… você pode sair, avisamos quando ficar pronto”) e o
  artefato pronto num viewer compacto (`StudioBlock` em modo mobile). Nada de painel Studio.
- **Exportar** (ABNT/PDF) só se já existir endpoint (`ABNT_SERVICE_URL`); senão, esconda.
- **Trocar Estudos ⇄ Pesquisa** num toggle no topo. Persistir a última aba (cookie/localStorage).
- **Anexar arquivo** só se trivial; caso contrário, deixe para depois (documente como fora de escopo).
Corte explicitamente do mobile: sidebar de salas, biblioteca lateral, árvore de habilidades,
cover-flow de agentes, mural, modo foco. (Liste no PR o que ficou de fora e por quê.)

### B.5 Design/UX (padrão-ouro)
- Coluna única, largura total, bolhas; input fixo com safe-area (`env(safe-area-inset-bottom)`).
- Tema claro/escuro já do app; use o **glossy blue** do claro que já definimos (navbar/menu).
- Toque: alvos ≥ 44×44px; sem hover-only. Teclado não deve cobrir o input (usar `dvh`).
- Performance: sem `ParticleSystem`/vídeo; lazy-load do viewer de artefato; bundle mobile enxuto.

---

## PARTE C — Padrão-ouro de qualidade (obrigatório para dar o PR por pronto)

### C.1 Testes (vitest) — cobertura mínima **80%** nas unidades novas
Configure no `vitest.config.ts` um `coverage` (provider v8) com thresholds
(`lines/functions/statements ≥ 80`, `branches ≥ 70`) **escopado aos arquivos novos/alterados**
(use `coverage.include`). Rode `npm run test` limpo. Escreva, no mínimo:
- **Puros/unidade:**
  - `lib/ui/useIsMobile.test.ts` — breakpoint, SSR (sem `window`), troca de tamanho.
  - `lib/queue/chat.test.ts` — `enqueueChatJob` no-op sem `REDIS_URL`; jobId = turnId (idempotência).
  - `lib/agent/runChatTurn.test.ts` — com `buildHarnessDeps` mockado: emite eventos, grava
    `answer` + `status=done`; em erro → `status=error`. (Mock de rede/LLM; **nunca** LLM real.)
  - Reaper: marca preso→error; ignora recentes.
- **Contrato de API (route handlers, chamados como função):**
  - `POST /api/ai/chat` bg-mode retorna turnId e cria `ChatTurn`; fallback inline quando
    `CHAT_BG` off. Auth 401 sem sessão.
  - `GET /turns` e `/turns/[id]` — só do dono (IDOR: usuário A não lê turno de B).
- **Cliente/UI (jsdom + @testing-library/react, adicionar se preciso):**
  - `MobileChat` renderiza, envia, mostra bolha do usuário e resposta; estado de progresso.
  - Reengate: com turno `running` mockado, faz polling e renderiza `answer` ao concluir.
- **Regressão:** garanta que o desktop (`StudyCoworkChat`, `OmegaScholarContext`) continua
  passando após o refactor pra hooks.

### C.2 Além dos testes
- **Typecheck:** `npx tsc --noEmit` sem erros nos arquivos tocados.
- **Acessibilidade mobile:** roles/labels no composer e no sheet; foco visível; navegação por
  teclado no drawer; contraste AA. Um teste de a11y (axe) na `MobileChat` é desejável.
- **Segurança:** toda rota nova deriva `userId` da sessão (nunca do body); reuse `guard()`
  (rate-limit); valide `surface`/`scopeId`. Sem segredos em logs.
- **Flags/rollout:** `CHAT_BG` (default off), `SCHOLAR_WORKER=1` (worker; reusa o container),
  `NEXT_PUBLIC_MOBILE_UI` (default off) pra liberar `/m` gradualmente. Nada muda até ligar.
- **Perf:** meça o bundle da rota `/m` (deve ser < metade do `/research-lab`); sem imports
  pesados (framer/recharts) no caminho mobile crítico.
- **Docs:** atualize `docs/BACKGROUND_JOBS_SALA_PESQUISA.md` (marcar fase 3 feita) e crie
  `docs/MOBILE.md` (arquitetura, flags, o que ficou fora de escopo).

### C.3 Definition of Done (checklist do PR)
- [ ] `ChatTurn` no schema + `prisma generate`/`db push` documentado.
- [ ] Chat de Estudos retomável: sair no meio conclui no servidor; voltar mostra a resposta.
- [ ] Fila `chat` reusa a infra BullMQ; worker no mesmo container; reaper ativo.
- [ ] `/m/estudos` e `/m/pesquisa` funcionais, coluna única, geração de artefato + poll.
- [ ] Alternância mobile⇄full sem prender o usuário; preferência persistida.
- [ ] `npm run test` verde com cobertura ≥ 80% nos arquivos novos; `tsc --noEmit` limpo.
- [ ] Desktop intacto (regressão passando).
- [ ] Tudo atrás de flag; merge não altera comportamento até ligar.
- [ ] Sem segredos vazados; rotas com auth por sessão + rate-limit.

### C.4 Como entregar
PRs pequenos, nesta ordem sugerida: (1) `ChatTurn` + fila/worker/runChatTurn + testes;
(2) rota bg + endpoints de turno + reengate no `StudyCoworkChat`; (3) extração de hooks de
rede (`useAuraChat`/`useScholar`) sem regressão; (4) rotas `/m` + componentes mobile + testes;
(5) polimento a11y/perf + docs. Cada PR com testes próprios e verde no CI.

> Lembrete final: o dono valida em dev antes de ligar as flags em prod. Nunca ligue
> `CHAT_BG`/`NEXT_PUBLIC_MOBILE_UI` em produção sem o build testado e o worker de pé.
