/**
 * Cyberespaço — SOM DA MOTO por estágio (PURO). Tudo SINTETIZADO no navegador (sem arquivo): o AudioCyber gera os
 * buffers no 1º gesto, como o jato da mochila (lib/cyber/audio: SINTESE).
 *
 * Os estágios e o que soa:
 *  - PARTIDA (montou): o motor de arranque gira (zumbido subindo), a ignição estoura e o motor dá uma acelerada;
 *  - LENTA (parada/pairando devagar): o MESMO motor, em rotação baixa (uma camada à parte, pulsada, soava como um
 *    "som extra estranho" por cima do motor — saiu);
 *  - DECOLA (saiu do chão): sopro subindo dos propulsores de baixo;
 *  - ACELERAÇÃO/CRUZEIRO: o MOTOR (um 4 em linha de superbike, ver `sintetizarExplosoes`) passa as MARCHAS
 *    (`passoCambio`: 6 no acelerador + a do boost): a rotação sobe dentro da marcha e CAI na troca (com um corte curtinho
 *    e um "tec" de engate); o tom vai da lenta grossa ao GRITO no corte; + o VENTO;
 *  - ALIVIOU (soltou o acelerador em rotação alta): estalos do escape (pipoco);
 *  - BOOST: estouro de ignição + a TURBINA (ronco + assobio agudo) enquanto dura;
 *  - BARREIRA DO SOM (acender o boost acima dos 300 km/h): o ESTRONDO sônico (o "crack-crack" duplo da onda N + o
 *    trovão rolando) e, enquanto o boost durar, o SUPERSÔNICO (o ar rasgando) crescendo até os 1000 km/h;
 *  - FREIO (freada forte): chiado de ar;
 *  - SETA (curva): só a luz pisca — SEM som (o clique a cada piscada virava um "tik tik tik" na curva);
 *  - POUSO (encostou no chão): baque + assentamento;
 *  - DESLIGA (desceu da moto): o motor cai de tom e apaga com um sopro.
 * `mixDaMoto` diz o volume/afinação de cada loop; `eventosDaMoto` diz quais one-shots disparar (comparando estados).
 */

import { PILOTAGEM, rompeuBarreira, supersonico } from "./motoFisica";

/** PRNG determinístico (mulberry32): a síntese sai igual sempre (e dá pra testar) */
function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normalizar = (x: Float32Array, pico: number) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / m) * pico; return x; };
/** fecha o loop: a ponta (x amostras além do fim) entra em crossfade de potência constante no começo */
function fecharLoop(raw: Float32Array, n: number) {
  const x = raw.length - n, out = raw.slice(0, n);
  for (let i = 0; i < x; i++) { const u = i / x; out[i] = raw[i]! * Math.sqrt(u) + raw[n + i]! * Math.sqrt(1 - u); }
  return out;
}
const fimSemClique = (x: Float32Array, k = 96) => { for (let i = 0; i < Math.min(k, x.length); i++) x[x.length - 1 - i]! *= i / k; return x; };
const passaBaixa = (fc: number, sr: number) => 1 - Math.exp((-2 * Math.PI * fc) / sr);
/** um "motor" de harmônicos (dente de serra suave + ímpares reforçados) na fase `fase` */
const harmonicos = (fase: number, n = 10) => { let v = 0; for (let k = 1; k <= n; k++) v += (Math.sin(fase * k) / k) * (k % 2 ? 1 : 0.55); return v; };

/**
 * O MOTOR é um 4 EM LINHA de superbike (o grito de uma S1000RR): sintetizado EXPLOSÃO POR EXPLOSÃO. Cada disparo é um
 * pulso que faz o escape ressoar (senos amortecidos nas frequências do coletor/escape) + um sopro de ruído; os disparos
 * variam um pouco de força (o motor "vivo", mais irregular embaixo); a soma passa por uma SATURAÇÃO pesada (tanh — o
 * rasgado violento). Um 2º trem de disparos levemente desafinado (+2/+3 Hz) bate contra o 1º: o "espacial" (um chorus).
 * Três loops de 1 s em três FAIXAS de rotação (grave 50 Hz, médio 150 Hz, grito 400 Hz de disparo); `mixDaMoto` toca
 * os três afinados na frequência do motor (`freqDoMotor`: 40 Hz na lenta → ~480 Hz no corte, ~14 mil giros) e cruza
 * os volumes — cada loop só estica dentro da faixa dele (sem voz de esquilo).
 */
