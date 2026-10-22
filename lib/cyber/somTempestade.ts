/**
 * Cyberespaço — o SOM da TRAVESSIA do buraco negro (PURO, sintetizado — sem arquivo; out/2026, o dono: "efeitos sonoros
 * de tempestade cósmica, trovões, raios, sons de estilhaços" — no lugar do assobio e do "rise"):
 *  - TEMPESTADE: o vento cósmico rodando (ruído grave filtrado que gira de um lado pro outro), um rumor de trovões ao
 *    longe e um zumbido sub-grave do buraco negro (loop de 6 s, sem emenda);
 *  - ESTILHAÇOS: o vidro estourando no horizonte — o estalo, dezenas de cacos tilintando (ressonâncias agudas que caem)
 *    e o chiado da chuva de cacos (~2 s).
 * (o RAIO e o TROVÃO já existem: lib/cyber/coracao)
 */
function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function normalizar(out: Float32Array, pico: number) {
  let m = 0; for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i]!));
  if (m > 0) for (let i = 0; i < out.length; i++) out[i]! *= pico / m;
  return out;
}
/** ruído filtrado (passa-baixa de `corte` Hz) com o rabo cruzado no começo (loop sem emenda) */
function ruidoCircular(n: number, sr: number, corte: number, seed: number): Float32Array {
  const X = Math.floor(sr * 0.3), r = prng(seed), a = 1 - Math.exp((-2 * Math.PI * corte) / sr), buf = new Float32Array(n + X), out = new Float32Array(n);
  let lp = 0, lp2 = 0; for (let i = 0; i < n + X; i++) { lp += (r() * 2 - 1 - lp) * a; lp2 += (lp - lp2) * a; buf[i] = lp2; }
  for (let i = 0; i < n; i++) { const k = i < X ? i / X : 1; out[i] = buf[i]! * k + (i < X ? buf[n + i]! * (1 - k) : 0); }
  return out;
}

/** a TEMPESTADE cósmica (6 s, loop): vento girando + rumor de trovão + o sub do buraco negro (ciclos inteiros no loop) */
export function sintetizarTempestade(sr: number): Float32Array {
  const D = 6, n = Math.round(sr * D), TWO = Math.PI * 2, out = new Float32Array(n);
  const vento = ruidoCircular(n, sr, 420, 11), rumor = ruidoCircular(n, sr, 70, 23), chiado = ruidoCircular(n, sr, 2400, 37);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // o vento RODA: o volume sobe e desce em ondas (1/6 e 2/6 Hz — fecham no loop) e o chiado "assobia" no pico
    const giro = 0.55 + 0.45 * Math.sin((TWO * t) / 6) * Math.sin((TWO * 2 * t) / 6 + 0.7);
    const rola = 0.6 + 0.4 * Math.sin((TWO * 3 * t) / 6 + 1.3);
    const sub = Math.sin(TWO * 33 * t) * 0.35 + Math.sin(TWO * 49.5 * t + 0.4) * 0.15;
    out[i] = vento[i]! * 3.2 * giro + rumor[i]! * 9 * rola + chiado[i]! * 0.35 * giro * giro + sub * (0.7 + 0.3 * rola);
  }
  return normalizar(out, 0.62);
}

/** os ESTILHAÇOS (~2,2 s): o estalo do vidro, os cacos tilintando e caindo, a chuva fina de cacos */
export function sintetizarEstilhacos(sr: number): Float32Array {
  const n = Math.round(sr * 2.2), out = new Float32Array(n), r = prng(97), TWO = Math.PI * 2;
  // o ESTALO: ruído agudo bem curto, rasgando
  let hp = 0, ant = 0;
  for (let i = 0; i < n; i++) { const t = i / sr, w = r() * 2 - 1; hp = 0.85 * (hp + w - ant); ant = w; out[i]! += hp * Math.exp(-t * 26) * 1.2 + w * Math.exp(-t * 9) * 0.25; }
  // os CACOS: ressonâncias agudas (2–9 kHz, ou o que couber abaixo de Nyquist) que aparecem espalhadas e caem rápido
  const nyq = sr / 2 - 200;
  for (let c = 0; c < 70; c++) {
    const t0 = Math.pow(r(), 1.8) * 1.6, f = Math.min(nyq, 2000 + r() * 7000) * (0.9 + 0.2 * r()), dec = 18 + r() * 40, g = 0.15 + 0.5 * r() * Math.exp(-t0 * 1.2);
    const i0 = Math.floor(t0 * sr), len = Math.min(n - i0, Math.floor(sr * 0.25));
    for (let j = 0; j < len; j++) { const t = j / sr; out[i0 + j]! += g * Math.sin(TWO * f * t) * Math.exp(-t * dec) * (0.6 + 0.4 * Math.sin(TWO * f * 1.51 * t)); }
  }
  // a CHUVA de cacos: chiado fino com grãos, sumindo
  for (let i = 0; i < n; i++) { const t = i / sr; if (r() < 0.02 * Math.exp(-t * 1.5)) out[i]! += (r() * 2 - 1) * 0.5; }
  for (let i = 0; i < Math.min(512, n); i++) out[n - 1 - i]! *= i / 512;
  return normalizar(out, 0.9);
}
