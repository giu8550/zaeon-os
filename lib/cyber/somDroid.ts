/**
 * Cyberespaço — o SOM DOS DROIDS das estações da Terra (PURO, sem WebAudio): MAQUINÁRIO TECNOLÓGICO SE MOVENDO PELO AR
 * (pedido do dono, out/2026). Um loop sintetizado, sem arquivo e sem emenda, em 4 camadas:
 *  - o ZUMBIDO grave do campo antigravidade (fundamental + harmônicos, com um batimento lento);
 *  - a TURBINA fina, um assobio que sobe e desce devagar (FM periódica no loop);
 *  - o AR deslocado: ruído filtrado (passa-banda) que respira;
 *  - os SERVOS: zumbidos curtos de motor girando (sobe-desce de tom), espalhados no loop.
 * As frequências são múltiplos de 1/DUR (ciclos inteiros no loop) e o ruído é cruzado no fim → começo.
 * O engine toca um loop em cada droid (o líder um pouco mais grave e mais alto; voando, acelera).
 */
export const DUR_DROID = 6;

function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Hz → a frequência mais perto com ciclos inteiros no loop */
const inteira = (f: number) => Math.round(f * DUR_DROID) / DUR_DROID;

export function sintetizarMaquinaNoAr(sr: number): Float32Array {
  const n = Math.round(sr * DUR_DROID), out = new Float32Array(n), TWO = Math.PI * 2, r = prng(31);
  // 1) o ZUMBIDO: 55 Hz + harmônicos, com um 2º oscilador 1/DUR acima (o batimento lento, sem emenda)
  const f0 = inteira(55), dF = 1 / DUR_DROID;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    out[i] = 0.32 * Math.sin(TWO * f0 * t) + 0.22 * Math.sin(TWO * (f0 + dF) * t) + 0.18 * Math.sin(TWO * 2 * f0 * t + 0.4)
      + 0.1 * Math.sin(TWO * 3 * f0 * t + 1.1) + 0.05 * Math.sin(TWO * 5 * f0 * t + 2.3);
  }
  // 2) a TURBINA: ~1,3 kHz com a frequência ondulando (2 ciclos no loop); fase = integral da frequência (periódica:
  //    o termo da FM volta ao começo e fc·DUR é inteiro)
  const fc = inteira(1320), dev = 70, fm = 2 / DUR_DROID;
  for (let i = 0; i < n; i++) {
    const t = i / sr, fase = TWO * fc * t + (dev / fm) * Math.sin(TWO * fm * t);
    out[i]! += 0.055 * Math.sin(fase) * (0.75 + 0.25 * Math.sin(TWO * (3 / DUR_DROID) * t)) + 0.02 * Math.sin(2 * fase);
  }
  // 3) o AR deslocado: ruído passa-banda (~350–1400 Hz) que respira; a ponta final é cruzada no começo (sem clique)
  { const x = Math.round(sr * 0.4), raw = new Float32Array(n + x), aLo = 1 - Math.exp((-TWO * 1400) / sr), aHi = 1 - Math.exp((-TWO * 350) / sr);
    let lo = 0, hi = 0;
    for (let i = 0; i < raw.length; i++) { const w = r() * 2 - 1; lo += (w - lo) * aLo; hi += (lo - hi) * aHi; raw[i] = (lo - hi) * (0.6 + 0.4 * Math.sin((TWO * (i % n)) / sr / DUR_DROID * 2)); }
    for (let i = 0; i < n; i++) { const v = i < x ? raw[i]! * Math.sqrt(i / x) + raw[n + i]! * Math.sqrt(1 - i / x) : raw[i]!; out[i]! += 0.55 * v; } }
  // 4) os SERVOS: 3 zumbidos curtos (0,35 s) de motor girando — o tom sobe e volta, com o "grão" do motor (quadrada suave)
  for (let k = 0; k < 3; k++) {
    const em = (k + 0.2 + r() * 0.6) * (DUR_DROID / 3), i0 = Math.floor(em * sr), len = Math.floor(sr * 0.35), fa = 420 + r() * 260;
    let fase = 0;
    for (let j = 0; j < len; j++) {
      const u = j / len, f = fa * (1 + 0.6 * Math.sin(Math.PI * u)); fase += (TWO * f) / sr;
      const env = Math.sin(Math.PI * u) ** 2, grao = Math.tanh(2.2 * Math.sin(fase));
      out[(i0 + j) % n]! += 0.09 * env * grao;
    }
  }
  let m = 0; for (const v of out) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < n; i++) out[i] = (out[i]! / m) * 0.75;
  return out;
}
