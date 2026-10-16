/**
 * Cyberespaço — HABILIDADES por tecla (PURO). Cada habilidade é um "script": tecla, quem pode usar, recarga e as falas.
 * O engine pergunta `habilidadeDaTecla` no keydown e executa o efeito (components/cyber/engine `usarHabilidade`).
 * Base da seção de AGENTES: invocar/dispensar companheiros é uma habilidade como outra qualquer. Hoje só o founder tem
 * habilidades; depois elas se conquistam progredindo (como as skins).
 */

export type IdHabilidade = "droid-companheiro";
export type QuemUsa = "fundador" | "todos";
export type Habilidade = { id: IdHabilidade; tecla: string; nome: string; quem: QuemUsa; /** s entre dois usos */ recarga: number };

export const HABILIDADES: readonly Habilidade[] = [
  // G: o DROID (o ofanim do tutorial) sai do portal e passa a te seguir; G de novo, ele volta pro portal
  { id: "droid-companheiro", tecla: "g", nome: "Droid companheiro", quem: "fundador", recarga: 1.2 },
];

export type CtxHabilidade = { fundador: boolean; digitando: boolean; repetida: boolean; modificador: boolean };

/** quais habilidades esta pessoa tem */
export const habilidadesDe = (fundador: boolean) => HABILIDADES.filter((h) => h.quem === "todos" || fundador);

/** a tecla aciona alguma habilidade? (ignora digitando, repetição do teclado e atalhos com Ctrl/⌘/Alt) */
export function habilidadeDaTecla(tecla: string, c: CtxHabilidade): Habilidade | null {
  if (c.digitando || c.repetida || c.modificador) return null;
  const k = tecla.toLowerCase();
  return habilidadesDe(c.fundador).find((h) => h.tecla === k) ?? null;
}

/** pode usar agora? (recarga) */
export const prontaPraUsar = (h: Habilidade, ultimoUso: number | undefined, agora: number) => ultimoUso === undefined || agora - ultimoUso >= h.recarga - 1e-9;

/** a tecla do RÁDIO (push-to-talk): G — a não ser que uma habilidade sua use o G; aí o rádio vai pro V */
export const teclaDoRadio = (fundador: boolean) => (habilidadesDe(fundador).some((h) => h.tecla === "g") ? "v" : "g");

/** o que o Droid companheiro diz ao chegar e ao ir embora (sorteado) */
export const FALAS_DROID = {
  chega: ["Às ordens ✦", "Estou contigo.", "Pronto. Vou junto.", "Chamou? Tô aqui ✦"],
  vai: ["Até já ✦", "Volto quando chamar.", "Fui. Bons estudos!"],
} as const;
export const sortear = <T,>(lista: readonly T[], r: number): T => lista[Math.min(lista.length - 1, Math.floor(r * lista.length))]!;
