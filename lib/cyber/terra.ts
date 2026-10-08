/**
 * Cyberespaço — os MIRANTES DA TERRA nas 4 QUINAS da Zaeon (PURO, sem three). A referência é a antiga base do Andrei
 * (a Recepção: pirâmide, escadas e a cabaninha no topo): ela e 3 cópias ficam SIMÉTRICAS nas diagonais da cidadela
 * (45°, 135°, 225°, 315° — fora da doca da nave a ~100°, da escada do lounge a 180°, do buraco negro e do
 * estacionamento). Em volta de cada mirante, de quem vem do CENTRO pra fora:
 *  - um TELÃO gigante virado pro centro (a Terra: pontos de regeneração/desenvolvimento; os eventos ao vivo depois),
 *    com 2 MOTORES DE ENERGIA de cada lado (reagem a quem chega perto);
 *  - o GLOBO holográfico da Terra flutuando sobre a escada;
 *  - a PIRÂMIDE (o mirante), com as SUPERTREES hídricas em volta (as árvores-jardim de Gardens by the Bay, Singapura:
 *    25–50 m, tronco com jardim vertical, copa larga, coleta de água);
 *  - um grupo de DROIDS OBSERVADORES (1 líder piramidal + 2 menores) patrulhando por cima, lendo a Terra — o movimento
 *    sai só do RELÓGIO (o mesmo pra todo mundo: todos veem os droids no mesmo lugar, sem rede);
 *  - ao lado, um ESTACIONAMENTO de 4 motos (onde sempre vai ter gente).
 * Coordenadas LOCAIS da ilha da Zaeon. Não importa lib/cyber/ceu (evita ciclo: ceu usa daqui).
 */
import type { Colisor, P2 } from "./colisao";

const rad = (graus: number) => (graus * Math.PI) / 180;

/** os 4 MIRANTES (o 0 é a própria Recepção — o lar da Zaeon, do dono e do tutorial): nas diagonais, a 195 m */
export const R_MIRANTE = 195;
export const MIRANTES = [45, 135, 225, 315].map((g, id) => ({ id, ang: rad(g), x: Math.cos(rad(g)) * R_MIRANTE, z: Math.sin(rad(g)) * R_MIRANTE }));
export type Mirante = (typeof MIRANTES)[number];
/** no referencial do mirante: `u` = rumo ao CENTRO da ilha, `v` = de lado → local da ilha */
export function noMirante(m: Mirante, u: number, v: number): P2 {
  const nx = -Math.cos(m.ang), nz = -Math.sin(m.ang), tx = -Math.sin(m.ang), tz = Math.cos(m.ang);
  return { x: m.x + nx * u + tx * v, z: m.z + nz * u + tz * v };
}
/** `rot` que deixa o +z local virado pro centro da ilha */
const proCentro = (p: P2) => Math.atan2(-p.x, -p.z);

/** os TELÕES: um por mirante, À FRENTE (depois do pé da escada), virados pro centro — quem vem de lá vê */
export const TELOES = MIRANTES.map((m) => { const p = noMirante(m, 52, 0); return { ...p, rot: proCentro(p), larg: 26, alt: 15, y: 13 }; });
/** os MOTORES DE ENERGIA: 2 por mirante, ladeando o telão */
export const MOTORES = MIRANTES.flatMap((m) => [-19, 19].map((v) => ({ ...noMirante(m, 48, v), r: 3.2 })));
/** os GLOBOS da Terra: flutuando sobre a escada de cada mirante (acima do telão, visto de longe) */
export const GLOBOS = MIRANTES.map((m) => ({ ...noMirante(m, 30, 0), r: 8.5, y: 30 }));
/** as SUPERTREES em volta de cada pirâmide (dos lados e atrás — a frente fica livre pra escada e o telão) */
export const SUPERTREES: { x: number; z: number; alt: number; copa: number }[] = MIRANTES.flatMap((m, i) =>
  [[70, 1], [-70, 1], [128, 0], [-128, 0]].map(([a, alta], k) => {
    const r = 30, p = noMirante(m, Math.cos(rad(a!)) * r, Math.sin(rad(a!)) * r);
    return { ...p, alt: alta ? 44 - ((i + k) % 2) * 6 : 32 + ((i + k) % 2) * 4, copa: alta ? 10.5 : 8 };
  }));
/** os ESTACIONAMENTOS dos mirantes (1 fila de 4, ao lado, virados pro centro) — lib/cyber/motos */
export const LOTES_MIRANTE = MIRANTES.map((m) => noMirante(m, 32, 42));

