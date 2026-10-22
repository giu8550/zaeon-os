/**
 * O ROSTO de quem anda SEM CAPACETE (o traje único — components/cyber/CabecaAnime): a pele, o cabelo (o corte e a cor)
 * e os olhos de cada personagem, tirados do id — o mesmo em todo cliente, sem passar pela rede.
 */
export const PELES = [0xf6dcc8, 0xefc7a6, 0xd9a47c, 0xb97d55, 0x8d5a3b, 0x6b412a] as const;
export const CABELOS = [0x1b1714, 0x3a2418, 0x6b4126, 0xa8743c, 0xe0c27a, 0xc2462e, 0x2a2f6e, 0x8a5cc8, 0xe6e6f0, 0x2f8a7a] as const;
export const OLHOS = [0x3b6fd1, 0x2f9c6a, 0x6b4126, 0x8a5cc8, 0xc23a5a, 0x2aa8c4] as const;
export const CORTES_M = ["curto", "espetado", "topete", "raspado"] as const;
export const CORTES_F = ["longo", "rabo", "coque", "chanel"] as const;
export type Corte = (typeof CORTES_M)[number] | (typeof CORTES_F)[number];
export type Rosto = { pele: number; cabelo: number; olhos: number; corte: Corte; feminino: boolean };

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** o rosto de um id (determinístico) */
export function rostoDe(id: string, feminino: boolean): Rosto {
  const h = hash(id), pega = <T,>(xs: readonly T[], k: number) => xs[Math.floor(h / k) % xs.length]!;
  return { pele: pega(PELES, 1), cabelo: pega(CABELOS, 7), olhos: pega(OLHOS, 71), corte: feminino ? pega(CORTES_F, 701) : pega(CORTES_M, 701), feminino };
}
