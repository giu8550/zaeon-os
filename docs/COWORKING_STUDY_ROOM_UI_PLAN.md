# Sala de Estudos → Co-working com Agentes Plugáveis — Plano de UI (Fase 1)

> **Objetivo (Martinez):** transformar a Sala de Estudos num **co-working dedicado** com
> agentes de IA plugáveis (incluindo agentes externos como **Claude Code**). Esta PR é a
> **Fase 1 — só a UI**: deixar a interface "pronta" para receber a lógica agêntica que vem
> depois (harness + loop). Nada da lógica pesada entra agora; preparamos as superfícies.
>
> Atualizado: 2026-07-10. Fonte da verdade para a próxima passada do agente.

---

## 0. TL;DR do que muda nesta PR

1. A aba **"Meus Estudos"** deixa de ser "a página do caderno" e vira um **chat conversacional
   estilo Claude** — conversa natural sobre qualquer assunto, ocupando o espaço central.
2. Os **estudos gerados** continuam existindo exatamente como hoje, mas passam a aparecer como
   **artefato** dentro da conversa (não mais como a UI inteira da página). Mais espaço pra conversa
   generativa acontecer.
3. Os estudos mantêm seu lugar próprio na **biblioteca**; **arrastar e soltar** um estudo (ou
   vários) na conversa **foca o agente naquele(s) estudo(s)**.
4. O **composer** (janela de input) fica **idêntico ao do Claude** — mesmo tamanho de fonte,
   respiro e comportamento. O **⟁ (triângulo)** permanece no chat e passa a **abrir a seção
   Studio** sob demanda.
5. Uma **pill de agente estilizada** mostra o agente ativo na aba. Agente inicial: **Aura** — que
   agora **conhece todas as capacidades do Studio** e pode usá-las a qualquer momento na conversa.
6. **Tipografia mais fina e "tech"** no módulo.

**Regra de ouro desta PR:** *não alteramos nada do que já funciona nos arquivos gerados / no
Studio.* Só **expandimos** o módulo pra ter IA generativa que também produz estudos como artefatos.
Portão verde preservado (`vitest run` + transpile).

---

## 1. Estado atual — arquitetura mapeada (com caminhos reais)

### 1.1 Sala e abas
- **`app/workstation/student/StudyRoomContent.tsx`** — raiz da Sala de Estudos. Injeta a aba
  default `{ id: "meus-estudos", label: "Meus Estudos", icon: NotebookPen }` antes das `SALA_TABS`.
  Renderiza `<MeusEstudosFeed/>` (dynamic import, `ssr:false`) na aba "Meus Estudos" e
  `<OmegaScholarWorkspace/>` na aba de pesquisa. Envolve tudo em `<OmegaScholarProvider>`.
- **`app/research-lab/page.tsx`** — shell com abas (`activeTab`: `pesquisa | sala-de-estudos |
  projetos | pesquisas | lounge | news | profile`), inicializa do `?tab=`.

### 1.2 O "caderno" e a biblioteca (hoje = a página inteira)
- **`components/study/MeusEstudosFeed.tsx`** — o coração. Centro = **feed/caderno**
  (`placement: "feed"`), painel direito = **BIBLIOTECA** (`placement: "library"`).
  - Drag-and-drop já existe: `const DT = "application/x-zaeon-item"` (linha 40); `onDrop`
    (linha 582) lê `e.dataTransfer.getData(DT)`; itens da biblioteca setam `dataTransfer.setData(DT, it.id)`
    (linha 1027).
  - Geração de estudo: `zaeonStudy()` → `POST /api/study/agent` — insere blocos ao vivo
    (`heading|subheading|text|link`) com efeito "escrevendo".
  - **⟁** ao lado do título (linhas ~795–803) abre/fecha a "barra-agente" (`barOpen`).
  - Escuta o evento `zaeon:study:embed` (linha 431) pra encaixar artefatos do Studio no caderno.

### 1.3 Studio (artefatos) — já pronto, NÃO mexer na lógica
- **`components/studio/StudioDock.tsx`** — dock de pills: 📘 Guia · 🧠 Mapa mental · 🕒 Linha do
  tempo · 🃏 Flashcards · ❓ FAQ · 🖼️ Imagem · 🎙️ Podcast · 🎬 Vídeo. Cada uma chama
  `POST /api/studio/<kind>` e **emite** `zaeon:study:embed` com
  `detail = { studioKind, title, data, artifactId? }` (linha 28).
