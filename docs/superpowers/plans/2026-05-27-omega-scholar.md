# Omega Scholar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Sala de Estudos title + Lounge header with a horizontal Omega Scholar prompt window whose AI agent searches real academic sources, streams Claude-Code-style progress, and lands **verified** output (every claim backed by a server-checked verbatim quote + downloadable PDF opened at the cited page) in a redesigned Comunidade tab.

**Architecture:** One streaming orchestrator route (`POST /api/ai/scholar`) runs the OMEGA pipeline server-side (plan → parallel retrieval → synthesis → deterministic verification → persist) and emits NDJSON progress events. Pure server logic lives in `lib/scholar/*` and is unit-tested with Vitest. The frontend uses a React context to feed the prompt bar's query into a redesigned Comunidade workspace.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vertex AI Gemini (`gemini-2.0-flash-001`), Prisma + MongoDB, `pdfjs-dist`, `@react-pdf-viewer/core`, framer-motion, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-27-omega-scholar-research-lab-design.md`

---

## Conventions for the executing agent

- Run commands from repo root `/Users/donmartinez/Documents/Projects/zaeon-os`.
- Reuse the existing Gemini pattern from `app/api/ai/agent-search/route.ts` (VertexAI, `GOOGLE_CREDENTIALS`).
- Match existing visual style: violet/purple gradients, `rounded-[2rem]`, dark-mode classes (`dark:bg-slate-950/40`), `lucide-react` icons.
- New env vars (add to `.env.local`): `UNPAYWALL_EMAIL` (any contact email), `CORE_API_KEY` (optional — CORE skipped if absent).
- Commit after every task. Branch is already `feat/research-news-profile-migration`.
- UI tasks: implement functional structure here; polish with the `frontend-design` skill during execution.

---

## Phase 0 — Tooling & data layer

### Task 0.1: Add Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm i -D vitest@^2
```
Expected: vitest added to devDependencies.

- [ ] **Step 2: Add test scripts to `package.json`**

In the `"scripts"` block add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `npm test`
Expected: exits 0 with "No test files found" (acceptable) OR passes. If it errors on config, fix before continuing.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for scholar logic tests"
```

---

### Task 0.2: Prisma singleton

**Files:**
- Create: `lib/prisma.ts`

- [ ] **Step 1: Create the singleton**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add lib/prisma.ts
git commit -m "feat: add shared prisma client singleton"
```

---

### Task 0.3: `ScholarSession` Prisma model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Append the model** (after the last model in the file)

```prisma
model ScholarSession {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  userId     String   @db.ObjectId
  room       String?
  query      String
  domain     String?
  status     String   @default("running") // running | done | error
  thread     Json?    // progress phases + synthesized answer
  references Json?    // Paper[]  (see lib/scholar/types.ts)
  evidence   Json?    // EvidenceRecord[]  (only verified shown as fact)
  insights   Json?    // { summary, trends[], contradictions[] }
  gaps       Json?    // { description, rqCards[] }
  files      Json?    // [{ name, kind, content }]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([userId])
}
```

- [ ] **Step 2: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client". (MongoDB needs no migration.)

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add ScholarSession model"
```

---

## Phase 1 — Pure server logic (TDD)

### Task 1.1: Shared types

**Files:**
- Create: `lib/scholar/types.ts`

- [ ] **Step 1: Define the types**

```ts
// Normalized paper from any source
export interface Paragraph {
  idx: number;
  page?: number;     // present for PDF-extracted text
  section?: string;  // present for structured full-text
  text: string;
}

export interface RetrievedText {
  kind: "pdf" | "fulltext" | "abstract";
  paragraphs: Paragraph[];
}

export interface Paper {
  id: string;            // stable internal id (doi or arxiv or source:externalId)
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  doi?: string;
  arxivId?: string;
  url?: string;
  pdfUrl?: string;
  abstract?: string;
  citationCount?: number;
  openAccess: boolean;
  sources: string[];     // which APIs returned it
  retrievedText?: RetrievedText;
}

export type Locator =
  | { kind: "pdf"; page: number; paragraph?: number }
  | { kind: "fulltext"; section?: string; paragraph: number }
  | { kind: "abstract"; sentence?: number };

export interface EvidenceRecord {
  paperId: string;
  claim: string;
  quote: string;
  locator?: Locator;
  confidence: "high" | "medium" | "low";
  verified: boolean;
  fullTextAvailable: boolean;
}

export interface ScholarPayload {
  query: string;
  domain?: string;
  answer: string;
  references: Paper[];
  evidence: EvidenceRecord[];
  insights: { summary: string; trends: string[]; contradictions: string[] };
  gaps: { description: string; rqCards: string[] };
  files: { name: string; kind: string; content: string }[];
}

// Shape the LLM returns (before deterministic verification). Lives here so both
// synthesize.ts and assemble.ts can import it without an ordering dependency.
export interface RawSynthesis {
  answer: string;
  evidence: { paperId: string; claim: string; quote: string; confidence: "high" | "medium" | "low" }[];
  insights: { summary: string; trends: string[]; contradictions: string[] };
  gaps: { description: string; rqCards: string[] };
}

// NDJSON stream events (server → client)
export type ScholarEvent =
  | { type: "session"; sessionId: string }
  | { type: "phase"; phase: "planning"; message: string }
  | { type: "phase"; phase: "searching"; source: string; count: number; message?: string }
  | { type: "phase"; phase: "dedup"; unique: number; fulltext: number; message?: string }
  | { type: "phase"; phase: "synthesizing"; message?: string }
  | { type: "phase"; phase: "verifying"; checked: number; verified: number; dropped: number; message?: string }
  | { type: "answer"; text: string }
  | { type: "done"; session: any }
  | { type: "error"; message: string };
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/scholar/types.ts
git commit -m "feat: scholar shared types"
```

---

### Task 1.2: Text normalization

**Files:**
- Create: `lib/scholar/normalize.ts`
- Test: `lib/scholar/normalize.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { normalizeText, tokenize, titleOverlap } from "./normalize";

describe("normalizeText", () => {
  it("lowercases, collapses whitespace, trims", () => {
    expect(normalizeText("  Hello   WORLD \n")).toBe("hello world");
  });
  it("de-hyphenates line-break splits", () => {
    expect(normalizeText("trans-\nformer")).toBe("transformer");
  });
  it("normalizes smart quotes", () => {
    expect(normalizeText("“attention”")).toBe('"attention"');
  });
});

describe("titleOverlap", () => {
  it("returns 1 for identical titles ignoring case/punctuation", () => {
    expect(titleOverlap("Attention Is All You Need", "attention is all you need!")).toBe(1);
  });
  it("returns 0 for disjoint titles", () => {
    expect(titleOverlap("graph neural networks", "ocean tides")).toBe(0);
  });
  it("is high for near-duplicate titles", () => {
    expect(titleOverlap("Attention Is All You Need", "Attention is All You Need (v2)")).toBeGreaterThan(0.85);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run lib/scholar/normalize.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export function normalizeText(s: string): string {
  return s
    .replace(/-\s*\n\s*/g, "")           // de-hyphenate across line breaks
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function tokenize(s: string): string[] {
  return normalizeText(s)
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// overlap coefficient over token sets (robust to length differences)
export function titleOverlap(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run lib/scholar/normalize.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/normalize.ts lib/scholar/normalize.test.ts
git commit -m "feat: scholar text normalization + tests"
```

---

### Task 1.3: Citation verification (the vital core)

