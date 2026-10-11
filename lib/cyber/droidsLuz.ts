/**
 * Cyberespaço — os DROIDS DE LUZ (PURO): os droids que liam os telões das estações da Terra agora PASSEIAM PELAS SALAS
 * DE ESTUDO levando luz pros alunos (pedido do dono, out/2026). Cada líder (o piramidal) faz uma volta FECHADA:
 * passa por cima dos lugares onde se estuda na BIBLIOTECA (as mesas de leitura e os pufes), sai pela porta, cruza alto
 * até o JARDIM, passa por cima dos pufes em volta do espelho d'água e volta — sempre ACIMA DAS CABEÇAS, com o feixe de
 * luz apontado pra baixo. Os 2 menores de cada líder orbitam ele, um pouco mais baixo. Tudo sai do RELÓGIO de parede:
 * todo mundo vê os droids no mesmo lugar, sem rede.
 * Coordenadas LOCAIS da ilha da Zaeon (y = acima do piso da Zaeon).
 */
import { ALTURA_LOUNGE, CIDADE, MOVEIS, daSala, type NomeSala } from "./ceu";

type P3 = { x: number; y: number; z: number };
/** a altura do voo acima do piso da sala (acima das cabeças), a da travessia entre as salas e a velocidade (m/s) */
export const VOO_DROIDS_LUZ = { acimaDaSala: 5.5, travessia: 16, vel: 4.2, orbitaMenores: 3.6 } as const;
/** as salas por onde eles passam */
export const SALAS_DOS_DROIDS: readonly NomeSala[] = ["biblioteca", "jardim"];
/** os tipos de móvel onde alguém ESTUDA (o droid passa por cima deles) */
const ONDE_SE_ESTUDA = new Set(["pufe", "mesaLeitura"]);

/** os pontos (local da ilha, altura do voo) por cima dos lugares de estudo de uma sala, em volta do meio dela */
function pontosNaSala(nome: NomeSala): P3[] {
  const s = CIDADE.salas[nome], y = ALTURA_LOUNGE + VOO_DROIDS_LUZ.acimaDaSala;
  const lugares = MOVEIS[nome].filter((m) => ONDE_SE_ESTUDA.has(m.tipo));
  const cx = lugares.reduce((a, m) => a + m.x, 0) / Math.max(1, lugares.length), cz = lugares.reduce((a, m) => a + m.z, 0) / Math.max(1, lugares.length);
  // em volta do meio, no sentido anti-horário; os muito perto um do outro viram um ponto só (a curva fica macia)
  const ord = [...lugares].sort((a, b) => Math.atan2(a.z - cz, a.x - cx) - Math.atan2(b.z - cz, b.x - cx));
  const out: P3[] = [];
  for (const m of ord) { const w = daSala(s, m.x, m.z); if (!out.length || Math.hypot(w.x - out[out.length - 1]!.x, w.z - out[out.length - 1]!.z) > 3.5) out.push({ x: w.x, y, z: w.z }); }
  return out;
}
/** a porta de uma sala (local da ilha): `dentro` = logo pra dentro dela; `fora` = do lado de fora, já na altura da travessia */
function porta(nome: NomeSala): { dentro: P3; fora: P3 } {
  const s = CIDADE.salas[nome], d = daSala(s, 0, s.r - 6), f = daSala(s, 0, s.r + 8);
  return { dentro: { x: d.x, y: ALTURA_LOUNGE + VOO_DROIDS_LUZ.acimaDaSala, z: d.z }, fora: { x: f.x, y: ALTURA_LOUNGE + VOO_DROIDS_LUZ.travessia, z: f.z } };
}

/** a ROTA fechada (polilinha 3D com o comprimento acumulado): biblioteca → travessia → jardim → travessia */
type Rota = { pts: P3[]; acum: number[]; len: number };
let rotaCache: Rota | null = null;
export function rotaDosDroids(): Rota {
  if (rotaCache) return rotaCache;
  const pts: P3[] = [];
  for (const nome of SALAS_DOS_DROIDS) { const p = porta(nome); pts.push(p.fora, p.dentro, ...pontosNaSala(nome), p.dentro, p.fora); }
  const acum = [0];
  for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1]!, b = pts[i % pts.length]!; acum.push(acum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)); }
  return (rotaCache = { pts, acum, len: acum[pts.length]! });
}
/** o ponto da rota a `s` m (dá a volta) e o rumo (atan2(dx, dz)) — com uma suavização nos cantos (média com os vizinhos) */
export function pontoDaRota(s: number): P3 & { rumo: number } {
  const R = rotaDosDroids(), em = (u: number): P3 => {
    const v = ((u % R.len) + R.len) % R.len; let i = 0; while (i < R.pts.length - 1 && R.acum[i + 1]! <= v) i++;
    const a = R.pts[i]!, b = R.pts[(i + 1) % R.pts.length]!, k = (v - R.acum[i]!) / Math.max(1e-6, R.acum[i + 1]! - R.acum[i]!);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
  };
  const A = em(s - 2.5), B = em(s), C = em(s + 2.5);
  return { x: (A.x + 2 * B.x + C.x) / 4, y: (A.y + 2 * B.y + C.y) / 4, z: (A.z + 2 * B.z + C.z) / 4, rumo: Math.atan2(C.x - A.x, C.z - A.z) };
}

/** os líderes: quantos e a fase de cada um (espalhados pela volta) */
export const N_LIDERES = 2;
/** a pose de um líder no relógio `t` (s): onde, pra onde vai e o ponto do CHÃO que ele ilumina (logo embaixo) */
export function poseDoLiderNaSala(i: number, t: number): P3 & { rumo: number; luz: P3 } {
  const R = rotaDosDroids(), s = t * VOO_DROIDS_LUZ.vel + (i / N_LIDERES) * R.len, p = pontoDaRota(s);
  const y = p.y + Math.sin(t * 0.6 + i * 2) * 0.35;
  const naSala = p.y < ALTURA_LOUNGE + VOO_DROIDS_LUZ.travessia - 0.5;
  return { ...p, y, luz: { x: p.x, y: naSala ? ALTURA_LOUNGE : p.y - VOO_DROIDS_LUZ.acimaDaSala, z: p.z } };
}
/** os 2 menores de cada líder: orbitando ele, um pouco mais baixo, cada um com o feixe fino pro chão */
export function poseDosMenoresNaSala(i: number, t: number): (P3 & { rumo: number; luz: P3 })[] {
  const l = poseDoLiderNaSala(i, t);
  return [0, 1].map((k) => {
    const a = t * 0.7 + i * 1.3 + k * Math.PI, R = VOO_DROIDS_LUZ.orbitaMenores, x = l.x + Math.cos(a) * R, z = l.z + Math.sin(a) * R, y = l.y - 1.2 + Math.sin(t * 1.1 + k) * 0.3;
    return { x, y, z, rumo: a + Math.PI / 2, luz: { x, y: l.luz.y, z } };
  });
}
