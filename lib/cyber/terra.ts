/**
 * Cyberespaço — os MIRANTES DA TERRA nas 4 QUINAS da Zaeon (PURO, sem three). A referência é a antiga base do Andrei
 * (a Recepção: pirâmide, escadas e a cabaninha no topo): ela e 3 cópias ficam SIMÉTRICAS nas diagonais da cidadela
 * (45°, 135°, 225°, 315° — fora da doca da nave a ~100°, da escada do lounge a 180°, do buraco negro e do
 * estacionamento). Em volta de cada mirante, de quem vem do CENTRO pra fora:
 * O objetivo: um lugar onde os ALUNOS VEEM OS PROBLEMAS DA TERRA (e o que está sendo feito).
 *  - a PIRÂMIDE (o mirante) livre, com as SUPERTREES hídricas em volta (as árvores-jardim de Gardens by the Bay,
 *    Singapura: 25–50 m, jardim vertical, copa larga, coleta de água) — a escada e a vista do centro ficam livres;
 *  - de UM LADO, a ESTAÇÃO DE ANÁLISE: o TELÃO em destaque num palco (os problemas da Terra no mapa), o GLOBO ao lado
 *    alimentado por CABOS que vêm dos MOTORES DE ENERGIA (reagem a quem chega perto), TOTENS dos temas (clima,
 *    florestas, oceanos, água) e os DROIDS OBSERVADORES (1 líder piramidal + 2 menores) analisando: o líder lê a tela
 *    voando baixo na frente dela, os menores escaneiam o globo — o movimento sai só do RELÓGIO (todos veem igual);
 *  - do OUTRO lado, um ESTACIONAMENTO de 4 motos.
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

/** a ESTAÇÃO DE ANÁLISE de cada mirante: AO LADO da pirâmide (nunca na frente dela — a escada e a vista do centro
 *  ficam livres), a 24 m rumo ao centro e 56 m de lado. Ali ficam o TELÃO (em destaque, num palco), o GLOBO ao lado
 *  com os CABOS que o alimentam vindo dos MOTORES DE ENERGIA, os TOTENS dos temas, e os DROIDS analisando os dados */
export const ESTACAO = { u: 24, v: 56 } as const;
const est = (m: Mirante, du: number, dv: number) => noMirante(m, ESTACAO.u + du, ESTACAO.v + dv);
/** os TELÕES: no centro da estação, virados pro centro da ilha (quem vem de lá vê de frente, ao lado da pirâmide) */
export const TELOES = MIRANTES.map((m) => { const p = est(m, 0, 0); return { ...p, rot: proCentro(p), larg: 30, alt: 17, y: 14 }; });
/** o GLOBO da Terra: ao lado do telão (do lado de fora), num pedestal */
export const GLOBOS = MIRANTES.map((m) => ({ ...est(m, -2, 26), r: 6.5, y: 11 }));
/** os MOTORES DE ENERGIA: 2 por estação, atrás do telão (as fontes dos cabos) */
export const MOTORES = MIRANTES.flatMap((m) => [-8, 10].map((dv) => ({ ...est(m, -14, dv), r: 3.2 })));
/** os CABOS ALIMENTADORES: de cada motor até o pé do globo e até o pé do telão (no chão) */
export const CABOS = MIRANTES.flatMap((m, i) => {
  const g = GLOBOS[i]!, t = TELOES[i]!, ms = MOTORES.slice(i * 2, i * 2 + 2);
  return ms.flatMap((mo) => [{ de: { x: mo.x, z: mo.z }, para: { x: g.x, z: g.z } }, { de: { x: mo.x, z: mo.z }, para: { x: t.x, z: t.z } }]);
});
/** os TOTENS dos problemas da Terra (Clima, Florestas, Oceanos, Água): em arco do lado de fora do globo */
export const TEMAS = ["clima", "florestas", "oceanos", "agua"] as const;
export const TOTENS = MIRANTES.flatMap((m) => TEMAS.map((tema, k) => { const p = est(m, 12 - k * 10, 44 - Math.abs(k - 1.5) * 4); return { ...p, tema, rot: proCentro(p) }; }));
/** as SUPERTREES em volta de cada pirâmide (dos lados e atrás — a frente fica livre pra escada) */
export const SUPERTREES: { x: number; z: number; alt: number; copa: number }[] = MIRANTES.flatMap((m, i) =>
  [[70, 1], [-70, 1], [128, 0], [-128, 0], [180, 1]].map(([a, alta], k) => {
    const r = 30, p = noMirante(m, Math.cos(rad(a!)) * r, Math.sin(rad(a!)) * r);
    return { ...p, alt: alta ? 44 - ((i + k) % 2) * 6 : 32 + ((i + k) % 2) * 4, copa: alta ? 10.5 : 8 };
  }));
/** os ESTACIONAMENTOS dos mirantes (1 fila de 4, do OUTRO lado da pirâmide, virados pro centro) — lib/cyber/motos */
export const LOTES_MIRANTE = MIRANTES.map((m) => noMirante(m, 30, -50));

