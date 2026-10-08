import { describe, expect, it } from "vitest";
import { CAMBIO, LOOPS_MOTO, SINTESE_MOTO, cambioNeutro, eventosDaMoto, mixDaMoto, passoCambio, setaAcesa, somMotoParada, type EstadoSomMoto } from "./somMoto";
import { PILOTAGEM, motoParada, passoMotoSub } from "./motoFisica";
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
  it("os LOOPS emendam sem clique: o salto do fim pro começo é do tamanho de um passo TÍPICO (não um estalo)", () => {
    for (const l of LOOPS_MOTO) {
      const x = SINTESE_MOTO[l](sr);
      let soma = 0; for (let i = 1; i < x.length; i++) soma += Math.abs(x[i]! - x[i - 1]!);
      // a CURVATURA na emenda (2ª diferença: último → 1º → 2º) tem que ser do tamanho das do meio do sinal: um estalo é
      // um salto que quebra a continuidade; a subida íngreme natural do dente de serra, não
      const n = x.length, curv = (i: number, j: number, k: number) => Math.abs(x[k]! - 2 * x[j]! + x[i]!);
      let maxMeio = 0; for (let i = 1; i < n - 1; i++) maxMeio = Math.max(maxMeio, curv(i - 1, i, i + 1));
      expect(curv(n - 1, 0, 1), l).toBeLessThan(maxMeio * 1.05 + 1e-6);
      expect(curv(n - 2, n - 1, 0), l).toBeLessThan(maxMeio * 1.05 + 1e-6);
      expect(soma).toBeGreaterThan(0);
    }
  });
  it("one-shots terminam em silêncio (sem estalo no fim)", () => {
    for (const n of ["moto-partida", "moto-desliga", "moto-boost", "moto-freio", "moto-decola", "moto-pouso", "moto-troca", "moto-estalo"] as const) {
      const x = SINTESE_MOTO[n](sr); expect(Math.abs(x[x.length - 1]!), n).toBeLessThan(0.01);
    }
  });
});

describe("estágios da moto (mix e eventos)", () => {
  const no = (o: Partial<EstadoSomMoto>): EstadoSomMoto => ({ ...somMotoParada, montada: true, ...o });
  it("parada no chão = o motor em LENTA; no ar o MOTOR sobe de tom com a velocidade; vento só rápido; turbina só no boost", () => {
    const chao = mixDaMoto(no({})), devagar = mixDaMoto(no({ voando: true, vel: 0.1 })), rapido = mixDaMoto(no({ voando: true, vel: 1 })), boost = mixDaMoto(no({ voando: true, vel: 1.6, boost: true }));
    expect(chao["moto-motor"].vol).toBeGreaterThan(0.3); expect(chao["moto-motor"].taxa).toBeLessThan(devagar["moto-motor"].taxa);   // a lenta é o motor em rotação baixa
    expect(Object.keys(chao)).toEqual(["moto-motor", "moto-motor-alto", "moto-vento", "moto-turbina"]);   // o motor = grave + agudo (mesma afinação)
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
    expect(eventosDaMoto(no({ voando: true, seta: 0 }), no({ voando: true, seta: 1 }))).toEqual([]);   // o pisca não faz barulho (era o "tik tik")
    expect(eventosDaMoto(no({ voando: true, vel: 0.1 }), no({ voando: true, vel: 0.1, acel: -1 }))).toEqual([]);   // freada devagar: sem chiado
  });
  it("pisca: só com o guidão virado, pro lado certo, piscando a 1,5 Hz", () => {
    expect(setaAcesa(0.1, 0.1)).toBe(0);
    expect(setaAcesa(1, 0.1)).toBe(1); expect(setaAcesa(1, 0.5)).toBe(0); expect(setaAcesa(-1, 0.1)).toBe(-1);
  });
});

