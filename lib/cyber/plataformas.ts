/**
 * Cyberespaço — os LUGARES FLUTUANTES (PURO): discos no céu com chão de verdade, que qualquer pessoa visita.
 *  - "univ": a Universidade (UNILAB), a 170 m (lib/cyber/universidade.ts);
 *  - "solana": a Solana House da Superteam Brasil, com 3 andares + rooftop (lib/cyber/solana.ts);
 *  - "ufc" / "unifor" / "uece": os OUTROS CAMPI, na mesma fundação (lib/cyber/campi.ts) — o buraco negro fica do lado
 *    virado pra praça.
 * (A Zaeon, a 450 m, é a ilha do céu de lib/cyber/ceu.ts — tem a física dela.)
 *
 * Como se chega: não há mais chão (nem os elevadores de luz que subiam dele) — cada lugar tem o seu BURACO NEGRO
 * (o `portal`, um anel no disco com o buraco negro pairando em cima), um nó da rede de túneis (lib/cyber/buracos):
 * entrou, escolhe o destino e aparece na `chegada` dele. Também dá pra pousar de moto/nave (o disco é sólido) e voar
 * de mochila em volta. A borda do disco é LIVRE (sem parede invisível): passou, cai. Os andares de cima da Solana
 * House são trocados pelo elevador do prédio (tecla F).
 */
import type { P2 } from "./colisao";
import type { Pilar } from "./voo";
import { UNIVERSIDADE, pilaresDaUniversidade, resolverUniversidade, resolverUniversidadeNoAr } from "./universidade";
import { CAMPI, IDS_CAMPI, andarNoCampus, mundoC, naEntrada, noArNoCampus, pilaresDoCampus, type IdCampus } from "./campi";
import { ANDARES_SOLANA, NOMES_ANDARES, ROOFTOP, SOLANA, andavel, decolaNaSolana, localS, mundoS, noElevador, pousosSolana, proximoAndar, resolverNoAndar, resolverNoArSolana } from "./solana";

export type IdPlataforma = "univ" | "solana" | IdCampus;
const ehCampus = (id: IdPlataforma): id is IdCampus => id in CAMPI;
export type Anel = { x: number; z: number; r: number };
export type Plataforma = {
  id: IdPlataforma; nome: string;
  centro: P2; y: number; r: number;
  /** o anel do BURACO NEGRO no disco (mundo, no piso do disco) — a boca do túnel */
  portal: Anel;
  /** onde se aparece ao chegar pelo túnel (mundo, no disco) e pra onde se olha */
  chegada: P2 & { rumo: number };
};

const w = (c: P2, l: P2) => ({ x: c.x + l.x, z: c.z + l.z });
const U = UNIVERSIDADE, S = SOLANA;
export const PLATAFORMAS: Record<IdPlataforma, Plataforma> = {
  univ: {
    id: "univ", nome: "UNILAB", centro: U.centro, y: U.y, r: U.discoR,
    portal: { ...w(U.centro, { x: 0, z: -142 }), r: 3 },   // (a chegada fica longe do anel: o buraco não tampa a câmera de quem chega)
    chegada: { ...w(U.centro, { x: 0, z: -124 }), rumo: 0 },          // de frente pro portão (norte)
  },
  solana: {
    id: "solana", nome: "Solana House", centro: S.centro, y: S.y, r: S.r,
    portal: { ...mundoS({ x: 0, z: -38 }), r: 2.6 },
    chegada: { ...mundoS({ x: 0, z: -19 }), rumo: 0 },
  },
  // os campi: o buraco negro perto da borda virada pra praça; chega-se olhando pro centro do campus
  ...Object.fromEntries(IDS_CAMPI.map((id) => {
    const c = CAMPI[id], rumoDentro = Math.atan2(-naEntrada(id, 1).x, -naEntrada(id, 1).z);
    return [id, {
      id, nome: c.sigla, centro: c.centro, y: c.y, r: c.r,
      portal: { ...mundoC(id, naEntrada(id, c.r - 10)), r: 3 },
      chegada: { ...mundoC(id, naEntrada(id, c.r - 26)), rumo: rumoDentro },
    } satisfies Plataforma];
  })) as Record<IdCampus, Plataforma>,
};
/** as UNIVERSIDADES no mapa (a UNILAB e os campi UFC/Unifor/UECE). DESLIGADAS a pedido do dono (out/2026): pesavam no
 *  fundo do mapa — ficam só a Zaeon, as salas dela e a Solana House. Os módulos continuam (true = voltam). */
