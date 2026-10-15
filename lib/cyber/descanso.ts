/**
 * Cyberespaço — DESCANSO nas salas (PURO, sem three): sentar e deitar nos SOFÁS, sentar nos PUFFS e LARGAR O CORPO nos
 * PUFES grandes (a pose bem relaxada: reclinado, pernas esticadas, mãos atrás da cabeça) com a tecla J, e o
 * MODO ESTUDO no TABLET (T): o tablet se materializa nas mãos do avatar e o laboratório abre por cima do cyberespaço,
 * enquanto o avatar fica lá — sentado, deitado ou em pé — estudando com o tablet (os outros veem).
 *
 * Os lugares saem dos MÓVEIS de TODAS as salas (lib/cyber/ceu `MOVEIS`): cada sofá tem 2 ASSENTOS e o comprimento todo
 * pra DEITAR; cada puff/pufe, 1 assento. Tudo em coordenadas do MUNDO (x, z) + o RUMO (facing = atan2(dx, dz), o mesmo do
 * engine) de quem está ali. A J cicla: em pé → sentado → deitado (só sofá) → em pé. Pra sentar, a pessoa ANDA até a
 * FRENTE do assento (`frentes`, fora do colisor), vira de costas e abaixa até ele (nada de atravessar o móvel); pra
 * levantar, o contrário.
 */
import { CIDADE, MOVEIS, daSala, mundo, rotDaSala, type Movel, type NomeSala } from "./ceu";

type P2 = { x: number; z: number };
export type ModoDescanso = "sentado" | "deitado";
export type TipoLugar = "sofa" | "puff" | "pufe" | "trono";
export type Lugar = {
  id: string; tipo: TipoLugar;
  /** os pontos de SENTAR (mundo) — o sofá tem 2; o puff, 1 */
  assentos: P2[];
  /** onde DEITA (o meio do sofá) — null no puff */
  deita: P2 | null;
  /** rumo de quem senta (olhando pra frente do sofá / pro meio da roda) */
  rumo: number;
  /** rumo do corpo DEITADO (a cabeça vai pro braço esquerdo do sofá) */
  rumoDeitado: number;
  /** onde a pessoa fica ao LEVANTAR (na frente do móvel, fora do colisor dele) */
  saida: P2;
  /** a FRENTE de cada assento (fora do colisor): anda até aqui, vira e senta; levantando, volta pra cá */
  frentes: P2[];
  /** o pufe grande: a pose BEM RELAXADA (reclinado, pernas esticadas, mãos atrás da cabeça) */
  relaxa: boolean;
  /** a altura do assento (m acima do piso) */
  alturaAssento: number;
  /** onde os pés pousam, à frente (m) — sem isto, o padrão do avatar */
  pes?: number;
};

/** alturas (m, acima de onde o pé pisa no lounge): o topo da almofada do sofá e do puff (components/cyber/Salas — os
 *  móveis ficam num tablado de 0,16 m) */
export const ALTURA_SOFA = 0.78, ALTURA_PUFF = 0.7, ALTURA_PUFE = 0.74;   // o pufe: em CIMA do saco (antes afundava dentro dele)
/** o TRONO de fluido do pátio do lounge (components/cyber/TronoFluido): o assento, e onde a pessoa para na frente dele
 *  pra virar e sentar (fora do colisor do pedestal e no vão livre entre os tentáculos da frente) */
export const ALTURA_TRONO = 0.64, FRENTE_TRONO = 1.35;
/** onde os PÉS pousam, à frente de quem senta (m): medido no avatar (coxa 0,50 m, canela 0,51 m) — com o assento a
 *  0,64 m, a COXA fica na horizontal e a CANELA na vertical, o joelho dobrado em ~90°. Os outros lugares usam o padrão do
 *  avatar (components/cyber/AvatarLuz) */
export const PES_TRONO = 0.58;
/** até onde a J alcança um lugar (m) e a distância que já conta como "alguém está aqui" */
export const ALCANCE_DESCANSO = 2.6, OCUPADO_R = 0.45;
/** os assentos no referencial do SOFÁ (x ao longo da largura, z pra frente) */
const ASSENTOS_SOFA = [-0.75, 0.75];

/** um ponto no referencial do MÓVEL (lx ao longo da largura, lz pra frente) → MUNDO */
function doMovel(sala: NomeSala, m: Movel, lx: number, lz: number): P2 {
  const c = Math.cos(m.rot), s = Math.sin(m.rot);   // o mesmo giro do three (rotation.y = m.rot)
  return mundo(daSala(CIDADE.salas[sala], m.x + lx * c + lz * s, m.z - lx * s + lz * c));
}