describe("câmbio (o tom do motor NÃO vai direto pro teto)", () => {
  /** acelera tudo a 60 fps e anota cada troca e a rotação por segundo */
  const acelerar = (seg: number, boostDepois = Infinity) => {
    let s = motoParada(300, 20, 300, 0), c = cambioNeutro(); const trocas: { t: number; antes: number; depois: number }[] = [], rpm: number[] = [];
    for (let i = 1; i <= seg * 60; i++) {
      const t = i / 60; s = passoMotoSub(s, { acel: 1, giro: 0, subir: false, descer: false, boost: t > boostDepois }, 1 / 60).s;
      const antes = c.rpm, m = c.marcha; c = passoCambio(c, { voando: true, vel: Math.hypot(s.vx, s.vz) / PILOTAGEM.vel, acel: 1, boost: s.boost }, 1 / 60);
      if (c.marcha > m) trocas.push({ t, antes, depois: 0 });
      if (trocas.length && trocas.at(-1)!.depois === 0 && t - trocas.at(-1)!.t > 0.25) trocas.at(-1)!.depois = c.rpm;
      if (i % 60 === 0) rpm.push(c.rpm);
    }
    return { trocas, rpm, c };
  };
  it("acelerando tudo, passa da 1ª à 5ª em ~3,5 s — uma troca por vez, espaçadas (não sobe tudo em 2 s)", () => {
    const { trocas, c } = acelerar(8);
    expect(trocas.length).toBe(4); expect(c.marcha).toBe(4);
    expect(trocas[0]!.t).toBeGreaterThan(0.4); expect(trocas[3]!.t).toBeGreaterThan(2.8);
    for (let i = 1; i < trocas.length; i++) expect(trocas[i]!.t - trocas[i - 1]!.t).toBeGreaterThan(0.5);
  });
  it("na troca a rotação CAI (perto do corte → bem abaixo) e volta a subir", () => {
    for (const tr of acelerar(8).trocas) { expect(tr.antes).toBeGreaterThan(0.85); expect(tr.depois).toBeLessThan(tr.antes - 0.05); }
  });
  it("no cruzeiro o motor fica abaixo do corte (a 5ª é longa); o boost engata a 6ª", () => {
    const cruzeiro = acelerar(8);
    expect(cruzeiro.c.rpm).toBeLessThan(0.95); expect(cruzeiro.c.rpm).toBeGreaterThan(0.75);
    expect(acelerar(10, 7).c.marcha).toBe(5);
  });
  it("no chão: marcha lenta (e o acelerador só ronca); freando, reduz", () => {
    let c = cambioNeutro(); for (let i = 0; i < 60; i++) c = passoCambio(c, { voando: false, vel: 0, acel: 0, boost: false }, 1 / 60);
    expect(c.rpm).toBeCloseTo(CAMBIO.lenta, 2); expect(c.marcha).toBe(0);
    let r = { ...cambioNeutro(), marcha: 4, rpm: 0.9 }; for (let i = 0; i < 120; i++) r = passoCambio(r, { voando: true, vel: 0.2, acel: -1, boost: false }, 1 / 60);
    expect(r.marcha).toBeLessThanOrEqual(1);
  });
  it("eventos: subir de marcha dá o 'tec' da troca; aliviar em giro alto dá os estalos", () => {
    const no = (o: Partial<EstadoSomMoto>): EstadoSomMoto => ({ ...somMotoParada, montada: true, voando: true, ...o });
    expect(eventosDaMoto(no({ marcha: 1, acel: 1 }), no({ marcha: 2, acel: 1 }))).toEqual(["moto-troca"]);
    expect(eventosDaMoto(no({ acel: 1, rpm: 0.9 }), no({ acel: 0, rpm: 0.9 }))).toEqual(["moto-estalo"]);
    expect(eventosDaMoto(no({ acel: 1, rpm: 0.3 }), no({ acel: 0, rpm: 0.3 }))).toEqual([]);
  });
  it("a afinação segue a ROTAÇÃO (o grave domina embaixo, o agudo em cima e com o acelerador)", () => {
    const m = (rpm: number, acel = 1) => mixDaMoto({ ...somMotoParada, montada: true, voando: true, vel: 0.5, acel, rpm });
    expect(m(0.9)["moto-motor"].taxa).toBeGreaterThan(m(0.4)["moto-motor"].taxa + 0.4);
    expect(m(0.9)["moto-motor"].taxa).toBe(m(0.9)["moto-motor-alto"].taxa);
    expect(m(0.9)["moto-motor-alto"].vol).toBeGreaterThan(m(0.3)["moto-motor-alto"].vol * 3);
    expect(m(0.9, 0)["moto-motor-alto"].vol).toBeLessThan(m(0.9, 1)["moto-motor-alto"].vol);
    expect(m(1)["moto-motor"].taxa).toBeLessThan(1.75);   // o teto do tom (antes passava de 2)
  });
});
