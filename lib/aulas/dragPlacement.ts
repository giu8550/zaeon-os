/** Estado de colocação de palavras em lacunas (puro/testável). slots[i] = palavra ou null. */
export function placeWord(slots: (string | null)[], word: string, slotIdx: number): (string | null)[] {
  const next = slots.map((s) => (s === word ? null : s)); // move: tira de onde estava
  next[slotIdx] = word;
  return next;
}

export function clearSlot(slots: (string | null)[], slotIdx: number): (string | null)[] {
  const next = [...slots];
  next[slotIdx] = null;
  return next;
}

/** Itens do banco ainda disponíveis (descontando os já colocados, por valor/duplicata). */
export function bankAvailable(bank: string[], slots: (string | null)[]): string[] {
  const used: Record<string, number> = {};
  for (const s of slots) if (s) used[s] = (used[s] || 0) + 1;
  const out: string[] = [];
  for (const w of bank) {
    if (used[w] > 0) used[w]--;
    else out.push(w);
  }
  return out;
}
