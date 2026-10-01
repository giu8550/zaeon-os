import { describe, it, expect } from "vitest";
import { skillsParaLista } from "./skills";

describe("skillsParaLista", () => {
  it("objeto do banco → array com id", () => {
    expect(skillsParaLista({ writing: { rank: "F", current: 1, next: 5, metricName: "Papers" }, focus: { rank: "E", current: 0, next: 10 } })).toEqual([
      { id: "writing", rank: "F", current: 1, next: 5, metricName: "Papers" },
      { id: "focus", rank: "E", current: 0, next: 10 },
    ]);
  });
  it("entrada inválida → []; campos de tipo errado são descartados", () => {
    expect(skillsParaLista(null)).toEqual([]);
    expect(skillsParaLista([1, 2])).toEqual([]);
    expect(skillsParaLista("x")).toEqual([]);
    expect(skillsParaLista({ a: null, b: 3, c: { rank: 5, current: "9", next: NaN } })).toEqual([{ id: "c" }]);
  });
});
