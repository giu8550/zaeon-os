/**
 * Cadência da "datilografia" das respostas (backlog v2 · B2).
 * Quanto mais atrasado o texto visível está do recebido, mais letras por frame —
 * mas com TETO, pra nunca "despejar" um bloco inteiro de uma vez (o efeito abrupto).
 */
export const TYPE_MAX_PER_FRAME = 6;

export function typeStep(remaining: number, max = TYPE_MAX_PER_FRAME): number {
  if (remaining <= 0) return 0;
  return Math.min(max, Math.max(1, Math.ceil(remaining / 30)));
}

/** Evita cortar no meio de um par surrogate (emoji) ao revelar parcialmente. */
export function safeCut(text: string, n: number): number {
  if (n <= 0 || n >= text.length) return Math.max(0, Math.min(n, text.length));
  const code = text.charCodeAt(n - 1);
  return code >= 0xd800 && code <= 0xdbff ? n + 1 : n;
}

/** a datilografia POR TEMPO (out/2026, "as respostas estão lentas"): o teto por QUADRO (`typeStep`) fazia o texto
 *  ficar segundos atrás do que já tinha chegado — 6 letras × 60 fps = 360/s, e menos quando a página perde quadros.
 *  Aqui o atraso se fecha em ~`alcance` segundos (uma fração do que falta a cada quadro, proporcional ao tempo
 *  passado), com um piso de `piso` letras/s pra cauda não se arrastar — independente do fps. */
export const REVELA_ALCANCE = 0.5, REVELA_PISO = 240;
export function revelarPorTempo(restante: number, dt: number, alcance = REVELA_ALCANCE, piso = REVELA_PISO): number {
  if (restante <= 0) return 0;
  const passo = Math.max(restante * Math.min(1, Math.max(0, dt) / alcance), piso * Math.max(0, dt));
  return Math.min(restante, Math.max(1, Math.ceil(passo)));
}