**Files:**
- Create: `lib/scholar/verify.ts`
- Test: `lib/scholar/verify.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { verifyQuote, fuzzyContains, verifyEvidence } from "./verify";
import type { RetrievedText } from "./types";

const pdfRt: RetrievedText = {
  kind: "pdf",
  paragraphs: [
    { idx: 0, page: 1, text: "We propose a new simple network architecture, the Transformer." },
    { idx: 1, page: 4, text: "Multi-head attention allows the model to jointly attend to information from different representation subspaces." },
  ],
};
const absRt: RetrievedText = {
  kind: "abstract",
  paragraphs: [{ idx: 0, text: "The dominant sequence transduction models are based on complex recurrent networks." }],
};

describe("verifyQuote", () => {
  it("verifies an exact quote and returns page locator", () => {
    const r = verifyQuote("the Transformer", pdfRt);
    expect(r.verified).toBe(true);
    expect(r.locator).toEqual({ kind: "pdf", page: 1, paragraph: 0 });
  });

  it("verifies despite case/whitespace differences", () => {
    const r = verifyQuote("MULTI-HEAD   attention allows the model", pdfRt);
    expect(r.verified).toBe(true);
    expect((r.locator as any).page).toBe(4);
  });

  it("returns abstract locator for abstract text", () => {
    const r = verifyQuote("complex recurrent networks", absRt);
    expect(r.verified).toBe(true);
    expect(r.locator).toEqual({ kind: "abstract" });
  });

  it("REJECTS a quote that is not in the paper (anti-hallucination)", () => {
    const r = verifyQuote("achieved 99.9% accuracy on every benchmark", pdfRt);
    expect(r.verified).toBe(false);
    expect(r.locator).toBeUndefined();
  });

  it("rejects too-short quotes", () => {
    expect(verifyQuote("the", pdfRt).verified).toBe(false);
  });
});

describe("fuzzyContains", () => {
  it("matches with a small omission", () => {
    expect(fuzzyContains(
      "multi-head attention allows the model to jointly attend to information",
      "multi-head attention allows the model to attend to information", 0.85
    )).toBe(true);
  });
  it("rejects unrelated text", () => {
    expect(fuzzyContains("the cat sat on the mat", "quantum chromodynamics lattice", 0.85)).toBe(false);
  });
});

describe("verifyEvidence (batch anti-hallucination)", () => {
  const textById = new Map<string, RetrievedText>([["p1", pdfRt]]);

  it("keeps records whose quote exists, drops the rest", () => {
    const out = verifyEvidence(
      [
        { paperId: "p1", quote: "the Transformer" },              // exists
        { paperId: "p1", quote: "achieved 99.9% accuracy" },      // fabricated
        { paperId: "ghost", quote: "the Transformer" },           // paper not retrieved
      ],
      textById
    );
    expect(out[0].verified).toBe(true);
    expect(out[1].verified).toBe(false);
    expect(out[2].verified).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run lib/scholar/verify.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { normalizeText, tokenize } from "./normalize";
import type { Locator, Paragraph, RetrievedText } from "./types";

const MIN_QUOTE_CHARS = 12;

export interface VerifyResult {
  verified: boolean;
  locator?: Locator;
}

function buildLocator(kind: RetrievedText["kind"], p: Paragraph): Locator {
  if (kind === "pdf") return { kind: "pdf", page: p.page ?? 0, paragraph: p.idx };
  if (kind === "fulltext") return { kind: "fulltext", section: p.section, paragraph: p.idx };
  return { kind: "abstract" };
}

// word-shingle overlap over a sliding window; deterministic, no deps
export function fuzzyContains(haystack: string, needle: string, threshold = 0.92): boolean {
  const H = tokenize(haystack);
  const N = tokenize(needle);
  if (N.length === 0) return false;
  if (N.length > H.length) return false;
  const needleSet = new Set(N);
  let best = 0;
  for (let i = 0; i + N.length <= H.length; i++) {
    let hit = 0;
    for (let j = 0; j < N.length; j++) if (needleSet.has(H[i + j])) hit++;
    best = Math.max(best, hit / N.length);
    if (best >= threshold) return true;
  }
  return false;
}

export function verifyQuote(quote: string, rt: RetrievedText): VerifyResult {
  const nq = normalizeText(quote);
  if (nq.length < MIN_QUOTE_CHARS) return { verified: false };
  for (const p of rt.paragraphs) {
    const np = normalizeText(p.text);
    if (np.includes(nq) || fuzzyContains(np, nq, 0.92)) {
      return { verified: true, locator: buildLocator(rt.kind, p) };
    }
  }
  return { verified: false };
}

// Apply verification to a batch of records against their papers.
export function verifyEvidence<T extends { paperId: string; quote: string }>(
  records: T[],
  paperTextById: Map<string, RetrievedText>
): (T & VerifyResult)[] {
  return records.map((rec) => {
    const rt = paperTextById.get(rec.paperId);
    if (!rt) return { ...rec, verified: false };
    return { ...rec, ...verifyQuote(rec.quote, rt) };
  });
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run lib/scholar/verify.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/verify.ts lib/scholar/verify.test.ts
git commit -m "feat: deterministic citation verification + tests"
```

---

### Task 1.4: Deduplication

**Files:**
- Create: `lib/scholar/dedup.ts`
- Test: `lib/scholar/dedup.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { dedupePapers } from "./dedup";
import type { Paper } from "./types";

const mk = (over: Partial<Paper>): Paper => ({
  id: "x", title: "t", authors: [], openAccess: false, sources: ["a"], ...over,
});

describe("dedupePapers", () => {
  it("merges by DOI case-insensitively and unions sources", () => {
    const out = dedupePapers([
      mk({ id: "1", doi: "10.1/AbC", sources: ["arxiv"] }),
      mk({ id: "2", doi: "10.1/abc", sources: ["openalex"] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].sources.sort()).toEqual(["arxiv", "openalex"]);
  });

  it("merges by near-identical title when no DOI", () => {
    const out = dedupePapers([
      mk({ id: "1", title: "Attention Is All You Need" }),
      mk({ id: "2", title: "Attention is all you need (v2)" }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("keeps distinct papers", () => {
    const out = dedupePapers([
      mk({ id: "1", title: "Graph neural networks" }),
      mk({ id: "2", title: "Ocean tide prediction" }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("prefers the richer record (with pdfUrl/abstract) when merging", () => {
    const out = dedupePapers([
      mk({ id: "1", doi: "10.1/a", abstract: undefined, pdfUrl: undefined }),
      mk({ id: "2", doi: "10.1/a", abstract: "has abstract", pdfUrl: "http://x/p.pdf" }),
    ]);
    expect(out[0].abstract).toBe("has abstract");
    expect(out[0].pdfUrl).toBe("http://x/p.pdf");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run lib/scholar/dedup.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { titleOverlap } from "./normalize";
import type { Paper } from "./types";

const TITLE_THRESHOLD = 0.85;

function merge(a: Paper, b: Paper): Paper {
  // prefer non-empty fields; union sources; keep max citationCount; OR openAccess
  const pick = <K extends keyof Paper>(k: K) => (a[k] ?? b[k]) as Paper[K];
  const richer = (x?: any, y?: any) => x ?? y;
  return {
    ...a,
    title: a.title || b.title,
    authors: a.authors.length ? a.authors : b.authors,
    year: richer(a.year, b.year),
    venue: richer(a.venue, b.venue),
    doi: richer(a.doi, b.doi),
    arxivId: richer(a.arxivId, b.arxivId),
    url: richer(a.url, b.url),
    pdfUrl: richer(a.pdfUrl, b.pdfUrl),
    abstract: richer(a.abstract, b.abstract),
    citationCount: Math.max(a.citationCount ?? 0, b.citationCount ?? 0) || undefined,
    openAccess: a.openAccess || b.openAccess,
    retrievedText: richer(a.retrievedText, b.retrievedText),
    sources: Array.from(new Set([...a.sources, ...b.sources])),
    id: pick("id"),
  };
}

export function dedupePapers(papers: Paper[]): Paper[] {
  const result: Paper[] = [];
  for (const p of papers) {
    const dKey = p.doi?.toLowerCase();
    let hitIndex = -1;
    for (let i = 0; i < result.length; i++) {
      const r = result[i];
      if (dKey && r.doi?.toLowerCase() === dKey) { hitIndex = i; break; }
      if (!dKey && !r.doi && titleOverlap(p.title, r.title) > TITLE_THRESHOLD) { hitIndex = i; break; }
    }
    if (hitIndex >= 0) result[hitIndex] = merge(result[hitIndex], p);
    else result.push(p);
  }
  return result;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run lib/scholar/dedup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/dedup.ts lib/scholar/dedup.test.ts
git commit -m "feat: paper deduplication + tests"
```

---

### Task 1.5: PDF paragraph attribution (pure core + pdfjs glue)

**Files:**
- Create: `lib/scholar/pdf.ts`
- Test: `lib/scholar/pdf.test.ts`

- [ ] **Step 1: Write failing tests for the pure functions**

```ts
import { describe, it, expect } from "vitest";
import { splitParagraphs, paragraphsFromPages } from "./pdf";

describe("splitParagraphs", () => {
  it("splits on blank lines and trims", () => {
    expect(splitParagraphs("Para one.\n\nPara two.")).toEqual(["Para one.", "Para two."]);
  });
  it("drops empty fragments", () => {
    expect(splitParagraphs("\n\n  \n\nOnly one")).toEqual(["Only one"]);
  });
});

describe("paragraphsFromPages", () => {
  it("assigns the correct page to each paragraph and sequential idx", () => {
    const out = paragraphsFromPages([
      { page: 1, text: "A1.\n\nA2." },
      { page: 2, text: "B1." },
    ]);
    expect(out).toEqual([
      { idx: 0, page: 1, text: "A1." },
      { idx: 1, page: 1, text: "A2." },
      { idx: 2, page: 2, text: "B1." },
    ]);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run lib/scholar/pdf.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement (pure core + impure pdfjs wrapper)**

```ts
import type { Paragraph } from "./types";

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function paragraphsFromPages(pages: { page: number; text: string }[]): Paragraph[] {
  const out: Paragraph[] = [];
  let idx = 0;
  for (const pg of pages) {
    for (const para of splitParagraphs(pg.text)) {
      out.push({ idx: idx++, page: pg.page, text: para });
    }
  }
  return out;
}

// Impure: extract per-page text with pdfjs-dist (Node, no worker), then attribute.
export async function extractPdfParagraphs(data: Uint8Array): Promise<Paragraph[]> {
  // legacy build runs in Node without a worker
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true }).promise;
  const pages: { page: number; text: string }[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // pdfjs returns items per text run; join with spaces, insert breaks on large Y gaps is overkill here
    const text = content.items.map((it: any) => (it.str ?? "")).join(" ");
    pages.push({ page: n, text });
  }
  return paragraphsFromPages(pages);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run lib/scholar/pdf.test.ts`
Expected: PASS (pure functions; the pdfjs wrapper is exercised in Phase 5 manual test).

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/pdf.ts lib/scholar/pdf.test.ts
git commit -m "feat: pdf per-page paragraph attribution + tests"
```

---

### Task 1.6: SSRF guard for the PDF proxy

