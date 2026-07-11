# Aula rica — Fatia 2a (cloze + dragwords + drag acessível) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar os 2 jogos avaliáveis (🧩 cloze, ✋ dragwords) como blocos do canvas teach ponta-a-ponta, sobre uma primitiva "fill-blanks" compartilhada e um helper de drag acessível (mouse/toque/teclado).

**Architecture:** cloze/dragwords reduzem a um modelo `{parts, answers, bank}` produzido por 2 parsers puros; correção por crédito parcial reusa `normalize`; o aluno preenche via `WordDrag` (sobre um reducer puro de colocação) com fallback de teclado. Respostas (gabarito) ficam server-side — o GET de detalhe sanitiza o `config` para o aluno.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma+MongoDB, vitest (`@/` alias), Tailwind.

## Global Constraints

- Trabalhar no worktree `/Users/donmartinez/Documents/Projects.nosync/zaeon-aula-rica` (sobre fatia 1). Entrega via Git Trees API sobre `feat/criacao-aula-rica` (proxy ISP trava git fetch/push grande).
- **Nunca `git add -A`** — só os arquivos de cada task. `npx tsc --noEmit` ao fim de cada task: **zero erros novos** (baseline 5). `node_modules/.bin/vitest run <arquivo>` para os testes.
- Aditivo: não quebrar os 4 tipos existentes, aulas antigas, `grade.ts`/submit/GET atuais. `config` é Json (sem migração).
- **Gabarito não vaza ao aluno:** o GET de detalhe sanitiza `config` de cloze/dragwords (manda `{parts, bank}`, nunca `answers`/texto marcado).
- Idioma de UI/strings: português. Marcador de lacuna: `*palavra*` (asteriscos).

---

### Task 1: `lib/aulas/fillBlanks.ts` — parsers + grading (puro, TDD)

**Files:**
- Create: `lib/aulas/fillBlanks.ts`
- Test: `lib/aulas/fillBlanks.test.ts`

**Interfaces:**
- Produces:
  - `type FillPart = { t: "text"; s: string } | { t: "blank"; i: number }`
  - `type FillModel = { parts: FillPart[]; answers: string[]; bank: string[] }`
  - `function parseCloze(text: string): FillModel`
  - `function parseDragwords(cfg: { sentence?: string; words?: string[] }): FillModel`
  - `function gradeBlanks(answers: string[], submitted: (string | null)[]): { correct: number; total: number }`
  - `function shuffleSeeded<T>(arr: T[], seed: string): T[]`
- Consumes: `normalize` de `@/lib/aulas/grade`.

- [ ] **Step 1: Testes (falhando)** — `lib/aulas/fillBlanks.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseCloze, parseDragwords, gradeBlanks, shuffleSeeded } from "@/lib/aulas/fillBlanks";

describe("parseCloze", () => {
  it("quebra texto em parts e extrai respostas dos *marcadores*", () => {
    const m = parseCloze("A capital é *Brasília* no *Brasil*.");
    expect(m.answers).toEqual(["Brasília", "Brasil"]);
    expect(m.parts).toEqual([
      { t: "text", s: "A capital é " },
      { t: "blank", i: 0 },
      { t: "text", s: " no " },
      { t: "blank", i: 1 },
      { t: "text", s: "." },
    ]);
    expect(m.bank.slice().sort()).toEqual(["Brasil", "Brasília"]);
  });
  it("sem marcadores → sem lacunas", () => {
    const m = parseCloze("texto sem lacuna");
    expect(m.answers).toEqual([]);
    expect(m.parts).toEqual([{ t: "text", s: "texto sem lacuna" }]);
  });
});

describe("parseDragwords", () => {
  it("respostas da sentence + distratores no banco", () => {
    const m = parseDragwords({ sentence: "O *gato* subiu no *telhado*.", words: ["cachorro"] });
    expect(m.answers).toEqual(["gato", "telhado"]);
    expect(m.bank.slice().sort()).toEqual(["cachorro", "gato", "telhado"]);
    expect(m.parts.filter((p) => p.t === "blank")).toHaveLength(2);
  });
});

describe("gradeBlanks", () => {
  it("crédito parcial, posição a posição, normalizado", () => {
    expect(gradeBlanks(["Brasília", "Brasil"], ["brasilia", "Brasil"])).toEqual({ correct: 2, total: 2 });
    expect(gradeBlanks(["a", "b", "c"], ["a", "x", "c"])).toEqual({ correct: 2, total: 3 });
    expect(gradeBlanks(["a"], [null])).toEqual({ correct: 0, total: 1 });
  });
});

describe("shuffleSeeded", () => {
  it("determinístico por seed e preserva os elementos", () => {
    const a = shuffleSeeded(["1", "2", "3", "4"], "q1");
    const b = shuffleSeeded(["1", "2", "3", "4"], "q1");
    expect(a).toEqual(b);
    expect(a.slice().sort()).toEqual(["1", "2", "3", "4"]);
  });
});
```

