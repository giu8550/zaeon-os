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