**Files:**
- Create: `lib/scholar/ssrf.ts`
- Test: `lib/scholar/ssrf.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { isSafePublicHttpUrl } from "./ssrf";

describe("isSafePublicHttpUrl", () => {
  it("allows public https", () => {
    expect(isSafePublicHttpUrl("https://arxiv.org/pdf/1706.03762.pdf")).toBe(true);
  });
  it("rejects non-http schemes", () => {
    expect(isSafePublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isSafePublicHttpUrl("ftp://x/y")).toBe(false);
  });
  it("rejects localhost and loopback", () => {
    expect(isSafePublicHttpUrl("http://localhost/x")).toBe(false);
    expect(isSafePublicHttpUrl("http://127.0.0.1/x")).toBe(false);
  });
  it("rejects private ipv4 ranges", () => {
    expect(isSafePublicHttpUrl("http://10.0.0.5/x")).toBe(false);
    expect(isSafePublicHttpUrl("http://192.168.1.1/x")).toBe(false);
    expect(isSafePublicHttpUrl("http://169.254.169.254/latest")).toBe(false);
  });
  it("rejects garbage", () => {
    expect(isSafePublicHttpUrl("not a url")).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run lib/scholar/ssrf.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export function isSafePublicHttpUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return false;

  // Block obvious private / link-local / loopback IPv4 literals
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127) return false;            // loopback
    if (a === 10) return false;             // private
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 169 && b === 254) return false; // link-local
    if (a === 0) return false;
  }
  // Block IPv6 loopback/link-local literals
  if (host === "::1" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) return false;
  return true;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run lib/scholar/ssrf.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/ssrf.ts lib/scholar/ssrf.test.ts
git commit -m "feat: ssrf guard for pdf proxy + tests"
```

---

## Phase 2 — Sources, retrieval, synthesis

> All source adapters return the normalized `Paper` shape. Use the global `fetch` (Node 18+). Set a 1-request `User-Agent: ZaeonScholar/1.0 (mailto:UNPAYWALL_EMAIL)` and a 10s timeout via `AbortSignal.timeout(10000)`. Each adapter must never throw — on failure return `[]` and let the orchestrator log it.
>
> **Testability rule (required by the test mandate):** every adapter MUST export a **pure** `parseX(payload)` function that maps the raw API payload (JSON object / XML string) to `Paper[]`, separate from the network `searchX` wrapper. Parsers are unit-tested with inline fixtures (Task 2.6) — no network in tests.

### Task 2.1: Source adapters

**Files:**
- Create: `lib/scholar/sources/semanticScholar.ts`
- Create: `lib/scholar/sources/openalex.ts`
- Create: `lib/scholar/sources/arxiv.ts`
- Create: `lib/scholar/sources/crossref.ts`
- Create: `lib/scholar/sources/index.ts`

- [ ] **Step 1: Semantic Scholar adapter**

`lib/scholar/sources/semanticScholar.ts`:
```ts
import type { Paper } from "../types";

export function parseSemanticScholar(json: any): Paper[] {
  return (json?.data ?? []).map((p: any): Paper => ({
    id: p.externalIds?.DOI ? `doi:${p.externalIds.DOI}` : `s2:${p.paperId}`,
    title: p.title ?? "",
    authors: (p.authors ?? []).map((a: any) => a.name),
    year: p.year ?? undefined,
    venue: p.venue || undefined,
    doi: p.externalIds?.DOI || undefined,
    arxivId: p.externalIds?.ArXiv || undefined,
    url: p.url || undefined,
    pdfUrl: p.openAccessPdf?.url || undefined,
    abstract: p.abstract || undefined,
    citationCount: p.citationCount ?? undefined,
    openAccess: !!p.openAccessPdf?.url,
    sources: ["semanticscholar"],
  }));
}

export async function searchSemanticScholar(query: string, limit = 15): Promise<Paper[]> {
  try {
    const fields = "title,authors,year,venue,externalIds,abstract,openAccessPdf,citationCount,url";
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    return parseSemanticScholar(await res.json());
  } catch { return []; }
}
```

- [ ] **Step 2: OpenAlex adapter**

`lib/scholar/sources/openalex.ts`:
```ts
import type { Paper } from "../types";

export function reconstructAbstract(inv?: Record<string, number[]>): string | undefined {
  if (!inv) return undefined;
  const words: string[] = [];
  for (const [w, positions] of Object.entries(inv)) for (const pos of positions) words[pos] = w;
  return words.filter(Boolean).join(" ") || undefined;
}

export function parseOpenAlex(json: any): Paper[] {
  return (json?.results ?? []).map((w: any): Paper => {
    const doi = w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//, "") : undefined;
    const pdf = w.open_access?.oa_url || w.primary_location?.pdf_url || undefined;
    return {
      id: doi ? `doi:${doi}` : `openalex:${w.id}`,
      title: w.title ?? "",
      authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
      year: w.publication_year ?? undefined,
      venue: w.primary_location?.source?.display_name || undefined,
      doi,
      url: w.id,
      pdfUrl: pdf,
      abstract: reconstructAbstract(w.abstract_inverted_index),
      citationCount: w.cited_by_count ?? undefined,
      openAccess: !!w.open_access?.is_oa,
      sources: ["openalex"],
    };
  });
}

export async function searchOpenAlex(query: string, limit = 15): Promise<Paper[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    return parseOpenAlex(await res.json());
  } catch { return []; }
}
```

> Export `reconstructAbstract` too (`export function reconstructAbstract`), so it can be tested directly.

- [ ] **Step 3: arXiv adapter** (Atom XML; parse with regex — no XML dep)

`lib/scholar/sources/arxiv.ts`:
```ts
import type { Paper } from "../types";

export function parseArxiv(xml: string): Paper[] {
  const entries = xml.split("<entry>").slice(1);
  return entries.map((e): Paper => {
    const get = (tag: string) => (e.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? "").trim();
    const idUrl = get("id");
    const arxivId = idUrl.match(/abs\/([^v]+)(v\d+)?/)?.[1] ?? idUrl.split("/").pop() ?? "";
    const authors = Array.from(e.matchAll(/<name>([\s\S]*?)<\/name>/g)).map((m) => m[1].trim());
    const pdf = (e.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/) ?? [])[1];
    return {
      id: `arxiv:${arxivId}`,
      title: get("title").replace(/\s+/g, " "),
      authors,
      year: Number(get("published").slice(0, 4)) || undefined,
      venue: "arXiv",
      arxivId,
      url: idUrl,
      pdfUrl: pdf ? pdf.replace(/^http:/, "https:") : `https://arxiv.org/pdf/${arxivId}.pdf`,
      abstract: get("summary").replace(/\s+/g, " "),
      openAccess: true,
      sources: ["arxiv"],
    };
  });
}

export async function searchArxiv(query: string, limit = 15): Promise<Paper[]> {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${limit}&sortBy=relevance`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    return parseArxiv(await res.text());
  } catch { return []; }
}
```

- [ ] **Step 4: CrossRef adapter (search + BibTeX)**

`lib/scholar/sources/crossref.ts`:
```ts
import type { Paper } from "../types";

export function parseCrossref(json: any): Paper[] {
  return (json?.message?.items ?? []).map((it: any): Paper => ({
    id: `doi:${it.DOI}`,
    title: Array.isArray(it.title) ? it.title[0] : (it.title ?? ""),
    authors: (it.author ?? []).map((a: any) => [a.given, a.family].filter(Boolean).join(" ")),
    year: it.issued?.["date-parts"]?.[0]?.[0] ?? undefined,
    venue: Array.isArray(it["container-title"]) ? it["container-title"][0] : undefined,
    doi: it.DOI,
    url: it.URL,
    citationCount: it["is-referenced-by-count"] ?? undefined,
    openAccess: false,
    sources: ["crossref"],
  }));
}

export async function searchCrossref(query: string, limit = 10): Promise<Paper[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&select=DOI,title,author,issued,container-title,URL,is-referenced-by-count`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    return parseCrossref(await res.json());
  } catch { return []; }
}

// Verified BibTeX via CrossRef transform; null on failure (caller builds manual fallback).
export async function fetchBibtex(doi: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}/transform/application/x-bibtex`, {
      headers: { Accept: "application/x-bibtex" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return (await res.text()).trim();
  } catch { return null; }
}
```

- [ ] **Step 5: Source registry / domain selection**

