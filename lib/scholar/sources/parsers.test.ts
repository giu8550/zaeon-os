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
  it("uses URL-based fallback id when DOI is absent", () => {
    const out = parseCrossref({ message: { items: [{ title: ["No DOI Here"], URL: "http://x/ch1", author: [] }] } });
    expect(out[0].id).toBe("crossref:http://x/ch1");
    expect(out[0].doi).toBeUndefined();
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