- [ ] **Step 2: Rodar — falha** — `node_modules/.bin/vitest run lib/aulas/fillBlanks.test.ts` → FAIL (módulo ausente).

- [ ] **Step 3: Implementar `lib/aulas/fillBlanks.ts`**

```ts
/**
 * Primitiva "fill-blanks" (cloze + dragwords) — PURA/testável.
 * Marcador de lacuna: *palavra* (a palavra entre asteriscos é a resposta).
 */
import { normalize } from "@/lib/aulas/grade";

export type FillPart = { t: "text"; s: string } | { t: "blank"; i: number };
export type FillModel = { parts: FillPart[]; answers: string[]; bank: string[] };

const MARK = /\*([^*]+)\*/g;

function parseMarked(text: string): { parts: FillPart[]; answers: string[] } {
  const parts: FillPart[] = [];
  const answers: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MARK.lastIndex = 0;
  while ((m = MARK.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: "text", s: text.slice(last, m.index) });
    parts.push({ t: "blank", i: answers.length });
    answers.push(m[1].trim());
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: "text", s: text.slice(last) });
  if (parts.length === 0) parts.push({ t: "text", s: "" });
  return { parts, answers };
}

export function parseCloze(text: string): FillModel {
  const { parts, answers } = parseMarked(String(text || ""));
  return { parts, answers, bank: [...answers] };
}

export function parseDragwords(cfg: { sentence?: string; words?: string[] }): FillModel {
  const { parts, answers } = parseMarked(String(cfg?.sentence || ""));
  const extra = Array.isArray(cfg?.words) ? cfg!.words!.filter((w) => typeof w === "string" && w.trim()).map((w) => w.trim()) : [];
  return { parts, answers, bank: [...answers, ...extra] };
}

export function gradeBlanks(answers: string[], submitted: (string | null)[]): { correct: number; total: number } {
  let correct = 0;
  for (let i = 0; i < answers.length; i++) {
    if (normalize(submitted[i] ?? "") && normalize(submitted[i]) === normalize(answers[i])) correct++;
  }
  return { correct, total: answers.length };
}

/** Embaralhamento determinístico (Fisher-Yates com PRNG mulberry32 semeado pela string). */
export function shuffleSeeded<T>(arr: T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
```

- [ ] **Step 4: Rodar — passa.** **Step 5: tsc + commit** (`git add lib/aulas/fillBlanks.ts lib/aulas/fillBlanks.test.ts`; `feat(aula): primitiva fill-blanks (parsers + gradeBlanks) + testes`).

---

### Task 2: `lib/aulas/dragPlacement.ts` — reducer de colocação (puro, TDD)

**Files:**
- Create: `lib/aulas/dragPlacement.ts`
- Test: `lib/aulas/dragPlacement.test.ts`

**Interfaces:**
- Produces:
  - `function placeWord(slots: (string | null)[], word: string, slotIdx: number): (string | null)[]` — coloca `word` em `slotIdx`; se já estiver em outro slot, MOVE (limpa o antigo); devolve novo array.
  - `function clearSlot(slots: (string | null)[], slotIdx: number): (string | null)[]`
  - `function bankAvailable(bank: string[], slots: (string | null)[]): string[]` — itens do banco ainda não usados (conta duplicatas por valor).

