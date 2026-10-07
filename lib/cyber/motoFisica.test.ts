import { describe, expect, it } from "vitest";
import { PILOTAGEM, motoParada, passoMotoSub, sensacaoDeVelocidade, type ComandoMoto, type EstadoMoto } from "./motoFisica";

const NADA: ComandoMoto = { acel: 0, giro: 0, subir: false, descer: false, boost: false };
/** no ar (longe do chão e de tudo), parada, rumo +z */
const noAr = (): EstadoMoto => motoParada(300, 120, 300, 0);
const pilotar = (s: EstadoMoto, c: Partial<ComandoMoto>, seg: number) => { for (let i = 0; i < seg * 30; i++) s = passoMotoSub(s, { ...NADA, ...c }, 1 / 30).s; return s; };
const vel = (s: EstadoMoto) => Math.hypot(s.vx, s.vz);

describe("pilotagem da moto (dirigibilidade)", () => {
  it("W acelera PRA FRENTE do rumo até a velocidade de cruzeiro (não teleporta: leva uns segundos)", () => {
    const s1 = pilotar(noAr(), { acel: 1 }, 1);
    expect(vel(s1)).toBeGreaterThan(10); expect(vel(s1)).toBeLessThan(PILOTAGEM.vel);
    const s = pilotar(noAr(), { acel: 1 }, 5);
    expect(vel(s)).toBeCloseTo(PILOTAGEM.vel, 0);
    expect(s.z - 300).toBeGreaterThan(80); expect(Math.abs(s.x - 300)).toBeLessThan(1e-6);
  });
  it("solta, PLANA perdendo velocidade aos poucos; S freia forte", () => {
    const rapido = pilotar(noAr(), { acel: 1 }, 5);
    const plana = pilotar(rapido, {}, 1), freia = pilotar(rapido, { acel: -1 }, 1);
    expect(vel(plana)).toBeGreaterThan(PILOTAGEM.vel * 0.55); expect(vel(plana)).toBeLessThan(PILOTAGEM.vel);
    expect(vel(freia)).toBeLessThan(5);
  });
  it("D vira pra DIREITA, A pra esquerda — e a curva é MAIS ABERTA quanto mais rápido", () => {
    const giro = (v0: number) => { let s = { ...noAr(), vz: v0 }; const y0 = s.yaw; s = pilotar(s, { acel: v0 > 0 ? v0 / PILOTAGEM.vel : 0, giro: 1 }, 1); return s.yaw - y0; };
    const devagar = giro(5), rapido = giro(PILOTAGEM.vel);
    expect(devagar).toBeLessThan(0); expect(rapido).toBeLessThan(0);   // direita = rumo diminui
    expect(Math.abs(rapido)).toBeLessThan(Math.abs(devagar) * 0.5);
    const curva = pilotar({ ...noAr(), vz: PILOTAGEM.vel }, { acel: 1, giro: 1 }, 3);
    expect(vel(curva)).toBeLessThanOrEqual(PILOTAGEM.vel + 0.01);   // curvar NÃO acelera (antes ganhava energia)
    expect(vel(curva)).toBeGreaterThan(PILOTAGEM.vel * 0.85);        // e nem trava: perde só um pouco
    const s = pilotar({ ...noAr(), vz: 30 }, { acel: 1, giro: 1 }, 0.8);
    expect(s.x).toBeLessThan(300);   // rumo +z, direita do piloto = −x
  });
  it("o guidão é SUTIL: um toque curto mal muda o rumo", () => {
    const s = pilotar({ ...noAr(), vz: PILOTAGEM.vel }, { acel: 1, giro: 1 }, 0.1);
    expect(Math.abs(s.yaw)).toBeLessThan(0.03);
  });
  it("INCLINA pra dentro da curva com tan θ = v·ω/g, até o máximo; reta volta a ficar em pé", () => {
    const dir = pilotar({ ...noAr(), vz: PILOTAGEM.vel }, { acel: 1, giro: 1 }, 2), esq = pilotar({ ...noAr(), vz: PILOTAGEM.vel }, { acel: 1, giro: -1 }, 2);
    expect(dir.inclina).toBeGreaterThan(0.2); expect(esq.inclina).toBeLessThan(-0.2);   // direita: + (deita pra direita)
    expect(Math.abs(dir.inclina)).toBeLessThanOrEqual(PILOTAGEM.inclinaMax + 1e-9);
    expect(dir.inclina).toBeLessThan(PILOTAGEM.inclinaMax - 0.03);   // no cruzeiro não satura: sobra inclinação pro boost
    const devagar = pilotar({ ...noAr(), vz: 6 }, { acel: 6 / PILOTAGEM.vel, giro: 1 }, 2);
    expect(devagar.inclina).toBeLessThan(dir.inclina * 0.8);       // devagar deita menos
    const omega = PILOTAGEM.giroAlto, esperado = Math.min(PILOTAGEM.inclinaMax, Math.atan((vel(dir) * omega) / PILOTAGEM.g));
    expect(dir.inclina).toBeCloseTo(esperado, 1);
    expect(Math.abs(pilotar(dir, { acel: 1 }, 2).inclina)).toBeLessThan(0.05);
  });
  it("ESCORREGA um pouco na curva (sobra velocidade de lado) e a aderência puxa de volta", () => {
    const s = pilotar({ ...noAr(), vz: PILOTAGEM.vel }, { acel: 1, giro: 1 }, 1.5);
    const lado = s.vx * Math.cos(s.yaw) - s.vz * Math.sin(s.yaw);
    expect(Math.abs(lado)).toBeGreaterThan(0.3);
    const reto = pilotar(s, { acel: 1 }, 2), ladoDepois = reto.vx * Math.cos(reto.yaw) - reto.vz * Math.sin(reto.yaw);
    expect(Math.abs(ladoDepois)).toBeLessThan(Math.abs(lado) * 0.2);
  });
  it("BOOST passa do cruzeiro, esvazia o tanque, apaga sozinho e recarrega", () => {
    let s = pilotar(noAr(), { acel: 1 }, 4);
    s = pilotar(s, { acel: 1, boost: true }, 2);
    expect(s.boost).toBe(true); expect(vel(s)).toBeGreaterThan(PILOTAGEM.vel + 15); expect(s.tanque).toBeLessThan(0.5);
    s = pilotar(s, { acel: 1, boost: true }, 2);
    expect(s.boost).toBe(false); expect(s.tanque).toBeLessThan(PILOTAGEM.boost.minimo);   // acabou: apaga
    s = pilotar(s, { acel: 1 }, 4);
    expect(vel(s)).toBeLessThan(PILOTAGEM.vel + 2);   // volta pro cruzeiro
    expect(s.tanque).toBeGreaterThan(0.7);
    expect(sensacaoDeVelocidade(s)).toBeGreaterThan(0.5);
  });
  it("parada não dá boost; no chão não anda (decola primeiro) mas o guidão gira ela no lugar", () => {
    expect(pilotar(noAr(), { boost: true }, 1).boost).toBe(false);
    const chao = motoParada(300, 0, 300, 0), s = pilotar(chao, { acel: 1, giro: 1 }, 1);
    expect(Math.hypot(s.x - 300, s.z - 300)).toBeLessThan(0.01);
    expect(s.yaw).toBeLessThan(-0.3);
    const sobe = pilotar(chao, { subir: true }, 1); expect(sobe.y).toBeGreaterThan(5);
  });
  it("o rumo NÃO depende de pra onde a câmera olha (W é sempre a frente da moto)", () => {
    const s = pilotar(motoParada(300, 120, 300, Math.PI / 2), { acel: 1 }, 3);
    expect(s.x - 300).toBeGreaterThan(30); expect(Math.abs(s.z - 300)).toBeLessThan(1e-6);
  });
});
