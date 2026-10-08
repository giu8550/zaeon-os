/**
 * Frota de IAs — o ACASO DETERMINÍSTICO (PURO). Tudo que a frota faz sai de sementes: o mesmo agente, no mesmo dia, faz a
 * mesma coisa em qualquer cliente (sem rede pra sincronizar 700 jogadores) — e muda de um dia pro outro, de um agente pro
 * outro. Aqui: o gerador (mulberry32), o hash de texto e os sorteios que o resto usa.
 */
export type Acaso = () => number;

/** gerador pseudo-aleatório (mulberry32): [0, 1) */
export function acaso(semente: number): Acaso {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** hash de texto (FNV-1a 32 bits) — pra derivar sementes de "agente|dia|bloco" */
export function hash(...partes: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const c of partes.join("|")) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** um acaso novo pra uma combinação de chaves (cada decisão tem o seu — mexer numa não bagunça as outras) */
export const acasoDe = (...partes: (string | number)[]) => acaso(hash(...partes));
export const entre = (r: Acaso, a: number, b: number) => a + (b - a) * r();
export const inteiro = (r: Acaso, a: number, b: number) => Math.floor(entre(r, a, b + 1));
export const escolher = <T>(r: Acaso, l: readonly T[]): T => l[Math.floor(r() * l.length) % l.length]!;
/** sorteio ponderado: `pesos` em qualquer escala */
export function ponderado<T extends string>(r: Acaso, pesos: Readonly<Record<T, number>>): T {
  const chaves = Object.keys(pesos) as T[], total = chaves.reduce((s, k) => s + Math.max(0, pesos[k]), 0);
  let x = r() * total;
  for (const k of chaves) { x -= Math.max(0, pesos[k]); if (x < 0) return k; }
  return chaves[chaves.length - 1]!;
}
/** embaralha (Fisher–Yates) numa cópia */
export function embaralhar<T>(r: Acaso, l: readonly T[]): T[] {
  const o = [...l];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j]!, o[i]!]; }
  return o;
}