/** os LUGARES do lounge (constante → calculado uma vez) */
let cache: Lugar[] | null = null;
export function lugaresDoLounge(): Lugar[] {
  if (cache) return cache;
  const out: Lugar[] = [];
  for (const sala of Object.keys(CIDADE.salas) as NomeSala[]) {
    const rs = rotDaSala(CIDADE.salas[sala]), em = (m: Movel, lx: number, lz: number) => doMovel(sala, m, lx, lz);
    MOVEIS[sala].forEach((m, i) => {
      const rumo = m.rot + rs, id = `${sala}-${m.tipo}-${i}`;
      if (m.tipo === "sofa") out.push({
        id, tipo: "sofa", rumo, rumoDeitado: rumo + Math.PI / 2, alturaAssento: ALTURA_SOFA, relaxa: false,
        assentos: ASSENTOS_SOFA.map((x) => em(m, x, 0.08)), deita: em(m, 0, 0.05), saida: em(m, 0, m.prof / 2 + 0.85),
        frentes: ASSENTOS_SOFA.map((x) => em(m, x, m.prof / 2 + 0.6)),
      });
      else if (m.tipo === "puff") out.push({ id, tipo: "puff", rumo, rumoDeitado: rumo, alturaAssento: ALTURA_PUFF, relaxa: false, assentos: [em(m, 0, 0)], deita: null, saida: em(m, 0, 1.1), frentes: [em(m, 0, 1.0)] });
      else if (m.tipo === "trono") out.push({ id, tipo: "trono", rumo, rumoDeitado: rumo, alturaAssento: ALTURA_TRONO, pes: PES_TRONO, relaxa: false, assentos: [em(m, 0, 0.06)], deita: null, saida: em(m, 0, FRENTE_TRONO + 0.1), frentes: [em(m, 0, FRENTE_TRONO)] });
      else if (m.tipo === "pufe") out.push({ id, tipo: "pufe", rumo, rumoDeitado: rumo, alturaAssento: ALTURA_PUFE, relaxa: true, assentos: [em(m, 0, 0.18)], deita: null, saida: em(m, 0, 1.3), frentes: [em(m, 0, 1.2)] });   // o quadril um pouco à frente: as costas deitam NO encosto, não dentro dele
    });
  }
  cache = out; return out;
}

/** onde a pessoa fica num lugar e em que rumo, por modo */
export function poseNoLugar(l: Lugar, modo: ModoDescanso, assento = 0): { x: number; z: number; rumo: number } {
  if (modo === "deitado" && l.deita) return { ...l.deita, rumo: l.rumoDeitado };
  const a = l.assentos[Math.min(assento, l.assentos.length - 1)]!;
  return { ...a, rumo: l.rumo };
}

const livre = (p: P2, outros: readonly P2[], r = OCUPADO_R) => outros.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > r);

/** o assento LIVRE mais perto de `p` dentro do alcance (os `outros` = onde estão as outras pessoas), ou null */
export function lugarPerto(p: P2, outros: readonly P2[] = [], alcance = ALCANCE_DESCANSO): { lugar: Lugar; assento: number } | null {
  let melhor: { lugar: Lugar; assento: number } | null = null, md = alcance;
  for (const l of lugaresDoLounge()) l.assentos.forEach((a, k) => {
    const d = Math.hypot(a.x - p.x, a.z - p.z);
    if (d < md && livre(a, outros)) { md = d; melhor = { lugar: l, assento: k }; }
  });
  return melhor;
}

/** dá pra DEITAR nesse lugar? (sofá, sem ninguém nos assentos dele) */
export const podeDeitar = (l: Lugar, outros: readonly P2[] = []) => !!l.deita && l.assentos.every((a) => livre(a, outros));

/** a tecla J: em pé → sentado → deitado (só no sofá livre) → em pé */
export function proximoModo(atual: ModoDescanso | null, l: Lugar | null, outros: readonly P2[] = []): ModoDescanso | null {
  if (!l) return null;
  if (atual === null) return "sentado";
  if (atual === "sentado" && podeDeitar(l, outros)) return "deitado";
  return null;
}

/** a POSE de descanso na rede (um inteiro pequeno): 0 em pé, 1 sentado, 2 deitado; +3 = com o tablet na mão */
export function codificarDescanso(modo: ModoDescanso | null, tablet: boolean): number {
  return (modo === "sentado" ? 1 : modo === "deitado" ? 2 : 0) + (tablet ? 3 : 0);
}
export function decodificarDescanso(v: unknown): { modo: ModoDescanso | null; tablet: boolean } {
  const n = typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 5 ? v : 0, m = n % 3;
  return { modo: m === 1 ? "sentado" : m === 2 ? "deitado" : null, tablet: n >= 3 };
}
/** o lugar onde alguém está (por posição — o remoto só manda x/z): o mais perto */
export function lugarEm(p: P2): Lugar | null {
  let melhor: Lugar | null = null, md = Infinity;
  for (const l of lugaresDoLounge()) for (const a of [...l.assentos, ...(l.deita ? [l.deita] : [])]) { const d = Math.hypot(a.x - p.x, a.z - p.z); if (d < md) { md = d; melhor = l; } }
  return melhor;
}
export const alturaDoAssentoEm = (p: P2): number => lugarEm(p)?.alturaAssento ?? ALTURA_SOFA;
/** o ritmo de SENTAR e LEVANTAR (s): abaixar até o assento / subir e dar o passo pra frente */
export const SENTAR = { desce: 0.8, sobe: 0.65 } as const;

/** o TABLET se materializando (s): cresce das partículas até a mão e o laboratório abre logo depois */
export const TABLET = { materializa: 0.9, abreLab: 1.05, some: 0.6 } as const;