export const UNIVERSIDADES_NO_MAPA = false;
/** este lugar flutuante está no mapa? */
export const plataformaAtiva = (id: IdPlataforma) => UNIVERSIDADES_NO_MAPA || id === "solana";
/** os lugares flutuantes que EXISTEM no mapa (física, túneis, bots, contadores) */
export const IDS_PLATAFORMAS = (Object.keys(PLATAFORMAS) as IdPlataforma[]).filter(plataformaAtiva);

const dentro = (p: P2, a: Anel) => Math.hypot(p.x - a.x, p.z - a.z) < a.r;
/** pisou no anel do buraco negro desta plataforma (no disco)? */
export const noPortalDaPlataforma = (id: IdPlataforma, p: P2) => dentro(p, PLATAFORMAS[id].portal);

/** altura (relativa ao disco) de um andar */
export const alturaDoAndar = (id: IdPlataforma, andar: number) => (id === "solana" ? ANDARES_SOLANA[andar] ?? 0 : 0);

/** um passo ANDANDO num lugar flutuante (mundo → mundo); `fora` = passou da borda do disco (vai cair) */
export function andarNaPlataforma(id: IdPlataforma, andar: number, p: P2): P2 & { fora: boolean } {
  const P = PLATAFORMAS[id];
  if (id === "univ") { const q = resolverUniversidade(p); return { ...q, fora: Math.hypot(q.x - P.centro.x, q.z - P.centro.z) > P.r }; }
  if (ehCampus(id)) return andarNoCampus(id, p);
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
  return id === "univ" ? resolverUniversidadeNoAr(p, y) : ehCampus(id) ? noArNoCampus(id, p, y) : mundoS(resolverNoArSolana(localS(p), y, yAnt));
}
/** onde dá pra pousar vindo de cima neste ponto: alturas RELATIVAS, da mais alta pra mais baixa */
export function pousosNaPlataforma(id: IdPlataforma, p: P2): number[] {
  const P = PLATAFORMAS[id];
  if (id === "univ" || ehCampus(id)) return Math.hypot(p.x - P.centro.x, p.z - P.centro.z) < P.r ? [0] : [];
  return pousosSolana(localS(p));
}
/** o andar correspondente a uma altura de pouso relativa */
export const andarDoPouso = (id: IdPlataforma, yRel: number) => (id === "solana" ? Math.max(0, ANDARES_SOLANA.findIndex((a) => Math.abs(a - yRel) < 0.01)) : 0);
/** teto da mochila numa plataforma (relativo): ~19 m acima do andar mais alto */
export const tetoNaPlataforma = (id: IdPlataforma) => (id === "solana" ? ANDARES_SOLANA[ROOFTOP] : 0) + 19.4;
/** dá pra decolar de mochila daqui? (na Solana House, de dentro de casa não) */
export const decolaDaPlataforma = (id: IdPlataforma, andar: number, p: P2) => (id !== "solana" ? true : decolaNaSolana(andar, localS(p)));
/** está mesmo em cima de um andar andável (pra quem chega pelo elevador de luz/moto) */
export const andavelNaPlataforma = (id: IdPlataforma, andar: number, p: P2) => (id !== "solana" ? Math.hypot(p.x - PLATAFORMAS[id].centro.x, p.z - PLATAFORMAS[id].centro.z) < PLATAFORMAS[id].r : andavel(andar, localS(p)));

/** o ELEVADOR do prédio (Solana House): no tubo → a ação de ir pro próximo andar */
export function elevadorAqui(id: IdPlataforma, andar: number, p: P2): { proximo: number; rotulo: string } | null {
  if (id !== "solana" || !noElevador(localS(p))) return null;
  const proximo = proximoAndar(andar);
  return { proximo, rotulo: `Elevador → ${NOMES_ANDARES[proximo]}` };
}

/** os sólidos de voo (nave/moto) de todos os lugares flutuantes, no mundo — fixos: calculados UMA vez (com os campi são
 *  centenas de prédios; o voo pergunta a cada quadro) */
let pilaresCache: Pilar[] | null = null;
export function pilaresDasPlataformas(): Pilar[] { return (pilaresCache ??= calcularPilares()); }
function calcularPilares(): Pilar[] {
  const P = PLATAFORMAS.solana, pr = SOLANA.predio, cx = (pr.x0 + pr.x1) / 2, cz = (pr.z0 + pr.z1) / 2;
  return [
    ...(UNIVERSIDADES_NO_MAPA ? [...pilaresDaUniversidade(), ...IDS_CAMPI.flatMap((id) => pilaresDoCampus(id))] : []),
    { ...P.centro, r: P.r, topo: P.y, base: P.y - SOLANA.espessura },
    { ...mundoS({ x: cx, z: cz }), r: Math.hypot(pr.x1 - cx, pr.z1 - cz), topo: P.y + ANDARES_SOLANA[ROOFTOP] + SOLANA.guardaCorpo, base: P.y },
  ];
}
