import { describe, expect, it } from "vitest";
import { CORTES_F, CORTES_M, rostoDe } from "./rosto";

describe("rostoDe", () => {
  it("é o mesmo pro mesmo id (todo cliente vê o mesmo rosto)", () => {
    expect(rostoDe("ia-42", true)).toEqual(rostoDe("ia-42", true));
  });
  it("o corte segue o gênero", () => {
    for (let i = 0; i < 50; i++) {
      expect(CORTES_F).toContain(rostoDe(`ia-${i}`, true).corte);
      expect(CORTES_M).toContain(rostoDe(`ia-${i}`, false).corte);
    }
  });
  it("varia entre as pessoas (cortes, cabelos e peles diferentes numa multidão)", () => {
    const rs = Array.from({ length: 200 }, (_, i) => rostoDe(`ia-${i}`, i % 2 === 0));
    expect(new Set(rs.map((r) => r.corte)).size).toBe(8);
    expect(new Set(rs.map((r) => r.cabelo)).size).toBeGreaterThan(6);
    expect(new Set(rs.map((r) => r.pele)).size).toBeGreaterThan(4);
  });
});