- [ ] **Step 1: Testes (falhando)** — `lib/aulas/dragPlacement.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { placeWord, clearSlot, bankAvailable } from "@/lib/aulas/dragPlacement";

describe("placeWord", () => {
  it("coloca em um slot vazio", () => {
    expect(placeWord([null, null], "gato", 1)).toEqual([null, "gato"]);
  });
  it("move quando a palavra já está em outro slot", () => {
    expect(placeWord(["gato", null], "gato", 1)).toEqual([null, "gato"]);
  });
  it("substitui o ocupante do slot de destino (volta pro banco)", () => {
    expect(placeWord(["x", null], "gato", 0)).toEqual(["gato", null]);
  });
});

describe("clearSlot", () => {
  it("esvazia o slot", () => { expect(clearSlot(["a", "b"], 0)).toEqual([null, "b"]); });
});

describe("bankAvailable", () => {
  it("remove os usados, respeitando duplicatas", () => {
    expect(bankAvailable(["a", "a", "b"], ["a", null])).toEqual(["a", "b"]);
    expect(bankAvailable(["a", "b"], ["a", "b"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar — falha.**

- [ ] **Step 3: Implementar `lib/aulas/dragPlacement.ts`**

```ts
/** Estado de colocação de palavras em lacunas (puro/testável). slots[i] = palavra ou null. */
export function placeWord(slots: (string | null)[], word: string, slotIdx: number): (string | null)[] {
  const next = slots.map((s) => (s === word ? null : s)); // move: tira de onde estava
  next[slotIdx] = word;
  return next;
}

export function clearSlot(slots: (string | null)[], slotIdx: number): (string | null)[] {
  const next = [...slots];
  next[slotIdx] = null;
  return next;
}

/** Itens do banco ainda disponíveis (descontando os já colocados, por valor/duplicata). */
export function bankAvailable(bank: string[], slots: (string | null)[]): string[] {
  const used: Record<string, number> = {};
  for (const s of slots) if (s) used[s] = (used[s] || 0) + 1;
  const out: string[] = [];
  for (const w of bank) {
    if (used[w] > 0) used[w]--;
    else out.push(w);
  }
  return out;
}
```

- [ ] **Step 4: Rodar — passa.** **Step 5: tsc + commit** (`feat(aula): reducer puro de colocação (drag) + testes`).

---

### Task 3: `grade.ts` — ramos cloze/dragwords + `blanks?` (TDD)

**Files:**
- Modify: `lib/aulas/grade.ts`
- Test: `lib/aulas/grade.cloze.test.ts`

**Interfaces:**
- Consumes: `parseCloze`, `parseDragwords`, `gradeBlanks` (Task 1).
- Produces: `SubmittedAnswer.blanks?: string[]`; `GradeQuestion.config` aceita `{ text?: string; sentence?: string; words?: string[] }`; `gradeSubmission` pontua cloze/dragwords (parcial).

- [ ] **Step 1: Teste (falhando)** — `lib/aulas/grade.cloze.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { gradeSubmission, type GradeQuestion } from "@/lib/aulas/grade";

