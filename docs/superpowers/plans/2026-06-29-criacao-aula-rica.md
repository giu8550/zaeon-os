# Criação de Aula Rica (fatia 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar perguntas blocos de primeira classe do canvas teach (summonáveis por "/" e dock), intercalados no conteúdo, persistidos numa sequência ordenada (`Aula.blocks`), e renderizados em ordem para o aluno — usando os 4 tipos de pergunta que já existem.

**Architecture:** O canvas (`MeusEstudosFeed mode="teach"`) ganha um novo bloco `aula-question` (StudyItem cujo payload é um `AuthQ`). No "Enviar", um serializador PURO converte o feed ordenado em `{ blocks, questions }`; o POST `/api/aulas` cria os `AulaQuestion` e grava `Aula.blocks` (sequência ordenada com refs `questionId`). O aluno (`StudentAulasModule`) itera `Aula.blocks` quando presente (fallback ao caminho atual). Correção (`lib/aulas/grade.ts`) e submit ficam intactos.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma + MongoDB, vitest (`@/` alias), Tailwind.

## Global Constraints

- Branch única `feat/criacao-aula-rica` (base `main` atual). **Nunca `git add -A`** — adicionar só os arquivos de cada task. Push pode travar (proxy ISP) → deixar commit pronto e avisar.
- macOS sem `python` → usar `python3`. Sem segredos no git/chat.
- `npx tsc --noEmit` ao fim de cada task: **zero erros novos** (baseline conhecido ≤5).
- Prisma: montar objetos `data` em `const` tipada (excess-property); `npx prisma generate` após mexer no schema. MongoDB — campo opcional novo é não-destrutivo (sem migrate).
- **Não quebrar** o caminho atual: aulas antigas (sem `blocks`), `AulaQuestionsPanel`, `grade.ts`, submit/progress.
- Reusar, não reinventar. Confirmar cada trecho no arquivo real antes de editar.
- Idioma de UI/strings: português.

---

### Task 1: Schema — `Aula.blocks Json?`

**Files:**
- Modify: `prisma/schema.prisma` (model `Aula`, ~linha 618-632 — adicionar campo `blocks`)

**Interfaces:**
- Produces: campo `Aula.blocks Json?` (sequência ordenada de blocos da aula; formato definido na Task 2).

- [ ] **Step 1: Adicionar o campo `blocks` ao model `Aula`**

No `model Aula`, logo abaixo de `body String?`, adicionar:
```prisma
  blocks      Json?                          // sequência ordenada de blocos (fatia rica); null = aula antiga (usa body)
```

- [ ] **Step 2: Regenerar o client Prisma**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" sem erros. (Mongo: sem migration.)

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit`
Expected: zero erros novos.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(aula): Aula.blocks Json para sequência ordenada de blocos (fatia rica)"
```

---

### Task 2: Serializador puro `lib/aulas/aulaBlocks.ts` (núcleo, TDD)

Converte o feed ordenado do canvas em `{ blocks, questions }`. PURO (sem React/DOM) → testável com vitest. É o coração da arquitetura intercalada.

**Files:**
- Create: `lib/aulas/aulaBlocks.ts`
- Test: `lib/aulas/aulaBlocks.test.ts`

**Interfaces:**
- Consumes: `AuthQ` de `@/components/aulas/AulaQuestionsPanel`; o tipo `FeedItem` (subconjunto do `Item` do feed) é definido aqui.
- Produces:
  - `type AulaBlock = {kind:"text"; md:string} | {kind:"video"; youtubeId:string} | {kind:"studio"; studioKind:string; title?:string; data:unknown} | {kind:"q"; qref:string; qkind:string}`
  - `type SerializedAula = { blocks: AulaBlock[]; questions: AuthQ[] }`
  - `function serializeFeed(feed: FeedItem[]): SerializedAula`
  - `function ytIdFromText(s: string): string | null`

Notas de design:
- `q` carrega `qref` = `AuthQ.id` (id temporário do cliente). A Task 5 (rota) troca `qref` pelo `questionId` real ao criar os `AulaQuestion`. O shape PERSISTIDO em `Aula.blocks` usa `questionId` (Task 5); o shape do serializador usa `qref`.
- Mapeamento de item do feed → bloco:
  - `type:"aula-question"` → empurra `payload` (AuthQ) em `questions` **e** um `{kind:"q", qref: payload.id, qkind: payload.kind}` em `blocks`.
  - `type:"note"` com `payload.text` que é um link solo do YouTube → `{kind:"video", youtubeId}`.
  - `type:"note"` → `{kind:"text", md}` (aplica `# `/`## ` conforme `payload.variant` h1/h2).
  - `type:"video"` (payload.videoId) → `{kind:"video", youtubeId}`.
  - `type:"link"` (payload.url) → `{kind:"text", md: "[title](url)"}`.
  - `type:"studio"` → `{kind:"studio", studioKind, title, data}`.
  - notes vazios e tipos desconhecidos → ignorados.