type Ressonancia = [freq: number, tau: number, peso: number];
function sintetizarExplosoes(sr: number, o: { F: number; res: Ressonancia[]; ruido: number; tauRuido: number; varia: number; sub: number; drive: number; desafina?: [number, number]; semente: number }): Float32Array {
  const n = sr, out = new Float32Array(n), r = prng(o.semente);
  const trem = (F: number, ganho: number) => {
    const caudaMax = Math.ceil(sr * Math.max(...o.res.map((x) => x[1]), o.tauRuido) * 6);
    for (let k = 0; k < F; k++) {
      const pos = Math.round((k * sr) / F), a = ganho * (1 + o.varia * (r() * 2 - 1));
      let lp = 0;
      for (let j = 0; j < caudaMax; j++) {
        const t = j / sr; let v = 0;
        for (const [f, tau, w] of o.res) v += w * Math.exp(-t / tau) * Math.sin(2 * Math.PI * f * t);
        lp += (r() * 2 - 1 - lp) * 0.5; v += o.ruido * lp * Math.exp(-t / o.tauRuido);
        out[(pos + j) % n] += a * v;   // a cauda dá a volta: o loop emenda sozinho
      }
    }
  };
  trem(o.F, 1);
  if (o.desafina) trem(o.desafina[0], o.desafina[1]);
  let rms = 0; for (const x of out) rms += x * x; rms = Math.sqrt(rms / n) || 1;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    out[i] = Math.tanh((o.drive * out[i]!) / (rms * 2.5)) + o.sub * Math.sin(2 * Math.PI * (o.F / 2) * t);   // satura + o virabrequim (meia frequência)
  }
  return normalizar(out, 0.85);
}
/** as três faixas: a frequência de DISPARO de cada loop (Hz) */
export const FAIXAS_MOTOR = { "moto-motor": 50, "moto-motor-alto": 150, "moto-motor-grito": 400 } as const;
/** GRAVE (marcha lenta / embaixo): disparos pesados e irregulares, escape grosso, o virabrequim aparecendo */
export const sintetizarMotorMoto = (sr: number) => sintetizarExplosoes(sr, { F: 50, res: [[110, 0.009, 1], [260, 0.004, 0.6], [55, 0.012, 0.5]], ruido: 0.5, tauRuido: 0.006, varia: 0.25, sub: 0.3, drive: 2.4, semente: 31 });
/** MÉDIO (a puxada): rasgado, com o coletor cantando e um tico de chorus */
export const sintetizarMotorAltoMoto = (sr: number) => sintetizarExplosoes(sr, { F: 150, res: [[420, 0.003, 1], [900, 0.0015, 0.5], [190, 0.006, 0.5]], ruido: 0.6, tauRuido: 0.003, varia: 0.12, sub: 0.18, drive: 3.4, desafina: [152, 0.45], semente: 37 });
/** GRITO (o alto do giro): o uivo do 4 em linha, agudo e violento, com o brilho "espacial" batendo a 3 Hz */
export const sintetizarMotorGritoMoto = (sr: number) => sintetizarExplosoes(sr, { F: 400, res: [[1150, 0.0012, 1], [2300, 0.0008, 0.5], [520, 0.002, 0.6]], ruido: 0.45, tauRuido: 0.0012, varia: 0.06, sub: 0.12, drive: 4.2, desafina: [403, 0.5], semente: 41 });

/** a FREQUÊNCIA do motor (Hz de disparo) na rotação `rpm` (lenta → 40 Hz ≈ 1200 giros; 1 → 480 Hz ≈ 14.400 giros) —
 *  exponencial: cada pedaço do conta-giros sobe o mesmo tanto de TOM */
export function freqDoMotor(rpm: number): number { return 40 * Math.pow(12, Math.max(0, (rpm - CAMBIO.lenta) / (1 - CAMBIO.lenta))); }

