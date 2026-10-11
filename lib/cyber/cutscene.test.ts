import { describe, it, expect } from "vitest";
import { misturarPose, passoPeso, planoConversa, planoTelao, poseDoPlano, seguirPose, suave, RITMO_CENA } from "./cutscene";

describe("cutscene", () => {
  it("o plano põe a câmera a `dist` do foco, no rumo `az`, olhando pro foco", () => {
    const p = poseDoPlano({ foco: { x: 10, y: 2, z: 5 }, az: 0, pitch: 0, dist: 8 });
    expect(p.pos).toEqual({ x: 10, y: 2, z: 13 });
    expect(p.olhar).toEqual({ x: 10, y: 2, z: 5 });
  });
  it("peso 0 = a câmera normal; 1 = só a cena; no meio, mistura", () => {
    const a = { pos: { x: 0, y: 0, z: 0 }, olhar: { x: 0, y: 0, z: 1 } }, b = { pos: { x: 10, y: 10, z: 10 }, olhar: { x: 5, y: 5, z: 5 } };
    expect(misturarPose(a, b, 0)).toEqual(a);
    expect(misturarPose(a, b, 1)).toEqual(b);
    expect(misturarPose(a, b, 0.5).pos.x).toBeCloseTo(5);
    expect(suave(0.25)).toBeLessThan(0.25);   // suave nas pontas
  });
  it("o peso entra em ~0,9 s e volta mais devagar — e bem devagar no fim do tutorial", () => {
    let w = 0; for (let i = 0; i < 60; i++) w = passoPeso(w, true, RITMO_CENA.entra / 60); expect(w).toBeCloseTo(1);
    let v = 1; for (let i = 0; i < 60; i++) v = passoPeso(v, false, RITMO_CENA.entra / 60); expect(v).toBeGreaterThan(0);
    let l = 1; for (let i = 0; i < 60; i++) l = passoPeso(l, false, RITMO_CENA.volta / 60, true); expect(l).toBeGreaterThan(0.5);
  });
  it("trocar de plano não pula: a pose anda suave até o novo", () => {
    const a = { pos: { x: 0, y: 0, z: 0 }, olhar: { x: 0, y: 0, z: 0 } }, b = { pos: { x: 10, y: 0, z: 0 }, olhar: { x: 10, y: 0, z: 0 } };
    const p = seguirPose(a, b, 1 / 60); expect(p.pos.x).toBeGreaterThan(0); expect(p.pos.x).toBeLessThan(1);
  });
  it("na conversa, a câmera fica do lado de quem ouve e o foco puxa pra quem fala", () => {
    const droid = { x: 0, y: 3, z: 0 }, eu = { x: 0, y: 1.8, z: 6 };
    const pl = planoConversa(droid, eu), pose = poseDoPlano(pl);
    expect(Math.hypot(pl.foco.x - droid.x, pl.foco.z - droid.z)).toBeLessThan(Math.hypot(pl.foco.x - eu.x, pl.foco.z - eu.z));
    expect(pose.pos.z).toBeGreaterThan(0);   // atrás/ao lado de quem ouve, não do outro lado do Droid
  });
  it("o telão é enquadrado de frente, longe o bastante pra caber", () => {
    const pl = planoTelao({ x: 0, z: 0, y: 14, rot: Math.PI / 2, larg: 30 });
    const p = poseDoPlano(pl);
    expect(p.pos.x).toBeGreaterThan(30); expect(Math.abs(p.pos.z)).toBeLessThan(1e-9);
  });
});
