/**
 * O SOM do TABLET (PURO, sintetizado) — abrir e guardar (pedido do dono, out/2026: "algo mais suave, sutil e
 * tecnológico", no lugar do "rise"/alerta). Um acorde de vidro curtinho que DESLIZA (abrir: sobe; guardar: desce), dois
 * parciais senoidais com ataque macio, um brilho de ar filtrado bem baixo e três "ticks" digitais quase imperceptíveis —
 * tipo uma interface de holograma ligando. Volume baixo; sem clique no fim.
 */
const prng = (s: number) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

export function sintetizarTablet(sr: number, abre: boolean): Float32Array {
  const dur = abre ? 0.55 : 0.42, n = Math.round(sr * dur), out = new Float32Array(n), r = prng(abre ? 91 : 93);
  const f0 = abre ? 740 : 1180, f1 = abre ? 1180 : 700;   // o deslize (Hz)
  let fa = 0, fb = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, u = Math.min(1, t / 0.14), suave = u * u * (3 - 2 * u);
    const f = f0 + (f1 - f0) * suave;
    fa += (2 * Math.PI * f) / sr; fb += (2 * Math.PI * f * 1.5) / sr;   // a quinta, mais baixa
    const env = Math.min(1, t / 0.018) * Math.exp(-t * (abre ? 6.5 : 8.5));
    const tom = Math.sin(fa) * 0.55 + Math.sin(fb) * 0.22 * Math.exp(-t * 9);
    // o AR: ruído passa-baixa fininho, só no começo
    lp += 0.08 * ((r() * 2 - 1) - lp);
    const ar = lp * 0.18 * Math.exp(-t * 14);
    // os TICKS digitais: 3 grãos curtos de 2,4 kHz no começo (abre) / no fim (guarda)
    let tick = 0;
    for (let k = 0; k < 3; k++) { const tk = abre ? 0.012 + k * 0.026 : dur - 0.11 + k * 0.024, dt = t - tk; if (dt >= 0 && dt < 0.006) tick += Math.sin(2 * Math.PI * 2400 * dt) * (1 - dt / 0.006) * 0.12; }
    out[i] = (tom + ar) * env + tick;
  }
  // sem clique no fim + volume baixo
  const cauda = Math.round(sr * 0.03); for (let i = 0; i < cauda; i++) out[n - 1 - i]! *= i / cauda;
  let pico = 0; for (const v of out) pico = Math.max(pico, Math.abs(v));
  const k = pico > 0 ? 0.32 / pico : 1; for (let i = 0; i < n; i++) out[i]! *= k;
  return out;
}