/** TROCA DE MARCHA (~0,16 s): o "tec" seco do engate + um sopro curtinho de alívio */
export function sintetizarTrocaMoto(sr: number): Float32Array {
  const n = Math.round(sr * 0.16), out = new Float32Array(n), r = prng(97), a = passaBaixa(2500, sr);
  let lp = 0, fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr; lp += (r() * 2 - 1 - lp) * a; fase += (2 * Math.PI * (180 - 400 * t)) / sr;
    out[i] = Math.sin(fase) * Math.exp(-t * 60) * 0.9 + lp * Math.exp(-t * 28) * 0.8;
  }
  return normalizar(fimSemClique(out, 128), 0.75);
}

/** ESTALOS do escape (~0,7 s): 4–6 pipocos em intervalos irregulares, cada um um estalo grave com rabinho */
export function sintetizarEstaloMoto(sr: number): Float32Array {
  const n = Math.round(sr * 0.7), out = new Float32Array(n), r = prng(101), a = passaBaixa(1600, sr);
  const tiros: number[] = []; for (let t = 0.02; t < 0.58; t += 0.05 + r() * 0.12) tiros.push(t);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr; lp += (r() * 2 - 1 - lp) * a; let v = 0;
    tiros.forEach((t0, k) => { const u = t - t0; if (u >= 0 && u < 0.08) v += (lp * 2 + Math.sin(2 * Math.PI * 70 * u)) * Math.exp(-u * 70) * (1 - k * 0.12); });
    out[i] = v;
  }
  return normalizar(fimSemClique(out, 256), 0.85);
}

/** ESTRONDO SÔNICO (~2,6 s): a onda N chega como DOIS estalos secos (proa e popa, 0,11 s de distância), um soco grave
 *  de 38 Hz e o TROVÃO rolando (ruído marrom, passa-baixa fechando, com ondulações) */
export function sintetizarEstrondoMoto(sr: number): Float32Array {
  const n = Math.round(sr * 2.6), out = new Float32Array(n), r = prng(107), a = passaBaixa(5000, sr);
  let lp = 0, marrom = 0, lp2 = 0, fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1; lp += (w - lp) * a; marrom = 0.996 * marrom + 0.06 * w;
    let v = 0;
    for (const t0 of [0.01, 0.12]) { const u = t - t0; if (u >= 0 && u < 0.06) v += (u < 0.002 ? u / 0.002 : 1) * Math.exp(-u * 90) * (lp * 1.6 + (u < 0.004 ? 1.4 : -0.7)); }   // os estalos
    fase += (2 * Math.PI * (38 + 30 * Math.exp(-t * 6))) / sr;
    v += Math.sin(fase) * Math.exp(-t * 3.2) * Math.min(1, t * 80) * 0.9;   // o soco grave
    const fc = 160 + 900 * Math.exp(-t * 2.5); lp2 += (marrom - lp2) * passaBaixa(fc, sr);
    v += lp2 * 5 * Math.min(1, t * 6) * Math.exp(-t * 1.25) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 3.1 * t + Math.sin(t * 7)));   // o trovão rolando
    out[i] = v;
  }
  return normalizar(fimSemClique(out, 1024), 0.95);
}

/** SUPERSÔNICO (loop de 2 s): o ar RASGANDO — ronco grave (marrom), um chiado agudo (banda ~2,5 kHz) tremulando a 9 Hz e
 *  um assobio de choque descendo/subindo devagar */
export function sintetizarSupersonicoMoto(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.35), raw = new Float32Array(n + x), r = prng(113);
  let marrom = 0, lo = 0, band = 0, fase = 0;
  const f = 2 * Math.sin((Math.PI * 2500) / sr), q = 0.35;
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr, w = r() * 2 - 1; marrom = 0.995 * marrom + 0.07 * w;
    lo += f * band; const hi = w - lo - q * band; band += f * hi;
    fase += (2 * Math.PI * (900 + 120 * Math.sin(2 * Math.PI * 0.5 * t))) / sr;
    raw[i] = marrom * 1.8 + band * 0.55 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 9 * t)) + Math.sin(fase) * 0.06;
  }
  return normalizar(fecharLoop(raw, n), 0.85);
}