- [ ] **Step 1: Escrever os testes (falhando)**

Create `lib/aulas/aulaBlocks.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { serializeFeed, ytIdFromText, type FeedItem } from "@/lib/aulas/aulaBlocks";

const note = (id: string, text: string, variant?: string, order = 0): FeedItem =>
  ({ id, type: "note", title: "", payload: { text, variant }, placement: "feed", order });
const q = (id: string, kind: string, order = 0): FeedItem =>
  ({ id, type: "aula-question", title: "", payload: { id, kind, type: "choice", text: "P?", marks: 2 }, placement: "feed", order });

describe("ytIdFromText", () => {
  it("extrai id de link solo do youtube", () => {
    expect(ytIdFromText("https://youtu.be/abc12345678")).toBe("abc12345678");
    expect(ytIdFromText("https://www.youtube.com/watch?v=abc12345678")).toBe("abc12345678");
  });
  it("texto com mais que o link → null", () => {
    expect(ytIdFromText("veja https://youtu.be/abc12345678 agora")).toBeNull();
    expect(ytIdFromText("só um texto")).toBeNull();
  });
});

describe("serializeFeed", () => {
  it("preserva a ordem e intercala texto e pergunta", () => {
    const feed = [note("a", "Introdução", "h1", 0), q("b", "q-choice", 1), note("c", "Conclusão", undefined, 2)];
    const { blocks, questions } = serializeFeed(feed);
    expect(blocks.map((b) => b.kind)).toEqual(["text", "q", "text"]);
    expect(blocks[0]).toEqual({ kind: "text", md: "# Introdução" });
    expect(blocks[1]).toEqual({ kind: "q", qref: "b", qkind: "q-choice" });
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe("b");
  });
  it("nota com link solo do youtube vira bloco de vídeo", () => {
    const { blocks } = serializeFeed([note("v", "https://youtu.be/abc12345678", undefined, 0)]);
    expect(blocks).toEqual([{ kind: "video", youtubeId: "abc12345678" }]);
  });
  it("ignora notas vazias e tipos desconhecidos", () => {
    const feed: FeedItem[] = [note("e", "   ", undefined, 0), { id: "x", type: "weird", title: "", payload: {}, placement: "feed", order: 1 }];
    expect(serializeFeed(feed)).toEqual({ blocks: [], questions: [] });
  });
  it("h2 vira ## e texto puro fica como está", () => {
    const { blocks } = serializeFeed([note("a", "Sub", "h2", 0), note("b", "corpo", "text", 1)]);
    expect(blocks).toEqual([{ kind: "text", md: "## Sub" }, { kind: "text", md: "corpo" }]);
  });
});
```

- [ ] **Step 2: Rodar — falha (módulo não existe)**

Run: `npx vitest run lib/aulas/aulaBlocks.test.ts`
Expected: FAIL — "Cannot find module '@/lib/aulas/aulaBlocks'".

- [ ] **Step 3: Implementar `lib/aulas/aulaBlocks.ts`**

