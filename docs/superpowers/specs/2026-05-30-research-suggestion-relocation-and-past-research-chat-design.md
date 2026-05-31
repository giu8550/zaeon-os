# Design — Realocação do Painel de Sugestão + Past-Research-Chat sobre `ScholarSession`

> **Data:** 2026-05-30
> **Origem:** `CLAUDE_CODE_PROMPT_research_suggestion_relocation_and_past_research_chat.md` (v1.0), reconciliado com o estado real do repositório.
> **Branch:** `feat/research-news-profile-migration`
> **Status:** aprovado para Fase 1; Fase 2 desenhada, implementação após checkpoint.

---

## 0. Conclusão (leia primeiro)

Duas correções de arquitetura, mesmos objetivos do prompt original, **re-fundamentadas no código real**:

1. **Fase 1 (P0, esta sessão):** mover `ResearchSuggestionPanel` da aba `pesquisa` para a `sala-de-estudos`, exibido como _dock_ contextual que aparece quando o usuário digita um termo acadêmico no **input que já existe** (`OmegaScholarBar`).
2. **Fase 2 (P0, após checkpoint):** transformar "Pesquisas Anteriores" em mini-chats Omega Scholar — **ancorados no histórico real de `ScholarSession`** do usuário (não nos cards mockados), de modo que a disciplina de citação `[ref:N]` tenha referências reais para honrar.

O painel de sugestão é a _surface_ de entrada (intent capture); cada past-research-chat reusa o pipeline scholar e o prompt-mestre do Omega Scholar.

---

## 1. Estado real do repositório (verificado)

Três premissas do prompt original **não se sustentam** no código atual. O design abaixo corrige cada uma.

| Premissa do prompt | Realidade verificada | Consequência no design |
|---|---|---|
| "Pesquisas Anteriores" tem paper/autores/abstract/DOI/downloads para carregar no chat | [`researches/page.tsx`](../../../app/study-rooms/lounge/main-lounge/researches/page.tsx) é 100% mock: `RESEARCH_DATA` gerado com `Math.random()` a partir de 12 títulos repetidos, agentes fake ("Alpha-Node") e métricas aleatórias. **Zero** papers/autores/abstracts/DOIs/refs. | Fase 2 ancora no histórico real de `ScholarSession` (já tem `references`/`evidence`/`insights`), via o endpoint existente [`/api/ai/scholar/sessions`](../../../app/api/ai/scholar/sessions/route.ts). |
| `sala-de-estudos` é tela vazia onde se acopla um dock flutuante com input próprio | [`StudyRoomContent.tsx`](../../../app/workstation/student/StudyRoomContent.tsx) já é um workspace Omega Scholar completo: `OmegaScholarProvider` + `OmegaScholarBar` (input próprio) + 7 abas. | O dock observa o input que **já existe** (`OmegaScholarBar`), sem criar input concorrente. |
| `ResearchSuggestionPanel` pode auto-disparar ao digitar, mantendo API intacta | A API (`docTitle`/`onSelectTitle`) só **semeia** o tópico uma vez e nunca auto-busca. | O dock aparece com o painel pré-semeado pelo termo; o usuário clica "Gerar". Sem mudar a API pública do painel. |

Discrepâncias menores (não-bloqueantes): `CLAUDE.md` não existe na raiz; o bloco `sala-de-estudos` está nas linhas previstas mas com `className` diferente; `lib/scholar/` é mais rico que o prompt lista (tem `gemini.ts`, `verify.ts`, `ssrf.ts`, etc.).

### Padrões a reusar (não reinventar)
- **Auth:** não há `session.user.id`. Padrão confirmado em ambas as rotas: `getServerSession(authOptions)` → `prisma.user.findUnique({ where: { email } })` → `userId`. Qualquer rota nova segue isto.
- **Streaming:** [`/api/ai/scholar/route.ts`](../../../app/api/ai/scholar/route.ts) usa `ReadableStream` + `send(e: ScholarEvent)` que enfileira `JSON.stringify(e) + "\n"`, `Content-Type: application/x-ndjson`. Cliente em `OmegaScholarContext.runQuery` faz parse linha-a-linha. Reusar este encoder/decoder.
- **Prisma singleton:** `@/src/lib/prisma`. `ScholarSession` em `prisma/schema.prisma:344-360`.

---

## 2. Fase 1 — Dock contextual na `sala-de-estudos` (esta sessão)

### 2.1 Arquivos novos

