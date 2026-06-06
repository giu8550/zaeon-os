// Efeito de digitação (typewriter) — helpers puros, unicode-safe.

/** Quantos caracteres devem estar visíveis dado o tempo decorrido (cps = chars por segundo). */
export function typedLength(textLength: number, elapsedMs: number, cps: number): number {
  if (cps <= 0) return textLength;
  const n = Math.floor((Math.max(0, elapsedMs) / 1000) * cps);
  return Math.min(textLength, Math.max(0, n));
}

/** Prefixo do texto já "digitado" no tempo decorrido (fatiado por code point). */
export function typedSlice(text: string, elapsedMs: number, cps: number): string {
  const chars = [...text];
  return chars.slice(0, typedLength(chars.length, elapsedMs, cps)).join("");
}
