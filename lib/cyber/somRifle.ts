/**
 * Cyberespaço — os SONS do RIFLE CÓSMICO (lib/cyber/rifle), sintetizados no navegador como os outros (lib/cyber/audio
 * SINTESE): o TIRO de energia (um "pew" grave e curto: a varredura que cai, o estalo e o corpo), o VAPOR do
 * superaquecimento (o chiado que esvazia) e o SACAR (a arma se materializando: um brilho que sobe).
 */
export type NomeSomRifle = "rifle-tiro" | "rifle-vapor" | "rifle-saca";

function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normalizar = (x: Float32Array, pico: number) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / m) * pico; return x; };

/** o TIRO (0,22 s): a varredura de 1900 → 140 Hz com um tico de FM (o "laser"), o estalo do começo e o corpo grave */
export function sintetizarTiroRifle(sr: number): Float32Array {
  const n = Math.round(sr * 0.22), x = new Float32Array(n), r = prng(71);
  let fase = 0, fase2 = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, u = t / 0.22, f = 140 + 1760 * Math.exp(-t * 26);
    fase += (2 * Math.PI * f) / sr; fase2 += (2 * Math.PI * 55) / sr;
    const env = Math.exp(-t * 16) * Math.min(1, t / 0.002);
    const laser = Math.sin(fase + 1.6 * Math.sin(fase * 0.5)) * env;
    lp += ((r() * 2 - 1) - lp) * 0.5; const estalo = lp * Math.exp(-t * 140);
    const corpo = Math.sin(fase2) * Math.exp(-t * 22) * 0.7;
    x[i] = (laser * 0.8 + estalo * 0.9 + corpo) * (1 - u * 0.2);
  }
  return normalizar(x, 0.9);
}
/** o VAPOR do superaquecimento (0,7 s): ruído chiado que abre e esvazia */
export function sintetizarVaporRifle(sr: number): Float32Array {
  const n = Math.round(sr * 0.7), x = new Float32Array(n), r = prng(72);
  let hp = 0, ant = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1; hp = 0.85 * (hp + w - ant); ant = w;
    x[i] = hp * Math.min(1, t / 0.03) * Math.exp(-t * 4.5);
  }
  return normalizar(x, 0.6);
}
/** SACAR (0,4 s): três parciais que sobem e um brilho agudo — a arma se forma */
export function sintetizarSacaRifle(sr: number): Float32Array {
  const n = Math.round(sr * 0.4), x = new Float32Array(n);
  const fases = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const t = i / sr, sobe = 1 + 1.4 * (t / 0.4), env = Math.min(1, t / 0.02) * Math.exp(-t * 6);
    let v = 0;
    [330, 495, 990].forEach((f, k) => { fases[k]! += (2 * Math.PI * f * sobe) / sr; v += Math.sin(fases[k]!) / (k + 1); });
    x[i] = v * env;
  }
  return normalizar(x, 0.5);
}
export const SINTESE_RIFLE: Record<NomeSomRifle, (sr: number) => Float32Array> = { "rifle-tiro": sintetizarTiroRifle, "rifle-vapor": sintetizarVaporRifle, "rifle-saca": sintetizarSacaRifle };
