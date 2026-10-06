/**
 * Cyberespaço — os LUGARES FLUTUANTES (PURO): discos no céu com chão de verdade, que qualquer pessoa visita.
 *  - "univ": a Universidade (UNILAB), a 170 m (lib/cyber/universidade.ts);
 *  - "solana": a Solana House da Superteam Brasil, a 120 m, com 3 andares + rooftop (lib/cyber/solana.ts).
 * (A Zaeon, a 230 m, é a ilha do céu de lib/cyber/ceu.ts — tem o portal do buraco negro e a física dela.)
 *
 * Como se chega: o ELEVADOR DE LUZ — um anel no chão, embaixo do disco; pisou, sobe (aparece na `chegada`). Lá em
 * cima, o anel de volta desce. Também dá pra pousar de moto/nave (o disco é sólido) e voar de mochila em volta.
 * A borda do disco é LIVRE (sem parede invisível): passou, cai. Os andares de cima da Solana House são trocados pelo
 * elevador do prédio (tecla F).
 */
import type { P2 } from "./colisao";
import type { Pilar } from "./voo";
import { UNIVERSIDADE, pilaresDaUniversidade, resolverUniversidade, resolverUniversidadeNoAr } from "./universidade";
import { ANDARES_SOLANA, NOMES_ANDARES, ROOFTOP, SOLANA, andavel, decolaNaSolana, localS, mundoS, noElevador, pousosSolana, proximoAndar, resolverNoAndar, resolverNoArSolana } from "./solana";

export type IdPlataforma = "univ" | "solana";
export type Anel = { x: number; z: number; r: number };
export type Plataforma = {
  id: IdPlataforma; nome: string;
  centro: P2; y: number; r: number;
  /** anel do elevador de luz no CHÃO (mundo) e o de volta no disco (mundo, no piso do disco) */
  anelChao: Anel; anelDisco: Anel;
  /** onde se aparece ao subir (mundo, no disco) e ao descer (mundo, no chão), e pra onde se olha */
  chegada: P2 & { rumo: number }; volta: P2 & { rumo: number };
};

const w = (c: P2, l: P2) => ({ x: c.x + l.x, z: c.z + l.z });
const U = UNIVERSIDADE, S = SOLANA;
export const PLATAFORMAS: Record<IdPlataforma, Plataforma> = {
  univ: {
    id: "univ", nome: "Universidade", centro: U.centro, y: U.y, r: U.discoR,
    anelChao: { ...w(U.centro, { x: 0, z: -121 }), r: 3.2 }, anelDisco: { ...w(U.centro, { x: 0, z: -134 }), r: 3 },
    chegada: { ...w(U.centro, { x: 0, z: -124 }), rumo: 0 },          // de frente pro portão (norte)
    volta: { ...w(U.centro, { x: 0, z: -127 }), rumo: Math.PI },       // no chão, de frente pra praça (sul)
  },
  solana: {
    id: "solana", nome: "Solana House", centro: S.centro, y: S.y, r: S.r,
    anelChao: { ...mundoS({ x: 0, z: -22 }), r: 3 }, anelDisco: { ...mundoS({ x: 0, z: -25 }), r: 2.6 },
    chegada: { ...mundoS({ x: 0, z: -19 }), rumo: 0 },
    volta: { ...mundoS({ x: 0, z: -28 }), rumo: Math.PI },
  },
};
export const IDS_PLATAFORMAS = Object.keys(PLATAFORMAS) as IdPlataforma[];

const dentro = (p: P2, a: Anel) => Math.hypot(p.x - a.x, p.z - a.z) < a.r;
/** pisou no anel do elevador no CHÃO de qual plataforma (ou null) */
export const anelDoChao = (p: P2): IdPlataforma | null => IDS_PLATAFORMAS.find((id) => dentro(p, PLATAFORMAS[id].anelChao)) ?? null;
/** pisou no anel de volta, lá em cima */
export const noAnelDoDisco = (id: IdPlataforma, p: P2) => dentro(p, PLATAFORMAS[id].anelDisco);

/** altura (relativa ao disco) de um andar */
export const alturaDoAndar = (id: IdPlataforma, andar: number) => (id === "solana" ? ANDARES_SOLANA[andar] ?? 0 : 0);