`lib/scholar/sources/index.ts`:
```ts
import type { Paper } from "../types";
import { searchSemanticScholar } from "./semanticScholar";
import { searchOpenAlex } from "./openalex";
import { searchArxiv } from "./arxiv";
import { searchCrossref } from "./crossref";

export type SourceName = "semanticscholar" | "openalex" | "arxiv" | "crossref";

export const SOURCE_FN: Record<SourceName, (q: string, limit?: number) => Promise<Paper[]>> = {
  semanticscholar: searchSemanticScholar,
  openalex: searchOpenAlex,
  arxiv: searchArxiv,
  crossref: searchCrossref,
};

// Domain → ordered priority (see spec §6.1). Always includes the multidisciplinary anchors.
export function basesForDomain(domain?: string): SourceName[] {
  const d = (domain ?? "").toLowerCase();
  if (/cs|ml|ai|comput|software|engenharia/.test(d)) return ["arxiv", "semanticscholar", "openalex", "crossref"];
  if (/med|bio|saúde|health|neuro/.test(d)) return ["semanticscholar", "openalex", "crossref"]; // PubMed/EuropePMC added in 2.2
  if (/phys|astro|math|física|matemática/.test(d)) return ["arxiv", "semanticscholar", "openalex"];
  return ["semanticscholar", "openalex", "arxiv", "crossref"];
}

export async function searchAll(query: string, sources: SourceName[]): Promise<{ source: SourceName; papers: Paper[] }[]> {
  return Promise.all(sources.map(async (s) => ({ source: s, papers: await SOURCE_FN[s](query) })));
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.
```bash
git add lib/scholar/sources
git commit -m "feat: academic source adapters (S2, OpenAlex, arXiv, CrossRef)"
```

---

### Task 2.2: Full-text retrieval chain (OA PDFs + EuropePMC)

**Files:**
- Create: `lib/scholar/sources/unpaywall.ts`
- Create: `lib/scholar/sources/core.ts`
- Create: `lib/scholar/sources/europepmc.ts`
- Create: `lib/scholar/fulltext.ts`

- [ ] **Step 1: Unpaywall PDF locator**

`lib/scholar/sources/unpaywall.ts`:
```ts
export async function unpaywallPdfUrl(doi: string): Promise<string | null> {
  const email = process.env.UNPAYWALL_EMAIL;
  if (!email) return null;
  try {
    const res = await fetch(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return j.best_oa_location?.url_for_pdf || j.best_oa_location?.url || null;
  } catch { return null; }
}
```

- [ ] **Step 2: CORE (skipped without key)**

`lib/scholar/sources/core.ts`:
```ts
export async function corePdfUrl(query: string): Promise<string | null> {
  const key = process.env.CORE_API_KEY;
  if (!key) return null; // skipped per spec
  try {
    const res = await fetch(`https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=1`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return j.results?.[0]?.downloadUrl || null;
  } catch { return null; }
}
```

- [ ] **Step 3: Europe PMC full-text (sectioned text fallback)**

`lib/scholar/sources/europepmc.ts`:
```ts
import type { Paragraph } from "../types";

// Pure: JATS-ish full-text XML → sectioned paragraphs (no page numbers).
export function parseEuropePmcXml(xml: string): Paragraph[] {
  const secs = Array.from(xml.matchAll(/<sec[\s\S]*?>([\s\S]*?)<\/sec>/g));
  const paras: Paragraph[] = [];
  let idx = 0;
  for (const s of secs) {
    const title = (s[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
    for (const p of Array.from(s[1].matchAll(/<p[\s\S]*?>([\s\S]*?)<\/p>/g))) {
      const text = p[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text) paras.push({ idx: idx++, section: title || undefined, text });
    }
  }
  return paras;
}

// Returns sectioned paragraphs (no page numbers) when an OA full text exists.
export async function europePmcFullText(doi: string): Promise<Paragraph[] | null> {
  try {
    const search = await fetch(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!search.ok) return null;
    const sj: any = await search.json();
    const hit = sj.resultList?.result?.[0];
    if (!hit || hit.source !== "PMC" || !hit.pmcid) return null;
    const ft = await fetch(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/${hit.source}/${hit.pmcid}/fullTextXML`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!ft.ok) return null;
    const paras = parseEuropePmcXml(await ft.text());
    return paras.length ? paras : null;
  } catch { return null; }
}
```

- [ ] **Step 4: Full-text resolver (ties PDF + EuropePMC + abstract together)**

`lib/scholar/fulltext.ts`:
```ts
import type { Paper, RetrievedText } from "./types";
import { isSafePublicHttpUrl } from "./ssrf";
import { extractPdfParagraphs } from "./pdf";
import { unpaywallPdfUrl } from "./sources/unpaywall";
import { europePmcFullText } from "./sources/europepmc";

async function fetchPdfBytes(url: string): Promise<Uint8Array | null> {
  if (!isSafePublicHttpUrl(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!/pdf/i.test(ct)) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch { return null; }
}

// Mutates+returns the paper with retrievedText filled by the best available source.
export async function resolveFullText(paper: Paper): Promise<Paper> {
  // 1) Try a PDF (arXiv / existing pdfUrl / Unpaywall) → page-attributed paragraphs (best proof)
  let pdfUrl = paper.pdfUrl;
  if (!pdfUrl && paper.doi) pdfUrl = (await unpaywallPdfUrl(paper.doi)) ?? undefined;
  if (pdfUrl) {
    const bytes = await fetchPdfBytes(pdfUrl);
    if (bytes) {
      const paragraphs = await extractPdfParagraphs(bytes).catch(() => []);
      if (paragraphs.length) {
        return { ...paper, pdfUrl, openAccess: true, retrievedText: { kind: "pdf", paragraphs } };
      }
    }
  }
  // 2) Europe PMC sectioned full text
  if (paper.doi) {
    const paras = await europePmcFullText(paper.doi);
    if (paras?.length) return { ...paper, retrievedText: { kind: "fulltext", paragraphs: paras } };
  }
  // 3) Abstract-only fallback
  if (paper.abstract) {
    return { ...paper, retrievedText: { kind: "abstract", paragraphs: [{ idx: 0, text: paper.abstract }] } };
  }
  return paper; // no text at all → cannot ground any claim
}
```

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add lib/scholar/sources/unpaywall.ts lib/scholar/sources/core.ts lib/scholar/sources/europepmc.ts lib/scholar/fulltext.ts
git commit -m "feat: open-access full-text retrieval chain (PDF + EuropePMC)"
```

---

### Task 2.6: Source parser tests (fixtures, no network)

**Files:**
- Test: `lib/scholar/sources/parsers.test.ts`

- [ ] **Step 1: Write the tests** (parsers already exist from Tasks 2.1/2.2)

```ts
import { describe, it, expect } from "vitest";
import { parseSemanticScholar } from "./semanticScholar";
import { parseOpenAlex, reconstructAbstract } from "./openalex";
import { parseArxiv } from "./arxiv";
import { parseCrossref } from "./crossref";
import { parseEuropePmcXml } from "./europepmc";

describe("parseSemanticScholar", () => {
  it("maps fields and derives doi id + openAccess", () => {
    const out = parseSemanticScholar({ data: [{
      paperId: "abc", title: "T", year: 2020, venue: "NeurIPS",
      authors: [{ name: "Ada L." }], externalIds: { DOI: "10.1/x", ArXiv: "2001.1" },
      abstract: "A", openAccessPdf: { url: "http://x/p.pdf" }, citationCount: 5, url: "http://s2/x",
    }] });
    expect(out[0]).toMatchObject({
      id: "doi:10.1/x", title: "T", doi: "10.1/x", arxivId: "2001.1",
      pdfUrl: "http://x/p.pdf", openAccess: true, citationCount: 5, sources: ["semanticscholar"],
    });
    expect(out[0].authors).toEqual(["Ada L."]);
  });
  it("returns [] for empty payload", () => {
    expect(parseSemanticScholar({})).toEqual([]);
  });
});

describe("reconstructAbstract", () => {
  it("rebuilds word order from inverted index", () => {
    expect(reconstructAbstract({ attention: [0, 2], is: [1] })).toBe("attention is attention");
  });
  it("returns undefined when absent", () => {
    expect(reconstructAbstract(undefined)).toBeUndefined();
  });
});

describe("parseOpenAlex", () => {
  it("strips doi url, reconstructs abstract, reads OA", () => {
    const out = parseOpenAlex({ results: [{
      id: "https://openalex.org/W1", title: "T", publication_year: 2021,
      doi: "https://doi.org/10.1/Y", authorships: [{ author: { display_name: "Bo" } }],
      abstract_inverted_index: { Hello: [0], world: [1] },
      open_access: { is_oa: true, oa_url: "http://oa/p.pdf" }, cited_by_count: 9,
      primary_location: { source: { display_name: "Nature" } },
    }] });
    expect(out[0]).toMatchObject({ id: "doi:10.1/Y", doi: "10.1/Y", venue: "Nature", openAccess: true, pdfUrl: "http://oa/p.pdf" });
    expect(out[0].abstract).toBe("Hello world");
  });
});

describe("parseArxiv", () => {
  const xml = `<feed><entry>
    <id>http://arxiv.org/abs/1706.03762v5</id>
    <title>Attention Is All You Need</title>
    <summary>We propose the Transformer.</summary>
    <published>2017-06-12T00:00:00Z</published>
    <author><name>Ashish Vaswani</name></author>
    <author><name>Noam Shazeer</name></author>
    <link title="pdf" href="http://arxiv.org/pdf/1706.03762v5"/>
  </entry></feed>`;
  it("parses id, authors, pdf (https), year", () => {
    const out = parseArxiv(xml);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ arxivId: "1706.03762", year: 2017, venue: "arXiv", openAccess: true });
    expect(out[0].authors).toEqual(["Ashish Vaswani", "Noam Shazeer"]);
    expect(out[0].pdfUrl?.startsWith("https://")).toBe(true);
  });
});

describe("parseCrossref", () => {
  it("flattens title/container arrays and joins author names", () => {
    const out = parseCrossref({ message: { items: [{
      DOI: "10.1/z", title: ["The Title"], "container-title": ["J. Stuff"],
      author: [{ given: "Ada", family: "Lovelace" }], issued: { "date-parts": [[1843]] },
      URL: "http://doi/z", "is-referenced-by-count": 3,
    }] } });
    expect(out[0]).toMatchObject({ id: "doi:10.1/z", title: "The Title", venue: "J. Stuff", year: 1843, citationCount: 3 });
    expect(out[0].authors).toEqual(["Ada Lovelace"]);
  });
});

describe("parseEuropePmcXml", () => {
  it("extracts sectioned paragraphs and strips tags", () => {
    const xml = `<article><sec><title>Intro</title><p>First <i>para</i>.</p><p>Second.</p></sec></article>`;
    const out = parseEuropePmcXml(xml);
    expect(out).toEqual([
      { idx: 0, section: "Intro", text: "First para ." },
      { idx: 1, section: "Intro", text: "Second." },
    ]);
  });
});
```

- [ ] **Step 2: Run, verify pass**

Run: `npx vitest run lib/scholar/sources/parsers.test.ts`
Expected: PASS. (If a parser is wrong, fix the parser in its source file — the test is the spec.)

- [ ] **Step 3: Commit**

```bash
git add lib/scholar/sources/parsers.test.ts
git commit -m "test: source + europepmc parser tests (fixtures)"
```

---

### Task 2.7: Result assembly (pure, TDD) — verify + filter + files

> Extracts the route's "verify each record, keep only verified, keep only cited papers, build files" logic into a pure, tested function so the vital guarantee is unit-covered (not only live-tested).

**Files:**
- Create: `lib/scholar/assemble.ts`
- Test: `lib/scholar/assemble.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { assembleResults } from "./assemble";
import type { Paper } from "./types";

const paper = (over: Partial<Paper>): Paper => ({
  id: "p1", title: "T", authors: ["A"], openAccess: true, sources: ["arxiv"],
  retrievedText: { kind: "pdf", paragraphs: [{ idx: 0, page: 2, text: "the Transformer dispenses with recurrence" }] },
  ...over,
});

describe("assembleResults", () => {
  const grounded = [paper({ id: "p1", doi: "10.1/a" }), paper({ id: "p2", title: "Other", retrievedText: { kind: "abstract", paragraphs: [{ idx: 0, text: "some abstract text here" }] } })];
  const raw = {
    answer: "resposta",
    evidence: [
      { paperId: "p1", claim: "C1", quote: "the Transformer dispenses with recurrence", confidence: "high" as const },
      { paperId: "p1", claim: "Fab", quote: "won every award in history", confidence: "high" as const }, // not in text
      { paperId: "p2", claim: "C2", quote: "some abstract text here", confidence: "medium" as const },
    ],
    insights: { summary: "s", trends: [], contradictions: [] },
    gaps: { description: "g", rqCards: [] },
  };

  it("keeps only verified evidence", () => {
    const r = assembleResults("q", grounded, raw);
    expect(r.evidence.map((e) => e.claim).sort()).toEqual(["C1", "C2"]);
    expect(r.verifiedCount).toBe(2);
    expect(r.dropped).toBe(1);
  });

  it("sets the page locator and fullTextAvailable correctly", () => {
    const r = assembleResults("q", grounded, raw);
    const c1 = r.evidence.find((e) => e.claim === "C1")!;
    expect(c1.locator).toEqual({ kind: "pdf", page: 2, paragraph: 0 });
    expect(c1.fullTextAvailable).toBe(true);
    const c2 = r.evidence.find((e) => e.claim === "C2")!;
    expect(c2.locator).toEqual({ kind: "abstract" });
    expect(c2.fullTextAvailable).toBe(false);
  });

  it("references include only papers that ended up cited", () => {
    const r = assembleResults("q", grounded, raw);
    expect(r.references.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("drops a paper with zero verified evidence from references", () => {
    const r = assembleResults("q", grounded, {
      ...raw, evidence: [{ paperId: "p1", claim: "C1", quote: "the Transformer dispenses with recurrence", confidence: "high" as const }],
    });
    expect(r.references.map((p) => p.id)).toEqual(["p1"]);
  });

  it("generates a literature-review.md file referencing cited papers", () => {
    const r = assembleResults("q", grounded, raw);
    const md = r.files.find((f) => f.name === "literature-review.md")!;
    expect(md.content).toContain("# q");
    expect(md.content).toContain("resposta");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run lib/scholar/assemble.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { verifyQuote } from "./verify";
import type { EvidenceRecord, Paper, RetrievedText, RawSynthesis } from "./types";

export interface AssembledResults {
  answer: string;
  references: Paper[];
  evidence: EvidenceRecord[];
  insights: RawSynthesis["insights"];
  gaps: RawSynthesis["gaps"];
  files: { name: string; kind: string; content: string }[];
  verifiedCount: number;
  dropped: number;
}

export function assembleResults(query: string, grounded: Paper[], raw: RawSynthesis): AssembledResults {
  const textById = new Map<string, RetrievedText>();
  for (const p of grounded) if (p.retrievedText) textById.set(p.id, p.retrievedText);

  const evidence: EvidenceRecord[] = [];
  let verifiedCount = 0, dropped = 0;
  for (const e of raw.evidence ?? []) {
    const rt = textById.get(e.paperId);
    const v = rt ? verifyQuote(e.quote, rt) : { verified: false as const };
    if (v.verified && rt) {
      verifiedCount++;
      evidence.push({ ...e, locator: v.locator, verified: true, fullTextAvailable: rt.kind !== "abstract" });
    } else dropped++;
  }

  const citedIds = new Set(evidence.map((e) => e.paperId));
  const references = grounded.filter((p) => citedIds.has(p.id));

  const files = [{
    name: "literature-review.md", kind: "markdown",
    content: `# ${query}\n\n${raw.answer}\n\n## Referências\n` +
      references.map((p) => `- ${p.authors.join(", ")} (${p.year ?? "s.d."}). ${p.title}. ${p.venue ?? ""}. ${p.doi ? "doi:" + p.doi : p.url ?? ""}`).join("\n"),
  }];

  return { answer: raw.answer, references, evidence, insights: raw.insights, gaps: raw.gaps, files, verifiedCount, dropped };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run lib/scholar/assemble.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/assemble.ts lib/scholar/assemble.test.ts
git commit -m "feat: tested result assembly (verify + filter + files)"
```

---

### Task 2.3: Gemini planner + synthesis

**Files:**
- Create: `lib/scholar/prompt.ts`
- Create: `lib/scholar/gemini.ts`
- Create: `lib/scholar/synthesize.ts`

- [ ] **Step 1: OMEGA-derived system prompt + tone**

`lib/scholar/prompt.ts`:
```ts
export const OMEGA_SYSTEM = `Você é o Omega Scholar, um agente de pesquisa acadêmica.
REGRAS INEGOCIÁVEIS:
- Você SÓ pode afirmar algo se houver um trecho VERBATIM (cópia exata) do texto fornecido que comprove.
- NUNCA invente autores, números, DOIs, venues ou resultados. NUNCA cite paper fora da lista fornecida.
- Cada Evidence Record deve conter: paperId, claim (em PT-BR), quote (verbatim copiado do texto do paper), confidence.
- A quote DEVE ser uma substring real do texto fornecido daquele paper. Se não houver suporte textual, não faça a afirmação.
TOM: leve, descontraído e amigável (PT-BR), como um colega de pesquisa empolgado — sem jargão pomposo.`;

export const planTone = (query: string) =>
  `Beleza! Vou fuçar sobre "${query}"…`;
```

- [ ] **Step 2: Gemini client wrapper (reuses agent-search auth)**

`lib/scholar/gemini.ts`:
```ts
import { VertexAI } from "@google-cloud/vertexai";

export function getGeminiModel(systemInstruction?: string) {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}");
  const vertexAI = new VertexAI({
    project: credentials.project_id || process.env.GOOGLE_PROJECT_ID,
    location: process.env.GOOGLE_LOCATION || "us-central1",
    googleAuthOptions: { credentials: { client_email: credentials.client_email, private_key: credentials.private_key } },
  });
  return vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash-001",
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    ...(systemInstruction ? { systemInstruction: { role: "system", parts: [{ text: systemInstruction }] } } : {}),
  });
}

export async function geminiJson<T>(systemInstruction: string, userPrompt: string): Promise<T> {
  const model = getGeminiModel(systemInstruction);
  const result = await model.generateContent(userPrompt);
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(text) as T;
}
```

- [ ] **Step 3: Planner + synthesis functions**

`lib/scholar/synthesize.ts`:
```ts
import { geminiJson } from "./gemini";
import { OMEGA_SYSTEM } from "./prompt";
import type { Paper, RawSynthesis } from "./types";

export interface Plan { intent: string; domain: string; queries: string[]; }

export async function planQuery(query: string): Promise<Plan> {
  const sys = "Classifique o pedido de pesquisa. Responda JSON {intent, domain, queries:[2-4 strings]}. domain em PT-BR (ex: 'CS/ML','Medicina','Economia').";
  try {
    return await geminiJson<Plan>(sys, `Pedido: ${query}`);
  } catch {
    return { intent: "search", domain: "", queries: [query] };
  }
}

// Feed ONLY retrieved text; the model must quote verbatim from it.
// (RawSynthesis is defined in ./types so assemble.ts can import it independently.)
export async function synthesize(query: string, papers: Paper[]): Promise<RawSynthesis> {
  const corpus = papers.map((p) => ({
    paperId: p.id,
    title: p.title,
    text: (p.retrievedText?.paragraphs ?? []).map((x) => x.text).join("\n\n").slice(0, 6000),
  }));
  const user = `Pergunta: ${query}

PAPERS (use SOMENTE este texto; quote verbatim a partir daqui):
${JSON.stringify(corpus)}

Responda JSON: {answer, evidence:[{paperId,claim,quote,confidence}], insights:{summary,trends[],contradictions[]}, gaps:{description,rqCards[]}}`;
  return geminiJson<RawSynthesis>(OMEGA_SYSTEM, user);
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add lib/scholar/prompt.ts lib/scholar/gemini.ts lib/scholar/synthesize.ts
git commit -m "feat: gemini planner + synthesis with OMEGA system prompt"
```

---

## Phase 3 — API routes

### Task 3.1: Streaming orchestrator `POST /api/ai/scholar`

**Files:**
- Create: `app/api/ai/scholar/route.ts`

- [ ] **Step 1: Implement the streaming pipeline**

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { basesForDomain, searchAll } from "@/lib/scholar/sources";
import { dedupePapers } from "@/lib/scholar/dedup";
import { resolveFullText } from "@/lib/scholar/fulltext";
import { planQuery, synthesize } from "@/lib/scholar/synthesize";
import { assembleResults } from "@/lib/scholar/assemble";
import { planTone } from "@/lib/scholar/prompt";
import type { Paper, ScholarEvent } from "@/lib/scholar/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { prompt, room } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ScholarEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const created = await prisma.scholarSession.create({
          data: { userId, room: room ?? null, query: prompt, status: "running" },
        });
        send({ type: "session", sessionId: created.id });

        // PLAN
        send({ type: "phase", phase: "planning", message: planTone(prompt) });
        const plan = await planQuery(prompt);

        // SEARCH (parallel)
        const bases = basesForDomain(plan.domain);
        const queries = plan.queries.length ? plan.queries : [prompt];
        const results = await searchAll(queries[0], bases);
        let pool: Paper[] = [];
        for (const r of results) {
          send({ type: "phase", phase: "searching", source: r.source, count: r.papers.length,
                 message: `✓ ${r.source}: ${r.papers.length} papers` });
          pool = pool.concat(r.papers);
        }

        // DEDUP + FULL TEXT (top N)
        const unique = dedupePapers(pool);
        const top = unique.slice(0, 14);
        const withText = await Promise.all(top.map(resolveFullText));
        const ftCount = withText.filter((p) => p.retrievedText && p.retrievedText.kind !== "abstract").length;
        send({ type: "phase", phase: "dedup", unique: unique.length, fulltext: ftCount,
               message: `✓ ${unique.length} únicos · full-text aberto de ${ftCount}` });

        // SYNTHESIZE
        send({ type: "phase", phase: "synthesizing", message: "🧠 Indo mais fundo e conferindo cada citação…" });
        const grounded = withText.filter((p) => p.retrievedText);
        const raw = await synthesize(prompt, grounded);

        // VERIFY + ASSEMBLE (deterministic; unit-tested in lib/scholar/assemble.test.ts)
        const r = assembleResults(prompt, grounded, raw);
        send({ type: "phase", phase: "verifying", checked: (raw.evidence ?? []).length,
               verified: r.verifiedCount, dropped: r.dropped, message: `✓ ${r.verifiedCount} citações confirmadas` });

        send({ type: "answer", text: r.answer });

        const saved = await prisma.scholarSession.update({
          where: { id: created.id },
          data: {
            status: "done", domain: plan.domain || null,
            references: r.references as any, evidence: r.evidence as any,
            insights: r.insights as any, gaps: r.gaps as any, files: r.files as any,
            thread: { answer: r.answer } as any,
          },
        });
        send({ type: "done", session: saved });
      } catch (err: any) {
        send({ type: "error", message: err?.message ?? "Erro inesperado" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
}
```

> Note: confirm `authOptions` is exported from `app/api/auth/[...nextauth]/route.ts`. If not exported there, import from wherever NextAuth options live (search `authOptions`). Confirm `session.user.id` exists (the app sets it elsewhere; if it's `email`, look up the user id via prisma).

- [ ] **Step 2: Verify auth wiring**

Run: `grep -rn "authOptions" app/api/auth/ app/lib lib 2>/dev/null | head`
Confirm the import path and that the session carries a user id (else adjust to resolve `userId` from email via `prisma.user.findUnique`).

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add app/api/ai/scholar/route.ts
git commit -m "feat: streaming Omega Scholar orchestrator route"
```

---

### Task 3.2: Sessions list/load `GET /api/ai/scholar/sessions`

**Files:**
- Create: `app/api/ai/scholar/sessions/route.ts`

- [ ] **Step 1: Implement**

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const one = await prisma.scholarSession.findFirst({ where: { id, userId } });
    return NextResponse.json({ session: one });
  }
  const list = await prisma.scholarSession.findMany({
    where: { userId }, orderBy: { createdAt: "desc" }, take: 20,
    select: { id: true, query: true, domain: true, status: true, createdAt: true },
  });
  return NextResponse.json({ sessions: list });
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add app/api/ai/scholar/sessions/route.ts
git commit -m "feat: scholar sessions list/load route"
```

---

### Task 3.3: PDF proxy `GET /api/ai/scholar/pdf`

**Files:**
- Create: `app/api/ai/scholar/pdf/route.ts`

- [ ] **Step 1: Implement (auth + SSRF + must-be-persisted check)**

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { isSafePublicHttpUrl } from "@/lib/scholar/ssrf";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const target = new URL(req.url).searchParams.get("url") ?? "";
  if (!isSafePublicHttpUrl(target)) return new Response("Bad URL", { status: 400 });

  // The URL must already exist as a pdfUrl in one of THIS user's sessions.
  const sessions = await prisma.scholarSession.findMany({
    where: { userId }, select: { references: true },
  });
  const allowed = sessions.some((s) =>
    Array.isArray(s.references) && (s.references as any[]).some((p) => p?.pdfUrl === target));
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const upstream = await fetch(target, { signal: AbortSignal.timeout(20000) });
  if (!upstream.ok || !/pdf/i.test(upstream.headers.get("content-type") ?? "")) {
    return new Response("Upstream error", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=3600" },
  });
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add app/api/ai/scholar/pdf/route.ts
git commit -m "feat: ssrf-guarded pdf proxy route"
```

---

## Phase 4 — Frontend

### Task 4.1: Context + NDJSON stream reader

**Files:**
- Create: `app/workstation/student/omega/OmegaScholarContext.tsx`

- [ ] **Step 1: Implement provider + hook**

```tsx
"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { ScholarEvent } from "@/lib/scholar/types";

interface Phase { phase: string; message: string; }
interface OmegaState {
  status: "idle" | "running" | "done" | "error";
  query: string;
  phases: Phase[];
  answer: string;
  session: any | null;
  error: string | null;
}
interface OmegaCtx extends OmegaState {
  runQuery: (prompt: string) => Promise<void>;
  loadSession: (s: any) => void;
}

const Ctx = createContext<OmegaCtx | null>(null);
export const useOmegaScholar = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOmegaScholar must be used within OmegaScholarProvider");
  return c;
};

export function OmegaScholarProvider({ room, onStart, children }:
  { room?: string; onStart?: () => void; children: ReactNode }) {
  const [state, setState] = useState<OmegaState>({
    status: "idle", query: "", phases: [], answer: "", session: null, error: null });

  const runQuery = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;
    onStart?.(); // parent switches activeTab → "community"
    setState({ status: "running", query: prompt, phases: [], answer: "", session: null, error: null });
    try {
      const res = await fetch("/api/ai/scholar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, room }),
      });
      if (!res.body) throw new Error("Sem stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as ScholarEvent;
          setState((s) => {
            if (ev.type === "phase") return { ...s, phases: [...s.phases, { phase: ev.phase, message: (ev as any).message ?? ev.phase }] };
            if (ev.type === "answer") return { ...s, answer: ev.text };
            if (ev.type === "done") return { ...s, status: "done", session: ev.session };
            if (ev.type === "error") return { ...s, status: "error", error: ev.message };
            return s;
          });
        }
      }
    } catch (e: any) {
      setState((s) => ({ ...s, status: "error", error: e?.message ?? "Erro" }));
    }
  }, [room, onStart]);

  const loadSession = useCallback((s: any) => {
    setState({ status: "done", query: s.query, phases: [], answer: s?.thread?.answer ?? "", session: s, error: null });
  }, []);

  return <Ctx.Provider value={{ ...state, runQuery, loadSession }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add app/workstation/student/omega/OmegaScholarContext.tsx
git commit -m "feat: OmegaScholar context with NDJSON stream reader"
```

---

### Task 4.2: Prompt bar (layout A)

**Files:**
- Create: `app/workstation/student/omega/OmegaScholarBar.tsx`

- [ ] **Step 1: Implement** (clones the gradient/beca aesthetic of the current room header)

```tsx
"use client";
import { useState } from "react";
import { GraduationCap, ArrowUp, Loader2 } from "lucide-react";
import { useOmegaScholar } from "./OmegaScholarContext";

export default function OmegaScholarBar() {
  const { runQuery, status } = useOmegaScholar();
  const [value, setValue] = useState("");
  const busy = status === "running";

  const submit = () => { if (value.trim() && !busy) { runQuery(value); setValue(""); } };

  return (
    <div className="mx-6 mt-6 p-5 rounded-[2rem] bg-gradient-to-r from-violet-500/15 to-purple-500/5 border border-white/30 dark:border-white/10 relative overflow-hidden">
      <div className="absolute -top-8 -right-8 w-40 h-40 bg-violet-400/10 rounded-full blur-[50px] pointer-events-none" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/30 dark:bg-white/5 flex items-center justify-center border border-white/40 dark:border-white/10 shrink-0">
          <GraduationCap className="text-violet-600 dark:text-violet-400" size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-violet-500 dark:text-violet-400">
            Omega Scholar · Pesquisa acadêmica
          </p>
          <div className="flex items-center gap-2 mt-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={busy}
              placeholder="Pesquise, revise a literatura, peça citações…"
              className="flex-1 bg-black/10 dark:bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-violet-400/50 disabled:opacity-60"
            />
            <button onClick={submit} disabled={busy}
              className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 disabled:opacity-60">
              {busy ? <Loader2 className="animate-spin" size={18} /> : <ArrowUp size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add app/workstation/student/omega/OmegaScholarBar.tsx
git commit -m "feat: Omega Scholar prompt bar (layout A)"
```

---

### Task 4.3: Activity thread + PDF viewer modal

**Files:**
- Create: `app/workstation/student/omega/ActivityThread.tsx`
- Create: `app/workstation/student/omega/PdfViewerModal.tsx`

- [ ] **Step 1: ActivityThread** (Claude-Code-style progress, friendly)

```tsx
"use client";
import { motion } from "framer-motion";
import { useOmegaScholar } from "./OmegaScholarContext";

export default function ActivityThread() {
  const { phases, answer, status, query } = useOmegaScholar();
  if (status === "idle") return null;
  return (
    <div className="rounded-3xl bg-black/[0.03] dark:bg-black/30 border border-black/5 dark:border-white/10 p-5 mb-5">
      <p className="text-sm font-bold text-slate-700 dark:text-white/80 mb-3">🔎 "{query}"</p>
      <div className="space-y-1.5">
        {phases.map((p, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            className="text-xs text-slate-500 dark:text-white/50 font-medium">{p.message}</motion.div>
        ))}
        {status === "running" && (
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity }}
            className="text-xs text-violet-500 font-semibold">processando…</motion.div>
        )}
      </div>
      {answer && (
        <div className="mt-4 pt-4 border-t border-dashed border-black/10 dark:border-white/10 text-sm leading-relaxed text-slate-700 dark:text-white/80 whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: PdfViewerModal** (opens the proxied PDF at the cited page)

```tsx
"use client";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import "@react-pdf-viewer/core/lib/styles/index.css";
import { X } from "lucide-react";
import { useEffect } from "react";

export default function PdfViewerModal({ pdfUrl, page, quote, onClose }:
  { pdfUrl: string; page: number; quote: string; onClose: () => void }) {
  const nav = pageNavigationPlugin();
  const proxied = `/api/ai/scholar/pdf?url=${encodeURIComponent(pdfUrl)}`;
  useEffect(() => { const t = setTimeout(() => nav.jumpToPage(Math.max(0, page - 1)), 600); return () => clearTimeout(t); }, [page]);

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-[#0a0a0a] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-100 dark:border-white/10 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">Página {page} — trecho citado</p>
            <p className="text-xs italic text-slate-600 dark:text-white/60 mt-1">"{quote}"</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-hidden">
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
            <Viewer fileUrl={proxied} plugins={[nav]} />
          </Worker>
        </div>
      </div>
    </div>
  );
}
```

> Install the plugin: `npm i @react-pdf-viewer/page-navigation@^3.12`.

- [ ] **Step 3: Typecheck + commit**

```bash
npm i @react-pdf-viewer/page-navigation@^3.12
npx tsc --noEmit
git add app/workstation/student/omega/ActivityThread.tsx app/workstation/student/omega/PdfViewerModal.tsx package.json package-lock.json
git commit -m "feat: activity thread + pdf viewer modal (jumps to cited page)"
```

---

### Task 4.4: Module components + workspace

**Files:**
- Create: `app/workstation/student/omega/modules/ReferencesModule.tsx`
- Create: `app/workstation/student/omega/modules/InsightsModule.tsx`
- Create: `app/workstation/student/omega/modules/FilesModule.tsx`
- Create: `app/workstation/student/omega/modules/GapsModule.tsx`
- Create: `app/workstation/student/omega/OmegaScholarWorkspace.tsx`

- [ ] **Step 1: ReferencesModule** (verified evidence + download + open-at-page)

```tsx
"use client";
import { useState } from "react";
import { CheckCircle2, Download, FileText } from "lucide-react";
import PdfViewerModal from "../PdfViewerModal";
import type { EvidenceRecord, Paper } from "@/lib/scholar/types";

function locatorLabel(l?: EvidenceRecord["locator"]) {
  if (!l) return "";
  if (l.kind === "pdf") return `Página ${l.page}`;
  if (l.kind === "fulltext") return l.section ? `Seção ${l.section}` : `Parágrafo ${l.paragraph}`;
  return "Resumo";
}

export default function ReferencesModule({ references, evidence }:
  { references: Paper[]; evidence: EvidenceRecord[] }) {
  const [viewer, setViewer] = useState<{ url: string; page: number; quote: string } | null>(null);
  const byPaper = (id: string) => evidence.filter((e) => e.paperId === id && e.verified);

  return (
    <div className="space-y-3">
      {references.map((p) => (
        <div key={p.id} className="rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-slate-800 dark:text-white">{p.title}</p>
              <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">
                {p.authors.slice(0, 4).join(", ")}{p.authors.length > 4 ? " et al." : ""} · {p.venue ?? "—"} {p.year ?? ""} {p.doi ? `· doi:${p.doi}` : p.arxivId ? `· arXiv:${p.arxivId}` : ""}
              </p>
            </div>
            {p.pdfUrl && (
              <a href={`/api/ai/scholar/pdf?url=${encodeURIComponent(p.pdfUrl)}`} target="_blank" rel="noreferrer"
                 className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 dark:text-violet-400 border border-violet-300/40 rounded-full px-3 py-1.5 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                <Download size={12} /> PDF
              </a>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {byPaper(p.id).map((e, i) => (
              <div key={i} className="rounded-xl bg-black/[0.03] dark:bg-black/30 border-l-2 border-violet-500 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                    <CheckCircle2 size={10} /> VERIFICADO
                  </span>
                  <span className="text-[9px] text-slate-400">{locatorLabel(e.locator)} · confiança {e.confidence}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-white/70 mt-1.5">{e.claim}</p>
                <p className="text-[11px] italic text-slate-500 dark:text-white/50 mt-1 bg-violet-500/5 rounded-lg px-2 py-1.5">"{e.quote}"</p>
                {p.pdfUrl && e.locator?.kind === "pdf" && (
                  <button onClick={() => setViewer({ url: p.pdfUrl!, page: (e.locator as any).page, quote: e.quote })}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:underline">
                    <FileText size={11} /> ver no paper (pág. {(e.locator as any).page})
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {viewer && <PdfViewerModal pdfUrl={viewer.url} page={viewer.page} quote={viewer.quote} onClose={() => setViewer(null)} />}
    </div>
  );
}
```

- [ ] **Step 2: InsightsModule, FilesModule, GapsModule**

`InsightsModule.tsx`:
```tsx
"use client";
export default function InsightsModule({ insights }: { insights: any }) {
  if (!insights) return null;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-700 dark:text-white/80">{insights.summary}</p>
      {!!insights.trends?.length && (
        <div><p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-1">Tendências</p>
          <ul className="list-disc pl-5 text-slate-600 dark:text-white/60 text-xs space-y-1">{insights.trends.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></div>
      )}
      {!!insights.contradictions?.length && (
        <div><p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Contradições</p>
          <ul className="list-disc pl-5 text-slate-600 dark:text-white/60 text-xs space-y-1">{insights.contradictions.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></div>
      )}
    </div>
  );
}
```

`FilesModule.tsx`:
```tsx
"use client";
import { Download } from "lucide-react";
export default function FilesModule({ files }: { files: { name: string; kind: string; content: string }[] }) {
  if (!files?.length) return <p className="text-xs text-slate-400">Nenhum arquivo gerado ainda.</p>;
  const dl = (f: any) => {
    const blob = new Blob([f.content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = f.name; a.click();
  };
  return (
    <div className="space-y-2">
      {files.map((f, i) => (
        <button key={i} onClick={() => dl(f)} className="w-full flex items-center gap-2 text-left rounded-xl bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 px-3 py-2.5 hover:border-violet-400/40">
          <Download size={14} className="text-violet-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-white/80">{f.name}</span>
        </button>
      ))}
    </div>
  );
}
```

`GapsModule.tsx`:
```tsx
"use client";
export default function GapsModule({ gaps }: { gaps: any }) {
  if (!gaps) return null;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-700 dark:text-white/80">{gaps.description}</p>
      {!!gaps.rqCards?.length && (
        <div className="space-y-2">
          {gaps.rqCards.map((c: string, i: number) => (
            <div key={i} className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-3 text-xs text-slate-700 dark:text-white/70">◎ {c}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: OmegaScholarWorkspace** (the redesigned Comunidade content)

```tsx
"use client";
import { useEffect, useState } from "react";
import { BookMarked, Lightbulb, FolderOpen, Target } from "lucide-react";
import { useOmegaScholar } from "./OmegaScholarContext";
import ActivityThread from "./ActivityThread";
import ReferencesModule from "./modules/ReferencesModule";
import InsightsModule from "./modules/InsightsModule";
import FilesModule from "./modules/FilesModule";
import GapsModule from "./modules/GapsModule";

const TABS = [
  { id: "refs", label: "Referências", icon: BookMarked },
  { id: "insights", label: "Insights & Síntese", icon: Lightbulb },
  { id: "files", label: "Arquivos", icon: FolderOpen },
  { id: "gaps", label: "Lacunas / RQ", icon: Target },
];

export default function OmegaScholarWorkspace() {
  const { session, status } = useOmegaScholar();
  const [mod, setMod] = useState("refs");
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/ai/scholar/sessions").then((r) => r.json()).then((d) => setHistory(d.sessions ?? [])).catch(() => {});
  }, [status]);

  const s = session;
  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6">
      <ActivityThread />

      {status === "idle" && (
        <div className="text-center text-slate-400 dark:text-white/30 text-sm py-16">
          Faça uma pergunta na barra do Omega Scholar acima — os resultados aparecem aqui. 🎓
        </div>
      )}

      {s && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {TABS.map((t) => {
              const Icon = t.icon; const on = mod === t.id;
              const count = t.id === "refs" ? s.references?.length : undefined;
              return (
                <button key={t.id} onClick={() => setMod(t.id)}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border transition ${on ? "bg-violet-600 text-white border-violet-600" : "text-slate-500 dark:text-white/50 border-black/10 dark:border-white/10 hover:border-violet-400/40"}`}>
                  <Icon size={13} /> {t.label}{count != null ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>
          {mod === "refs" && <ReferencesModule references={s.references ?? []} evidence={s.evidence ?? []} />}
          {mod === "insights" && <InsightsModule insights={s.insights} />}
          {mod === "files" && <FilesModule files={s.files ?? []} />}
          {mod === "gaps" && <GapsModule gaps={s.gaps} />}
        </>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Pesquisas anteriores</p>
          <div className="flex gap-2 flex-wrap">
            {history.map((h) => (
              <span key={h.id} className="text-[11px] text-slate-500 dark:text-white/50 bg-black/[0.03] dark:bg-white/5 rounded-full px-3 py-1.5">{h.query}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

> Polish pass: run the `frontend-design` skill over `OmegaScholarWorkspace` + modules to refine spacing, motion, empty states. Logic/props above must stay intact.

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add app/workstation/student/omega/modules app/workstation/student/omega/OmegaScholarWorkspace.tsx
git commit -m "feat: Omega Scholar workspace + module components"
```

---

### Task 4.5: Wire into StudyRoomContent + research-lab page

**Files:**
- Modify: `app/workstation/student/StudyRoomContent.tsx`
- Modify: `app/research-lab/page.tsx`

- [ ] **Step 1: StudyRoomContent — imports + provider wrapper**

At the top of `app/workstation/student/StudyRoomContent.tsx`, add imports:
```tsx
import { OmegaScholarProvider } from "./omega/OmegaScholarContext";
import OmegaScholarBar from "./omega/OmegaScholarBar";
import OmegaScholarWorkspace from "./omega/OmegaScholarWorkspace";
```

- [ ] **Step 2: Replace the room header with the bar, wrap in provider, swap community tab**

In the returned JSX of `StudyRoomContent` (currently lines ~263-377):
- Wrap the whole returned tree in `<OmegaScholarProvider room={room} onStart={() => setActiveTab("community")}> … </OmegaScholarProvider>`.
- **Delete** the "ROOM HEADER" block (the `<div className="mx-6 mt-6 p-5 rounded-[2rem] ...">` … `</div>` containing `GraduationCap` + `meta.name`, lines ~267-282) and put `<OmegaScholarBar />` in its place.
- In the content area, where it renders `<ActiveComponent />`, special-case the community tab:

```tsx
{activeTab === "community" ? (
  <OmegaScholarWorkspace />
) : !ActiveComponent ? (
  <NoRoomFound />
) : (
  <AnimatePresence mode="wait">
    {/* …existing motion.div + Suspense + <ActiveComponent /> unchanged… */}
  </AnimatePresence>
)}
```

Keep the tab bar, indicator, and all other tabs exactly as-is.

- [ ] **Step 3: research-lab page — hide the page title on the sala-de-estudos tab**

In `app/research-lab/page.tsx` (the CABEÇALHO block, ~lines 1158-1167), wrap the title `<div>` so it does not render for this tab:
```tsx
{activeTab !== "sala-de-estudos" && (
  <div>
    <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
      {tabMeta.title}
    </h1>
    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
      {tabMeta.subtitle}
    </p>
  </div>
)}
```
(Leave the rest of the header row untouched.)

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/workstation/student/StudyRoomContent.tsx app/research-lab/page.tsx
git commit -m "feat: wire Omega Scholar bar + workspace into Sala de Estudos"
```

---

## Phase 5 — Verification

### Task 5.1: Full test + build

- [ ] **Step 1: Run the full unit suite**

Run: `npm test`
Expected: ALL of these pass, zero failures:
- `lib/scholar/normalize.test.ts`
- `lib/scholar/verify.test.ts` (incl. `verifyEvidence` batch anti-hallucination)
- `lib/scholar/dedup.test.ts`
- `lib/scholar/pdf.test.ts`
- `lib/scholar/ssrf.test.ts`
- `lib/scholar/sources/parsers.test.ts`
- `lib/scholar/assemble.test.ts`

If any fail, fix the implementation (the test is the spec) before proceeding.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "test: green unit suite + clean build for Omega Scholar"
```

---

### Task 5.2: Manual end-to-end (real APIs)

> Requires `GOOGLE_CREDENTIALS` (already used by agent-search) and `UNPAYWALL_EMAIL` in `.env.local`.

- [ ] **Step 1: Start dev server**

Run: `npm run dev` (uses `node server.js`).

- [ ] **Step 2: Drive the flow** (use the `run`/`verify` skill or a browser)
  - Go to `/research-lab`, open the **Sala de Estudos** tab.
  - Confirm the page `<h1>` title is gone and the **Omega Scholar bar** sits at the top with the beca icon.
  - Submit: `mecanismos de atenção em transformers`.
  - Confirm it auto-switches to **Comunidade** and shows the friendly progress thread (searching → dedup → synthesizing → verifying).
  - Confirm **Referências** lists real papers; each verified claim shows a **✓ VERIFICADO** badge + locator.
  - Click **"ver no paper (pág. N)"** on a PDF-backed claim → the PDF opens at that page; confirm the quoted sentence is actually there.
  - Click **PDF** download → the paper downloads.
  - Reload the page → the session appears under "Pesquisas anteriores".

- [ ] **Step 2b: Anti-hallucination spot check**
  - In the Referências list, every displayed claim must have a verified quote. There must be **no** claim shown as fact without a quote+locator. (Dropped/unverified claims are not rendered.)

- [ ] **Step 3: Record results**

Note any failures (source returning 0, PDF that won't parse, page mis-jump) and fix in a follow-up commit. Abstract-only papers should be labeled "Resumo" — that is expected, not a bug.

---

### Task 5.3: PR gate (do NOT open the PR until this passes)

> User requirement: **no PR without all needed tests.** This task is a hard gate.

- [ ] **Step 1: Confirm every logic module has a test**

Run: `ls lib/scholar/*.test.ts lib/scholar/sources/*.test.ts`
Expected to list: `normalize`, `verify`, `dedup`, `pdf`, `ssrf`, `assemble`, and `sources/parsers`. If a pure-logic module lacks a test, write it before opening the PR.

- [ ] **Step 2: Green suite + clean build, captured**

Run: `npm test && npm run build`
Expected: tests all pass AND build succeeds. Do not proceed if either fails.

- [ ] **Step 3: Only now open the PR**

Use the `superpowers:finishing-a-development-branch` skill. The PR body must paste the `npm test` summary (counts of passing test files/assertions) and confirm the Phase 5.2 manual checks were done. If the suite is red or incomplete, the PR is not ready — fix first.

---

## Self-review notes (spec coverage)

- §1 vital rule → Tasks 1.3 (verify), 3.1 (verification pass), 4.4 (only verified rendered), 5.2 (anti-hallucination check). ✔
- Layout A bar replacing title + header → 4.2, 4.5. ✔
- Comunidade = workspace (globe removed) → 4.4, 4.5 step 2. ✔
- Claude-Code-style friendly thread → 2.3 (tone), 3.1 (messages), 4.3. ✔
- DB persistence → 0.3, 3.1, 3.2. ✔
- Sources (S2/OpenAlex/arXiv/CrossRef + Unpaywall/CORE/EuropePMC) → 2.1, 2.2. ✔
- PDF proof: page locators + download + open-at-page → 1.5, 2.2, 3.3, 4.3, 4.4. ✔
- SSRF-guarded proxy → 1.6, 3.3. ✔
- All four modules → 4.4. ✔
- Tests (all needed, PR-gated) → Phase 1 (normalize/verify/dedup/pdf/ssrf), 2.6 (parsers), 2.7 (assemble/anti-hallucination batch), 5.1 (full suite), 5.3 (PR gate — no PR until green). ✔

## Test inventory (the "all needed tests" the user asked for)

| Module | Test file | Key guarantees |
|--------|-----------|----------------|
| `normalize.ts` | `normalize.test.ts` | casing/whitespace/de-hyphenation/quotes; title overlap |
| `verify.ts` | `verify.test.ts` | exact/fuzzy match; page vs abstract locator; **rejects fabricated quotes**; `verifyEvidence` batch |
| `dedup.ts` | `dedup.test.ts` | DOI + title merge; richer-record win; distinct kept |
| `pdf.ts` | `pdf.test.ts` | paragraph split; **per-page attribution** |
| `ssrf.ts` | `ssrf.test.ts` | scheme/localhost/private-IP rejection |
| sources | `sources/parsers.test.ts` | S2/OpenAlex/arXiv/CrossRef/EuropePMC parsing; abstract reconstruction |
| `assemble.ts` | `assemble.test.ts` | **only verified evidence kept**; cited-only references; file generation |

> The Gemini calls (`synthesize.ts`, `gemini.ts`), network wrappers, and routes are exercised in the Phase 5.2 live run, not unit-tested (they are thin I/O over the tested pure core).
```
