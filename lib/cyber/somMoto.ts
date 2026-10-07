/**
 * Cyberespaço — SOM DA MOTO por estágio (PURO). Tudo SINTETIZADO no navegador (sem arquivo): o AudioCyber gera os
 * buffers no 1º gesto, como o jato da mochila (lib/cyber/audio: SINTESE).
 *
 * Os estágios e o que soa:
 *  - PARTIDA (montou): o motor de arranque gira (zumbido subindo), a ignição estoura e o motor dá uma acelerada;
 *  - LENTA (parada/pairando devagar): o MESMO motor, em rotação baixa (uma camada à parte, pulsada, soava como um
 *    "som extra estranho" por cima do motor — saiu);
 *  - DECOLA (saiu do chão): sopro subindo dos propulsores de baixo;
 *  - ACELERAÇÃO/CRUZEIRO: o MOTOR (harmônicos) sobe de tom com a velocidade e com o acelerador, + o VENTO;
 *  - BOOST: estouro de ignição + a TURBINA (ronco + assobio agudo) enquanto dura;
 *  - FREIO (freada forte): chiado de ar;
 *  - SETA (curva): clique-claque no compasso do pisca;
 *  - POUSO (encostou no chão): baque + assentamento;
 *  - DESLIGA (desceu da moto): o motor cai de tom e apaga com um sopro.
 * `mixDaMoto` diz o volume/afinação de cada loop; `eventosDaMoto` diz quais one-shots disparar (comparando estados).
 */

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

/** MOTOR (loop de 1 s, 80 Hz = 80 ciclos exatos: emenda perfeita). A afinação (playbackRate) é a rotação. */
export function sintetizarMotorMoto(sr: number): Float32Array {
  const n = sr, out = new Float32Array(n), r = prng(31), a = passaBaixa(1800, sr);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, fase = 2 * Math.PI * 80 * t;
    const explosao = 0.75 + 0.25 * Math.sin(2 * Math.PI * 20 * t) + 0.08 * Math.sin(2 * Math.PI * 40 * t + 1);   // o compasso dos "cilindros"
    lp += (r() * 2 - 1 - lp) * a;
    out[i] = harmonicos(fase, 12) * explosao + 0.35 * Math.sin(fase * 0.5) + lp * 0.18;
  }
  return normalizar(out, 0.8);
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

/** SETA (~45 ms): o clique do pisca (uma batidinha seca, com corpo) */
export function sintetizarSetaMoto(sr: number): Float32Array {
  const n = Math.round(sr * 0.045), out = new Float32Array(n), r = prng(97);
  for (let i = 0; i < n; i++) { const t = i / sr; out[i] = (Math.sin(2 * Math.PI * 1900 * t) * 0.6 + Math.sin(2 * Math.PI * 520 * t) + (r() * 2 - 1) * 0.4) * Math.exp(-t * 160); }
  return normalizar(fimSemClique(out, 32), 0.8);
}

export const SINTESE_MOTO = {
  "moto-motor": sintetizarMotorMoto, "moto-vento": sintetizarVentoMoto, "moto-turbina": sintetizarTurbinaMoto,
  "moto-partida": sintetizarPartidaMoto, "moto-desliga": sintetizarDesligaMoto, "moto-boost": sintetizarBoostMoto, "moto-freio": sintetizarFreioMoto,
  "moto-decola": sintetizarDecolaMoto, "moto-pouso": sintetizarPousoMoto, "moto-seta": sintetizarSetaMoto,
} as const;
export type NomeSomMoto = keyof typeof SINTESE_MOTO;
/** os LOOPS da moto (o resto é one-shot) */
export const LOOPS_MOTO = ["moto-motor", "moto-vento", "moto-turbina"] as const satisfies readonly NomeSomMoto[];

/** o que a moto está fazendo agora, do ponto de vista do som */
export type EstadoSomMoto = {
  /** alguém montado */ montada: boolean;
  /** no ar */ voando: boolean;
  /** velocidade 0..1 (cruzeiro = 1; no boost passa de 1) */ vel: number;
  /** acelerador −1..1 (só conhecido na MINHA moto; nas dos outros, 0) */ acel: number;
  boost: boolean;
  /** pisca aceso agora: −1 esquerda, 1 direita, 0 apagado */ seta: number;
};
export const somMotoParada: EstadoSomMoto = { montada: false, voando: false, vel: 0, acel: 0, boost: false, seta: 0 };

/** volume (0..1) e afinação de cada loop no estado `e` */
export function mixDaMoto(e: EstadoSomMoto): Record<(typeof LOOPS_MOTO)[number], { vol: number; taxa: number }> {
  if (!e.montada) return { "moto-motor": { vol: 0, taxa: 0.6 }, "moto-vento": { vol: 0, taxa: 1 }, "moto-turbina": { vol: 0, taxa: 1 } };
  const v = Math.max(0, Math.min(1.8, e.vel)), v1 = Math.min(1, v), acel = Math.max(0, e.acel);
  return {
    // o motor: no chão em marcha LENTA (rotação baixa); no ar sobe com a velocidade; o acelerador "puxa" a rotação
    // antes da velocidade chegar
    "moto-motor": { vol: e.voando ? 0.4 + 0.5 * v1 : 0.42, taxa: (e.voando ? 0.68 : 0.55) + 0.75 * v1 + 0.22 * acel * (1 - v1 * 0.5) + (e.boost ? 0.3 : 0) + 0.15 * Math.max(0, v - 1) },
    "moto-vento": { vol: e.voando ? Math.pow(v1, 1.6) * 0.8 + (e.boost ? 0.25 : 0) : 0, taxa: 0.8 + 0.45 * Math.min(1.5, v) },
    "moto-turbina": { vol: e.boost ? 1 : 0, taxa: 1 + 0.15 * Math.min(1.5, v) },
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
  if (a.seta !== b.seta) ev.push("moto-seta");   // acendeu ou apagou: tic… tac
  return ev;
}

/** o pisca: ligado pra um lado enquanto o guidão está virado (> 0,25), piscando a 1,5 Hz (aceso metade do tempo) */
export function setaAcesa(guidao: number, t: number): number {
  const lado = guidao > 0.25 ? 1 : guidao < -0.25 ? -1 : 0;
  return lado !== 0 && (t * 1.5) % 1 < 0.5 ? lado : 0;
}
