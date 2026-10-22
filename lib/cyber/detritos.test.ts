import { describe, expect, it } from "vitest";
import { DETRITOS, baseDoTunel, empurraoDaBatida, naZona, novoAsteroide, passoAsteroide, puxaoDaZona, tamanhoDoCampo, vaiAcertar } from "./detritos";

const bn = { x: 0, y: 0, z: 0 }, R = 140, alcance = 840, parado = { x: 0, y: 0, z: 0 };
let n = 7; const rnd = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);

describe("o campo de asteroides do caminho até o buraco negro", () => {
  it("a zona começa logo depois da boca da pista", async () => {
    const { inicioDaZona } = await import("./detritos");
    expect(inicioDaZona({ x: 8000, y: 0, z: 0 }, bn)).toBe(8000 - DETRITOS.depoisDaBoca);
  });
  it("a zona: fora / borda (k 0) / ponto doce (k 1)", () => {
    expect(naZona({ x: 900, y: 0, z: 0 }, bn, R, alcance)).toBeNull();
    expect(naZona({ x: 830, y: 0, z: 0 }, bn, R, alcance)!.k).toBeLessThan(0.05);
    const z = naZona({ x: R * DETRITOS.doce - 1, y: 0, z: 0 }, bn, R, alcance)!; expect(z.k).toBe(1); expect(z.doce).toBe(true);
  });
  it("mais denso chegando; os asteroides nascem na FRENTE (entre mim e o buraco negro), dentro do túnel, e vêm na minha direção", () => {
    expect(tamanhoDoCampo(1)).toBeGreaterThan(tamanhoDoCampo(0)); expect(tamanhoDoCampo(1, true)).toBeLessThan(tamanhoDoCampo(1));
    const eu = { x: 700, y: 0, z: 0 }, b = baseDoTunel(eu, bn);
    for (let i = 0; i < 80; i++) {
      const a = novoAsteroide(rnd, i, eu, parado, bn, 0.5, 300), rel = { x: a.p.x - eu.x, y: a.p.y - eu.y, z: a.p.z - eu.z };
      const prof = rel.x * b.f.x + rel.y * b.f.y + rel.z * b.f.z, lat = Math.hypot(rel.x - b.f.x * prof, rel.y - b.f.y * prof, rel.z - b.f.z * prof);
      expect(prof).toBeGreaterThan(0); expect(lat).toBeLessThanOrEqual(DETRITOS.tunelR + 1e-6);
      expect(a.v.x * b.f.x + a.v.y * b.f.y + a.v.z * b.f.z).toBeLessThan(0);   // (vem contra o eixo — pra mim)
    }
  });
  it("parado no meio do campo, alguém me acerta; desviando de lado os não-mirados passam", () => {
    const eu = { x: 700, y: 0, z: 0 }, b = baseDoTunel(eu, bn);
    const campo = Array.from({ length: 120 }, (_, i) => novoAsteroide(rnd, i, eu, parado, bn, 0.6, 30 + (i / 120) * 300));
    let acertos = 0;
    for (let s = 0; s < 300; s++) for (const a of campo) if (passoAsteroide(a, 1 / 60, eu, b.f).acertou) acertos++;
    expect(acertos).toBeGreaterThan(0);
  });
  it("rápido não atravessa sem acertar; o raspão conta quando passa perto", () => {
    const d = { id: 1, p: { x: 10, y: 0, z: 0 }, v: { x: -2000, y: 0, z: 0 }, r: 1, gira: parado, forma: 0 as const, mirado: false, passou: false };
    expect(passoAsteroide(d, 1 / 60, parado, { x: 1, y: 0, z: 0 }).acertou).toBe(true);
    const r = { id: 2, p: { x: 1, y: 0, z: 4 }, v: { x: -120, y: 0, z: 0 }, r: 1, gira: parado, forma: 0 as const, mirado: false, passou: false };
    expect(passoAsteroide(r, 1 / 60, parado, { x: 1, y: 0, z: 0 }).raspou).toBe(true);
  });
  it("o mirado vai me acertar (a marca); a batida empurra pra longe; o magnetismo puxa (mais forte perto)", () => {
    const eu = { x: 600, y: 0, z: 0 };
    let m = novoAsteroide(rnd, 1, eu, parado, bn, 1, 200); for (let i = 0; i < 200 && !m.mirado; i++) m = novoAsteroide(rnd, i, eu, parado, bn, 1, 200);
    expect(m.mirado).toBe(true); for (let s = 0; s < 120 && !vaiAcertar(m, eu, parado); s++) passoAsteroide(m, 1 / 60, eu, { x: -1, y: 0, z: 0 });
    expect(vaiAcertar(m, eu, parado)).toBe(true);
    const d = { id: 1, p: { x: 401, y: 0, z: 0 }, v: { x: 80, y: 0, z: 0 }, r: 2, gira: parado, forma: 0 as const, mirado: false, passou: false };
    expect(empurraoDaBatida(d, { x: 400, y: 0, z: 0 }, bn).x).toBeGreaterThan(20);
    expect(puxaoDaZona(eu, bn, 1).x).toBeLessThan(puxaoDaZona(eu, bn, 0.2).x);
  });
});
