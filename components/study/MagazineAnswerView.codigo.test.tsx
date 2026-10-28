import { describe, it, expect } from "vitest";
import { podeVirarRevista } from "./MagazineAnswerView";

describe("podeVirarRevista — bloco de código (#634)", () => {
  it("resposta longa com ``` não vira revista (o canvas desenharia o código como prosa)", () => {
    const longo = Array.from({ length: 400 }, (_, i) => `palavra${i}`).join(" ");
    expect(podeVirarRevista({ nucleo: longo } as any, false)).toBe(true);
    expect(podeVirarRevista({ nucleo: longo + "\n```py\nprint(1)\n```" } as any, false)).toBe(false);
  });
});
