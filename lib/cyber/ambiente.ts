/**
 * Cyberespaço — a MÚSICA AMBIENTE dos espaços de convivência (PURO, sem three/WebAudio): cada sala tem a sua trilha
 * minimalista, SINTETIZADA no navegador (sem arquivo) e tocada em loop pelas caixas de som discretas dela
 * (components/cyber/Salas `caixaMinimal`). Afinação 432 Hz, como o resto do cyberespaço. O loop é SEM EMENDA: as
 * frequências caem em múltiplos de 1/DUR (ciclos inteiros no loop) e o que tem ruído é cruzado no fim → começo.
 *  - BIBLIOTECA: um pad alto e calmo + sininhos esparsos (pentatônica) + uma chuvinha bem baixa lá fora;
 *  - JARDIM: quintas abertas no ar + água correndo e gotas.
 */
export type SalaAmbiente = "biblioteca" | "jardim";
/** duração do loop (s) */
export const DUR_AMBIENTE = 16;

const A = 432;
/** nota (semitons a partir do Lá 432) → Hz, arredondada pra ciclos inteiros no loop */
const nota = (st: number) => Math.round(A * Math.pow(2, st / 12) * DUR_AMBIENTE) / DUR_AMBIENTE;
function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** os acordes (semitons do Lá) que se revezam no loop, cada um em janela suave (cosseno) que cruza com o próximo.
 *  Rápido: osciladores por RECORRÊNCIA (y[n+1] = 2·cos(w)·y[n] − y[n−1]) — nada de Math.sin por amostra */
function pad(out: Float32Array, sr: number, acordes: number[][], o: { ganho: number; tremolo?: number; brilho?: number }) {
  const n = out.length, passo = DUR_AMBIENTE / acordes.length, TWO = Math.PI * 2, meia = Math.floor(passo * 0.95 * sr), L = 2 * meia + 1;
  const jan = new Float32Array(L);   // a janela (com o tremolo) de um acorde — a mesma pras notas dele
  acordes.forEach((ac, k) => {
    const ic = Math.floor((k + 0.5) * passo * sr), i0 = ic - meia;
    for (let j = 0; j < L; j++) { const d = (j - meia) / meia, t = (i0 + j) / sr; jan[j] = (0.5 + 0.5 * Math.cos(Math.PI * d)) * (o.tremolo ? 0.85 + 0.15 * Math.sin(TWO * o.tremolo * t + k) : 1); }
    const osc = (f: number, fase: number, amp: number) => {   // soma amp·jan·sin(2πf t + fase) na janela (dando a volta no loop)
      const w = (TWO * f) / sr, c2 = 2 * Math.cos(w);
      let y1 = Math.sin(w * (i0 - 1) + fase), y0 = Math.sin(w * i0 + fase);
      for (let j = 0; j < L; j++) { const i = (((i0 + j) % n) + n) % n; out[i]! += amp * jan[j]! * y0; const y2 = c2 * y0 - y1; y1 = y0; y0 = y2; }
    };
    for (const st of ac) {
      const f = nota(st);
      osc(f, 0, o.ganho); osc(f + 1 / DUR_AMBIENTE, 1, o.ganho * 0.5); osc(nota(st + 12), 0, o.ganho * (o.brilho ?? 0.25));   // + o coro leve e a oitava
    }
  });
}
/** um SININHO (sino/kalimba): parcial fundamental + inarmônicos, decaimento exponencial */
function sino(out: Float32Array, sr: number, em: number, st: number, ganho: number) {
  const f = A * Math.pow(2, st / 12), TWO = Math.PI * 2, i0 = Math.floor(em * sr), len = Math.floor(sr * 3.2);
  for (let j = 0; j < len; j++) {
    const i = (i0 + j) % out.length, t = j / sr, env = Math.exp(-t * 1.6) * Math.min(1, t * 400);
    out[i]! += ganho * env * (Math.sin(TWO * f * t) + 0.35 * Math.sin(TWO * f * 2.76 * t) * Math.exp(-t * 3) + 0.15 * Math.sin(TWO * f * 5.4 * t) * Math.exp(-t * 6));
  }
}
/** RUÍDO filtrado (passa-baixa de 1 polo) — chuva/água — com o fim cruzado no começo (loop sem emenda) */
function ruido(out: Float32Array, sr: number, corte: number, ganho: number, seed: number, mod?: (t: number) => number) {
  const n = out.length, X = Math.floor(sr * 0.6), r = prng(seed), a = 1 - Math.exp((-2 * Math.PI * corte) / sr), buf = new Float32Array(n + X);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n + X; i++) { lp += (r() * 2 - 1 - lp) * a; lp2 += (lp - lp2) * a; buf[i] = lp2; }
  for (let i = 0; i < n; i++) {
    let v = buf[i]!;
    if (i < X) { const k = i / X; v = v * k + buf[n + i]! * (1 - k); }   // o rabo (depois do fim) entra cruzado no começo
    out[i]! += ganho * v * (mod ? mod(i / sr) : 1);
  }
}
function normalizar(out: Float32Array, pico: number) {
  let m = 0; for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i]!));
  if (m > 0) for (let i = 0; i < out.length; i++) out[i]! *= pico / m;
  return out;
}

/** a trilha ambiente da sala (mono, `sr` Hz, DUR_AMBIENTE s) */
export function sintetizarAmbiente(sala: SalaAmbiente, sr: number): Float32Array {
  const out = new Float32Array(Math.round(sr * DUR_AMBIENTE));
  if (sala === "biblioteca") {
    pad(out, sr, [[0, 7, 12], [-2, 5, 10], [3, 7, 15], [-4, 3, 8]], { ganho: 0.1, brilho: 0.35 });
    const r = prng(7), penta = [12, 14, 17, 19, 21, 24];
    for (let k = 0; k < 6; k++) sino(out, sr, k * (DUR_AMBIENTE / 6) + r() * 1.2, penta[Math.floor(r() * penta.length)]!, 0.22);
    ruido(out, sr, 1800, 0.05, 11);   // a chuvinha
  } else {
    pad(out, sr, [[-12, -5, 2], [-10, -3, 4], [-15, -8, -1], [-12, -5, 0]], { ganho: 0.12, brilho: 0.3 });
    ruido(out, sr, 900, 0.22, 23, (t) => 0.7 + 0.3 * Math.sin((2 * Math.PI * t * 3) / DUR_AMBIENTE));   // a água correndo
    const r = prng(5);
    for (let k = 0; k < 14; k++) {   // gotas: um "plic" curto subindo de tom
      const em = r() * DUR_AMBIENTE, f0 = 900 + r() * 900, i0 = Math.floor(em * sr), len = Math.floor(sr * 0.09);
      for (let j = 0; j < len; j++) { const t = j / sr, i = (i0 + j) % out.length; out[i]! += 0.12 * Math.exp(-t * 55) * Math.sin(2 * Math.PI * (f0 + 2600 * t) * t); }
    }
  }
  return normalizar(out, 0.7);
}