/** um passo ANDANDO num lugar flutuante (mundo → mundo); `fora` = passou da borda do disco (vai cair) */
export function andarNaPlataforma(id: IdPlataforma, andar: number, p: P2): P2 & { fora: boolean } {
  const P = PLATAFORMAS[id];
  if (id === "univ") { const q = resolverUniversidade(p); return { ...q, fora: Math.hypot(q.x - P.centro.x, q.z - P.centro.z) > P.r }; }
  const r = resolverNoAndar(andar, localS(p));
  return { ...mundoS(r), fora: r.fora };
}

/** a plataforma em cuja "bolha" de voo alguém está (perto do disco e não muito abaixo dele) */
export function plataformaPerto(p: P2, y: number): IdPlataforma | null {
  for (const id of IDS_PLATAFORMAS) {
    const P = PLATAFORMAS[id];
    if (Math.hypot(p.x - P.centro.x, p.z - P.centro.z) < P.r + 3 && y > P.y - 3 && y < P.y + 80) return id;
  }
  return null;
}
/** voando de mochila numa plataforma (mundo; `y`/`yAnt` relativos ao disco): as paredes/prédio barram abaixo do alto */
export function noArNaPlataforma(id: IdPlataforma, p: P2, y: number, yAnt: number): P2 {
  return id === "univ" ? resolverUniversidadeNoAr(p, y) : mundoS(resolverNoArSolana(localS(p), y, yAnt));
}
/** onde dá pra pousar vindo de cima neste ponto: alturas RELATIVAS, da mais alta pra mais baixa */
export function pousosNaPlataforma(id: IdPlataforma, p: P2): number[] {
  const P = PLATAFORMAS[id];
  if (id === "univ") return Math.hypot(p.x - P.centro.x, p.z - P.centro.z) < P.r ? [0] : [];
  return pousosSolana(localS(p));
}
/** o andar correspondente a uma altura de pouso relativa */
export const andarDoPouso = (id: IdPlataforma, yRel: number) => (id === "solana" ? Math.max(0, ANDARES_SOLANA.findIndex((a) => Math.abs(a - yRel) < 0.01)) : 0);
/** teto da mochila numa plataforma (relativo): ~19 m acima do andar mais alto */
export const tetoNaPlataforma = (id: IdPlataforma) => (id === "solana" ? ANDARES_SOLANA[ROOFTOP] : 0) + 19.4;
/** dá pra decolar de mochila daqui? (na Solana House, de dentro de casa não) */
export const decolaDaPlataforma = (id: IdPlataforma, andar: number, p: P2) => (id === "univ" ? true : decolaNaSolana(andar, localS(p)));
/** está mesmo em cima de um andar andável (pra quem chega pelo elevador de luz/moto) */
export const andavelNaPlataforma = (id: IdPlataforma, andar: number, p: P2) => (id === "univ" ? Math.hypot(p.x - PLATAFORMAS.univ.centro.x, p.z - PLATAFORMAS.univ.centro.z) < PLATAFORMAS.univ.r : andavel(andar, localS(p)));

/** o ELEVADOR do prédio (Solana House): no tubo → a ação de ir pro próximo andar */
export function elevadorAqui(id: IdPlataforma, andar: number, p: P2): { proximo: number; rotulo: string } | null {
  if (id !== "solana" || !noElevador(localS(p))) return null;
  const proximo = proximoAndar(andar);
  return { proximo, rotulo: `Elevador → ${NOMES_ANDARES[proximo]}` };
}

/** os sólidos de voo (nave/moto) de todos os lugares flutuantes, no mundo */
export function pilaresDasPlataformas(): Pilar[] {
  const P = PLATAFORMAS.solana, pr = SOLANA.predio, cx = (pr.x0 + pr.x1) / 2, cz = (pr.z0 + pr.z1) / 2;
  return [
    ...pilaresDaUniversidade(),
    { ...P.centro, r: P.r, topo: P.y, base: P.y - SOLANA.espessura },
    { ...mundoS({ x: cx, z: cz }), r: Math.hypot(pr.x1 - cx, pr.z1 - cz), topo: P.y + ANDARES_SOLANA[ROOFTOP] + SOLANA.guardaCorpo, base: P.y },
  ];
}
