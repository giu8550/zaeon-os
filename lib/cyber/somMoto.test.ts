import { describe, expect, it } from "vitest";
import { CAMBIO, FAIXAS_MOTOR, LOOPS_MOTO, SINTESE_MOTO, cambioNeutro, eventosDaMoto, freqDoMotor, mixDaMoto, passoCambio, setaAcesa, somMotoParada, type EstadoSomMoto } from "./somMoto";
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
    for (const n of ["moto-partida", "moto-desliga", "moto-boost", "moto-freio", "moto-decola", "moto-pouso", "moto-troca", "moto-estalo", "moto-estrondo"] as const) {
      const x = SINTESE_MOTO[n](sr); expect(Math.abs(x[x.length - 1]!), n).toBeLessThan(0.01);
    }
  });
});

describe("estágios da moto (mix e eventos)", () => {
  const no = (o: Partial<EstadoSomMoto>): EstadoSomMoto => ({ ...somMotoParada, montada: true, ...o });
  /** a frequência que SOA (a faixa mais alta de volume, na afinação dela) */
  const soa = (e: EstadoSomMoto) => { const m = mixDaMoto(e); const n = (Object.keys(FAIXAS_MOTOR) as (keyof typeof FAIXAS_MOTOR)[]).reduce((a, b) => (m[b].vol > m[a].vol ? b : a)); return m[n].taxa * FAIXAS_MOTOR[n]; };
  it("parada no chão = a LENTA grossa (a faixa grave); no ar o motor sobe de tom; vento só rápido; turbina só no boost", () => {
    const chao = mixDaMoto(no({})), devagar = no({ voando: true, vel: 0.1 }), rapido = no({ voando: true, vel: 1 }), boost = mixDaMoto(no({ voando: true, vel: 1.6, boost: true }));
    expect(Object.keys(chao)).toEqual(["moto-motor", "moto-motor-alto", "moto-motor-grito", "moto-vento", "moto-turbina", "moto-supersonico"]);
    expect(chao["moto-motor"].vol).toBeGreaterThan(chao["moto-motor-grito"].vol * 5);   // a lenta é o grave
    expect(soa(no({}))).toBeLessThan(70);
    expect(soa(rapido)).toBeGreaterThan(soa(devagar) * 2);
    expect(mixDaMoto(devagar)["moto-vento"].vol).toBeLessThan(0.05); expect(mixDaMoto(rapido)["moto-vento"].vol).toBeGreaterThan(0.6);
    expect(mixDaMoto(rapido)["moto-turbina"].vol).toBe(0); expect(boost["moto-turbina"].vol).toBeGreaterThan(0.5);
    expect(soa(no({ voando: true, vel: 0.2, acel: 1 }))).toBeGreaterThan(soa(devagar));   // o acelerador puxa a rotação
    for (const l of LOOPS_MOTO) expect(mixDaMoto(somMotoParada)[l].vol).toBe(0);   // ninguém montado: silêncio
  });
  it("eventos: partida → decola → boost (com o ESTRONDO: acendeu rápido) → freio → pouso → desliga", () => {
    const seq: EstadoSomMoto[] = [somMotoParada, no({}), no({ voando: true }), no({ voando: true, vel: 1, acel: 1 }), no({ voando: true, vel: 1.05, acel: 1, boost: true }), no({ voando: true, vel: 0.9, acel: -1 }), no({ voando: false }), somMotoParada];
    const ev = seq.slice(1).flatMap((b, i) => eventosDaMoto(seq[i]!, b));
    expect(ev).toEqual(["moto-partida", "moto-decola", "moto-boost", "moto-estrondo", "moto-freio", "moto-pouso", "moto-desliga"]);
    expect(eventosDaMoto(no({ voando: true, seta: 0 }), no({ voando: true, seta: 1 }))).toEqual([]);   // o pisca não faz barulho (era o "tik tik")
    expect(eventosDaMoto(no({ voando: true, vel: 0.1 }), no({ voando: true, vel: 0.1, acel: -1 }))).toEqual([]);   // freada devagar: sem chiado
  });
  it("pisca: só com o guidão virado, pro lado certo, piscando a 1,5 Hz", () => {
    expect(setaAcesa(0.1, 0.1)).toBe(0);
    expect(setaAcesa(1, 0.1)).toBe(1); expect(setaAcesa(1, 0.5)).toBe(0); expect(setaAcesa(-1, 0.1)).toBe(-1);
  });
});

describe("motor 4 em linha (S1000RR): faixas e frequência", () => {
  it("a frequência vai da lenta grossa (~40 Hz) ao GRITO (~480 Hz, ~14 mil giros), subindo o mesmo TOM por pedaço do conta-giros", () => {
    expect(freqDoMotor(CAMBIO.lenta)).toBeCloseTo(40, 3); expect(freqDoMotor(1)).toBeCloseTo(480, 3);
    expect(freqDoMotor(0.57) / freqDoMotor(CAMBIO.lenta)).toBeCloseTo(freqDoMotor(1) / freqDoMotor(0.57), 3);
  });
  it("cada faixa só estica dentro dela (sem voz de esquilo) e a que domina é a mais perto da frequência", () => {
    for (const rpm of [0.14, 0.3, 0.5, 0.7, 0.9, 1]) {
      const m = mixDaMoto({ ...somMotoParada, montada: true, voando: true, vel: 0.5, acel: 1, rpm }), f = freqDoMotor(rpm);
      const dom = (Object.keys(FAIXAS_MOTOR) as (keyof typeof FAIXAS_MOTOR)[]).reduce((a, b) => (m[b].vol > m[a].vol ? b : a));
      expect(Math.abs(Math.log2(f / FAIXAS_MOTOR[dom]))).toBeLessThan(0.9);
      expect(m[dom].taxa * FAIXAS_MOTOR[dom]).toBeCloseTo(f, 0);
    }
    const alto = (acel: number) => mixDaMoto({ ...somMotoParada, montada: true, voando: true, vel: 0.5, acel, rpm: 0.95 });
    expect(alto(0)["moto-motor-grito"].vol).toBeLessThan(alto(1)["moto-motor-grito"].vol);   // aliviar = menos grito
  });
});