/** VENTO (loop de 3 s): ruído passa-baixa ondulando (rajadas) */
export function sintetizarVentoMoto(sr: number): Float32Array {
  const n = sr * 3, x = Math.round(sr * 0.4), raw = new Float32Array(n + x), r = prng(41);
  let lp1 = 0, lp2 = 0;
  const a1 = passaBaixa(900, sr), a2 = passaBaixa(1400, sr);
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr, w = r() * 2 - 1; lp1 += (w - lp1) * a1; lp2 += (lp1 - lp2) * a2;
    raw[i] = lp2 * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.7 * t + Math.sin(2 * Math.PI * 0.23 * t) * 2));
  }
  return normalizar(fecharLoop(raw, n), 0.75);
}

/** TURBINA do boost (loop de 2 s): ronco (ruído marrom) + rugido médio + ASSOBIO agudo (1800 Hz com vibrato de 6 Hz) */
export function sintetizarTurbinaMoto(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.3), raw = new Float32Array(n + x), r = prng(53);
  let marrom = 0, lp = 0, hp = 0, wAnt = 0, fase = 0;
  const a = passaBaixa(700, sr);
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr, w = r() * 2 - 1;
    marrom = 0.995 * marrom + 0.07 * w; lp += (w - lp) * a; hp = 0.7 * (hp + w - wAnt); wAnt = w;
    fase += (2 * Math.PI * (1800 + 25 * Math.sin(2 * Math.PI * 6 * t))) / sr;
    raw[i] = marrom * 1.5 + lp * 1.6 + hp * 0.12 + 0.12 * Math.sin(fase) + 0.05 * Math.sin(fase * 1.5);
  }
  return normalizar(fecharLoop(raw, n), 0.85);
}

/** PARTIDA (~1,7 s): arranque zumbindo (220 → 600 Hz, com o "tec-tec" a 28 Hz), estouro da ignição e uma acelerada */
export function sintetizarPartidaMoto(sr: number): Float32Array {
  const n = Math.round(sr * 1.7), out = new Float32Array(n), r = prng(61), a = passaBaixa(900, sr);
  let fa = 0, fm = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr; let v = 0;
    if (t < 0.65) { fa += (2 * Math.PI * (220 + 380 * (t / 0.65))) / sr; v += Math.sin(fa) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 28 * t)) * 0.35 * Math.min(1, t * 20); }
    if (t >= 0.6) {
      const u = t - 0.6;
      lp += (r() * 2 - 1 - lp) * a; v += lp * 2.2 * Math.exp(-u * 22);                               // o estouro
      const f = 60 + 110 * Math.exp(-Math.pow((u - 0.35) / 0.22, 2)) + 20 * Math.exp(-u * 3); fm += (2 * Math.PI * f) / sr;
      v += harmonicos(fm, 10) * Math.min(1, u * 30) * (0.35 + 0.65 * Math.exp(-u * 1.6)) * 0.6;   // a acelerada (blip)
    }
    out[i] = v;
  }
  return normalizar(fimSemClique(out, 512), 0.9);
}

/** DESLIGA (~1,3 s): o motor cai de tom (95 → 22 Hz) e apaga; um sopro no fim */
export function sintetizarDesligaMoto(sr: number): Float32Array {
  const n = Math.round(sr * 1.3), out = new Float32Array(n), r = prng(67), a = passaBaixa(500, sr);
  let fm = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = 22 + 73 * Math.exp(-t * 2.4); fm += (2 * Math.PI * f) / sr;
    lp += (r() * 2 - 1 - lp) * a;
    out[i] = harmonicos(fm, 8) * Math.exp(-t * 2.2) * 0.8 + lp * 1.5 * Math.exp(-Math.pow((t - 0.95) / 0.15, 2));
  }
  return normalizar(fimSemClique(out, 512), 0.85);
}

