/**
 * O LIVRO-HOLOGRAMA de uma pesquisa (PURO) — no inventário, a pesquisa que a pessoa criou aparece como um livro aberto
 * de luz: a CAPA à esquerda (o título) e, à direita, as PÁGINAS que ela escreveu, em leque. Com 1 página: a capa e 1
 * página. As folhas desenhadas vão até `MAX_FOLHAS` (o número de verdade fica escrito embaixo).
 */
export const MAX_FOLHAS = 24;

/** quantas folhas desenhar */
export const folhasVisiveis = (paginas: number) => Math.max(1, Math.min(MAX_FOLHAS, Math.floor(paginas)));

/** o ângulo (rad, em volta da lombada; 0 = deitada aberta à direita) de cada folha: um leque que abre com mais folhas
 *  — a de cima (a última) a mais levantada, até ~38° */
export function anguloDasFolhas(n: number): number[] {
  const k = folhasVisiveis(n);
  if (k === 1) return [0.18];
  const abre = Math.min(0.66, 0.12 + k * 0.03);
  return Array.from({ length: k }, (_, i) => 0.05 + (abre * i) / (k - 1));
}

/** a valoração no inventário: a pesquisa do tutorial ainda não tem base de estudos (o veredito do Droid) */
export const VALOR_PESQUISA_SEM_BASE = "Sem base de estudos — ainda não dá pra vender nem publicar";
