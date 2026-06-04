import { describe, it, expect } from "vitest";
import {
  estimateResearchTime, scholarshipOutlook, publicationTarget, buildTermometro,
} from "./termometro";

describe("termometro", () => {
  it("tempo de pesquisa por nível", () => {
    expect(estimateResearchTime("grad").label).toBe("6–12 meses");
    expect(estimateResearchTime("phd").typicalMonths).toBeGreaterThan(estimateResearchTime("msc").typicalMonths);
  });
  it("outlook de bolsa do mestrado usa valor federal de referência e faixa até FAPESP", () => {
    const o = scholarshipOutlook("msc");
    expect(o.monthlyValueBRL).toBe(2100);
    expect(o.monthlyValueRangeBRL).toEqual([2100, 3450]);
    expect(o.agencies).toContain("FAPESP");
    expect(["baixa", "média", "alta"]).toContain(o.probability);
    expect(o.probabilityScore).toBeGreaterThan(0);
    expect(o.probabilityScore).toBeLessThanOrEqual(1);
  });
  it("pós-doc tem competitividade alta", () => {
    expect(scholarshipOutlook("postdoc").competitiveness).toBe("alta");
  });
  it("alvo de publicação por nível", () => {
    expect(publicationTarget("phd").qualis).toBe("Q1");
    expect(publicationTarget("grad").qualis).toMatch(/B/);
  });
  it("buildTermometro faz clamp do gapScore e rotula", () => {
    expect(buildTermometro("phd", 1.5).gapScore).toBe(1);
    expect(buildTermometro("phd", -2).gapScore).toBe(0);
    expect(buildTermometro("phd", NaN).gapScore).toBe(0);
    const t = buildTermometro("postdoc", 0.9);
    expect(t.gapLabel).toMatch(/Pioneira/);
    expect(t.level).toBe("postdoc");
    expect(t.scholarship.monthlyValueBRL).toBe(5200);
  });
});