describe("gradeSubmission cloze/dragwords", () => {
  it("cloze: crédito parcial pelos blanks", () => {
    const q: GradeQuestion = { id: "c1", type: "cloze", marks: 4, config: { text: "*um* e *dois*" } };
    const r = gradeSubmission([q], [{ questionId: "c1", blanks: ["um", "errado"] }], 70);
    expect(r.graded[0]).toMatchObject({ marks: 2, marksOutOf: 4, isCorrect: false });
  });
  it("dragwords: tudo certo → nota cheia + isCorrect", () => {
    const q: GradeQuestion = { id: "d1", type: "dragwords", marks: 2, config: { sentence: "*a* *b*", words: ["c"] } };
    const r = gradeSubmission([q], [{ questionId: "d1", blanks: ["a", "b"] }], 70);
    expect(r.graded[0]).toMatchObject({ marks: 2, marksOutOf: 2, isCorrect: true });
  });
  it("sem lacunas → manual (marksOutOf 0)", () => {
    const q: GradeQuestion = { id: "c2", type: "cloze", marks: 3, config: { text: "sem lacuna" } };
    const r = gradeSubmission([q], [{ questionId: "c2", blanks: [] }], 70);
    expect(r.graded[0].marksOutOf).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar — falha** (cloze cai no `else`, marksOutOf 0 → asserts de marks falham).

- [ ] **Step 3: Implementar**

No topo de `lib/aulas/grade.ts`, importar os parsers:
```ts
import { parseCloze, parseDragwords, gradeBlanks } from "@/lib/aulas/fillBlanks";
```
No type `SubmittedAnswer`, adicionar campo:
```ts
  blanks?: string[]; // cloze/dragwords: 1 palavra por lacuna, na ordem
```
No type `GradeQuestion`, alargar `config`:
```ts
  config?: { pool?: PoolQuestion[]; rounds?: number; text?: string; sentence?: string; words?: string[] } | null;
```
Em `gradeSubmission`, ANTES do `else` final, adicionar o ramo:
```ts
    } else if (q.type === "cloze" || q.type === "dragwords") {
      const model = q.type === "cloze" ? parseCloze(q.config?.text || "") : parseDragwords(q.config || {});
      const total = model.answers.length;
      if (total > 0) {
        marksOutOf = marks;
        const { correct } = gradeBlanks(model.answers, Array.isArray(a?.blanks) ? a!.blanks! : []);
        isCorrect = correct === total;
        earnedThis = Math.round((marks * correct) / total);
      }
```
(o `else` final continua tratando open/voice-sem-gabarito/desconhecido como manual.)

- [ ] **Step 4: Rodar — passa** (`node_modules/.bin/vitest run lib/aulas/grade.cloze.test.ts` e `lib/aulas/grade.test.ts`). **Step 5: tsc + commit** (`feat(aula): correção parcial de cloze/dragwords (blanks)`).

---

### Task 4: `buildQuestionBlock` — cloze + dragwords (TDD)

**Files:**
- Modify: `lib/aulas/generateParse.ts` (função `buildQuestionBlock`; o `ParsedBlock` type)
- Test: `lib/aulas/generateParse.fill.test.ts`

**Interfaces:**
- Produces: `buildQuestionBlock(raw, "q-cloze")` → `{ type:"cloze", text, marks, config:{ text } }`; `buildQuestionBlock(raw, "q-dragwords")` → `{ type:"dragwords", text, marks, config:{ sentence, words } }`; null se degenerado (sem `*marcador*`).

- [ ] **Step 1: Teste (falhando)** — `lib/aulas/generateParse.fill.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildQuestionBlock } from "@/lib/aulas/generateParse";

describe("buildQuestionBlock fill", () => {
  it("cloze: usa o texto marcado", () => {
    const b = buildQuestionBlock(JSON.stringify({ text: "A *fotossíntese* ocorre.", marks: 3 }), "q-cloze");
    expect(b).toMatchObject({ type: "cloze", config: { text: "A *fotossíntese* ocorre." }, marks: 3 });
  });
  it("cloze sem marcador → null", () => {
    expect(buildQuestionBlock(JSON.stringify({ text: "sem lacuna" }), "q-cloze")).toBeNull();
  });
  it("dragwords: sentence + words", () => {
    const b = buildQuestionBlock(JSON.stringify({ sentence: "O *gato*.", words: ["cão"] }), "q-dragwords");
    expect(b).toMatchObject({ type: "dragwords", config: { sentence: "O *gato*.", words: ["cão"] } });
  });
});
```

- [ ] **Step 2: Rodar — falha** (retorna null hoje).

- [ ] **Step 3: Implementar** — em `buildQuestionBlock`, ANTES do `return null` final, adicionar:

```ts
  if (kind === "q-cloze") {
    const t = typeof parsed.text === "string" ? parsed.text.trim() : "";
    if (!t || !/\*[^*]+\*/.test(t)) return null;
    return { type: "cloze", text: (parsed.title || "Complete as lacunas").toString().slice(0, 200), marks, accepted: [], config: { text: t.slice(0, 2000) } };
  }
  if (kind === "q-dragwords") {
    const sentence = typeof parsed.config?.sentence === "string" ? parsed.config.sentence.trim()
      : (typeof parsed.sentence === "string" ? parsed.sentence.trim() : "");
    if (!sentence || !/\*[^*]+\*/.test(sentence)) return null;
    const wordsRaw = parsed.config?.words ?? parsed.words;
    const words = Array.isArray(wordsRaw) ? wordsRaw.filter((x: any) => typeof x === "string" && x.trim()).map((x: string) => x.trim().slice(0, 60)) : [];
    return { type: "dragwords", text: (parsed.title || "Arraste as palavras").toString().slice(0, 200), marks, accepted: [], config: { sentence: sentence.slice(0, 2000), words } };
  }
```
> Conferir o type `ParsedBlock` em `generateParse.ts` — se `type`/`config` forem unions estritas, alargar p/ incluir `"cloze"|"dragwords"` e `config: { ...; text?: string; sentence?: string; words?: string[] }`. Repetir os campos `text/marks/accepted` conforme a forma já usada pelos 4 prontos.

- [ ] **Step 4: Rodar — passa.** **Step 5: tsc + commit** (`feat(aula): geração por IA de cloze/dragwords`).

---

### Task 5: Server plumbing — persistir tipos, sanitizar GET, submit `blanks`, factory + tipos

**Files:**
- Modify: `app/api/aulas/route.ts` (QT aceita cloze/dragwords)
- Modify: `app/api/aulas/[id]/route.ts` (`stripConfig` sanitiza cloze/dragwords)
- Modify: `app/api/aulas/[id]/submit/route.ts` (repassa `blanks`)
- Modify: `components/aulas/AulaQuestionsPanel.tsx` (`blank()` p/ q-cloze/q-dragwords; alargar `AuthQ.config`)
- Modify: `components/aulas/types.ts` (`Question.type`/`config` incluem cloze/dragwords)

**Interfaces:**
- Consumes: `parseCloze`, `parseDragwords`, `shuffleSeeded` (Task 1).
- Produces: persistência e sanitização dos novos tipos; `AuthQ.config` aceita `{ text?; sentence?; words? }`; estudante recebe `config:{ parts, bank }` (sem gabarito).

- [ ] **Step 1: POST aceita os tipos** — em `app/api/aulas/route.ts`, trocar o set `QT`:
```ts
    const QT = new Set(["choice", "input", "open", "voice", "roulette", "cloze", "dragwords"]);
```
(o `baseType` do registro já mapeia q-cloze→`cloze`, q-dragwords→`dragwords`.)

- [ ] **Step 2: `blank()` p/ os novos tipos** — em `components/aulas/AulaQuestionsPanel.tsx`, dentro de `blank(kind)`, antes do `return base`:
```ts
  if (kind === "q-cloze") { base.type = "cloze"; base.config = { text: "" } as any; }
  if (kind === "q-dragwords") { base.type = "dragwords"; base.config = { sentence: "", words: [] } as any; }
```
E alargar o type `AuthQ.config`:
```ts
  config?: { pool?: AuthPoolQ[]; rounds?: number; text?: string; sentence?: string; words?: string[] };
```

- [ ] **Step 3: Sanitizar GET** — em `app/api/aulas/[id]/route.ts`, importar parsers/shuffle e estender `stripConfig`:
```ts
import { parseCloze, parseDragwords, shuffleSeeded } from "@/lib/aulas/fillBlanks";
```
No `stripConfig(config)`, ANTES do `return` da roleta, tratar fill (detecção por campo), devolvendo SÓ `{ parts, bank }` (sem `answers`, sem texto marcado):
```ts
  if (typeof config.text === "string" || typeof config.sentence === "string") {
    const m = typeof config.text === "string" ? parseCloze(config.text) : parseDragwords(config);
    return { parts: m.parts, bank: shuffleSeeded(m.bank, String(config.text || config.sentence || "")), allowType: typeof config.text === "string" };
  }
```
> `allowType:true` só p/ cloze. O aluno NUNCA recebe `answers` nem o texto com `*marcadores*`.

- [ ] **Step 4: submit repassa `blanks`** — em `app/api/aulas/[id]/submit/route.ts`, no `.map` que monta `answers`, adicionar (ao lado do `picks`):
```ts
        ...(Array.isArray(a?.blanks) ? { blanks: a.blanks } : {}),
```

- [ ] **Step 5: tipos do aluno** — em `components/aulas/types.ts`, no type `Question`:
```ts
  type: "choice" | "input" | "open" | "voice" | "roulette" | "cloze" | "dragwords";
```
e alargar `config`:
```ts
  config?: {
    pool?: RoulettePoolQ[]; rounds?: number;
    parts?: Array<{ t: "text"; s: string } | { t: "blank"; i: number }>;
    bank?: string[]; allowType?: boolean;
  } | null;
```

- [ ] **Step 6: tsc + commit** (`git add` os 5 arquivos; `feat(aula): persistência/sanitização/submit de cloze e dragwords`). Verificar `npx tsc --noEmit` = 5.

---

### Task 6: `components/aulas/WordDrag.tsx` — drag acessível

**Files:**
- Create: `components/aulas/WordDrag.tsx`

**Interfaces:**
- Consumes: `placeWord`, `clearSlot`, `bankAvailable` (Task 2).
- Produces: `export default function WordDrag({ slots, bank, value, onChange, allowType, locked, correct }: { slots: number; bank: string[]; value: (string|null)[]; onChange: (v: (string|null)[]) => void; allowType?: boolean; locked?: boolean; correct?: boolean[] })`.

- [ ] **Step 1: Implementar `components/aulas/WordDrag.tsx`**

```tsx
"use client";
import { useState } from "react";
import { placeWord, clearSlot, bankAvailable } from "@/lib/aulas/dragPlacement";

export default function WordDrag({ slots, bank, value, onChange, allowType, locked, correct }: {
  slots: number; bank: string[]; value: (string | null)[]; onChange: (v: (string | null)[]) => void;
  allowType?: boolean; locked?: boolean; correct?: boolean[];
}) {
  const v: (string | null)[] = Array.from({ length: slots }, (_, i) => value[i] ?? null);
  const [picked, setPicked] = useState<string | null>(null); // palavra "pega" via teclado/clique
  const avail = bankAvailable(bank, v);
  const drop = (slotIdx: number, word: string) => { if (!locked && word) onChange(placeWord(v, word, slotIdx)); setPicked(null); };
  const slotCls = (i: number) =>
    locked && correct ? (correct[i] ? "border-emerald-400/60 bg-emerald-500/10" : "border-rose-400/60 bg-rose-500/10")
      : "border-cyan-400/30 bg-white/5";
  return (
    <div className="flex flex-col gap-3">
      {/* lacunas (slots) */}
      <div className="flex flex-wrap items-center gap-2">
        {v.map((w, i) => (
          <button key={i} type="button" disabled={locked}
            aria-label={`Lacuna ${i + 1}${w ? `: ${w}` : " vazia"}`}
            onClick={() => { if (locked) return; if (picked) drop(i, picked); else if (w) onChange(clearSlot(v, i)); }}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); drop(i, e.dataTransfer.getData("text/plain")); }}
            className={`min-w-[72px] min-h-[34px] rounded-lg border px-2 text-[13px] text-white ${slotCls(i)}`}>
            {w || (allowType ? "" : "—")}
          </button>
        ))}
      </div>
      {/* opção de digitar (cloze) */}
      {allowType && !locked && (
        <div className="flex flex-wrap gap-2">
          {v.map((w, i) => (
            <input key={i} value={w || ""} onChange={(e) => onChange(placeWord(v, e.target.value, i))}
              placeholder={`lacuna ${i + 1}`} className="w-28 rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[12px] text-white" />
          ))}
        </div>
      )}
      {/* banco de palavras */}
      {!locked && (
        <div className="flex flex-wrap gap-2">
          {avail.map((w, k) => (
            <button key={`${w}-${k}`} type="button" draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", w)}
              onClick={() => setPicked(picked === w ? null : w)}
              aria-grabbed={picked === w}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold border ${picked === w ? "border-cyan-400 bg-cyan-500/20 text-white" : "border-white/15 bg-white/[0.06] text-white/85 hover:border-cyan-400/40"}`}>
              {w}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```
> Teclado: Tab foca os chips e as lacunas (são `<button>`); Enter/Espaço num chip "pega" (`picked`), Enter numa lacuna "solta". Toque: clicar o chip (pega) e a lacuna (solta) funciona sem DnD; o `draggable` cobre mouse. `correct[]` pinta verde/vermelho quando `locked`.

- [ ] **Step 2: tsc + commit** (`feat(aula): WordDrag acessível (mouse/toque/teclado)`). Smoke depois nas Tasks 7-8.

---

### Task 7: `QuestionEditor` — editores cloze e dragwords

**Files:**
- Modify: `components/aulas/QuestionEditor.tsx`

**Interfaces:**
- Consumes: `AuthQ.config` com `text`/`sentence`/`words`.

- [ ] **Step 1: Editores** — em `components/aulas/QuestionEditor.tsx`, após o bloco `q.type === "roulette"`, adicionar:

```tsx
      {q.type === "cloze" && (
        <div className="flex flex-col gap-1.5">
          <textarea value={q.config?.text || ""} onChange={(e) => onSet({ config: { ...(q.config || {}), text: e.target.value } })} rows={3}
            placeholder="Texto com lacunas: marque a resposta entre *asteriscos*. Ex.: A capital é *Brasília*."
            className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50 resize-none" />
          <p className="text-[11px] text-white/40">Lacunas detectadas: {((q.config?.text || "").match(/\*[^*]+\*/g) || []).length} — o aluno digita ou arrasta.</p>
        </div>
      )}
      {q.type === "dragwords" && (
        <div className="flex flex-col gap-1.5">
          <textarea value={q.config?.sentence || ""} onChange={(e) => onSet({ config: { ...(q.config || {}), sentence: e.target.value } })} rows={2}
            placeholder="Frase com lacunas marcadas: O *gato* subiu no *telhado*."
            className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50 resize-none" />
          <input value={(q.config?.words || []).join(", ")} onChange={(e) => onSet({ config: { ...(q.config || {}), words: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })}
            placeholder="Palavras distratoras (vírgula) — entram no banco junto das respostas"
            className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[12.5px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50" />
        </div>
      )}
```
> O enunciado (`q.text`, textarea já existente no topo do editor) serve de instrução curta; o conteúdo da lacuna vai no `config`.

- [ ] **Step 2: tsc + smoke + commit** (`feat(aula): editor de cloze e dragwords no canvas`). Smoke: inserir cloze/dragwords pelo "/", digitar texto com `*marcador*`, ver a contagem de lacunas.

---

### Task 8: `QuestionView` (aluno) — `FillBlanksView`

**Files:**
- Modify: `components/aulas/StudentAulasModule.tsx`

**Interfaces:**
- Consumes: `WordDrag` (Task 6); `q.config.parts`/`bank`/`allowType` (sanitizado pelo GET); `state.blanks`; `AnswerState.blanks?`.

- [ ] **Step 1: `AnswerState` ganha `blanks`** — em `StudentAulasModule.tsx` (type `AnswerState`, ~linha 19):
```ts
type AnswerState = { answer?: string; choiceIndex?: number; transcript?: string; audioUrl?: string; picks?: { index: number; choiceIndex?: number; answer?: string }[]; blanks?: (string | null)[] };
```

- [ ] **Step 2: import + render** — importar `WordDrag` no topo e, em `QuestionView`, após o ramo `roulette`, adicionar:
```tsx
      {(q.type === "cloze" || q.type === "dragwords") && (
        <FillBlanksView q={q} state={state} onChange={onChange} locked={locked} graded={graded} />
      )}
```
E criar o componente (perto de `RouletteView`):
```tsx
function FillBlanksView({ q, state, onChange, locked, graded }: { q: Question; state: AnswerState; onChange: (p: AnswerState) => void; locked: boolean; graded?: { isCorrect: boolean; marksOutOf: number } }) {
  const parts = q.config?.parts || [];
  const bank = q.config?.bank || [];
  const nBlanks = parts.filter((p) => p.t === "blank").length;
  const value = state.blanks || Array.from({ length: nBlanks }, () => null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-white/85 leading-relaxed">
        {parts.map((p, i) => p.t === "text"
          ? <span key={i}>{p.s}</span>
          : <span key={i} className="inline-block mx-1 px-2 min-w-[56px] border-b-2 border-cyan-400/50 text-cyan-200 text-center">{value[(p as any).i] || "____"}</span>)}
      </p>
      <WordDrag slots={nBlanks} bank={bank} value={value} allowType={q.config?.allowType}
        locked={locked} onChange={(v) => onChange({ blanks: v })} />
      {locked && graded && <p className="text-[11.5px] text-white/50">{graded.marksOutOf > 0 ? (graded.isCorrect ? "Tudo certo ✓" : "Parcial/incorreto") : "Avaliação manual"}</p>}
    </div>
  );
}
```
> O texto acima do `WordDrag` mostra a frase com as lacunas preenchidas (ou `____`). O `WordDrag` faz o preenchimento (arrastar/tocar/teclar/digitar).

- [ ] **Step 3: tsc + commit** (`feat(aula): aluno responde cloze/dragwords (FillBlanksView + WordDrag)`).

---

### Task 9: Ligar os tipos (`ready:true`) + smoke final

**Files:**
- Modify: `lib/aulas/blockTypes.ts`

- [ ] **Step 1: `ready:true`** — em `lib/aulas/blockTypes.ts`, nas entradas `q-cloze` e `q-dragwords`, trocar `ready: false` por `ready: true`. (Isso os faz aparecer no "/", dock e no painel.)

- [ ] **Step 2: Verificação final**
- `npx tsc --noEmit` → 5 (zero novos).
- `node_modules/.bin/vitest run` → tudo verde (inclui os novos de Task 1-4).
- **Smoke manual:** criar aula → "/" e dock mostram 🧩 Lacunas e ✋ Arrastar palavras; inserir, editar, gerar por IA; como aluno: **arrastar** (mouse), **tocar** (toque), **teclado** (foca chip+Enter, foca lacuna+Enter) e (cloze) **digitar**; enviar; nota soma parcial; lacunas verde/vermelho; o aluno **não** vê as respostas no HTML (config sanitizado).

- [ ] **Step 3: Commit** (`feat(aula): habilita cloze e dragwords (ready) — fatia 2a completa`).

---

## Self-Review (cobertura do spec)

- §4 primitiva fill-blanks (parseCloze/parseDragwords) → Task 1 ✓
- §5 grading parcial + `blanks` + config alargado → Tasks 1 (gradeBlanks) + 3 ✓
- §6 drag acessível (reducer + WordDrag, mouse/toque/teclado) → Tasks 2 + 6 ✓
- §7 unidades 1-9 → Tasks 1-9 ✓
- §8 compat (aditivo, aula-question carrega config) → Tasks 5 preserva caminhos ✓
- **gabarito não vaza** (sanitização GET) → Task 5 Step 3 ✓ (requisito de segurança do spec §4/§ Global)
- §9 testes (parsers, grading, reducer, buildQuestionBlock) → Tasks 1-4 vitest ✓

**Diferido:** flashcards + memória (2b, memória reusa WordDrag); cenário ramificado (2c).
