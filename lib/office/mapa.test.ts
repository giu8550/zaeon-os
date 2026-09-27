import { describe, it, expect } from "vitest";
import { montarEscritorio, departamentoDe, porDepartamento, DEPARTAMENTOS } from "./mapa";
import { MENTOR_SEED } from "@/lib/agent/mentors";

describe("escritório como dado", () => {
  it("todo mentor do seed vira um pod — o escritório não inventa gente", () => {
    const pods = montarEscritorio();
    expect(pods.length).toBe(MENTOR_SEED.length);
    expect(new Set(pods.map((p) => p.slug)).size).toBe(MENTOR_SEED.length);
  });

  it("ninguém ocupa a mesma célula (dois pods no mesmo lugar = um some)", () => {
    const pods = montarEscritorio();
    const celulas = pods.map((p) => `${p.x},${p.z}`);
    expect(new Set(celulas).size).toBe(pods.length);
  });

  it("o centro fica livre pro ⟁", () => {
    const pods = montarEscritorio();
    expect(pods.some((p) => p.x === 0)).toBe(false);
  });

  it("a cor vem do skill DISTINTIVO, não de memory/studio que todos têm", () => {
    expect(departamentoDe({ enabledSkills: ["memory", "studio", "literature"] })).toBe(DEPARTAMENTOS.literature);
    expect(departamentoDe({ enabledSkills: ["memory", "studio", "molecule"] })).toBe(DEPARTAMENTOS.molecule);
    // só as comuns → cai no Estúdio em vez de quebrar
    expect(departamentoDe({ enabledSkills: ["memory", "studio"] })).toBe(DEPARTAMENTOS.studio);
  });

  it("agrupa por departamento e põe o maior primeiro", () => {
    const grupos = porDepartamento(montarEscritorio());
    expect(grupos.length).toBeGreaterThan(0);
    for (let i = 1; i < grupos.length; i++) {
      expect(grupos[i - 1].pods.length).toBeGreaterThanOrEqual(grupos[i].pods.length);
    }
    expect(grupos.reduce((n, g) => n + g.pods.length, 0)).toBe(MENTOR_SEED.length);
  });
});