/** BOOST (~1,1 s): baque de ignição + sopro com o filtro abrindo (300 → 3500 Hz) */
export function sintetizarBoostMoto(sr: number): Float32Array {
  const n = Math.round(sr * 1.1), out = new Float32Array(n), r = prng(71);
  let lo = 0, band = 0, fb = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1;
    // filtro de estado variável (Chamberlin): passa-banda varrendo pra cima
    const fc = 300 + 3200 * (1 - Math.exp(-t * 3)), f = 2 * Math.sin((Math.PI * fc) / sr), q = 0.6;
    lo += f * band; const hi = w - lo - q * band; band += f * hi;
    fb += (2 * Math.PI * (42 + 60 * Math.exp(-t * 14))) / sr;
    out[i] = band * 1.4 * Math.min(1, t * 25) * Math.exp(-t * 2.2) + Math.sin(fb) * Math.exp(-t * 10) * 0.9;
  }
  return normalizar(fimSemClique(out, 512), 0.9);
}

/** FREIO (~0,6 s): chiado de ar (ruído passa-alta) com ataque rápido */
export function sintetizarFreioMoto(sr: number): Float32Array {
  const n = Math.round(sr * 0.6), out = new Float32Array(n), r = prng(79);
  let hp = 0, wAnt = 0, lp = 0;
  const a = passaBaixa(6000, sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1; hp = 0.9 * (hp + w - wAnt); wAnt = w; lp += (hp - lp) * a;
    out[i] = lp * Math.min(1, t * 40) * Math.exp(-t * 4.5) * (1 + 0.15 * Math.sin(2 * Math.PI * 37 * t));
  }
  return normalizar(fimSemClique(out), 0.7);
}

/** DECOLA (~0,9 s): sopro grave crescendo + um tom subindo (60 → 130 Hz) */
export function sintetizarDecolaMoto(sr: number): Float32Array {
  const n = Math.round(sr * 0.9), out = new Float32Array(n), r = prng(83), a = passaBaixa(400, sr);
  let lp = 0, ft = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr; lp += (r() * 2 - 1 - lp) * a; ft += (2 * Math.PI * (60 + 70 * t / 0.9)) / sr;
    const env = Math.sin(Math.PI * Math.min(1, t / 0.9)) ** 0.7;
    out[i] = (lp * 3 + Math.sin(ft) * 0.5) * env;
  }
  return normalizar(fimSemClique(out), 0.8);
}

/** POUSO (~0,55 s): baque grave (100 → 34 Hz) + assentamento (chiado curto) */
export function sintetizarPousoMoto(sr: number): Float32Array {
  const n = Math.round(sr * 0.55), out = new Float32Array(n), r = prng(89), a = passaBaixa(1200, sr);
  let fase = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr; fase += (2 * Math.PI * (34 + 66 * Math.exp(-t * 16))) / sr; lp += (r() * 2 - 1 - lp) * a;
    out[i] = Math.sin(fase) * (1 - Math.exp(-t * 700)) * Math.exp(-t * 8) + lp * 0.6 * Math.exp(-Math.pow((t - 0.12) / 0.08, 2));
  }
  return normalizar(fimSemClique(out), 0.9);
}

export const SINTESE_MOTO = {
  "moto-motor": sintetizarMotorMoto, "moto-motor-alto": sintetizarMotorAltoMoto, "moto-motor-grito": sintetizarMotorGritoMoto, "moto-troca": sintetizarTrocaMoto, "moto-estalo": sintetizarEstaloMoto, "moto-estrondo": sintetizarEstrondoMoto, "moto-supersonico": sintetizarSupersonicoMoto, "moto-vento": sintetizarVentoMoto, "moto-turbina": sintetizarTurbinaMoto,
  "moto-partida": sintetizarPartidaMoto, "moto-desliga": sintetizarDesligaMoto, "moto-boost": sintetizarBoostMoto, "moto-freio": sintetizarFreioMoto,
  "moto-decola": sintetizarDecolaMoto, "moto-pouso": sintetizarPousoMoto,
} as const;
export type NomeSomMoto = keyof typeof SINTESE_MOTO;
/** os LOOPS da moto (o resto é one-shot) */
export const LOOPS_MOTO = ["moto-motor", "moto-motor-alto", "moto-motor-grito", "moto-vento", "moto-turbina", "moto-supersonico"] as const satisfies readonly NomeSomMoto[];