/** colisores (mundo, via `mundo`): troncos das supertrees, bases dos motores, pés dos telões */
export function colisoresDoDistritoTerra(mundo: (p: P2) => P2): Colisor[] {
  const out: Colisor[] = [];
  for (const s of SUPERTREES) out.push({ ...mundo(s), r: 2.6 });
  for (const m of MOTORES) out.push({ ...mundo(m), r: m.r + 0.6 });
  for (const t of TELOES) for (let k = -2; k <= 2; k++) { const c = Math.cos(t.rot), s = Math.sin(t.rot), lx = (k * t.larg) / 5; out.push({ ...mundo({ x: t.x + lx * c, z: t.z - lx * s }), r: 2.2 }); }   // o palco do telão
  for (const g of GLOBOS) out.push({ ...mundo(g), r: 3.6 });
  for (const t of TOTENS) out.push({ ...mundo(t), r: 1.2 });
  return out;
}

/** quanto um MOTOR de energia acelera (0..1) com a pessoa mais perto a `dist` m: acorda a 26 m, no máximo a 6 m */
export const reacaoDoMotor = (dist: number) => Math.max(0, Math.min(1, (26 - dist) / 20));

// ── os DROIDS OBSERVADORES ───────────────────────────────────────────────────────────────────────────────────────────
/** um grupo por estação: o LÍDER paira BAIXO na frente do telão, passando de um lado pro outro e lendo os dados (o
 *  feixe vai pra tela); os 2 MENORES orbitam o GLOBO, escaneando a Terra */
export const GRUPOS_DROIDS = MIRANTES.map((_, i) => ({ id: i, tela: TELOES[i]!, globo: GLOBOS[i]!, fase: i * 1.7 }));
type P3 = { x: number; y: number; z: number };
/** a pose do líder (s, relógio de parede — a mesma pra todos): na frente da tela (8 m), varrendo de lado a lado,
 *  a ~6 m do chão; `alvo` = o ponto da tela que ele lê agora */
export function poseDoLider(g: (typeof GRUPOS_DROIDS)[number], t: number): P3 & { rumo: number; lendo: number; alvo: P3 } {
  const T = g.tela, nx = Math.sin(T.rot), nz = Math.cos(T.rot), tx = Math.cos(T.rot), tz = -Math.sin(T.rot);
  const lado = Math.sin(t * 0.18 + g.fase) * T.larg * 0.32, frente = 8 + Math.sin(t * 0.31 + g.fase) * 1.2;
  const ciclo = 11, k = (((t + g.fase * 3) % ciclo) + ciclo) % ciclo / ciclo, lendo = 0.35 + 0.65 * Math.max(0, Math.sin(k * Math.PI * 2));
  const y = 6 + Math.sin(t * 0.6 + g.fase) * 0.7;
  const alvo = { x: T.x + tx * (lado * 1.1), y: T.y + Math.sin(t * 0.9 + g.fase) * T.alt * 0.25, z: T.z + tz * (lado * 1.1) };
  return { x: T.x + nx * frente + tx * lado, y, z: T.z + nz * frente + tz * lado, rumo: T.rot + Math.PI, lendo, alvo };
}
/** os 2 menores: orbitando o globo (lados opostos), um pouco acima do equador, virados pra ele */
export function poseDosMenores(g: (typeof GRUPOS_DROIDS)[number], t: number): (P3 & { rumo: number })[] {
  return [0, 1].map((i) => {
    const a = t * 0.35 + g.fase + i * Math.PI, R = g.globo.r + 3.5;
    const x = g.globo.x + Math.cos(a) * R, z = g.globo.z + Math.sin(a) * R;
    return { x, y: g.globo.y + 1.5 + Math.sin(t * 0.8 + i * 2) * 1.2, z, rumo: Math.atan2(g.globo.x - x, g.globo.z - z) };
  });
}

/** os PONTOS da Terra nos telões: os PROBLEMAS (o que os alunos precisam ver) e o que está sendo feito — lugares e
 *  fenômenos REAIS, sem números inventados; os eventos ao vivo (terremotos, incêndios, tempestades) entram depois por
 *  uma fonte pública */
export type PontoTerra = { nome: string; lat: number; lon: number; tipo: "problema" | "regeneracao" | "desenvolvimento" | "evento" };
export const PONTOS_TERRA: readonly PontoTerra[] = [
  { nome: "Desmatamento · Arco da Amazônia", lat: -9, lon: -56, tipo: "problema" },
  { nome: "Queimadas · Pantanal", lat: -17.5, lon: -57, tipo: "problema" },
  { nome: "Branqueamento de corais · Austrália", lat: -18, lon: 147, tipo: "problema" },
  { nome: "Derretimento do gelo · Groenlândia", lat: 72, lon: -40, tipo: "problema" },
  { nome: "Secas · Chifre da África", lat: 5, lon: 45, tipo: "problema" },
  { nome: "Mar de Aral que secou · Ásia Central", lat: 45, lon: 60, tipo: "problema" },
  { nome: "Lixo plástico · Pacífico Norte", lat: 32, lon: -145, tipo: "problema" },
  { nome: "Desertificação · Semiárido do Ceará", lat: -5.5, lon: -39.5, tipo: "problema" },
  { nome: "Grande Muralha Verde · Sahel", lat: 14, lon: 2, tipo: "regeneracao" },
  { nome: "Planalto de Loess · China", lat: 37, lon: 109, tipo: "regeneracao" },
  { nome: "Mata Atlântica · Brasil", lat: -23, lon: -45, tipo: "regeneracao" },
  { nome: "Gardens by the Bay · Singapura", lat: 1.28, lon: 103.86, tipo: "desenvolvimento" },
];
/** lat/lon → posição no mapa equiretangular (0..1) */
export const noMapa = (lat: number, lon: number) => ({ u: (lon + 180) / 360, v: (90 - lat) / 180 });
