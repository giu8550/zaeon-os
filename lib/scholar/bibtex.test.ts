import { describe, it, expect } from "vitest";
import { bibKey, manualBibtex } from "./bibtex";
import type { Paper } from "./types";

const mk = (o: Partial<Paper>): Paper => ({ id: "doi:10.1/x", title: "T", authors: ["Ashish Vaswani"], openAccess: true, sources: ["arxiv"], ...o });

describe("bibKey", () => {
  it("uses last name + year", () => {
    expect(bibKey(mk({ authors: ["Ashish Vaswani"], year: 2017 }))).toBe("vaswani2017");
  });
});

describe("manualBibtex", () => {
  it("emits only present fields, never invented ones, with doi", () => {
    const bib = manualBibtex(mk({ title: "Attention Is All You Need", authors: ["Ashish Vaswani", "Noam Shazeer"], year: 2017, venue: "NeurIPS", doi: "10.5555/x" }));
    expect(bib).toContain("@article{vaswani2017,");
    expect(bib).toContain("title={Attention Is All You Need}");
    expect(bib).toContain("author={Ashish Vaswani and Noam Shazeer}");
    expect(bib).toContain("doi={10.5555/x}");
    expect(bib).not.toContain("volume");
    expect(bib).not.toContain("pages");
  });
  it("uses misc + eprint for arXiv-only papers", () => {
    const bib = manualBibtex(mk({ id: "arxiv:1706.03762", title: "X", authors: ["A B"], year: 2017, doi: undefined, arxivId: "1706.03762" }));
    expect(bib).toContain("@misc{");
    expect(bib).toContain("eprint={1706.03762}");
  });
});
