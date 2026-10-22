import { describe, expect, it } from "vitest";
import { DETRITOS, empurraoDaBatida, lancarDetrito, naZona, passoDetrito, puxaoDaZona, vaiAcertar } from "./detritos";

const bn = { x: 0, y: 0, z: 0 }, R = 140, alcance = 700;
let n = 7; const rnd = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);

describe("a zona dos detritos do buraco negro", () => {
  it("fora / borda (k 0) / ponto doce (k 1)", () => {
    expect(naZona({ x: 900, y: 0, z: 0 }, bn, R, alcance)).toBeNull();
    expect(naZona({ x: 830, y: 0, z: 0 }, bn, R, alcance)!.k).toBeLessThan(0.05);
    const z = naZona({ x: R * DETRITOS.doce - 1, y: 0, z: 0 }, bn, R, alcance)!; expect(z.k).toBe(1); expect(z.doce).toBe(true);
  });
  it("o detrito sai do lado do buraco negro e, parado, me ACERTA (a mira)", () => {
    const eu = { x: 600, y: 0, z: 0 }, parado = { x: 0, y: 0, z: 0 };
    let acertos = 0, total = 0;
    for (let i = 0; i < 60; i++) {
      const d = lancarDetrito(rnd, i, eu, parado, bn, 0.5);
      expect(Math.hypot(d.p.x - bn.x, d.p.z - bn.z)).toBeLessThan(600);   // (sai entre mim e o buraco negro)
      total++; for (let s = 0; s < 400; s++) { const r = passoDetrito(d, 1 / 60, eu); if (r.acertou) { acertos++; break; } if (r.morreu) break; }
    }
    expect(acertos / total).toBeGreaterThan(0.5); expect(acertos / total).toBeLessThan(0.95);   // (a maior parte mira em mim; uns erram de propósito)
  });
  it("desviando (andando de lado) dá pra escapar de quem não foi mirado no futuro", () => {
    const eu = { x: 600, y: 0, z: 0 }, d = lancarDetrito(() => 0.01, 1, eu, { x: 0, y: 0, z: 0 }, bn, 0.5);
    expect(vaiAcertar(d, eu, { x: 0, y: 0, z: 0 })).toBe(true);
    const lado = { x: 0, y: 0, z: 40 }; let acertou = false; const p = { ...eu };
    for (let s = 0; s < 400 && !acertou; s++) { p.z += lado.z / 60; const r = passoDetrito(d, 1 / 60, p); acertou = r.acertou; if (r.morreu) break; }
    expect(acertou).toBe(false);
  });
  it("rápido não atravessa sem acertar (o segmento inteiro conta)", () => {
    const d = { id: 1, p: { x: 10, y: 0, z: 0 }, v: { x: -2000, y: 0, z: 0 }, r: 1, gira: { x: 0, y: 0, z: 0 }, t: 0, vida: 9 };
    expect(passoDetrito(d, 1 / 60, { x: 0, y: 0, z: 0 }).acertou).toBe(true);
  });
  it("a batida empurra pra longe do buraco negro; o magnetismo puxa pra ele (mais forte perto)", () => {
    const eu = { x: 400, y: 0, z: 0 }, d = { id: 1, p: { x: 401, y: 0, z: 0 }, v: { x: 80, y: 0, z: 0 }, r: 2, gira: { x: 0, y: 0, z: 0 }, t: 0, vida: 9 };
    expect(empurraoDaBatida(d, eu, bn).x).toBeGreaterThan(20);
    expect(puxaoDaZona(eu, bn, 1).x).toBeLessThan(puxaoDaZona(eu, bn, 0.2).x);
  });
});