```ts
/**
 * Serializador PURO do feed do canvas teach → { blocks, questions } (fatia rica).
 * blocks = sequência ordenada (texto/vídeo/studio/pergunta). As perguntas (q) carregam
 * `qref` = id temporário do AuthQ; a rota /api/aulas troca por `questionId` real ao
 * criar os AulaQuestion. NÃO importa React/DOM (testável).
 */
import type { AuthQ } from "@/components/aulas/AulaQuestionsPanel";

export type FeedItem = {
  id: string; type: string; title: string; payload: any;
  placement: string; order?: number; createdAt?: string;
};

export type AulaBlock =
  | { kind: "text"; md: string }
  | { kind: "video"; youtubeId: string }
  | { kind: "studio"; studioKind: string; title?: string; data: unknown }
  | { kind: "q"; qref: string; qkind: string };

export type SerializedAula = { blocks: AulaBlock[]; questions: AuthQ[] };

/** id de um vídeo do YouTube SE o texto, sem espaços, for um único link (senão null). */
export function ytIdFromText(s: string): string | null {
  const t = (s || "").trim();
  if (!t || /\s/.test(t)) return null;
  const m = t.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const ord = (i: FeedItem) => (typeof i.order === "number" ? i.order : 0);

export function serializeFeed(feed: FeedItem[]): SerializedAula {
  const ordered = [...feed].sort(
    (a, b) => (ord(a) - ord(b)) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
  );
  const blocks: AulaBlock[] = [];
  const questions: AuthQ[] = [];
  for (const it of ordered) {
    if (it.type === "aula-question" && it.payload && typeof it.payload === "object") {
      const aq = it.payload as AuthQ;
      questions.push(aq);
      blocks.push({ kind: "q", qref: aq.id, qkind: aq.kind });
    } else if (it.type === "note") {
      const text = String(it.payload?.text || "").trim();
      if (!text) continue;
      const yt = ytIdFromText(text);
      if (yt) { blocks.push({ kind: "video", youtubeId: yt }); continue; }
      const v = it.payload?.variant;
      blocks.push({ kind: "text", md: v === "h1" ? `# ${text}` : v === "h2" ? `## ${text}` : text });
    } else if (it.type === "video" && it.payload?.videoId) {
      blocks.push({ kind: "video", youtubeId: String(it.payload.videoId) });
    } else if (it.type === "link" && it.payload?.url) {
      blocks.push({ kind: "text", md: `[${it.title || it.payload.url}](${it.payload.url})` });
    } else if (it.type === "studio" && it.payload?.studioKind) {
      blocks.push({ kind: "studio", studioKind: String(it.payload.studioKind), title: it.title || undefined, data: it.payload.data ?? null });
    }
  }
  return { blocks, questions };
}
```

- [ ] **Step 4: Rodar — passa**

Run: `npx vitest run lib/aulas/aulaBlocks.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: tsc + commit**

Run: `npx tsc --noEmit` (zero erros novos).
```bash
git add lib/aulas/aulaBlocks.ts lib/aulas/aulaBlocks.test.ts
git commit -m "feat(aula): serializador puro feed→blocks (intercalado) + testes"
```

---

### Task 3: Extrair `QuestionEditor` de `AulaQuestionsPanel`

O editor de UMA pergunta hoje é a função privada `QEditor` dentro de `AulaQuestionsPanel.tsx`. Extrair para componente próprio reutilizável (canvas block + painel usam o mesmo). Refactor sem mudança de comportamento.

**Files:**
- Create: `components/aulas/QuestionEditor.tsx`
- Modify: `components/aulas/AulaQuestionsPanel.tsx` (remover `QEditor` local; importar e usar `QuestionEditor`)

**Interfaces:**
- Produces: `export default function QuestionEditor({ q, onSet, onDel, controls }: { q: AuthQ; onSet: (p: Partial<AuthQ>) => void; onDel?: () => void; controls?: React.ReactNode })` — o miolo de edição (cabeçalho com tipo + pontos + lixeira; textarea do enunciado; campos por tipo: choice/input/voice/open/roulette). `controls` permite o pai injetar botões extras (ex.: setas de mover no painel). Sem `idx/up/down` internos.
- Consumes: `AuthQ`, `aulaBlock` de `@/lib/aulas/blockTypes`.

- [ ] **Step 1: Criar `components/aulas/QuestionEditor.tsx`**

Copiar o corpo da função `QEditor` atual (linhas ~115-210 de `AulaQuestionsPanel.tsx`) para um componente default. Trocar a assinatura: remover `idx/onUp/onDown/canUp/canDown`; manter `q/onSet/onDel`; adicionar `controls?: React.ReactNode` renderizado no cabeçalho (onde hoje ficam as setas). Manter o número do item fora (responsabilidade do pai). Topo do arquivo:
```tsx
"use client";
import { Trash2, Plus } from "lucide-react";
import { aulaBlock } from "@/lib/aulas/blockTypes";
import type { AuthQ } from "@/components/aulas/AulaQuestionsPanel";
```
> Verificar no arquivo real os campos por tipo (choice/input/voice/open/roulette) e copiá-los VERBATIM (a lógica de options/accepted/noPaste/roulette já existe e funciona — não reescrever).
> Cabeçalho: `<span>{def?.emoji} {def?.label}</span>` + input de `marks` (number 0-20) + `{controls}` + (se `onDel`) lixeira.

