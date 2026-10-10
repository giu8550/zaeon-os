/**
 * Cyberespaço — os SONS do movimento turbinado (PURO, sintetizados — sem arquivo; lib/cyber/movimento):
 *  - DASH (~0,45 s): o "swoosh" moderno de jogo de ação — ar rasgando (ruído num passa-banda ressonante varrendo do
 *    agudo pro grave), um ZIP eletrônico descendo (seno com FM, 1,9 kHz → 160 Hz), um soco GRAVE curto (o peso do
 *    arranque) e um brilho fino no fim;
 *  - ALERTA (~0,6 s): o "shing" metálico baixinho de quando o corpo entra em guarda (parciais inarmônicos de lâmina).
 */

/** PRNG determinístico (mulberry32) — a síntese sai igual sempre (e dá pra testar) */
function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normalizar = (x: Float32Array, pico: number) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / m) * pico; return x; };
const fimSemClique = (x: Float32Array, n = 96) => { for (let i = 0; i < n && i < x.length; i++) x[x.length - 1 - i]! *= i / n; return x; };

export function sintetizarDash(sr: number): Float32Array {
  const dur = 0.45, n = Math.round(sr * dur), out = new Float32Array(n), r = prng(31);
  // filtro de estado variável (passa-banda ressonante) pro ar
  let low = 0, band = 0, faseZip = 0, faseSub = 0, hpAnt = 0, hp = 0, wAnt = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1;
    // AR: o centro varre 3,4 kHz → 520 Hz (rápido no começo), Q alto → o "fffshhh" que passa
    const fc = 520 + 2900 * Math.exp(-t * 11), f = 2 * Math.sin((Math.PI * Math.min(fc, sr / 6)) / sr), q = 0.32;
    low += f * band; const high = w - low - q * band; band += f * high;
    const envAr = (1 - Math.exp(-t * 260)) * Math.exp(-Math.max(0, t - 0.03) * 7.5);
    // ZIP: seno descendo exponencial com um FM leve (soa "digital", moderno)
    const fz = 160 + 1750 * Math.exp(-t * 19); faseZip += (2 * Math.PI * fz) / sr;
    const zip = Math.sin(faseZip + 0.9 * Math.sin(faseZip * 2.01)) * (1 - Math.exp(-t * 500)) * Math.exp(-t * 16);
    // SOCO grave: 92 → 44 Hz, curtinho
    const fs = 44 + 48 * Math.exp(-t * 26); faseSub += (2 * Math.PI * fs) / sr;
    const sub = Math.sin(faseSub) * (1 - Math.exp(-t * 700)) * Math.exp(-t * 15);
    // BRILHO fino no fim (chiado passa-alta com tremolo rápido — a "cauda" do ar)
    hp = 0.86 * (hp + w - wAnt); wAnt = w; hpAnt = hp;
    const brilho = hpAnt * Math.exp(-Math.abs(t - 0.12) * 18) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 47 * t));
    out[i] = band * envAr * 2.4 + zip * 0.42 + sub * 0.9 + brilho * 0.12;
  }
  return normalizar(fimSemClique(out), 0.9);
}

export function sintetizarAlerta(sr: number): Float32Array {
  const dur = 0.6, n = Math.round(sr * dur), out = new Float32Array(n), r = prng(57);
  // parciais inarmônicos de LÂMINA (cada um decai no seu tempo) + um raspão curtinho de metal no começo
  const parciais = [[2120, 7.5, 1], [3380, 9, 0.7], [5230, 12, 0.45], [7810, 16, 0.25]] as const;
  let hp = 0, wAnt = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1;
    let s = 0; for (const [f, dec, a] of parciais) s += Math.sin(2 * Math.PI * f * t * (1 + 0.004 * Math.exp(-t * 8))) * Math.exp(-t * dec) * a;
    hp = 0.9 * (hp + w - wAnt); wAnt = w;
    const raspa = hp * Math.exp(-t * 60) * 0.5;
    out[i] = (s * (1 - Math.exp(-t * 900)) + raspa);
  }
  return normalizar(fimSemClique(out), 0.7);
}
