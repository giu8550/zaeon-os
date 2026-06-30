import { describe, it, expect } from "vitest";
import { buildQuestionBlock } from "@/lib/aulas/generateParse";

describe("buildQuestionBlock fill", () => {
  it("cloze: usa o texto marcado", () => {
    const b = buildQuestionBlock(JSON.stringify({ text: "A *fotossíntese* ocorre.", marks: 3 }), "q-cloze");
    expect(b).toMatchObject({ type: "cloze", config: { text: "A *fotossíntese* ocorre." }, marks: 3 });
  });
  it("cloze sem marcador → null", () => {
    expect(buildQuestionBlock(JSON.stringify({ text: "sem lacuna" }), "q-cloze")).toBeNull();
  });
  it("dragwords: sentence + words", () => {
    const b = buildQuestionBlock(JSON.stringify({ sentence: "O *gato*.", words: ["cão"] }), "q-dragwords");
    expect(b).toMatchObject({ type: "dragwords", config: { sentence: "O *gato*.", words: ["cão"] } });
  });
});