- [ ] **Step 2: Usar `QuestionEditor` no painel**

Em `AulaQuestionsPanel.tsx`: remover a função `QEditor`. No `.map`, trocar `<QEditor ... />` por:
```tsx
<QuestionEditor key={q.id} q={q} onSet={(p) => set(q.id, p)} onDel={() => del(q.id)}
  controls={<>
    <button onClick={() => move(q.id, -1)} disabled={i === 0} className="text-white/30 hover:text-white/70 disabled:opacity-20"><ChevronUp size={14} /></button>
    <button onClick={() => move(q.id, 1)} disabled={i === value.length - 1} className="text-white/30 hover:text-white/70 disabled:opacity-20"><ChevronDown size={14} /></button>
  </>} />
```
Adicionar `import QuestionEditor from "@/components/aulas/QuestionEditor";` e manter `export type AuthQ`/`AuthOption`/`AuthPoolQ` (QuestionEditor importa `AuthQ` daqui — sem ciclo: tipo-only). Manter `ChevronUp/ChevronDown` no import.

- [ ] **Step 3: tsc + smoke**

Run: `npx tsc --noEmit` (zero novos).
Smoke manual: abrir o painel de perguntas (modal de envio em modo teach) — gerar/criar/editar/excluir/mover perguntas continua igual.

- [ ] **Step 4: Commit**

```bash
git add components/aulas/QuestionEditor.tsx components/aulas/AulaQuestionsPanel.tsx
git commit -m "refactor(aula): extrai QuestionEditor reutilizável de AulaQuestionsPanel"
```

---

### Task 4: Bloco `aula-question` no canvas + "/" e dock (teach)

Tornar as perguntas blocos do feed: inseríveis por "/" (e dock) em modo teach, editáveis inline com `QuestionEditor`, reordenáveis como qualquer bloco.

**Files:**
- Modify: `lib/study/slashMenu.ts` (estender `SlashKind` com `"aula"`)
- Create: `lib/aulas/aulaSlash.ts` (+ test) — opções "/" de aula a partir de `AULA_BLOCKS` (puro)
- Modify: `app/api/study/items/route.ts` (whitelist `TYPES`: adicionar `"aula-question"`)
- Modify: `components/study/MeusEstudosFeed.tsx` (slash em teach; `selectSlash` kind "aula"; `renderBlock` para `aula-question`; insert por dock via evento)
- Modify: `components/studio/StudioDock.tsx` (seção teach: botões dos 4 tipos → evento `zaeon:aula:insert`)

**Interfaces:**
- Consumes: `serializeFeed`/`AuthQ` (Tasks 2/3), `READY_BLOCKS`/`aulaBlock` (`@/lib/aulas/blockTypes`), `blank(kind)` (exportar de `AulaQuestionsPanel` — ver Step).
- Produces: novo `StudyItem.type = "aula-question"` (payload = `AuthQ`); evento `window` `"zaeon:aula:insert"` `{ detail: { qkind: string } }`.

- [ ] **Step 1: Exportar `blank(kind)` e estender SlashKind**

Em `components/aulas/AulaQuestionsPanel.tsx`: trocar `function blank(` por `export function blank(` (já existe; só exportar).
Em `lib/study/slashMenu.ts`: `export type SlashKind = "struct" | "studio" | "aula";`

- [ ] **Step 2: Opções "/" de aula (puro) + teste**

Create `lib/aulas/aulaSlash.ts`:
```ts
import type { SlashOption } from "@/lib/study/slashMenu";
import { READY_BLOCKS } from "@/lib/aulas/blockTypes";

/** Opções "/" dos blocos de pergunta prontos (modo teach). `key` = kind do AULA_BLOCKS. */
export const AULA_SLASH_OPTIONS: SlashOption[] = READY_BLOCKS.map((b) => ({
  key: b.kind, label: b.label, emoji: b.emoji, kind: "aula" as const,
}));

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function filterAulaSlash(query: string): SlashOption[] {
  const q = norm((query || "").trim());
  if (!q) return AULA_SLASH_OPTIONS;
  return AULA_SLASH_OPTIONS.filter((o) => norm(o.label).includes(q) || o.key.includes(q));
}
```
Create `lib/aulas/aulaSlash.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { AULA_SLASH_OPTIONS, filterAulaSlash } from "@/lib/aulas/aulaSlash";

describe("aula slash options", () => {
  it("expõe os 4 tipos prontos com kind aula", () => {
    expect(AULA_SLASH_OPTIONS).toHaveLength(4);
    expect(AULA_SLASH_OPTIONS.every((o) => o.kind === "aula")).toBe(true);
    expect(AULA_SLASH_OPTIONS.map((o) => o.key).sort()).toEqual(["q-choice", "q-roulette", "q-voice", "q-written"]);
  });
  it("filtra sem acento/case", () => {
    expect(filterAulaSlash("voz").map((o) => o.key)).toContain("q-voice");
    expect(filterAulaSlash("ESCOLHA").map((o) => o.key)).toContain("q-choice");
    expect(filterAulaSlash("")).toHaveLength(4);
  });
});
```
Run: `npx vitest run lib/aulas/aulaSlash.test.ts` → PASS.