/** o que a moto está fazendo agora, do ponto de vista do som */
export type EstadoSomMoto = {
  /** alguém montado */ montada: boolean;
  /** no ar */ voando: boolean;
  /** velocidade 0..1 (cruzeiro = 1; no boost passa de 1) */ vel: number;
  /** acelerador −1..1 (só conhecido na MINHA moto; nas dos outros, 0) */ acel: number;
  boost: boolean;
  /** pisca aceso agora: −1 esquerda, 1 direita, 0 apagado */ seta: number;
  /** o CÂMBIO (`passoCambio`): rotação 0..1, marcha (0 = 1ª) e o corte da troca (0..1, 1 = acabou de trocar) */
  rpm?: number; marcha?: number; corte?: number;
};
export const somMotoParada: EstadoSomMoto = { montada: false, voando: false, vel: 0, acel: 0, boost: false, seta: 0 };

/** o CÂMBIO virtual: em que fração da velocidade de cruzeiro cada marcha chega no TOPO da rotação (a 6ª só no boost).
 *  A rotação na marcha é vel / topo — na troca ela cai pra topo(n)/topo(n+1): queda grande nas primeiras, pequena nas
 *  últimas, como numa moto de verdade */
export const CAMBIO = {
  topo: [0.14, 0.28, 0.44, 0.61, 0.8, 1.1, 1.9],   // 6 no acelerador (até os 560 km/h); a 7ª é a do boost (até os 1000)
  /** marcha lenta (parada / no chão), a rotação onde sobe a marcha e a fração do topo da anterior onde reduz */
  lenta: 0.14, troca: 0.96, reduz: 0.7,
  /** quanto o acelerador puxa a rotação (carga) e quão rápido ela segue o alvo (1/s); `corte` = duração da troca (s) */
  carga: 0.07, segue: 9, corte: 0.12,
} as const;
export type Cambio = { marcha: number; rpm: number; corte: number };
export const cambioNeutro = (): Cambio => ({ marcha: 0, rpm: CAMBIO.lenta, corte: 0 });

/** um passo do câmbio: sobe/reduz a marcha pela velocidade, e a rotação segue (rápido) a da marcha + a carga */
export function passoCambio(c: Cambio, e: { voando: boolean; vel: number; acel: number; boost: boolean }, dt: number): Cambio {
  const C = CAMBIO, v = Math.max(0, e.vel), carga = Math.max(0, e.acel);
  let { marcha } = c, corte = Math.max(0, c.corte - dt / C.corte);
  if (!e.voando) marcha = 0;
  else {
    const n = C.topo.length, ultima = e.boost || v > C.topo[n - 2]! * 0.96 ? n - 1 : n - 2;   // a 6ª é a última do acelerador; a 7ª, do boost
    if (marcha < ultima && v / C.topo[marcha]! >= C.troca && carga > 0) { marcha++; corte = 1; }
    else if (marcha > ultima || (marcha > 0 && v < C.topo[marcha - 1]! * C.reduz)) marcha--;
  }
  const alvo = !e.voando ? C.lenta + 0.22 * carga
    : Math.min(1.02, Math.max(C.lenta, v / C.topo[marcha]!) + C.carga * carga - (carga > 0 ? 0 : 0.04));
  const rpm = c.rpm + (alvo - c.rpm) * Math.min(1, dt * C.segue * (corte > 0 ? 2 : 1));
  return { marcha, rpm, corte };
}

