/**
 * Cyberespaço SEM CHÃO (out. 2026): não existe mais o plano infinito com a grade — o hiperespaço é só VAZIO e áreas
 * flutuantes. A antiga praça (as bases de estudo de cada membro, o heliporto e o estacionamento pequeno das motos)
 * virou uma ILHA FLUTUANTE, igual às outras: passou da borda, cai. PURO, sem three.
 *
 * A PRAÇA PERTO DA ZAEON (out/2026, pedido do dono): "as superfícies de baixo não existem — a praça fica a 100 m da
 * Zaeon, um pouquinho mais abaixo (dá pra ver pela borda)". A Zaeon NÃO muda de lugar nem de altura (piso a 450 m); quem
 * sobe é o CHÃO DO HIPERESPAÇO: tudo que ficava "no chão" (y = 0 — a praça, as pistas de corrida, o pouso das naves e
 * das motos sobre o vazio) agora fica a `CHAO` m, 40 m abaixo do piso da Zaeon, e a praça fica ao NORTE dela, com a
 * borda a 100 m da borda da ilha (a nave-QG atracada na doca paira entre as duas).
 *
 * Quem cai no vazio (abaixo de `QUEDA_VAZIO`) renasce — o engine leva de volta pra praça.
 */
import type { P2 } from "./colisao";

/** o NÍVEL DO CHÃO do hiperespaço: o piso da praça (era 0). A Zaeon (lib/cyber/ceu `CIDADE.pisoY` = 450) fica 40 m acima */
export const CHAO: number = 410;
/** a ilha da praça: centro (ao norte da Zaeon, borda a 100 m da borda dela — a Zaeon tem centro em z −560 e raio 252),
 *  raio do piso andável e a altura do piso */
export const PRACA = { x: 0, z: -560 + 252 + 100 + 54, r: 54, y: CHAO } as const;
/** um ponto no referencial da PRAÇA (o que antes era medido a partir da origem do mapa) → mundo */
export const naPracaLocal = (x: number, z: number): P2 => ({ x: PRACA.x + x, z: PRACA.z + z });
/** o anel do BURACO NEGRO da praça (o nó dela na rede de túneis — lib/cyber/buracos): ao sul do centro, longe do
 *  heliporto e do estacionamento; as bases do anel desviam dele */
export const PORTAL_PRACA = { ...naPracaLocal(14, -32), r: 3 } as const;
/** abaixo disto (m) quem cai no vazio renasce (120 m abaixo do chão) */
export const QUEDA_VAZIO = CHAO - 120;
/** está em cima do piso da praça? */
export const naPraca = (p: P2, folga = 0) => Math.hypot(p.x - PRACA.x, p.z - PRACA.z) <= PRACA.r + folga;
/** o chão embaixo de quem está NO ALTURA da praça: o piso dela, ou o vazio (`null`) */
export const chaoDaPraca = (p: P2): number | null => (naPraca(p) ? PRACA.y : null);