- [ ] **Step 3: Permitir o tipo no backend de itens**

Em `app/api/study/items/route.ts`, no `Set` `TYPES`, adicionar `"aula-question"` à whitelist.

- [ ] **Step 4: Slash em teach (dropdown) + `selectSlash`**

Em `MeusEstudosFeed.tsx`:
- Import: `import { filterAulaSlash } from "@/lib/aulas/aulaSlash"; import { blank as blankQ } from "@/components/aulas/AulaQuestionsPanel";`
- Onde o dropdown calcula as opções (a partir de `filterSlash(slashQuery)`), em teach concatenar as de aula. Localizar a linha que monta `opts` (perto do `selectSlash`/render ~1049-1095) e trocar para:
```tsx
const opts = teach ? [...filterSlash(slashQuery), ...filterAulaSlash(slashQuery)] : filterSlash(slashQuery);
```
(aplicar tanto no handler de teclado ~841 quanto no render do dropdown ~1060).
- Em `selectSlash`, antes do `else` do studio, tratar `"aula"`:
```tsx
} else if (opt.kind === "aula") {
  setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, title: "", payload: { ...x.payload, text: "" } } : x)));
  persist(it.id);
  const aq = blankQ(opt.key);
  addItem({ type: "aula-question", title: "", payload: aq, placement: "feed", order: ord(it) });
} else {
```
(insere o bloco de pergunta logo após o bloco "/" — mesma `order`, desempate por createdAt, igual ao `addBlockAfter`).

- [ ] **Step 5: Render do bloco `aula-question`**

Em `renderBlock` (logo após o ramo `if (it.type === "studio")`, ~726), adicionar:
```tsx
if (it.type === "aula-question") {
  const aq = (it.payload || {}) as AuthQ;
  return (
    <div className="w-full">
      <QuestionEditor q={aq}
        onSet={(patch) => { setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, payload: { ...x.payload, ...patch } } : x)); persist(it.id); }}
        onDel={() => removeItem(it)} />
    </div>
  );
}
```
Imports: `import QuestionEditor from "@/components/aulas/QuestionEditor"; import type { AuthQ } from "@/components/aulas/AulaQuestionsPanel";`
> Confirmar o nome real do helper de remover bloco (grep `const removeItem`/`const onRemove`/`delete` no arquivo) e usá-lo; idem `persist`.

- [ ] **Step 6: Dock (teach) — inserir por botão**

Em `MeusEstudosFeed.tsx`, adicionar um listener (perto do `onEmbed`):
```tsx
useEffect(() => {
  if (!teach) return;
  const onInsert = (e: any) => {
    const qk = e?.detail?.qkind; if (!qk) return;
    const aq = blankQ(qk);
    addItem({ type: "aula-question", title: "", payload: aq, placement: "feed", order: nextOrder() });
  };
  window.addEventListener("zaeon:aula:insert", onInsert);
  return () => window.removeEventListener("zaeon:aula:insert", onInsert);
}, [teach, addItem]);
```
Em `components/studio/StudioDock.tsx`, aceitar prop `teach?: boolean` e, quando `teach`, renderizar uma faixa com os `READY_BLOCKS`:
```tsx
{teach && READY_BLOCKS.map((b) => (
  <button key={b.kind} title={b.label}
    onClick={() => window.dispatchEvent(new CustomEvent("zaeon:aula:insert", { detail: { qkind: b.kind } }))}
    className="...mesmo estilo dos outros botões do dock...">{b.emoji}</button>
))}
```
(import `READY_BLOCKS` de `@/lib/aulas/blockTypes`). Onde o `MeusEstudosFeed` monta `<StudioDock .../>`, passar `teach={teach}`.

