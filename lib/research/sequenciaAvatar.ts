/**
 * O ROTEIRO da avatar enquanto a resposta é gerada (out/2026, o dono: "estruturarmos 3 tipos de animações e rodarmos;
 * o gatilho é a geração de resposta, mas não depende dos estágios dela"). PURO: dado há quanto tempo a resposta está
 * sendo gerada, qual sequência toca e em que ponto dela.
 *  1. PENSAR — os olhos acendem (uma vez, no começo);
 *  2. BUSCAR — ela flutua no meio dos hologramas da rede, com a aranha rastejando por eles (web crawling);
 *  3. ARVORE / CEREBRO — o holograma de uma árvore de habilidades ou de um cérebro se forma (alternam a cada ciclo).
 * Depois do PENSAR, 2 → 3 em laço até a resposta acabar.
 */
export type Sequencia = "pensar" | "buscar" | "arvore" | "cerebro";
export const DURACAO: Record<Sequencia, number> = { pensar: 2.8, buscar: 7, arvore: 5.5, cerebro: 5.5 };

/** `t` = s desde que a geração começou → a sequência, o progresso nela (0..1) e o número do ciclo */
export function sequenciaEm(t: number): { seq: Sequencia; u: number; ciclo: number } {
  if (!(t > 0)) return { seq: "pensar", u: 0, ciclo: 0 };
  if (t < DURACAO.pensar) return { seq: "pensar", u: t / DURACAO.pensar, ciclo: 0 };
  const volta = DURACAO.buscar + DURACAO.arvore, r = t - DURACAO.pensar, ciclo = Math.floor(r / volta), dentro = r - ciclo * volta;
  if (dentro < DURACAO.buscar) return { seq: "buscar", u: dentro / DURACAO.buscar, ciclo };
  const holo: Sequencia = ciclo % 2 === 0 ? "arvore" : "cerebro";
  return { seq: holo, u: (dentro - DURACAO.buscar) / DURACAO[holo], ciclo };
}

/** o envelope de uma sequência (entra e sai suave nas pontas): 0..1 */
export function envelope(u: number, entra = 0.12, sai = 0.12): number {
  const s = (x: number) => x * x * (3 - 2 * x);
  if (u < entra) return s(Math.max(0, u / entra));
  if (u > 1 - sai) return s(Math.max(0, (1 - u) / sai));
  return 1;
}