describe("câmbio (o tom do motor NÃO vai direto pro teto)", () => {
  /** acelera tudo a 60 fps e anota cada troca e a rotação por segundo */
  const acelerar = (seg: number, boostDepois = Infinity) => {
    let s = motoParada(300, 20, 300, 0), c = cambioNeutro(); const trocas: { t: number; antes: number; depois: number }[] = [];
    for (let i = 1; i <= seg * 60; i++) {
      const t = i / 60; s = passoMotoSub(s, { acel: 1, giro: 0, subir: false, descer: false, boost: t > boostDepois }, 1 / 60).s;
      const antes = c.rpm, m = c.marcha; c = passoCambio(c, { voando: true, vel: Math.hypot(s.vx, s.vz) / PILOTAGEM.vel, acel: 1, boost: s.boost }, 1 / 60);
      if (c.marcha > m) trocas.push({ t, antes, depois: 0 });
      if (trocas.length && trocas.at(-1)!.depois === 0 && t - trocas.at(-1)!.t > 0.25) trocas.at(-1)!.depois = c.rpm;
    }
    return { trocas, c };
  };
  it("acelerando tudo, passa as 6 marchas em ~5 s — uma por vez, cada vez mais longas — e a 6ª leva até os 560", () => {
    const { trocas, c } = acelerar(12);
    expect(trocas.length).toBe(5); expect(c.marcha).toBe(5);
    expect(trocas[0]!.t).toBeGreaterThan(0.5); expect(trocas[4]!.t).toBeGreaterThan(4);
    for (let i = 1; i < trocas.length; i++) expect(trocas[i]!.t - trocas[i - 1]!.t).toBeGreaterThan(0.5);
  });
  it("na troca a rotação CAI (perto do corte → bem abaixo) e volta a subir", () => {
    for (const tr of acelerar(12).trocas) { expect(tr.antes).toBeGreaterThan(0.85); expect(tr.depois).toBeLessThan(tr.antes - 0.05); }
  });
  it("na máxima do acelerador fica perto do corte (gritando, sem passar); o boost engata a 7ª", () => {
    const topo = acelerar(14);
    expect(topo.c.rpm).toBeLessThanOrEqual(1.02); expect(topo.c.rpm).toBeGreaterThan(0.9);
    expect(acelerar(16, 13).c.marcha).toBe(6);
  });
  it("no chão: marcha lenta (e o acelerador só ronca); freando, reduz", () => {
    let c = cambioNeutro(); for (let i = 0; i < 60; i++) c = passoCambio(c, { voando: false, vel: 0, acel: 0, boost: false }, 1 / 60);
    expect(c.rpm).toBeCloseTo(CAMBIO.lenta, 2); expect(c.marcha).toBe(0);
    let r = { ...cambioNeutro(), marcha: 5, rpm: 0.9 }; for (let i = 0; i < 180; i++) r = passoCambio(r, { voando: true, vel: 0.15, acel: -1, boost: false }, 1 / 60);
    expect(r.marcha).toBeLessThanOrEqual(1);
  });
  it("eventos: subir de marcha dá o 'tec' da troca; aliviar em giro alto dá os estalos", () => {
    const no = (o: Partial<EstadoSomMoto>): EstadoSomMoto => ({ ...somMotoParada, montada: true, voando: true, ...o });
    expect(eventosDaMoto(no({ marcha: 1, acel: 1 }), no({ marcha: 2, acel: 1 }))).toEqual(["moto-troca"]);
    expect(eventosDaMoto(no({ acel: 1, rpm: 0.9 }), no({ acel: 0, rpm: 0.9 }))).toEqual(["moto-estalo"]);
    expect(eventosDaMoto(no({ acel: 1, rpm: 0.3 }), no({ acel: 0, rpm: 0.3 }))).toEqual([]);
  });
  it("BARREIRA DO SOM: o estrondo toca quando o boost ACENDE rápido (> 300 km/h) — uma vez; o supersônico cresce até os 1000", () => {
    const no = (kmh: number, boost: boolean): EstadoSomMoto => ({ ...somMotoParada, montada: true, voando: true, acel: 1, boost, vel: kmh / 3.6 / PILOTAGEM.vel });
    expect(eventosDaMoto(no(500, false), no(505, true))).toContain("moto-estrondo");
    expect(eventosDaMoto(no(505, true), no(700, true))).not.toContain("moto-estrondo");   // já aceso: nada
    expect(eventosDaMoto(no(200, false), no(205, true))).not.toContain("moto-estrondo");  // devagar: só o boost
    expect(mixDaMoto(no(560, false))["moto-supersonico"].vol).toBe(0);
    expect(mixDaMoto(no(1000, true))["moto-supersonico"].vol).toBeGreaterThan(mixDaMoto(no(600, true))["moto-supersonico"].vol);
    expect(mixDaMoto(no(1000, true))["moto-supersonico"].taxa).toBeGreaterThan(mixDaMoto(no(600, true))["moto-supersonico"].taxa);
  });
});
