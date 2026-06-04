import { describe, it, expect } from "vitest";
import { generateSuggestion, parseSuggestion, paperToRefItem } from "./suggest";
import type { Paper } from "./types";

const mk = (over: Partial<Paper>): Paper => ({
  id: "x", title: "t", authors: [], openAccess: false, sources: ["semanticscholar"], ...over,
});

describe("parseSuggestion", () => {
  it("lê JSON válido", () => {
    const s = parseSuggestion('{"suggestion":{"type":"Pioneira","title":"T","rationale":"R","novelty_angle":"N","gap_score":0.8}}', "Exploratória");
    expect(s.type).toBe("Pioneira");
    expect(s.title).toBe("T");
    expect(s.gap_score).toBe(0.8);
  });
  it("tolera cercas markdown", () => {
    const s = parseSuggestion('```json\n{"suggestion":{"title":"X","gap_score":0.5}}\n```', "Experimental");
    expect(s.title).toBe("X");
    expect(s.type).toBe("Experimental"); // type ausente → fallback
  });
  it("JSON malformado → fallback seguro", () => {
    const s = parseSuggestion("isto não é json", "Exploratória");
    expect(s.type).toBe("Exploratória");
    expect(s.gap_score).toBe(0.5);
    expect(s.title).toBe("");
  });
  it("clampa o gap_score", () => {
    expect(parseSuggestion('{"suggestion":{"gap_score":9}}', "Pioneira").gap_score).toBe(1);
  });
});

describe("paperToRefItem", () => {
  it("classifica a fonte", () => {
    expect(paperToRefItem(mk({ sources: ["arxiv"], arxivId: "1" })).source).toBe("arXiv");
    expect(paperToRefItem(mk({ sources: ["pubmed"] })).source).toBe("PubMed");
    expect(paperToRefItem(mk({ sources: ["crossref"], doi: "10.1/x" })).source).toBe("DOI");
    expect(paperToRefItem(mk({ sources: ["openalex"] })).source).toBe("Scholar");
  });
  it("formata autores com et al.", () => {
    expect(paperToRefItem(mk({ authors: ["A", "B", "C", "D"] })).authors).toMatch(/et al\./);
  });
});

describe("generateSuggestion", () => {
  const llm = async () => '{"suggestion":{"type":"Experimental","title":"Estudo X","rationale":"R","novelty_angle":"N","gap_score":0.6}}';
  const retrieve = async () => ({
    papers: [mk({ id: "p1", sources: ["arxiv"], arxivId: "a" }), mk({ id: "p2", sources: ["pubmed"] }), mk({ id: "p3", doi: "10.1/z" })],
    perSource: [], reachedMin: false,
  });

  it("monta sugestão + referências reais + termômetro do nível", async () => {
    const r = await generateSuggestion({ topic: "tema", level: "msc" }, { llm, retrieve });
    expect(r.suggestion.title).toBe("Estudo X");
    expect(r.references.length).toBe(3);
    expect(r.references[0].source).toBe("arXiv");
    expect(r.termometro.level).toBe("msc");
    expect(r.termometro.scholarship.monthlyValueBRL).toBe(2100);
    expect(r.termometro.gapScore).toBe(0.6);
  });

  it("falha de retrieve não derruba a sugestão", async () => {
    const r = await generateSuggestion({ topic: "tema", level: "phd" }, { llm, retrieve: async () => { throw new Error("offline"); } });
    expect(r.references).toEqual([]);
    expect(r.termometro.level).toBe("phd");
    expect(r.suggestion.title).toBe("Estudo X");
  });
});
