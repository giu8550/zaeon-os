import { describe, it, expect } from "vitest";
import { AURA, levelFromAura, NIVEIS, auraPorCredencial, AURA_NIVEL, AURA_VINCULO, maiorNivel, dentroDoCapDiario, seloDoMetodo, isNivelAcademico, isMetodo } from "./rules";

describe("rules · pesos", () => {
  it("validado ≫ aplicado ≫ aprendido; cérebro é bônus", () => {
    expect(AURA.node_learned).toBeLessThan(AURA.node_applied);
    expect(AURA.node_applied).toBeLessThan(AURA.node_validated);
    expect(AURA.node_validated).toBeLessThan(AURA.brain_completed);
    expect(AURA).toEqual({ node_learned: 5, node_applied: 15, node_validated: 50, brain_completed: 200 });
  });
  it("cap diário só nas fontes de baixo rigor", () => {
    expect(dentroDoCapDiario("node_learned", 19)).toBe(true);
    expect(dentroDoCapDiario("node_learned", 20)).toBe(false);
    expect(dentroDoCapDiario("node_validated", 999)).toBe(true);
  });
});

describe("rules · levelFromAura (bordas)", () => {
  it("limiares", () => {
    expect(levelFromAura(0)).toMatchObject({ level: 1, titulo: "Iniciante", prox: 150 });
    expect(levelFromAura(149)).toMatchObject({ level: 1, prox: 1 });
    expect(levelFromAura(150)).toMatchObject({ level: 2, titulo: "Aprendiz", prox: 250 });
    expect(levelFromAura(400)).toMatchObject({ level: 3 });
    expect(levelFromAura(899)).toMatchObject({ level: 3 });
    expect(levelFromAura(900)).toMatchObject({ level: 4, titulo: "Especialista" });
    expect(levelFromAura(1800)).toMatchObject({ level: 5 });
    expect(levelFromAura(10_000)).toMatchObject({ level: NIVEIS.length, prox: null, proxMin: null });
  });
  it("entrada suja → nível 1", () => {
    expect(levelFromAura(-5).level).toBe(1);
    expect(levelFromAura(NaN).level).toBe(1);
    expect(levelFromAura(149.9).level).toBe(1);
  });
});

describe("rules · credencial acadêmica", () => {
  it("nível maior = AURA maior", () => {
    const v = ["tecnico", "graduacao", "especializacao", "mestrado", "doutorado", "posdoc"].map((n) => AURA_NIVEL[n as keyof typeof AURA_NIVEL]);
    for (let i = 1; i < v.length; i++) expect(v[i]!).toBeGreaterThan(v[i - 1]!);
  });
  it("método é portão: declarado 0, edu_email fixo, doc_review/registry/onchain base cheia", () => {
    expect(auraPorCredencial("mestrado", "declarado")).toBe(0);
    expect(auraPorCredencial("mestrado", "edu_email")).toBe(AURA_VINCULO);
    expect(auraPorCredencial("mestrado", "doc_review")).toBe(350);
    expect(auraPorCredencial("doutorado", "registry")).toBe(600);
    expect(auraPorCredencial("posdoc", "onchain")).toBe(800);
    expect(seloDoMetodo("declarado")).toBe("nenhum");
    expect(seloDoMetodo("doc_review")).toBe("verificado");
    expect(seloDoMetodo("registry")).toBe("ouro");
  });
  it("maiorNivel e validadores", () => {
    expect(maiorNivel(["graduacao", "doutorado", "mestrado"])).toBe("doutorado");
    expect(maiorNivel([])).toBeNull();
    expect(isNivelAcademico("posdoc")).toBe(true);
    expect(isNivelAcademico("phd")).toBe(false);
    expect(isMetodo("doc_review")).toBe(true);
    expect(isMetodo("x")).toBe(false);
  });
});
