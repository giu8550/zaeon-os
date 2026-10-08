/**
 * Cyberespaço — o SOM dos FIOS DE ENERGIA que ligam a Zaeon às salas (PURO, sintetizado — sem arquivo):
 *  - ZUMBIDO: o cabo energizado, perto dos postes das pontas — um hum grave de rede elétrica (com harmônicos) que
 *    respira devagar e uns estalinhos de faísca (loop de 4 s, sem emenda);
 *  - PUXA: quem está sendo puxado — um assobio elétrico com vibrato + o vento passando (loop de 2 s, sem emenda; o
 *    engine sobe a afinação com a velocidade).
 */
function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function normalizar(out: Float32Array, pico: number) {
  let m = 0; for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i]!));
  if (m > 0) for (let i = 0; i < out.length; i++) out[i]! *= pico / m;
  return out;
}
/** ruído filtrado com o rabo cruzado no começo (loop sem emenda) */
function ruidoCircular(n: number, sr: number, corte: number, seed: number): Float32Array {
  const X = Math.floor(sr * 0.25), r = prng(seed), a = 1 - Math.exp((-2 * Math.PI * corte) / sr), buf = new Float32Array(n + X), out = new Float32Array(n);
  let lp = 0; for (let i = 0; i < n + X; i++) { lp += (r() * 2 - 1 - lp) * a; buf[i] = lp; }
  for (let i = 0; i < n; i++) { const k = i < X ? i / X : 1; out[i] = buf[i]! * k + (i < X ? buf[n + i]! * (1 - k) : 0); }
  return out;
}

/** o ZUMBIDO do cabo (4 s): 55 Hz + harmônicos (ciclos inteiros no loop), respirando a 0,5 Hz, com faíscas */
export function sintetizarZumbidoFio(sr: number): Float32Array {
  const D = 4, n = Math.round(sr * D), out = new Float32Array(n), TWO = Math.PI * 2, r = prng(31);
  for (let i = 0; i < n; i++) {
    const t = i / sr, resp = 0.8 + 0.2 * Math.sin(TWO * 0.5 * t);
    out[i] = resp * (Math.sin(TWO * 55 * t) + 0.55 * Math.sin(TWO * 110 * t + 0.3) + 0.3 * Math.sin(TWO * 165 * t + 1.1) + 0.12 * Math.sin(TWO * 330 * t));
  }
  const chiado = ruidoCircular(n, sr, 3000, 7); for (let i = 0; i < n; i++) out[i]! += 0.18 * chiado[i]!;
  for (let k = 0; k < 9; k++) {   // os estalinhos de faísca
    const i0 = Math.floor(r() * n), len = Math.floor(sr * 0.012);
    for (let j = 0; j < len; j++) out[(i0 + j) % n]! += (r() * 2 - 1) * 0.9 * Math.exp(-j / (len * 0.3));
  }
  return normalizar(out, 0.6);
}

/** o PUXA (2 s): assobio elétrico 420 Hz (+ oitava) com vibrato de 6 Hz e o vento passando */
export function sintetizarPuxaFio(sr: number): Float32Array {
  const D = 2, n = Math.round(sr * D), out = new Float32Array(n), TWO = Math.PI * 2;
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = 420 + 18 * Math.sin(TWO * 6 * t);   // a fase do vibrato fecha (12 ciclos em 2 s)
    fase += (TWO * f) / sr;
    out[i] = 0.5 * Math.sin(fase) + 0.18 * Math.sin(2 * fase);
  }
  // (fecha o loop: 840 ciclos da portadora em 2 s e o vibrato é periódico)
  const vento = ruidoCircular(n, sr, 900, 13);
  for (let i = 0; i < n; i++) out[i]! = out[i]! * 0.6 + vento[i]! * 2.2 * (0.75 + 0.25 * Math.sin(TWO * 1.5 * (i / sr)));
  return normalizar(out, 0.65);
}