- **`components/studio/StudioBlock.tsx`** — cartão colapsável que renderiza o artefato inline.
- **`components/studio/StudioArtifactViews.tsx`** — views por tipo (Guide/Faq/Flashcards/Mindmap/
  Timeline/Podcast/Image/Video).
- APIs `app/api/studio/{guide,mindmap,timeline,flashcards,faq,image,podcast,video}/route.ts` +
  `[id]/route.ts` (polling) + `[id]/file/route.ts` (binário). Libs puras em **`lib/studio/`**.
- Persistência: modelo Prisma **`StudioArtifact`** (`kind, status, sourceIds[], mime, storageRef,
  meta`); binários em `.studio/<id>.<ext>`; cache por `(sourceIds + kind)`.

### 1.4 Chat de IA e personas
- **`app/api/ai/chat/route.ts`** — rota central (Vertex/Gemini Flash).
  - `AGENT_PERSONAS` (linha 86): `aura, zion, zaeon, scholar, examiner, zenita, core_active,
    abnt_structurer`. Default `agentKey = "aura"` (linha 208).
  - Histórico multi-turno: `sanitizeHistory` de **`lib/ai/history.ts`** → `startChat({ history })`.
  - World-state injetado: `formatAgentContext` (activeTab, currentGoal, currentStudyId,
    recentActions…).
  - Tools (function-calling) condicionais: `updateScheduleTool`, `summonAgentTool`, `openRoomTool`;
    `SUMMON_MAP` (linha 78) roteia skill → rota/rótulo de agente.
- **`app/api/ai/scholar/route.ts`** — pesquisa acadêmica (NDJSON streaming) — permanece na aba
  Pesquisa, **fora** do escopo desta PR.

### 1.5 Persistência de estado / world-state (já existe — reaproveitar)
- **`src/models/AgentContext.ts`** + **`/api/agent/context`** + **`lib/agent/context.ts`**:
  world-state durável por usuário (`activeRoom, activeTab, currentStudyId, currentGoal,
  recentActions[]`). É onde o "foco" de estudo(s) vai morar.

### 1.6 Tipografia
- **`tailwind.config.ts`** — `sans = var(--font-space)`, `mono = var(--font-code)`.
- **`app/layout.tsx`** — `Space_Grotesk` (`--font-space`), `JetBrains_Mono` (`--font-code`),
  `Outfit` (`--font-outfit`).
- **`app/globals.css`** — Fraunces (`.font-ornament`), Cedarville (`.cursive`), CSS vars de tema.

### 1.7 Lacunas confirmadas (o que esta PR resolve)
- **Não existe** chat conversacional multi-turno **dentro** da Sala de Estudos — há três
  superfícies de input separadas (barra Omega, barra-agente do caderno, e `/api/ai/chat` fora dela).
- **Não existe** componente reutilizável de **pill de agente**.
- Estudo hoje **é** a UI da página inteira; precisa virar **artefato** dentro da conversa.

---

## 2. Fase 1 — a UI (esta PR). Escopo detalhado

> Princípio de fatiamento: entregar **casca visual + contratos**, com stubs onde a lógica ainda
> não existe. Cada slice fecha verde antes do próximo.

### Slice 1 — "Meus Estudos" vira o chat (layout estilo Claude)
- Novo componente **`components/study/StudyCoworkChat.tsx`** (client, `ssr:false`) que passa a ser
  o que `StudyRoomContent` renderiza na aba "Meus Estudos" (substitui o mount direto do
  `MeusEstudosFeed` **como página**; ver Slice 2 pra onde o feed vai).
- Layout: coluna central de **conversa** (bolhas de turno usuário/agente, `whitespace-pre-wrap`,
  markdown leve), largura de leitura confortável (max-w ~48rem, centralizado), fundo liquid-glass
  suave. Conversa sobre **qualquer assunto** — chama **`POST /api/ai/chat`** com
  `agent: "aura"` + `history` (via `sanitizeHistory`) + `agentContext`.
- **Sem** re-arquitetar o backend do chat nesta PR — só consumir o `/api/ai/chat` já existente.
- Estado de conversa local no componente nesta fase (persistência durável fica pra Fase 2 /
  `Conversation` model — ver AGENT_CONTEXT_AND_EXECUTION.md, Fase 3).