- [ ] **Step 7: tsc + smoke**

Run: `npx tsc --noEmit` (zero novos).
Smoke: em "Criar aula", digitar "/" → aparecem os 4 tipos de pergunta junto dos blocos de Studio; selecionar um insere um bloco de pergunta editável no meio do conteúdo; o dock (teach) tem os 4 botões; reordenar arrastando funciona.

- [ ] **Step 8: Commit**

```bash
git add lib/study/slashMenu.ts lib/aulas/aulaSlash.ts lib/aulas/aulaSlash.test.ts app/api/study/items/route.ts components/study/MeusEstudosFeed.tsx components/studio/StudioDock.tsx components/aulas/AulaQuestionsPanel.tsx
git commit -m "feat(aula): pergunta como bloco do canvas (/ + dock) em modo teach"
```

---

### Task 5: Envio serializa `blocks` + POST `/api/aulas` persiste

Trocar "body markdown + teachQuestions separado" pela sequência ordenada. O serializador (Task 2) gera `{blocks, questions}`; a rota cria os `AulaQuestion` e grava `Aula.blocks` com `questionId` real.

**Files:**
- Create: `lib/aulas/persistBlocks.ts` (+ test) — mapeia `qref`→`questionId` (puro, testável)
- Modify: `app/api/aulas/route.ts` (POST: aceitar `blocks` + `questions`; criar questions; gravar `Aula.blocks`; validar `qkind`/`type` via registro)
- Modify: `components/study/MeusEstudosFeed.tsx` (`sendToTurma`: usar `serializeFeed`; manter `body` como fallback)

**Interfaces:**
- Consumes: `serializeFeed` (Task 2), `aulaBlock`/`EVALUABLE_KINDS` (`@/lib/aulas/blockTypes`).
- Produces: `function resolveBlockRefs(blocks, idByRef): PersistedBlock[]` onde `PersistedBlock` troca `{kind:"q",qref}` por `{kind:"q",questionId,qkind}`; demais blocos inalterados.

- [ ] **Step 1: Teste do mapeamento (falha)**

Create `lib/aulas/persistBlocks.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveBlockRefs } from "@/lib/aulas/persistBlocks";

describe("resolveBlockRefs", () => {
  it("troca qref por questionId e mantém os outros blocos", () => {
    const blocks = [
      { kind: "text", md: "oi" },
      { kind: "q", qref: "tmp1", qkind: "q-choice" },
      { kind: "video", youtubeId: "abc12345678" },
    ] as any[];
    const out = resolveBlockRefs(blocks, { tmp1: "real1" });
    expect(out).toEqual([
      { kind: "text", md: "oi" },
      { kind: "q", questionId: "real1", qkind: "q-choice" },
      { kind: "video", youtubeId: "abc12345678" },
    ]);
  });
  it("descarta bloco q sem id mapeado", () => {
    const out = resolveBlockRefs([{ kind: "q", qref: "x", qkind: "q-voice" }] as any[], {});
    expect(out).toEqual([]);
  });
});
```
Run: `npx vitest run lib/aulas/persistBlocks.test.ts` → FAIL (módulo ausente).

- [ ] **Step 2: Implementar `lib/aulas/persistBlocks.ts`**

```ts
import type { AulaBlock } from "@/lib/aulas/aulaBlocks";

export type PersistedBlock =
  | { kind: "text"; md: string }
  | { kind: "video"; youtubeId: string }
  | { kind: "studio"; studioKind: string; title?: string; data: unknown }
  | { kind: "q"; questionId: string; qkind: string };

/** Troca os refs temporários (qref) das perguntas pelo questionId real; descarta q sem id. */
export function resolveBlockRefs(blocks: AulaBlock[], idByRef: Record<string, string>): PersistedBlock[] {
  const out: PersistedBlock[] = [];
  for (const b of blocks) {
    if (b.kind === "q") {
      const questionId = idByRef[b.qref];
      if (questionId) out.push({ kind: "q", questionId, qkind: b.qkind });
    } else {
      out.push(b);
    }
  }
  return out;
}
```
Run: `npx vitest run lib/aulas/persistBlocks.test.ts` → PASS.

- [ ] **Step 3: POST `/api/aulas` aceita `blocks` + cria questions + grava `Aula.blocks`**

