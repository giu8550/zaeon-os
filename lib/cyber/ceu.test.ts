import { describe, expect, it } from "vitest";
import { BURACO_NEGRO, CIDADE, chaoDaNave, colisoresDaCidade, computadorPerto, computadoresLocais, foraDaIlha, mundo, noPortalEntrada, noPortalVolta, resolverCidade } from "./ceu";
import { VOO, passoVoo, type EstadoVoo } from "./voo";
import { dentroDeAlgum } from "./colisao";
import { POIS } from "./landmarks";

describe("cidade no céu", () => {
  it("fica BEEEM acima do buraco negro (flutuando nas alturas)", () => {
    expect(CIDADE.centro).toEqual({ x: BURACO_NEGRO.x, z: BURACO_NEGRO.z });
    expect(CIDADE.pisoY - CIDADE.ilhaAltura).toBeGreaterThan(BURACO_NEGRO.y + 120);   // o fundo da ilha
    expect(VOO.yMax).toBeGreaterThan(CIDADE.pisoY + 40);                              // a nave sobrevoa por cima
  });
  it("é maior que a Zaeon do chão", () => {
    const z = POIS.find((p) => p.id === "zaeon")!;
    expect(CIDADE.bordaR).toBeGreaterThan(z.nav!.bordaR * 2);
  });
  it("portal de entrada no chão, embaixo do buraco negro; portal de volta na cidade", () => {
    expect(noPortalEntrada({ x: 0, z: -110 })).toBe(true);
    expect(noPortalEntrada({ x: 0, z: 0 })).toBe(false);
    expect(noPortalVolta(mundo(CIDADE.portalVolta))).toBe(true);
    expect(noPortalVolta(mundo(CIDADE.chegada))).toBe(false);   // chegar não te manda de volta
  });
  it("a chegada, o hangar e o portal de volta ficam livres de colisores e dentro da área andável", () => {
    const cs = colisoresDaCidade();
    for (const l of [CIDADE.chegada, CIDADE.hangar, CIDADE.portalVolta]) {
      expect(dentroDeAlgum(mundo(l), cs)).toBe(false);
      expect(Math.hypot(l.x, l.z)).toBeLessThan(CIDADE.andavelR);
    }
  });
  it("andar: computadores, pilares e mesa são sólidos; não cai da borda", () => {
    const c0 = mundo(computadoresLocais()[0]!);
    const r = resolverCidade(c0);
    expect(Math.hypot(r.x - c0.x, r.z - c0.z)).toBeGreaterThanOrEqual(CIDADE.computadores.colR - 1e-6);
    const fora = resolverCidade(mundo({ x: 80, z: 0 }));
    expect(Math.hypot(fora.x - CIDADE.centro.x, fora.z - CIDADE.centro.z)).toBeLessThanOrEqual(CIDADE.andavelR + 1e-6);
  });
  it("estação de computador mais perto (pra clicar e estudar)", () => {
    const c3 = computadoresLocais()[3]!;
    const perto = mundo({ x: c3.x * 1.25, z: c3.z * 1.25 });
    expect(computadorPerto(perto)).toBe(3);
    expect(computadorPerto(mundo(CIDADE.chegada))).toBe(-1);
  });
  it("a ilha é sólida pra nave (pousa em cima; não atravessa por baixo nem pelo lado)", () => {
    const meio = { ...mundo({ x: 5, z: 0 }), y: CIDADE.pisoY - 2 };
    expect(foraDaIlha(meio).y).toBe(CIDADE.pisoY);
    const embaixo = { ...mundo({ x: 5, z: 0 }), y: CIDADE.pisoY - CIDADE.ilhaAltura + 1 };
    expect(foraDaIlha(embaixo).y).toBe(CIDADE.pisoY - CIDADE.ilhaAltura);
    expect(chaoDaNave({ ...mundo({ x: 0, z: 0 }), y: CIDADE.pisoY + 3 })).toBe(CIDADE.pisoY);
    expect(chaoDaNave({ x: 0, y: 10, z: 0 })).toBe(0);
  });
});

describe("voo da nave", () => {
  const parada: EstadoVoo = { ...mundo(CIDADE.hangar), y: CIDADE.pisoY, yaw: 0, vx: 0, vy: 0, vz: 0 };
  const voar = (s: EstadoVoo, cmd: Parameters<typeof passoVoo>[1], seg: number) => { let r = { s, pousado: true, chaoY: 0 }; for (let i = 0; i < seg * 60; i++) r = passoVoo(r.s, cmd, 1 / 60); return r; };
  it("decola do hangar, sobrevoa e pousa no chão do mapa", () => {
    const sobe = voar(parada, { wx: 0, wz: 0, subir: true, descer: false }, 2);
    expect(sobe.pousado).toBe(false); expect(sobe.s.y).toBeGreaterThan(CIDADE.pisoY + 5);
    const sai = voar(sobe.s, { wx: 0, wz: 1, subir: false, descer: false }, 5);   // vai pra +z (rumo à praça)
    expect(Math.hypot(sai.s.x - CIDADE.centro.x, sai.s.z - CIDADE.centro.z)).toBeGreaterThan(CIDADE.bordaR);
    const desce = voar(sai.s, { wx: 0, wz: 0, subir: false, descer: true }, 20);
    expect(desce.pousado).toBe(true); expect(desce.s.y).toBe(0); expect(desce.chaoY).toBe(0);
  });
  it("não sai do mapa nem passa do teto", () => {
    const r = voar({ x: 0, y: VOO.yMax - 5, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0 }, { wx: 1, wz: 0, subir: true, descer: false }, 30);
    expect(Math.hypot(r.s.x, r.s.z)).toBeLessThanOrEqual(VOO.raioMapa + 1e-6);
    expect(r.s.y).toBeLessThanOrEqual(VOO.yMax);
  });
  it("pousa de volta na cidade (hangar/piso), não atravessa a ilha", () => {
    const acima = { ...mundo({ x: 10, z: 0 }), y: CIDADE.pisoY + 20, yaw: 0, vx: 0, vy: 0, vz: 0 };
    const r = voar(acima, { wx: 0, wz: 0, subir: false, descer: true }, 5);
    expect(r.pousado).toBe(true); expect(r.s.y).toBe(CIDADE.pisoY);
  });
  it("marcos sólidos (Zaeon) desviam a nave", () => {
    const z = POIS.find((p) => p.id === "zaeon")!;
    const pilar = { x: z.x, z: z.z, r: z.nav!.bordaR, topo: z.nav!.pisoY + 8 };
    let s: EstadoVoo = { x: z.x + 30, y: 5, z: z.z, yaw: 0, vx: 0, vy: 0, vz: 0 };
    for (let i = 0; i < 400; i++) s = passoVoo(s, { wx: -1, wz: 0, subir: false, descer: false }, 1 / 60, [pilar]).s;
    expect(Math.hypot(s.x - z.x, s.z - z.z)).toBeGreaterThanOrEqual(z.nav!.bordaR - 1e-6);
  });
});
