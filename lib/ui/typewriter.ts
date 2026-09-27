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
