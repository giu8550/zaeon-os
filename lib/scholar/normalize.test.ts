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
  it("returns 0 when first title has fewer than 3 tokens (short-subset guard)", () => {
    expect(titleOverlap("Networks", "Graph Neural Networks")).toBe(0);
  });
  it("returns 0 when second title has fewer than 3 tokens (short-subset guard)", () => {
    expect(titleOverlap("Graph Neural Networks", "Networks")).toBe(0);
  });
  it("returns 0 when both titles are short subsets of each other", () => {
    expect(titleOverlap("The Model", "The Transformer Model")).toBe(0);
  });
});