**`lib/scholar/academic-term-classifier.ts`** — função pura, sem rede (roda a cada keystroke, debounce 350 ms):
```ts
isAcademicTerm(input: string): {
  isAcademic: boolean;
  confidence: number;            // 0..1, threshold ≥ 0.55
  matchedTerms: string[];
  domain?: 'bio'|'med'|'cs'|'phys'|'chem'|'eng'|'human'|'social'|'multi';
}
```
Heurísticas combinadas:
- **Léxico** por domínio (`academic-lexicon.json`).
- **Tokens morfológicos:** `-omics`, `-genesis`, `bio-`, `nano-`, `quantum`, `ab initio`, `in vitro/vivo/silico`, `metaanálise`, `revisão sistemática`, `framework`, `theorem`, `hypothesis`, etc.
- **Estrutura tipográfica:** fórmulas químicas (`[A-Z][a-z]?\d*`), DOIs (`10.\d{4,}/…`), arXiv IDs (`\d{4}\.\d{4,5}`), CamelCase de gene/proteína.
- **Idioma:** aceita pt-BR e en.

**`lib/scholar/academic-lexicon.json`** — ~400 termos por domínio. **Fonte obrigatória (não inventar):** `OMEGA_SCHOLAR.md` §2 (bases públicas), `research-engine/prompts.py`, e a taxonomia `ROOM_MAPPING` já existente em `StudyRoomContent.tsx` (cursos pt-BR → domínios). Mapa de domínios alinhado às salas: cyber→cs, med→med, bio→bio, quantic→phys, humanities→human/social.

**`lib/scholar/academic-term-classifier.test.ts`** — ≥ 25 casos positivos (ex.: "graphene oxide synthesis", "revisão sistemática de CRISPR", "ab initio DFT") e ≥ 25 negativos (ex.: "comprar pão", "qual o horário do ônibus", "jogo de futebol hoje").

**`components/research/ContextualSuggestionDock.tsx`** — wrapper que encapsula `ResearchSuggestionPanel` (**API inalterada**). Props: `topic: string`, `level?: Level`, `onSelectTitle?`, `autoHideMs?`, `onDismiss?`.
- Renderiza **somente** quando `topic.length ≥ 3 && isAcademicTerm(topic).isAcademic`.
- O painel recebe `topic` via `docTitle` (semeado na **primeira** detecção; o `useEffect` do painel só seta o tópico quando ainda vazio). Edições posteriores acontecem **dentro** do painel — a API pública não muda. Se o termo detectado mudar materialmente e quisermos re-semear, o dock remonta o painel via `key={topic}` (reset deliberado de estado); decisão fica explícita no plano.
- Container flutuante no topo: `sticky top-0 z-30`, `max-h-[420px]`, `bg-[#030014]/95 backdrop-blur-xl`, chevron de colapso, estado em `localStorage` (`zaeon:dock:collapsed`).
- Cooldown de 8 s após dismiss explícito (mitiga ruído / falso positivo).
- `mounted` guard para hidratação (`sticky` + `localStorage`).
- Fallback amigável quando engine offline (a rota já retorna 503; o painel já exibe `error` — o dock mostra a nota "Engine indisponível — verifique research-engine na porta 8002").
- Paleta cyan/teal e `Space Grotesk` mantidos (sem nova paleta).

### 2.2 Integração & edições

- **`OmegaScholarContext.tsx`:** adicionar `draft: string` + `setDraft(v)` ao estado/contexto. (Decisão aprovada: elevar o draft ao contexto em vez de escutar atributos DOM `[data-academic-input]`.)
- **`OmegaScholarBar.tsx`:** o input passa a ler/escrever `draft` do contexto (hoje é `value` local). `submit()` continua chamando `runQuery(draft)` e limpando (`setDraft("")`).
- **`StudyRoomContent.tsx`:** renderizar `<ContextualSuggestionDock topic={debouncedDraft} onSelectTitle={…} />` logo abaixo do `OmegaScholarBar` (debounce 350 ms sobre `draft`).
- **`onSelectTitle` na sala-de-estudos:** não há editor de documento aqui → "Usar como título →" mapeia para semear a barra (`setDraft(title)`), permitindo disparar uma pesquisa profunda. (Decisão aprovada. Fase 3 evolui para "→ Iniciar pesquisa" direto.)
- **`app/research-lab/page.tsx`:** remover o bloco do painel na aba `pesquisa` (1161–1167). Isso **orfana** `handleSelectResearchTitle` (def. ~973) e o `dynamic import` de `ResearchSuggestionPanel` (19–20). Remover o handler e o import órfãos para manter `lint` + suíte verdes (regra tests-before-PR). `ResearchesPage` (import linha 18) permanece.

### 2.3 Critérios de verificação (Fase 1)
- `npm test -- academic-term-classifier` verde (≥25/≥25).
- Suíte `lib/scholar` existente continua verde.
- `npx tsc --noEmit` e `npm run lint` limpos.
- Manual: digitar "graphene oxide synthesis" na `sala-de-estudos` → dock aparece ≤ 500 ms; digitar "comprar pão" → não aparece.
- Manual: aba `pesquisa` não exibe mais o painel.
- Console sem warnings de hidratação.

