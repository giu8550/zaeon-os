/**
 * Cyberespaço — REGIÕES por distância (o que o CS Brasil faz com os lotes de props: só desenha e anima o que está
 * perto). Cada região (Zaeon do céu, UNILAB, Solana House, cada marco, base e moto) é um CILINDRO no mundo
 * (`x`,`z`,`r` + faixa de altura `y0`..`y1`); a distância da câmera até ele decide:
 *  - `detalhe`: móveis, telas, botões, partículas (peças pequenas) — só de perto;
 *  - `anima`: o `atualizar` da região (luzes, LEDs, discos girando…) — um pouco mais longe que o detalhe;
 *  - `visivel`: a silhueta (paredes, torres, disco) — até perto do fim da visão.
 * Com FOLGA: quem já está ligado só desliga `folga` metros depois (na fronteira não fica piscando). PURO.
 */
export type Regiao = { x: number; z: number; r: number; y0: number; y1: number };
export type EstadoRegiao = { visivel: boolean; detalhe: boolean; anima: boolean };
export const DIST_REGIAO = { detalhe: 110, anima: 170, visivel: 2300, folga: 15 } as const;   // (o mapa cresceu: de longe a silhueta continua)

/** distância (m) de um ponto até o cilindro da região (0 dentro) */
export function distanciaDaRegiao(p: { x: number; y: number; z: number }, g: Regiao): number {
  const h = Math.max(0, Math.hypot(p.x - g.x, p.z - g.z) - g.r), v = p.y < g.y0 ? g.y0 - p.y : p.y > g.y1 ? p.y - g.y1 : 0;
  return Math.hypot(h, v);
}

export function estadoDaRegiao(cam: { x: number; y: number; z: number }, g: Regiao, antes?: EstadoRegiao): EstadoRegiao {
  const d = distanciaDaRegiao(cam, g), f = DIST_REGIAO.folga;
  const liga = (lim: number, era?: boolean) => d < lim + (era ? f : 0);
  const visivel = liga(DIST_REGIAO.visivel, antes?.visivel), anima = visivel && liga(DIST_REGIAO.anima, antes?.anima), detalhe = anima && liga(DIST_REGIAO.detalhe, antes?.detalhe);
  return { visivel, detalhe, anima };
}