Em `app/api/aulas/route.ts`, no POST, após criar a `aula` e ANTES do `return`, substituir o bloco atual de criação de quiz/perguntas por uma versão que (a) aceita `body.questions` (AuthQ[]) e `body.blocks` (AulaBlock[] com `qref`), (b) cria as questions guardando `qref → id`, (c) grava `aula.blocks` resolvido:
```ts
import { resolveBlockRefs } from "@/lib/aulas/persistBlocks";
import { aulaBlock } from "@/lib/aulas/blockTypes";
// ...
const rawQs = Array.isArray(body.questions) ? (body.questions as any[]) : [];
const rawBlocks = Array.isArray(body.blocks) ? (body.blocks as any[]) : [];
if (rawQs.length) {
  const quizData = { aulaId: aula.id, title: `Quiz — ${title}`.slice(0, 160), passingPct: 70 };
  const quiz = await prisma.aulaQuiz.create({ data: quizData });
  const idByRef: Record<string, string> = {};
  let order = 0;
  for (const q of rawQs) {
    if (!q || typeof q.text !== "string" || !q.text.trim()) continue;
    const def = aulaBlock(typeof q.kind === "string" ? q.kind : "");
    const baseType = def?.baseType || (typeof q.type === "string" ? q.type : "open");
    const qData = {
      quizId: quiz.id,
      text: String(q.text).slice(0, 600),
      type: ["choice", "input", "open", "voice", "roulette"].includes(baseType) ? baseType : "open",
      options: Array.isArray(q.options) ? (q.options as object) : undefined,
      accepted: Array.isArray(q.accepted) ? q.accepted.filter((x: any) => typeof x === "string").map((x: string) => String(x).slice(0, 200)) : [],
      marks: Number.isFinite(q.marks) && q.marks > 0 ? Math.min(20, Math.floor(q.marks)) : 1,
      noPaste: !!q.noPaste,
      config: q.config && typeof q.config === "object" ? (q.config as object) : undefined,
      order: order++,
    };
    const created = await prisma.aulaQuestion.create({ data: qData });
    if (typeof q.id === "string") idByRef[q.id] = created.id;
  }
  if (rawBlocks.length) {
    const persisted = resolveBlockRefs(rawBlocks, idByRef);
    const upd = { blocks: persisted as object };
    await prisma.aula.update({ where: { id: aula.id }, data: upd });
  }
}
const fresh = await prisma.aula.findUnique({ where: { id: aula.id } });
return NextResponse.json({ aula: fresh ?? aula });
```
> Manter compat: requests antigos (sem `blocks`) seguem criando questions na ordem do array, sem gravar `blocks` — comportamento atual preservado. `baseType` vem do registro (resolve os 4 kinds; jogos futuros caem em "open" até a fatia 2).

- [ ] **Step 4: `sendToTurma` usa o serializador**

Em `MeusEstudosFeed.tsx`, no `sendToTurma`, trocar o corpo do fetch:
```tsx
const { serializeFeed } = await import("@/lib/aulas/aulaBlocks");
const { blocks, questions } = serializeFeed(feed);
const body = feedToMarkdown(); // fallback p/ aulas antigas / clientes sem render de blocks
if (!blocks.length && questions.length === 0) { setSendMsg("Monte a aula (conteúdo ou perguntas) antes de enviar."); return; }
// ...
const r = await fetch("/api/aulas", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title, body, blocks, questions }) });
```
(`questions` agora vem do feed, não do estado `teachQuestions`; o painel `AulaQuestionsPanel` no modal continua existindo como atalho — suas perguntas, se houver, podem ser concatenadas: `[...questions, ...teachQuestions]`. Decisão de fatia: concatenar para não perder o painel.)
> Ajustar para `questions: [...questions, ...teachQuestions]` (perguntas no canvas primeiro, depois as do painel) — mas o `blocks` só referencia as do canvas; as do painel entram como hoje (no fim).

- [ ] **Step 5: tsc + smoke**

Run: `npx tsc --noEmit`; `npx vitest run lib/aulas/` (todos verdes).
Smoke: montar uma aula com texto + pergunta no meio → Enviar → conferir no banco/registro que a `Aula.blocks` foi gravada na ordem e os `AulaQuestion` existem.

- [ ] **Step 6: Commit**

```bash
git add lib/aulas/persistBlocks.ts lib/aulas/persistBlocks.test.ts app/api/aulas/route.ts components/study/MeusEstudosFeed.tsx
git commit -m "feat(aula): envio serializa blocks ordenados + POST grava Aula.blocks"
```

---

### Task 6: Render intercalado do aluno (+ fallback)