/** volume (0..1) e afinação de cada loop no estado `e` */
export function mixDaMoto(e: EstadoSomMoto): Record<(typeof LOOPS_MOTO)[number], { vol: number; taxa: number }> {
  const zero = { vol: 0, taxa: 1 };
  if (!e.montada) return { "moto-motor": zero, "moto-motor-alto": zero, "moto-motor-grito": zero, "moto-vento": zero, "moto-turbina": zero, "moto-supersonico": zero };
  const sup = e.voando ? supersonico(e.vel * PILOTAGEM.vel, e.boost) : 0;
  const v = Math.max(0, Math.min(1.8, e.vel)), v1 = Math.min(1, v), acel = Math.max(0, e.acel);
  // sem câmbio (quem chama não passou rpm): a rotação sai da velocidade
  const rpm = e.rpm ?? (e.voando ? Math.min(1, 0.2 + 0.6 * v1 + 0.15 * acel) : CAMBIO.lenta + 0.2 * acel);
  const f = freqDoMotor(rpm), corte = 1 - 0.5 * (e.corte ?? 0), carga = 0.6 + 0.4 * acel;
  // as três faixas tocam AFINADAS na frequência do motor; o volume de cada uma é o quanto ela está perto (em oitavas)
  const pesos = Object.fromEntries(Object.entries(FAIXAS_MOTOR).map(([n, F]) => [n, Math.exp(-((Math.log2(f / F) / 0.8) ** 2))])) as Record<keyof typeof FAIXAS_MOTOR, number>;
  const soma = pesos["moto-motor"] + pesos["moto-motor-alto"] + pesos["moto-motor-grito"];
  const forca = (0.5 + 0.5 * rpm) * carga * corte;   // mais alto em cima e no acelerador; a troca corta um instante
  const faixa = (n: keyof typeof FAIXAS_MOTOR) => ({ vol: Math.min(1, (pesos[n] / soma) * forca * (n === "moto-motor-grito" ? 0.75 + 0.25 * acel : 1)), taxa: Math.max(0.5, Math.min(2.2, f / FAIXAS_MOTOR[n])) });
  return {
    "moto-motor": faixa("moto-motor"), "moto-motor-alto": faixa("moto-motor-alto"), "moto-motor-grito": faixa("moto-motor-grito"),
    "moto-vento": { vol: e.voando ? Math.pow(v1, 1.6) * 0.8 + (e.boost ? 0.25 : 0) : 0, taxa: 0.8 + 0.45 * Math.min(1.5, v) },
    "moto-turbina": { vol: e.boost ? 1 - 0.35 * sup : 0, taxa: 1 + 0.15 * Math.min(2, v) },
    // supersônico (boost aceso acima dos 300 km/h): o ar rasgando, crescendo e subindo de tom até os 1000 km/h
    "moto-supersonico": { vol: sup > 0 ? 0.35 + 0.65 * sup : 0, taxa: 0.8 + 0.4 * sup },
  };
}

/** os one-shots de um quadro pro outro (montar/descer, decolar/pousar, boost, freada forte, pisca) */
export function eventosDaMoto(a: EstadoSomMoto, b: EstadoSomMoto): NomeSomMoto[] {
  const ev: NomeSomMoto[] = [];
  if (!a.montada && b.montada) ev.push("moto-partida");
  if (a.montada && !b.montada) ev.push("moto-desliga");
  if (!a.montada || !b.montada) return ev;
  if (!a.voando && b.voando) ev.push("moto-decola");
  if (a.voando && !b.voando) ev.push("moto-pouso");
  if (!a.boost && b.boost) ev.push("moto-boost");
  if (b.voando && a.acel >= 0 && b.acel < 0 && b.vel > 0.35) ev.push("moto-freio");
  if (b.voando && (b.marcha ?? 0) > (a.marcha ?? 0)) ev.push("moto-troca");
  if (b.voando && rompeuBarreira(a.boost, b.boost, b.vel * PILOTAGEM.vel)) ev.push("moto-estrondo");   // acendeu o boost rápido: quebrou a barreira do som
  if (b.voando && a.acel > 0.5 && b.acel === 0 && (a.rpm ?? 0) > 0.6) ev.push("moto-estalo");   // aliviou em rotação alta: pipoco
  return ev;
}

/** o pisca: ligado pra um lado enquanto o guidão está virado (> 0,25), piscando a 1,5 Hz (aceso metade do tempo) */
export function setaAcesa(guidao: number, t: number): number {
  const lado = guidao > 0.25 ? 1 : guidao < -0.25 ? -1 : 0;
  return lado !== 0 && (t * 1.5) % 1 < 0.5 ? lado : 0;
}
