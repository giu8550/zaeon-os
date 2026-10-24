/**
 * O ROTEIRO da avatar enquanto a resposta é gerada (out/2026, o dono: "estruturarmos tipos de animações e rodarmos; o
 * gatilho é a geração de resposta, mas não depende dos estágios dela"; depois: "níveis de um evento — eventos rápidos,
 * um web scraping visual já resolve: uma aranha passeando em cima da tela e se alimentando das telas; se for mais de
 * 5 s, a aranha vira uma energia e raios aparecem"). PURO: dado há quanto tempo a resposta está sendo gerada, qual
 * sequência toca e em que ponto dela.
 *  1. PENSAR  — os olhos acendem (o começo);
 *  2. RASPAR  — as telas acendem e a ARANHA passeia pela página se alimentando delas (o nível rápido: até 5 s);
 *  3. ENERGIA — passou de 5 s: a aranha vira uma esfera de energia e RAIOS saltam dela pras telas;
 *  4. depois, numa resposta longa: ÁRVORE de habilidades → ENERGIA → CÉREBRO → ENERGIA… em laço.
 */
export type Sequencia = "pensar" | "raspar" | "energia" | "arvore" | "cerebro";
/** quando cada nível começa (s desde o começo da geração) */
export const NIVEL = { raspar: 1.4, energia: 5, holo: 12 } as const;
export const DURACAO = { arvore: 5.5, cerebro: 5.5, energia: 4 } as const;
const LACO: readonly Sequencia[] = ["arvore", "energia", "cerebro", "energia"];

/** `t` = s desde que a geração começou → a sequência, o progresso nela (0..1) e o número do bloco */
export function sequenciaEm(t: number): { seq: Sequencia; u: number; ciclo: number } {
  if (!(t > 0)) return { seq: "pensar", u: 0, ciclo: 0 };
  if (t < NIVEL.raspar) return { seq: "pensar", u: t / NIVEL.raspar, ciclo: 0 };
  if (t < NIVEL.energia) return { seq: "raspar", u: (t - NIVEL.raspar) / (NIVEL.energia - NIVEL.raspar), ciclo: 0 };
  if (t < NIVEL.holo) return { seq: "energia", u: (t - NIVEL.energia) / (NIVEL.holo - NIVEL.energia), ciclo: 0 };
  const volta = LACO.reduce((s, q) => s + DURACAO[q as keyof typeof DURACAO], 0);
  let r = t - NIVEL.holo; const ciclo = Math.floor(r / volta); r -= ciclo * volta;
  for (let i = 0; i < LACO.length; i++) {
    const q = LACO[i]!, d = DURACAO[q as keyof typeof DURACAO];
    if (r < d) return { seq: q, u: r / d, ciclo: ciclo * LACO.length + i + 1 };
    r -= d;
  }
  return { seq: "energia", u: 1, ciclo };
}

/** o envelope de uma sequência (entra e sai suave nas pontas): 0..1 */
export function envelope(u: number, entra = 0.12, sai = 0.12): number {
  const s = (x: number) => x * x * (3 - 2 * x);
  if (u < entra) return s(Math.max(0, u / entra));
  if (u > 1 - sai) return s(Math.max(0, (1 - u) / sai));
  return 1;
}
