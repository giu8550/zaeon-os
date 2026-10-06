/**
 * Cyberespaço — a SOLANA HOUSE (PURO, sem three): o QG da Superteam Brasil, um prédio de apartamento futurista de 3
 * andares + ROOFTOP, num disco flutuando no céu (abaixo da Universidade e da Zaeon). Térreo = lobby/coworking; 2º andar
 * = hacker house (mesas compridas, telão); 3º = o apartamento (sala, cozinha, quartos); rooftop = piscina de borda
 * infinita, bar e lounge. Os andares se trocam no ELEVADOR (tecla F, como as outras ações). Sacadas de vidro no 2º e 3º.
 *
 * Coordenadas locais relativas a `centro`, SEM giro: −z = sul (a frente do prédio, onde chega o elevador de luz).
 * Alturas relativas ao piso do disco (`y`). Colisão: as mesmas primitivas da Universidade (paredes-segmento com altura,
 * retângulos de móveis).
 */
import type { P2 } from "./colisao";
import { empurrarDasParedes, empurrarDosRetangulos, paredesDoRetangulo, type Parede } from "./universidade";

export const SOLANA = {
  centro: { x: 200, z: -60 },
  /** piso do disco (m) — abaixo da Universidade (170) e da Zaeon (230) */
  y: 120,
  /** raio do disco andável (a borda é livre: passou, cai) e a espessura dele (sólido pra nave/moto) */
  r: 30, espessura: 6,
  predio: { x0: -12, x1: 12, z0: -2, z1: 14 },
  /** sacadas de vidro na frente do 2º e 3º andar (mesma largura do prédio) */
  sacada: { z0: -5.5 },
  porta: { c: 0, w: 3.2 },          // porta de vidro do térreo (sul)
  aberturaSacada: { c: 0, w: 12 },  // a fachada sul dos andares de cima abre pra sacada
  elevador: { x: 9.6, z: 11.6, r: 1.3 },
  piscina: { x0: -10.5, x1: 1.5, z0: 2.5, z1: 12 },
  paredeAlt: 4.1, guardaCorpo: 1.1,
} as const;
/** altura (relativa ao disco) do piso de cada andar: térreo, 2º, 3º e o rooftop */
export const ANDARES_SOLANA = [0, 4.4, 8.8, 13.2] as const;
export const NOMES_ANDARES = ["Térreo", "2º andar", "3º andar", "Rooftop"] as const;
export const ROOFTOP = ANDARES_SOLANA.length - 1;

const P = SOLANA.predio, S = SOLANA;
export const noPredio = (l: P2, folga = 0) => l.x > P.x0 - folga && l.x < P.x1 + folga && l.z > P.z0 - folga && l.z < P.z1 + folga;
export const naSacada = (l: P2) => l.x > P.x0 && l.x < P.x1 && l.z > S.sacada.z0 && l.z <= P.z0;
export const noDisco = (l: P2) => Math.hypot(l.x, l.z) < S.r;
export const localS = (w: P2): P2 => ({ x: w.x - S.centro.x, z: w.z - S.centro.z });
export const mundoS = (l: P2): P2 => ({ x: S.centro.x + l.x, z: S.centro.z + l.z });

/** as paredes de um andar (locais): o prédio (porta no térreo, fachada aberta pra sacada em cima), os guarda-corpos
 *  de vidro das sacadas e o parapeito do rooftop */
const paredesCache = new Map<number, Parede[]>();
export function paredesDoAndar(andar: number): Parede[] {
  const c = paredesCache.get(andar); if (c) return c;
  let out: Parede[];
  if (andar === ROOFTOP) out = paredesDoRetangulo(P.x0, P.x1, P.z0, P.z1, 0.3, S.guardaCorpo, {});
  else {
    const vao = andar === 0 ? S.porta : S.aberturaSacada;
    out = paredesDoRetangulo(P.x0, P.x1, P.z0, P.z1, 0.4, S.paredeAlt, { s: [vao] });
    if (andar > 0) out.push(
      { ax: P.x0, az: S.sacada.z0, bx: P.x1, bz: S.sacada.z0, esp: 0.15, alt: S.guardaCorpo },
      { ax: P.x0, az: S.sacada.z0, bx: P.x0, bz: P.z0, esp: 0.15, alt: S.guardaCorpo },
      { ax: P.x1, az: S.sacada.z0, bx: P.x1, bz: P.z0, esp: 0.15, alt: S.guardaCorpo },
    );
  }
  paredesCache.set(andar, out);
  return out;
}

