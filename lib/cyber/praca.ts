/**
 * Cyberespaço SEM CHÃO (out. 2026): não existe mais o plano infinito com a grade — o hiperespaço é só VAZIO e áreas
 * flutuantes. A antiga praça (as bases de estudo de cada membro, o heliporto e o estacionamento pequeno das motos)
 * virou uma ILHA FLUTUANTE na altura 0, igual às outras: passou da borda, cai. PURO, sem three.
 *
 * Quem cai no vazio (abaixo de `QUEDA_VAZIO`) renasce — o engine leva de volta pra praça.
 */
import type { P2 } from "./colisao";

/** a ilha da praça: centro, raio do piso andável e a altura do piso (y = 0, a "altura de referência" do mapa) */
export const PRACA = { x: 0, z: 0, r: 54, y: 0 } as const;
/** o anel do BURACO NEGRO da praça (o nó dela na rede de túneis — lib/cyber/buracos): ao sul do centro, longe do
 *  heliporto e do estacionamento; as bases do anel desviam dele */
export const PORTAL_PRACA = { x: 14, z: -32, r: 3 } as const;
/** abaixo disto (m) quem cai no vazio renasce */
export const QUEDA_VAZIO = -70;
/** está em cima do piso da praça? */
export const naPraca = (p: P2, folga = 0) => Math.hypot(p.x - PRACA.x, p.z - PRACA.z) <= PRACA.r + folga;
/** o chão embaixo de quem está NO ALTURA da praça: o piso dela, ou o vazio (`null`) */
export const chaoDaPraca = (p: P2): number | null => (naPraca(p) ? PRACA.y : null);
