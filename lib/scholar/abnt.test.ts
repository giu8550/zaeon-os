import { describe, it, expect } from "vitest";
import { formatAbntAuthor, formatAbntAuthors, formatAbntReference } from "./abnt";
import type { Paper } from "./types";
const P = (o: Partial<Paper>): Paper => ({ id:"x", title:"T", authors:[], openAccess:false, sources:["x"], ...o });

describe("formatAbntAuthor", () => {
  it("Given Family -> SURNAME, Given", () => {
    expect(formatAbntAuthor("Ashish Vaswani")).toBe("VASWANI, Ashish");
    expect(formatAbntAuthor("Ada Lovelace")).toBe("LOVELACE, Ada");
  });
  it("PubMed 'Family Initials' -> SURNAME, Initials", () => {
    expect(formatAbntAuthor("Doudna J")).toBe("DOUDNA, J");
    expect(formatAbntAuthor("Charpentier E")).toBe("CHARPENTIER, E");
  });
  it("single token", () => { expect(formatAbntAuthor("Aristoteles")).toBe("ARISTOTELES"); });
});

describe("formatAbntAuthors", () => {
  it("joins up to 3 with ;", () => {
    expect(formatAbntAuthors(["Ashish Vaswani","Noam Shazeer"])).toBe("VASWANI, Ashish; SHAZEER, Noam");
  });
  it(">3 -> first + et al.", () => {
    expect(formatAbntAuthors(["A B","C D","E F","G H"])).toBe("B, A et al.");
  });
  it("empty -> ''", () => { expect(formatAbntAuthors([])).toBe(""); });
});

describe("formatAbntReference", () => {
  it("article with venue, doi", () => {
    expect(formatAbntReference(P({ authors:["Ashish Vaswani","Noam Shazeer"], title:"Attention Is All You Need", venue:"NeurIPS", year:2017, doi:"10.5555/abc" })))
      .toBe("VASWANI, Ashish; SHAZEER, Noam. Attention Is All You Need. NeurIPS, 2017. DOI: 10.5555/abc.");
  });
  it("no venue, url, no doi -> Disponível em", () => {
    expect(formatAbntReference(P({ authors:["Ada Lovelace"], title:"Notes", year:1843, url:"http://x" })))
      .toBe("LOVELACE, Ada. Notes. 1843. Disponível em: http://x.");
  });
  it("no year -> [s. d.]", () => {
    expect(formatAbntReference(P({ authors:["Ada Lovelace"], title:"X", venue:"J" }))).toContain("[s. d.]");
  });
  it("strips trailing period in title (no double period)", () => {
    expect(formatAbntReference(P({ authors:["Ada Lovelace"], title:"Title.", venue:"J", year:2020 })))
      .toBe("LOVELACE, Ada. Title. J, 2020.");
  });
});
