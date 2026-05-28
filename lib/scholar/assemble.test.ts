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