### Slice 2 — Estudo como **artefato** (não a página inteira)
- O **caderno/estudo** deixa de ocupar a página e passa a renderizar como **artefato dentro da
  conversa**, reusando o mesmo padrão do Studio:
  - Emitir/consumir um **artefato de tipo estudo**: estender o contrato do evento existente
    `zaeon:study:embed` com um `studioKind: "study"` (ou um irmão `zaeon:cowork:artifact`), cujo
    `data` aponta pro `StudySpace`/`StudyItem[]` já gerado por `POST /api/study/agent`.
  - Um card **`StudyArtifactCard`** (pode nascer como wrapper fino sobre o `StudioBlock` /
    `MeusEstudosFeed` em modo "embedded/compacto") renderiza o estudo **inline na conversa**, com
    as MESMAS ações de hoje (abrir, salvar na biblioteca, baixar, TTS/Ouvir). **Nada dos arquivos
    gerados muda** — só o **container** onde ele aparece.
- **`MeusEstudosFeed.tsx`** ganha um prop de modo (`variant: "page" | "artifact"`): em `"artifact"`
  ele renderiza compacto (sem ocupar tela cheia), preservando toda a lógica de blocos/persistência.
  Em `"page"` continua idêntico (para a Biblioteca — Slice 3).

### Slice 3 — Biblioteca dedicada + drag-drop de **foco**
- Os estudos mantêm **espaço próprio na biblioteca** (o painel `placement: "library"` de hoje),
  acessível ao lado da conversa (drawer/coluna colapsável, abre pelo ⟁ ou por um botão de acervo).
- **Arrastar um estudo (ou vários) para a conversa** → o agente passa a **focar apenas naquele(s)
  estudo(s)**:
  - Reusar o tipo de drag existente **`application/x-zaeon-item`** (`DT`). A conversa registra uma
    dropzone que lê `getData(DT)` (múltiplos ids = multi-seleção).
  - Ao soltar: setar **`focusedStudyIds: string[]`** no estado da conversa **e** em
    `AgentContext.currentStudyId`/campo novo `focusedStudyIds` (world-state), pra viajar no prompt.
  - Injetar no `/api/ai/chat` como `agentContext` + carregar o conteúdo dos estudos focados como
    contexto (reaproveitar **`lib/studio/content.ts` `loadStudyContext`** / `sameIdSet`). Chips de
    "foco ativo" aparecem acima do composer, removíveis.

### Slice 4 — Composer idêntico ao Claude + ⟁ abre o Studio
- Novo **`components/study/CoworkComposer.tsx`**: textarea auto-crescente, **mesmo tamanho de
  fonte/entrelinha do Claude** (~15–16px, line-height confortável), placeholder discreto, borda
  liquid-glass fina, botão enviar (seta), Shift+Enter = nova linha, Enter = enviar.
- O **⟁ permanece no chat** (dentro/ao lado do composer) e passa a **abrir a seção "Studio"** —
  o `StudioDock` (pills 📘🧠🕒🃏❓🖼️🎙️🎬) aparece num painel/drawer sob demanda, **não** fixo.
  Fechar volta pro chat limpo. Mantém o pulse do ⟁ (`zaeon:pulse`).
- Sem mudar as rotas do Studio — o dock continua chamando `POST /api/studio/<kind>` e emitindo
  `zaeon:study:embed`; a diferença é que o resultado agora encaixa **na conversa**.

### Slice 5 — Pill de agente estilizada + Aura ciente do Studio
- Novo componente reutilizável **`components/agent/AgentPill.tsx`**: mostra o **nome do agente
  ativo** ("Aura") com estética "tech" — fonte fina, tracking levemente aumentado, ponto/anel de
  status com gradiente azul→ciano→violeta (liquid-glass), opcional glow sutil. Fica no topo da
  aba "Meus Estudos". Preparado para ser **trocável** (dropdown de agentes na Fase 2, incl.
  externos como Claude Code).