/** colisores (mundo, via `mundo`): troncos das supertrees, bases dos motores, pés dos telões */
export function colisoresDoDistritoTerra(mundo: (p: P2) => P2): Colisor[] {
  const out: Colisor[] = [];
  for (const s of SUPERTREES) out.push({ ...mundo(s), r: 2.6 });
  for (const m of MOTORES) out.push({ ...mundo(m), r: m.r + 0.6 });
  for (const t of TELOES) for (const lado of [-1, 1]) { const c = Math.cos(t.rot), s = Math.sin(t.rot), lx = (lado * t.larg) / 2.4; out.push({ ...mundo({ x: t.x + lx * c, z: t.z - lx * s }), r: 1.6 }); }
  return out;
}

/** quanto um MOTOR de energia acelera (0..1) com a pessoa mais perto a `dist` m: acorda a 26 m, no máximo a 6 m */
export const reacaoDoMotor = (dist: number) => Math.max(0, Math.min(1, (26 - dist) / 20));

// ── os DROIDS OBSERVADORES ───────────────────────────────────────────────────────────────────────────────────────────
/** um grupo por mirante: patrulha um oval por cima da pirâmide e das árvores, lendo a Terra */
export const GRUPOS_DROIDS = MIRANTES.map((m, i) => ({ id: i, centro: noMirante(m, 6, 0), raio: 30, alt: 30 + (i % 2) * 6, periodo: 70 + i * 13, fase: i * 1.7 }));
/** a pose do líder do grupo `g` no tempo `t` (s, relógio de parede — o mesmo pra todos): voa um oval devagar,
 *  sobe e desce de leve, e a cada ~18 s PARA e lê a Terra (o feixe) */
export function poseDoLider(g: (typeof GRUPOS_DROIDS)[number], t: number): { x: number; y: number; z: number; rumo: number; lendo: number } {
  const u = (t / g.periodo) * Math.PI * 2 + g.fase;
  const ciclo = 18, k = (((t + g.fase * 5) % ciclo) + ciclo) % ciclo / ciclo, lendo = k > 0.7 ? Math.sin(((k - 0.7) / 0.3) * Math.PI) : 0;
  const uu = u - lendo * 0.12;
  const x = g.centro.x + Math.cos(uu) * g.raio, z = g.centro.z + Math.sin(uu) * g.raio * 0.62;
  const dx = -Math.sin(uu) * g.raio, dz = Math.cos(uu) * g.raio * 0.62;
  return { x, y: g.alt + Math.sin(t * 0.5 + g.fase) * 1.4, z, rumo: Math.atan2(dx, dz), lendo };
}
/** os 2 menores: em triângulo atrás do líder (girando devagar em volta dele) */
export function poseDosMenores(lider: { x: number; y: number; z: number; rumo: number }, t: number, fase: number): { x: number; y: number; z: number }[] {
  return [0, 1].map((i) => {
    const a = lider.rumo + Math.PI + (i ? 0.75 : -0.75) + Math.sin(t * 0.4 + fase + i) * 0.25, d = 9;
    return { x: lider.x + Math.sin(a) * d, y: lider.y - 2.5 + Math.sin(t * 1.1 + i * 2 + fase) * 0.8, z: lider.z + Math.cos(a) * d };
  });
}

/** os PONTOS da Terra nos telões: projetos REAIS de regeneração/desenvolvimento (lat, lon) — sem números inventados;
 *  os eventos ao vivo (terremotos, incêndios, tempestades) entram depois por uma fonte pública */
export type PontoTerra = { nome: string; lat: number; lon: number; tipo: "regeneracao" | "desenvolvimento" | "evento" };
export const PONTOS_TERRA: readonly PontoTerra[] = [
  { nome: "Grande Muralha Verde · Sahel", lat: 14, lon: 2, tipo: "regeneracao" },
  { nome: "Planalto de Loess · China", lat: 37, lon: 109, tipo: "regeneracao" },
  { nome: "Mata Atlântica · Brasil", lat: -23, lon: -45, tipo: "regeneracao" },
  { nome: "Amazônia · Brasil", lat: -4, lon: -62, tipo: "regeneracao" },
  { nome: "Grande Barreira de Corais · Austrália", lat: -18, lon: 147, tipo: "regeneracao" },
  { nome: "Gardens by the Bay · Singapura", lat: 1.28, lon: 103.86, tipo: "desenvolvimento" },
  { nome: "Fortaleza · Ceará", lat: -3.73, lon: -38.52, tipo: "desenvolvimento" },
  { nome: "Delta do Mekong · Vietnã", lat: 10, lon: 105.8, tipo: "regeneracao" },
];
/** lat/lon → posição no mapa equiretangular (0..1) */
export const noMapa = (lat: number, lon: number) => ({ u: (lon + 180) / 360, v: (90 - lat) / 180 });
