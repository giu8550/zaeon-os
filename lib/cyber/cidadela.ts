/**
 * Cyberespaço — os LUGARES DE ESTUDO DA CIDADELA por hierarquia acadêmica (PURO). As CABINES (level 10, 7–9,
 * mestrandos) são do layout da ilha (lib/cyber/ceu `cabinesDaCidadela`, entram nos colisores); aqui ficam:
 *  - o ASSENTO de cada cabine (a cadeira, de frente pra mesa e pra capela);
 *  - as RODAS DE ESTUDO dos level 1–3 (graduação, sem cabine): grupos de 4 lugares no chão, em volta das SUPERTREES (as árvores de
 *    Singapura, nas pontas da cidadela) e atrás das cabines dos mestrandos — cada GRUPO DE ESTUDOS fica numa roda.
 * Tudo determinístico; local da ilha → mundo pelo `mundo` do ceu.
 */
import { CABINE, CIDADE, alturaNaCidade, cabinesDaCidadela, colisoresDaCidade, daCabine, mundo, naIlhaPrincipal, type CabineEstudo } from "./ceu";
import { SUPERTREES } from "./terra";
import type { Spot } from "./frota/lugares";

type P2 = { x: number; z: number };

/** o ASSENTO de uma cabine como lugar de estudo (sentado na cadeira, de frente pra mesa — e pra capela) */
export function assentoDaCabine(c: CabineEstudo): Spot {
  const w = mundo(daCabine(c, CABINE.assento.x, CABINE.assento.z));
  return { id: `cidadela-${c.id}`, ambiente: "cidadela", tipo: "cabine", x: w.x, z: w.z, y: CIDADE.pisoY, rumo: c.rot, zaeon: true };
}

/** uma RODA DE ESTUDO dos level 1–3: o centro (local) e os 4 lugares no chão (mundo), virados pro centro da roda */
export type RodaDeEstudo = { id: string; tipo: "supertree" | "cabine"; centro: P2; lugares: Spot[] };
export const LUGARES_POR_RODA = 4;
/** quantos metros do tronco da supertree os level 1–3 sentam */
export const RODA_SUPERTREE_R = 5.4;

let rodasCache: RodaDeEstudo[] | null = null;
/** as rodas: uma em volta de cada supertree (do lado de dentro da ilha) e uma atrás de cada 4ª cabine de mestrando */
export function rodasDeEstudo(): RodaDeEstudo[] {
  if (rodasCache) return rodasCache;
  const cs = colisoresDaCidade(), out: RodaDeEstudo[] = [];
  const livre = (l: P2) => { const w = mundo(l); return naIlhaPrincipal(w) && alturaNaCidade(w) === 0 && Math.hypot(l.x, l.z) <= CIDADE.andavelR - 2 && cs.every((c) => Math.hypot(w.x - c.x, w.z - c.z) > c.r + 0.7); };
  const lugar = (id: string, l: P2, olha: P2): Spot => { const w = mundo(l); return { id, ambiente: "cidadela", tipo: "piso", x: w.x, z: w.z, y: CIDADE.pisoY, rumo: Math.atan2(olha.x - l.x, olha.z - l.z), zaeon: true }; };
  // em volta das SUPERTREES: 4 lugares no lado de dentro (rumo ao centro da ilha), um arco de ~140°
  SUPERTREES.forEach((t, k) => {
    const dentro = Math.atan2(-t.z, -t.x), ls: Spot[] = [];
    for (const [j, da] of [-1.2, -0.4, 0.4, 1.2].entries()) {
      let l: P2 | null = null;
      for (let dr = 0; dr <= 3 && !l; dr += 0.6) for (const extra of [0, 0.25, -0.25]) { const a = dentro + da + extra, c = { x: t.x + Math.cos(a) * (RODA_SUPERTREE_R + dr), z: t.z + Math.sin(a) * (RODA_SUPERTREE_R + dr) }; if (livre(c) && ls.every((s) => Math.hypot(mundo(c).x - s.x, mundo(c).z - s.z) > 1.4)) { l = c; break; } }
      if (l) ls.push(lugar(`cidadela-roda-arvore-${k}-${j}`, l, t));
    }
    if (ls.length === LUGARES_POR_RODA) out.push({ id: `roda-arvore-${k}`, tipo: "supertree", centro: { x: t.x, z: t.z }, lugares: ls });
  });
  // atrás das CABINES dos mestrandos (uma a cada 4): uma rodinha no chão, 4 m atrás da cadeira
  for (const c of cabinesDaCidadela().filter((c) => c.nivel === "mestrando" && c.i % 4 === 1)) {
    const centro = daCabine(c, 0, CABINE.assento.z - 4.2), ls: Spot[] = [];
    for (let j = 0; j < LUGARES_POR_RODA; j++) { const a = (j / LUGARES_POR_RODA) * Math.PI * 2 + 0.4, l = { x: centro.x + Math.cos(a) * 1.5, z: centro.z + Math.sin(a) * 1.5 }; if (livre(l)) ls.push(lugar(`cidadela-roda-${c.id}-${j}`, l, centro)); }
    if (ls.length === LUGARES_POR_RODA) out.push({ id: `roda-${c.id}`, tipo: "cabine", centro, lugares: ls });
  }
  return (rodasCache = out);
}

/** todos os lugares de estudo da cidadela (os assentos das cabines + os das rodas) */
export function lugaresDaCidadela(): Spot[] {
  return [...cabinesDaCidadela().map(assentoDaCabine), ...rodasDeEstudo().flatMap((r) => r.lugares)];
}