- **Aura conhece o Studio**: em `app/api/ai/chat/route.ts`, estender a persona
  `AGENT_PERSONAS.aura` (linha 98) com um bloco descrevendo as capacidades do Studio (guia, mapa
  mental, timeline, flashcards, FAQ, imagem, podcast, vídeo, ouvir) e **quando/como** oferecê-las
  ("se o usuário pedir um resumo mastigado, ofereça gerar um Guia/FAQ; para memorização,
  Flashcards", etc.). Nesta PR isso é **conhecimento no prompt** — o disparo real via function-call
  (tool `studio_action`) é Fase 2; aqui a Aura pode ao menos **sugerir** e o usuário clica a pill
  correspondente no dock.

### Slice 6 — Tipografia mais fina e "tech"
- Introduzir uma face **mais fina/tech** para o módulo co-working. Opções (decidir — ver §5):
  manter **Space Grotesk** com pesos 300/400 e tracking ajustado, **ou** adicionar uma mono/grotesk
  mais técnica (ex.: peso leve de `JetBrains Mono` para labels/pills, ou uma nova var
  `--font-tech`). Aplicar via classe utilitária escopada ao co-working (não trocar a fonte global
  do app sem aprovação).

---

## 3. Pontos de código a tocar (mapa da PR)

| Arquivo | Ação | Slice |
|---|---|---|
| `app/workstation/student/StudyRoomContent.tsx` | Trocar o mount da aba "Meus Estudos" para `<StudyCoworkChat/>` | 1 |
| `components/study/StudyCoworkChat.tsx` | **Novo** — shell do chat co-working (conversa + composer + biblioteca + artefatos) | 1–4 |
| `components/study/CoworkComposer.tsx` | **Novo** — composer estilo Claude + ⟁ que abre o Studio | 4 |
| `components/agent/AgentPill.tsx` | **Novo** — pill estilizada do agente ativo (Aura) | 5 |
| `components/study/MeusEstudosFeed.tsx` | Prop `variant: "page"\|"artifact"`; extrair o painel Biblioteca reutilizável; **sem tocar** na lógica de blocos/persistência/Studio | 2–3 |
| `components/studio/StudioDock.tsx` | Passar a abrir via ⟁/drawer (sem fixar); manter emissão `zaeon:study:embed` | 4 |
| `app/api/ai/chat/route.ts` | Estender `AGENT_PERSONAS.aura` com catálogo do Studio; aceitar `focusedStudyIds` no `agentContext` | 3,5 |
| `lib/agent/context.ts` + `src/models/AgentContext.ts` | Adicionar `focusedStudyIds?: string[]` ao world-state | 3 |
| `lib/studio/content.ts` | Reusar `loadStudyContext`/`sameIdSet` para montar contexto dos estudos focados | 3 |
| `tailwind.config.ts` / `app/globals.css` / `app/layout.tsx` | Fonte fina/tech escopada ao co-working (`--font-tech` ou pesos leves) | 6 |

### Contratos novos (tipos)
```ts
// estado da conversa co-working (cliente, Fase 1)
type CoworkMessage = { role: "user" | "assistant"; content: string; at: number;
                       artifacts?: CoworkArtifactRef[] };
type CoworkArtifactRef = { kind: "study" | StudioKind; id?: string; title: string; data?: unknown };

// foco de estudo (viaja no agentContext)
type StudyFocus = { focusedStudyIds: string[] };  // dropados na conversa

// evento reutilizado/estendido
// window "zaeon:study:embed" detail: { studioKind: StudioKind | "study", title, data, artifactId? }
```

---

## 4. O que **NÃO** muda nesta PR (contrato de não-regressão)
- Lógica de geração dos estudos (`/api/study/agent`, blocos ao vivo, `StudySpace`/`StudyItem`).
- Tudo do **Studio**: rotas `/api/studio/*`, `StudioArtifact`, `StudioBlock`, views, storage
  `.studio/`, cache por `sourceIds+kind`, evento `zaeon:study:embed`.
- Características dos **arquivos criados** nos estudos (formatos, ações salvar/baixar/TTS).
- Aba **Pesquisa** (Omega Scholar) e suas rotas.
- Voz / `ttsController` / `useTTS`.

## 5. Decisões em aberto (confirmar com Martinez)
1. **Fonte "tech"**: manter Space Grotesk leve **ou** adicionar uma nova `--font-tech`? Se nova,
   qual (ex.: *Geist*, *Inter Tight*, *JetBrains Mono* leve)?
2. **Biblioteca ao lado da conversa**: drawer que abre pelo ⟁, coluna fixa colapsável, ou aba?
3. **Persistência da conversa** nesta fase: só em memória de página (recomendado p/ Fase 1) ou já
   ligar no world-state?
4. **Nome/rota** do artefato de estudo: reusar `zaeon:study:embed` com `studioKind:"study"` ou
   criar canal próprio `zaeon:cowork:artifact`?

## 6. Portão de verificação (obrigatório)
- `node_modules/.bin/vitest run` **100% verde** (não regredir a contagem atual).
- Transpile por arquivo dos tocados (`typescript.transpileModule`, category!==1).
- **Não** rodar `next dev`/`next build` localmente (RAM). Build real no CI/VPS.
- Checagem manual: conversa envia/recebe via `/api/ai/chat`; drag de estudo mostra chip de foco;
  ⟁ abre/fecha Studio; pill mostra "Aura"; artefato de estudo encaixa na conversa; **nada** do
  Studio existente quebrou.
- Commits pequenos; push é do humano (Zed). Deploy automático `main → GitHub Actions → VPS`.

---

## 7. Fase 2 (próxima PR) — Harness + loop agêntico + agentes externos

> Escopo desenhado aqui só para orientar a Fase 1 (não implementar agora). Baseado no que já
> existe no repo + padrões do `ai4s-research/open-science` e dos benchmarks de agente.

### 7.1 Harness / action bus (as "mãos" visíveis)
- Ligar o **action bus** já projetado (`lib/agent/actions.ts` + `<AgentActionRunner/>`, ver
  **AGENT_CONTEXT_AND_EXECUTION.md** Fase 2): a Aura retorna uma **lista de passos** (tool
  `execute_plan`) e a UI executa **visivelmente** (cursor-fantasma, digitação animada, log de
  passos), chamando as funções reais (criar estudo, gerar artefato do Studio, focar item…).
- Tool **`studio_action`** no `/api/ai/chat` (function-calling): a Aura **dispara** as capacidades
  do Studio que hoje ela só descreve (guide/faq/flashcards/mindmap/timeline/image/podcast/video),
  devolvendo `{ action, args }` que o front executa via os canais já existentes.

### 7.2 Loop agêntico + guardrails (reusar o que já foi validado na sala Projetos)
- Portar os guardrails do agente de Projetos (ver **PROJECTS_AGENT_OSS_BENCHMARK.md**, extraídos de
  *Golem* e *Bitloops*): teto de chamadas (`MAX_CALLS`), gate de falhas consecutivas, anti-stale,
  **checklist viva** (pending→doing→done), **memória de projeto** apagável, e **raciocínio ligado
  ao artefato** (o "porquê" salvo no `StudioArtifact.meta`).
- Padrão **plan → approve → execute → artifacts → review** (o loop do `open-science`): manter
  **human-in-the-loop** (aprovar comando/escrita) como default, exatamente como o workbench deles.

### 7.3 Agentes plugáveis externos (Claude Code etc.)
- Generalizar a **AgentPill** num **seletor de agentes**. Reusar o contrato de roteador de modelos
  já existente: **`lib/ai/router.ts`** (`route()`/`generate()`) que hoje tem Gemini real +
  **Anthropic (Sonnet/Opus) plugável/fallback** (ver **PROJECTS_AGENTIC_IDE_SPEC.md**).
- **Claude Code / agentes externos**: dois caminhos a avaliar na Fase 2 —
  (a) via **MCP** (o Zaeon expõe as ações da Sala como um MCP server, e um agente externo as
  consome), espelhando o modelo do `open-science` (OpenCode runtime + MCP + skills plugáveis);
  (b) via **harness próprio** que troca o provider no `router.ts` e mantém a mesma UI de co-working.
- Definir o **contrato de "agente"**: `{ id, label, provider, capabilities[], external? }` — a pill
  mostra qualquer um; o loop e o action bus permanecem os mesmos.

### 7.4 Referências internas para a Fase 2
- `docs/AGENT_CONTEXT_AND_EXECUTION.md` — world-state + action bus (Fases 1–3).
- `docs/AGENT_FINALIZATION_LOOP.md` — loop de finalização + regra de ouro voz.
- `docs/PROJECTS_AGENTIC_IDE_SPEC.md` — roteador de modelos + Anthropic plugável + contrato GitHub.
- `docs/PROJECTS_AGENT_OSS_BENCHMARK.md` — guardrails/memória/checklist (Golem, Bitloops).
- `docs/ZAEON_STUDIO_AGENT.md` — catálogo completo do Studio (fonte da verdade dos artefatos).
- Externo: `ai4s-research/open-science` (OpenCode + MCP + skills; UI↔SDK↔runtime desacoplado;
  provenance append-only) — blueprint do co-working plugável.