export type MovelS = { tipo: "balcao" | "sofa" | "mesa" | "pufe" | "cama" | "ilha" | "piscina" | "bar" | "espreguicadeira" | "planta" | "dj"; x0: number; x1: number; z0: number; z1: number; alt: number; solido?: boolean };
const m = (tipo: MovelS["tipo"], x0: number, x1: number, z0: number, z1: number, alt: number, solido = true): MovelS => ({ tipo, x0, x1, z0, z1, alt, solido });
/** os móveis de cada andar (deixam livres a porta/abertura, o elevador e um corredor até ele) */
export function moveisDoAndar(andar: number): MovelS[] {
  if (andar === 0) return [   // LOBBY + coworking: recepção, sofás, mesas com computador, plantas
    m("balcao", -7, -2, 1.2, 2.4, 1.1), m("sofa", 3, 8, 1.6, 2.6, 0.8), m("mesa", -10.5, -4, 7, 8.6, 0.76), m("mesa", -10.5, -4, 11, 12.6, 0.76),
    m("mesa", 1, 6, 8, 9.6, 0.76), m("planta", -11.5, -10.5, -1.5, -0.5, 1.6), m("planta", 10.7, 11.7, 13, 13.9, 1.6),
  ];
  if (andar === 1) return [   // HACKER HOUSE: mesas compridas com telas, pufes
    m("mesa", -10.5, -2, 2.5, 4, 0.76), m("mesa", -10.5, -2, 7.5, 9, 0.76), m("mesa", 1, 7, 2.5, 4, 0.76),
    m("pufe", 2, 3.2, 8, 9.2, 0.5), m("pufe", 4.4, 5.6, 8, 9.2, 0.5), m("mesa", -10.5, -2, 12, 13.4, 0.76),
  ];
  if (andar === 2) return [   // APARTAMENTO: sala (sofá em L de frente pra TV), cozinha com ilha, dois quartos
    m("sofa", -10.5, -4, 1.4, 2.4, 0.8), m("sofa", -11.6, -10.5, 1.4, 6.5, 0.8), m("ilha", 1, 6, 5.5, 7, 1.0),
    m("cama", -11.4, -7.6, 9.6, 13.6, 0.6), m("cama", -6.4, -2.6, 9.6, 13.6, 0.6),
  ];
  return [   // ROOFTOP: piscina de borda infinita, bar, espreguiçadeiras, lounge, cabine do DJ
    m("piscina", S.piscina.x0, S.piscina.x1, S.piscina.z0, S.piscina.z1, 0.5), m("bar", 4, 9, 2.4, 3.6, 1.1),
    m("espreguicadeira", -10, -7.6, -0.8, 1.4, 0.45, false), m("espreguicadeira", -6.6, -4.2, -0.8, 1.4, 0.45, false), m("espreguicadeira", -3.2, -0.8, -0.8, 1.4, 0.45, false),
    m("sofa", 4, 7.6, 7.6, 8.6, 0.8), m("dj", 3, 6, 12.2, 13.4, 1.1),
  ];
}

/** dá pra andar aqui nesse andar? térreo = o disco todo; 2º/3º = dentro do prédio ou na sacada; rooftop = o telhado */
export const andavel = (andar: number, l: P2) => andar === 0 ? noDisco(l) : andar === ROOFTOP ? noPredio(l) : noPredio(l) || naSacada(l);

/** andar num andar (local → local): paredes, guarda-corpos e móveis; `fora` = saiu da área (só o térreo tem borda livre) */
export function resolverNoAndar(andar: number, l: P2): P2 & { fora: boolean } {
  let q = empurrarDasParedes(l, paredesDoAndar(andar));
  q = empurrarDosRetangulos(q, moveisDoAndar(andar));
  if (andar > 0 && !andavel(andar, q)) {   // nos andares de cima o vidro segura (prende na área andável)
    const zMin = andar === ROOFTOP ? P.z0 + 0.3 : S.sacada.z0 + 0.3;
    q = { x: Math.min(P.x1 - 0.3, Math.max(P.x0 + 0.3, q.x)), z: Math.min(P.z1 - 0.3, Math.max(zMin, q.z)) };
  }
  return { ...q, fora: andar === 0 && !noDisco(q) };
}

/** no ELEVADOR (o tubo de vidro no canto do prédio): perto o bastante pra trocar de andar */
export const noElevador = (l: P2) => Math.hypot(l.x - S.elevador.x, l.z - S.elevador.z) < S.elevador.r + 0.4;
/** o próximo andar do elevador: sobe um a um e do rooftop volta pro térreo */
export const proximoAndar = (andar: number) => (andar + 1) % ANDARES_SOLANA.length;

/** onde dá pra POUSAR vindo de cima neste ponto (alturas relativas, da mais alta pra mais baixa) */
export function pousosSolana(l: P2): number[] {
  if (noPredio(l)) return [ANDARES_SOLANA[ROOFTOP]];
  if (naSacada(l)) return [ANDARES_SOLANA[2], ANDARES_SOLANA[1], 0];
  return noDisco(l) ? [0] : [];
}
/** o andar de uma altura de pouso */
export const andarDaAltura = (y: number) => { let k = 0; ANDARES_SOLANA.forEach((a, i) => { if (Math.abs(a - y) < 0.01) k = i; }); return k; };
/** dá pra decolar de mochila daqui? do rooftop, das sacadas e do terraço (fora do prédio); dentro de casa não */
export const decolaNaSolana = (andar: number, l: P2) => andar === ROOFTOP || naSacada(l) || (andar === 0 && !noPredio(l));

/** voando de mochila por perto (local, alturas relativas): o prédio é sólido até o parapeito do rooftop (vindo de cima
 *  dele, não empurra — é pouso) */
export function resolverNoArSolana(l: P2, y: number, yAnt: number): P2 {
  const topo = ANDARES_SOLANA[ROOFTOP];
  if (yAnt >= topo - 0.05) return l;
  return empurrarDosRetangulos(l, [{ ...P, alt: topo + S.guardaCorpo }], 0.45, y);
}
