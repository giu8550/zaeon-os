import { describe, it, expect } from "vitest";
import { BOLSAS_BRASIL, getBolsaInfo, bolsaRange } from "./bolsas-brasil";
import { LEVELS } from "./levels";

describe("bolsas-brasil dataset", () => {
  it("cobre os 4 níveis", () => {
    for (const l of LEVELS) expect(BOLSAS_BRASIL[l].level).toBe(l);
  });
  it("cada agência tem valor mensal positivo, fonte e ano", () => {
    for (const l of LEVELS)
      for (const a of BOLSAS_BRASIL[l].agencies) {
        expect(a.monthlyBRL).toBeGreaterThan(0);
        expect(a.sourceUrl).toMatch(/^https?:\/\//);
        expect(a.asOf.length).toBeGreaterThanOrEqual(4);
      }
  });
  it("inclui FAPESP e o valor FAPESP é >= federal em todo nível", () => {
    for (const l of LEVELS) {
      const fap = BOLSAS_BRASIL[l].agencies.find((a) => a.name === "FAPESP");
      const fed = BOLSAS_BRASIL[l].agencies.find((a) => a.name !== "FAPESP");
      expect(fap).toBeTruthy();
      expect(fap!.monthlyBRL).toBeGreaterThanOrEqual(fed!.monthlyBRL);
    }
  });
  it("bolsaRange entrega reference (federal) <= max (FAPESP)", () => {
    const r = bolsaRange("phd");
    expect(r.reference).toBe(3100);
    expect(r.max).toBe(7140);
    expect(r.min).toBeLessThanOrEqual(r.reference);
  });
  it("getBolsaInfo devolve o programa correto", () => {
    expect(getBolsaInfo("postdoc").programLabel).toMatch(/Pós-Doutorado/);
  });
});