---

## 3. Fase 2 — Past-Research-Chat sobre `ScholarSession` (design; após checkpoint)

> Não implementado nesta sessão. Contratos abaixo ficam congelados para o plano subsequente.

### 3.1 Dados
- A página `researches` (lounge) busca `/api/ai/scholar/sessions` (GET já existente: `findMany({ where: { userId } })`) e lista as `ScholarSession` `status: "done"` do usuário como "Pesquisas Anteriores" (query, domain, nº de referências, data). O showcase mockado (`Math.random`) é substituído por histórico real.
- Cada card abre o `PastResearchChatModal`; o "expandir métricas" atual vira secundário (`Detalhes ▼`).

### 3.2 Prisma — novo modelo (não altera `ScholarSession`)
```prisma
model PastResearchChat {
  id               String   @id @default(auto()) @map("_id") @db.ObjectId
  userId           String   @db.ObjectId
  scholarSessionId String   @db.ObjectId   // REQUIRED: past-research = uma ScholarSession real
  title            String
  contextJson      Json     // snapshot: query, domain, references[], evidence[], insights
  messages         Json     // [{ id, role, content, createdAt, citations?: Citation[] }]
  pinned           Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@index([userId, scholarSessionId])
}
```
(Diferença vs prompt: `scholarSessionId` é obrigatório e `researchId` string mock é descartado, porque a fonte é a sessão real.) Migração: `npx prisma generate` + `npx prisma db push` (MongoDB, sem `migrate`). Documentar estado anterior em `migration_notes.md` para rollback (`db.PastResearchChat.drop()`).

### 3.3 Rota nova — `app/api/research/chat/[sessionId]/route.ts`
- **GET:** retorna/upsert `PastResearchChat`; popula `contextJson` a partir da `ScholarSession` (auth-by-email; valida `userId` dono da sessão).
- **POST (NDJSON streaming, mesmo encoder do scholar):** recebe `{ message }`, aplica o **system prompt do Omega Scholar** (`OMEGA_SCHOLAR.md` §1 identidade + §3 loop + §6 citação) + contexto injetado de `contextJson`, responde via `lib/scholar/gemini.ts`.
- **Citação obrigatória:** afirmações factuais marcam `[ref:N]` (índice em `contextJson.references`, que **agora existem**). Validação por regex no servidor antes de persistir; re-prompt se faltar citação onde há fato verificável.
- **Custo:** janela deslizante de 12 mensagens + summary das anteriores; soft-limit de 50 turns.

### 3.4 Modal — `components/research/PastResearchChatModal.tsx`
3 colunas: (esq. 25%) metadados da sessão — query, domínio, lista de referências, evidências; (centro 50%) chat infinito com auto-scroll, `Ctrl+Enter`, Markdown + badges `[ref:N]`; (dir. 25%) referências verificadas + ações: exportar Markdown, "Iniciar pesquisa aprofundada" (`/api/ai/scholar`). `IosLoader` no loading; fallback `localStorage` se a auth cair. **Layout mobile: NÃO especificado — perguntar antes de implementar.**

---

## 4. Contratos que não podem quebrar
- `ResearchSuggestionPanel` props (`docTitle`, `onSelectTitle`) — inalterado; só muda quem o renderiza.
- `POST /api/ai/research-suggest` body `{ topic, level, exclude_titles }` — inalterado.
- `SuggestResponse` (engine) — inalterado.
- `ScholarSession` (Prisma) — **não alterar**; `PastResearchChat` é separado e linka via `scholarSessionId`.
- `ScholarEvent` / encoder NDJSON — reusar idêntico no endpoint novo.
- Tipografia/paleta (`Space Grotesk`, cyan/teal) — manter.

## 5. Fora de escopo (agora)
Outras 6 salas `researches/page.tsx` (só a lounge está plugada em research-lab + lounge StudyRoom); Fase 3 (integração cruzada), Fase 4 (telemetria/a11y além do básico do dock/modal), Fase 5 (cache Redis, export docx, indexação Obsidian).

## 6. Plano de testes
Unit do classificador (≥25/≥25) · suíte `lib/scholar` verde · `tsc --noEmit` · `lint` · `build`. **Suíte verde antes de qualquer PR** (regra do usuário).

## 7. Riscos
- Falso positivo do classificador → ruído. Mitigação: threshold 0.55 + cooldown 8 s.
- MongoDB sem migrations versionadas → `db push` direto; documentar rollback.
- Custo Gemini em chats longos → janela deslizante + soft-cap 50 (Fase 2).
- Hidratação do `sticky`/`localStorage` → `mounted` guard.
