import { describe, expect, it } from "vitest";
import { LOOPS_MOTO, SINTESE_MOTO, eventosDaMoto, mixDaMoto, setaAcesa, somMotoParada, type EstadoSomMoto } from "./somMoto";
import { SINTESE, SONS, SONS_ARQUIVO } from "./audio";

const sr = 22050;
const pico = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe("sons da moto (sintetizados)", () => {
  it("todos geram áudio finito, normalizado e não-mudo — e estão registrados como sintéticos (sem arquivo)", () => {
    for (const [nome, gerar] of Object.entries(SINTESE_MOTO)) {
      const x = gerar(sr);
      expect(x.length, nome).toBeGreaterThan(sr * 0.03);
      expect(x.every(Number.isFinite), nome).toBe(true);
      expect(pico(x), nome).toBeGreaterThan(0.5); expect(pico(x), nome).toBeLessThanOrEqual(0.95);
      expect(SONS[nome as keyof typeof SINTESE_MOTO].sintetico).toBe(true);
      expect(SINTESE[nome as keyof typeof SINTESE_MOTO]).toBe(gerar);
      expect(SONS_ARQUIVO).not.toContain(nome);
    }
    for (const l of LOOPS_MOTO) expect(SONS[l].loop).toBe(true);
  });
  it("os LOOPS emendam sem clique (o fim continua no começo)", () => {
    for (const l of LOOPS_MOTO) {
      const x = SINTESE_MOTO[l](sr);
      let passoMax = 0; for (let i = 1; i < x.length; i++) passoMax = Math.max(passoMax, Math.abs(x[i]! - x[i - 1]!));
      expect(Math.abs(x[0]! - x[x.length - 1]!), l).toBeLessThan(Math.max(0.05, passoMax * 1.5));
    }
  });
  it("one-shots terminam em silêncio (sem estalo no fim)", () => {
    for (const n of ["moto-partida", "moto-desliga", "moto-boost", "moto-freio", "moto-decola", "moto-pouso", "moto-seta"] as const) {
      const x = SINTESE_MOTO[n](sr); expect(Math.abs(x[x.length - 1]!), n).toBeLessThan(0.01);
    }
  });
});

describe("estágios da moto (mix e eventos)", () => {
  const no = (o: Partial<EstadoSomMoto>): EstadoSomMoto => ({ ...somMotoParada, montada: true, ...o });
  it("parada no chão = o motor em LENTA; no ar o MOTOR sobe de tom com a velocidade; vento só rápido; turbina só no boost", () => {
    const chao = mixDaMoto(no({})), devagar = mixDaMoto(no({ voando: true, vel: 0.1 })), rapido = mixDaMoto(no({ voando: true, vel: 1 })), boost = mixDaMoto(no({ voando: true, vel: 1.6, boost: true }));
    expect(chao["moto-motor"].vol).toBeGreaterThan(0.3); expect(chao["moto-motor"].taxa).toBeLessThan(devagar["moto-motor"].taxa);   // a lenta é o motor em rotação baixa
    expect(Object.keys(chao)).toEqual(["moto-motor", "moto-vento", "moto-turbina"]);   // nada de camada extra por cima do motor
    expect(rapido["moto-motor"].taxa).toBeGreaterThan(devagar["moto-motor"].taxa + 0.5);
    expect(boost["moto-motor"].taxa).toBeGreaterThan(rapido["moto-motor"].taxa);
    expect(devagar["moto-vento"].vol).toBeLessThan(0.05); expect(rapido["moto-vento"].vol).toBeGreaterThan(0.6);
    expect(rapido["moto-turbina"].vol).toBe(0); expect(boost["moto-turbina"].vol).toBe(1);
    // o acelerador puxa a rotação antes da velocidade chegar
    expect(mixDaMoto(no({ voando: true, vel: 0.2, acel: 1 }))["moto-motor"].taxa).toBeGreaterThan(devagar["moto-motor"].taxa + 0.15);
    for (const l of LOOPS_MOTO) expect(mixDaMoto(somMotoParada)[l].vol).toBe(0);   // ninguém montado: silêncio
  });
  it("eventos: partida → decola → boost → freio → pouso → desliga, e o pisca clica ao acender/apagar", () => {
    const seq: EstadoSomMoto[] = [somMotoParada, no({}), no({ voando: true }), no({ voando: true, vel: 1, acel: 1 }), no({ voando: true, vel: 1.3, acel: 1, boost: true }), no({ voando: true, vel: 0.9, acel: -1 }), no({ voando: false }), somMotoParada];
    const ev = seq.slice(1).flatMap((b, i) => eventosDaMoto(seq[i]!, b));
    expect(ev).toEqual(["moto-partida", "moto-decola", "moto-boost", "moto-freio", "moto-pouso", "moto-desliga"]);
    expect(eventosDaMoto(no({ voando: true, seta: 0 }), no({ voando: true, seta: 1 }))).toEqual(["moto-seta"]);
    expect(eventosDaMoto(no({ voando: true, vel: 0.1 }), no({ voando: true, vel: 0.1, acel: -1 }))).toEqual([]);   // freada devagar: sem chiado
  });
  it("pisca: só com o guidão virado, pro lado certo, piscando a 1,5 Hz", () => {
    expect(setaAcesa(0.1, 0.1)).toBe(0);
    expect(setaAcesa(1, 0.1)).toBe(1); expect(setaAcesa(1, 0.5)).toBe(0); expect(setaAcesa(-1, 0.1)).toBe(-1);
  });
});
