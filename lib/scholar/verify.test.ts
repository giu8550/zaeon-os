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