`StudentAulasModule` passa a iterar `aula.blocks` quando presente (conteúdo + pergunta no lugar). Sem `blocks` → caminho atual (body + perguntas no fim).

**Files:**
- Modify: `components/aulas/StudentAulasModule.tsx` (render do `detail`, ~182-224)
- Modify: `components/aulas/types.ts` (`Aula.blocks?`)

**Interfaces:**
- Consumes: `detail.aula.blocks` (`PersistedBlock[]` sanitizado — perguntas sem gabarito), `detail.questions` (`Question[]`), `QuestionView` existente.
- Produces: render em ordem; submit/grade inalterados.

- [ ] **Step 1: Tipar `Aula.blocks`**

Em `components/aulas/types.ts`, no type `Aula`, adicionar:
```ts
  blocks?: Array<
    | { kind: "text"; md: string }
    | { kind: "video"; youtubeId: string }
    | { kind: "studio"; studioKind: string; title?: string; data?: unknown }
    | { kind: "q"; questionId: string; qkind: string }
  > | null;
```

- [ ] **Step 2: Render intercalado com fallback**

Em `StudentAulasModule.tsx`, substituir o miolo do `detail` (do `<h2>` até o fim da seção de quiz) por: título (mantém) → se `detail.aula.blocks?.length`, renderizar a sequência; senão, o bloco atual (youtube + MiniMarkdown body + seção de quiz). Inserir, após o `<h2>`:
```tsx
{detail.aula.blocks && detail.aula.blocks.length > 0 ? (
  <div className="flex flex-col gap-5">
    {detail.aula.blocks.map((b, i) => {
      if (b.kind === "text") return <MiniMarkdown key={i} source={b.md} />;
      if (b.kind === "video") return (
        <div key={i} className="aspect-video rounded-xl overflow-hidden border border-white/10 max-w-2xl">
          <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${b.youtubeId}`} title="Vídeo da aula" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      );
      if (b.kind === "q") {
        const q = detail.questions.find((x) => x.id === b.questionId);
        if (!q) return null;
        const idx = detail.questions.findIndex((x) => x.id === b.questionId);
        return <QuestionView key={i} q={q} idx={idx} state={answers[q.id] || {}} onChange={(patch) => setAns(q.id, patch)} graded={result?.graded.find((g) => g.questionId === q.id)} locked={!!result} />;
      }
      return null; // studio: fora de escopo da fatia 1 no aluno
    })}
    {/* botão Enviar respostas / card de resultado: reutilizar o bloco atual (mover para cá quando houver perguntas) */}
  </div>
) : (
  /* … CAMINHO ATUAL intacto: youtube grid + MiniMarkdown body + seção de quiz … */
)}
```
> Refatorar o botão "Enviar respostas"/card de resultado para um helper local `renderSubmit()` reutilizado nos dois caminhos (evita duplicar). Render só quando `detail.questions.length > 0`.

- [ ] **Step 3: tsc + smoke**

Run: `npx tsc --noEmit`.
Smoke: como aluno, abrir uma aula NOVA (com blocks) → conteúdo e pergunta aparecem **na ordem** (pergunta no meio); responder e enviar soma a nota. Abrir uma aula ANTIGA (sem blocks) → render atual (body + perguntas no fim) intacto.

- [ ] **Step 4: Commit**

```bash
git add components/aulas/StudentAulasModule.tsx components/aulas/types.ts
git commit -m "feat(aula): aluno renderiza blocks intercalados (fallback p/ aulas antigas)"
```

---

## Self-Review (cobertura do spec)

- §4/§6 unidade 1 (QuestionEditor) → Task 3 ✓
- unidade 2 (bloco aula-question) → Task 4 ✓
- unidade 3 (registro → "/" + dock) → Task 4 (aulaSlash + dock) ✓
- unidade 4 (serializador de envio) → Tasks 2 + 5 ✓
- unidade 5 (persistência Aula.blocks) → Tasks 1 + 5 ✓
- unidade 6 (render intercalado + fallback) → Task 6 ✓
- §7 compat (aulas antigas, AulaQuestionsPanel, grade/submit) → Tasks 5/6 preservam caminho atual ✓
- §8 testes (vitest puro serializador/validação; smoke UI) → Tasks 2/4/5 ✓

**Diferido (não neste plano):** 5 jogos + drag acessível; painel "Pontuação da aula" dedicado; fusão dos registros Studio+aula; studio block no render do aluno.
