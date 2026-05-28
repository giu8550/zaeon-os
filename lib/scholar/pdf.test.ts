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
