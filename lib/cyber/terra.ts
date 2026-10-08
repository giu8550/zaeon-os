/**
 * Cyberespaço — os MIRANTES DA TERRA nas 4 QUINAS da Zaeon (PURO, sem three). A referência é a antiga base do Andrei
 * (a Recepção: pirâmide, escadas e a cabaninha no topo): ela e 3 cópias ficam SIMÉTRICAS nas diagonais da cidadela
 * (45°, 135°, 225°, 315° — fora da doca da nave a ~100°, da escada do lounge a 180°, do buraco negro e do
 * estacionamento). Em volta de cada mirante, de quem vem do CENTRO pra fora:
 * O objetivo: um lugar onde os ALUNOS VEEM OS PROBLEMAS DA TERRA (e o que está sendo feito).
 *  - a PIRÂMIDE (o mirante) livre, com as SUPERTREES hídricas em volta (as árvores-jardim de Gardens by the Bay,
 *    Singapura: 25–50 m, jardim vertical, copa larga, coleta de água) — a escada e a vista do centro ficam livres;
 *  - de UM LADO, a ESTAÇÃO DE ANÁLISE — PROBLEMA → SOLUÇÃO: o telão dos PROBLEMAS DA TERRA (em destaque, num palco)
 *    com os CARDS dos temas (clima, florestas, oceanos, água) colados nele, cada card ligado por um cabo de luz ao
 *    telão das SOLUÇÕES (projetos e ideias reais); o GLOBO entre os dois, alimentado pelos MOTORES DE ENERGIA (reagem
 *    a quem chega perto); os DROIDS OBSERVADORES (1 líder piramidal + 2 menores): o líder alterna entre as duas telas,
 *    os menores escaneiam o globo — o movimento sai só do RELÓGIO (todos veem igual);
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
 *  ficam livres), a 24 m rumo ao centro e 75 m de lado. É um PROBLEMA → SOLUÇÃO, lido por quem vem do centro:
 *    [ telão PROBLEMAS DA TERRA ]  cards dos problemas · globo  [ telão SOLUÇÕES PARA A TERRA ]
 *  os 4 CARDS (clima, florestas, oceanos, água) ficam colados ao telão dos problemas, e cada um tem um CABO de luz até
 *  o telão das soluções (os projetos e ideias que atacam aquele problema); o GLOBO paira entre os dois, alimentado
 *  pelos MOTORES DE ENERGIA atrás dos telões; o DROID líder passa um tempo em cada telão */
export const ESTACAO = { u: 24, v: 75 } as const;
/** meia-distância entre os centros dos dois telões (cabe o palco de cada um + os cards e o globo no meio) */
export const MEIO_TELOES = 34;
const est = (m: Mirante, du: number, dv: number) => noMirante(m, ESTACAO.u + du, ESTACAO.v + dv);
const telao = (m: Mirante, dv: number) => { const p = est(m, 0, dv); return { ...p, rot: proCentro(p), larg: 30, alt: 17, y: 14 }; };
/** o telão dos PROBLEMAS (o mais perto da pirâmide), virado pro centro da ilha */
export const TELOES = MIRANTES.map((m) => telao(m, -MEIO_TELOES));
/** o telão das SOLUÇÕES (projetos e ideias que ajudam a Terra), do outro lado */
export const TELOES_SOLUCAO = MIRANTES.map((m) => telao(m, MEIO_TELOES));
/** o GLOBO da Terra: pairando ENTRE os dois telões (um pouco atrás dos cards, acima deles), num pedestal */
export const GLOBOS = MIRANTES.map((m) => ({ ...est(m, -5, 0), r: 6.5, y: 14 }));
/** os MOTORES DE ENERGIA: 1 atrás de cada telão (as fontes dos cabos) */
export const MOTORES = MIRANTES.flatMap((m) => [-MEIO_TELOES, MEIO_TELOES].map((dv) => ({ ...est(m, -14, dv), r: 3.2 })));
/** os CABOS ALIMENTADORES: de cada motor até o pé do globo e até o pé do telão dele (no chão) */
export const CABOS = MIRANTES.flatMap((m, i) => {
  const g = GLOBOS[i]!, ts = [TELOES[i]!, TELOES_SOLUCAO[i]!], ms = MOTORES.slice(i * 2, i * 2 + 2);
  return ms.flatMap((mo, k) => [{ de: { x: mo.x, z: mo.z }, para: { x: g.x, z: g.z } }, { de: { x: mo.x, z: mo.z }, para: { x: ts[k]!.x, z: ts[k]!.z } }]);
});
/** os CARDS dos problemas da Terra (Clima, Florestas, Oceanos, Água): uma fileira COLADA ao telão dos problemas, na
 *  frente do globo, virados pro centro */
export const TEMAS = ["clima", "florestas", "oceanos", "agua"] as const;
export type Tema = (typeof TEMAS)[number];
export const TOTENS = MIRANTES.flatMap((m) => TEMAS.map((tema, k) => { const p = est(m, 5, -MEIO_TELOES + 21.4 + k * 3.4); return { ...p, tema, rot: proCentro(p) }; }));
/** as LIGAÇÕES problema → solução: de cada card até o pé do telão das soluções (o pulso corre do problema pra solução) */
export const LIGACOES = TOTENS.map((t, k) => { const s = TELOES_SOLUCAO[Math.floor(k / TEMAS.length)]!; return { tema: t.tema, de: { x: t.x, z: t.z }, para: { x: s.x, z: s.z } }; });
/** as SUPERTREES em volta de cada pirâmide (dos lados e atrás — a frente fica livre pra escada) */
export const SUPERTREES: { x: number; z: number; alt: number; copa: number }[] = MIRANTES.flatMap((m, i) =>
  [[70, 1], [-70, 1], [128, 0], [-128, 0], [180, 1]].map(([a, alta], k) => {
    const r = 30, p = noMirante(m, Math.cos(rad(a!)) * r, Math.sin(rad(a!)) * r);
    return { ...p, alt: alta ? 44 - ((i + k) % 2) * 6 : 32 + ((i + k) % 2) * 4, copa: alta ? 10.5 : 8 };
  }));
/** os ESTACIONAMENTOS dos mirantes (1 fila de 4, do OUTRO lado da pirâmide, virados pro centro) — lib/cyber/motos */
export const LOTES_MIRANTE = MIRANTES.map((m) => noMirante(m, 30, -50));

/** colisores (mundo, via `mundo`): troncos das supertrees, bases dos motores, pés dos 2 telões, globo e cards */
export function colisoresDoDistritoTerra(mundo: (p: P2) => P2): Colisor[] {
  const out: Colisor[] = [];
  for (const s of SUPERTREES) out.push({ ...mundo(s), r: 2.6 });
  for (const m of MOTORES) out.push({ ...mundo(m), r: m.r + 0.6 });
  for (const t of [...TELOES, ...TELOES_SOLUCAO]) for (let k = -2; k <= 2; k++) { const c = Math.cos(t.rot), s = Math.sin(t.rot), lx = (k * t.larg) / 5; out.push({ ...mundo({ x: t.x + lx * c, z: t.z - lx * s }), r: 2.2 }); }   // o palco do telão
  for (const g of GLOBOS) out.push({ ...mundo(g), r: 3.6 });
  for (const t of TOTENS) out.push({ ...mundo(t), r: 1.2 });
  return out;
}

/** quanto um MOTOR de energia acelera (0..1) com a pessoa mais perto a `dist` m: acorda a 26 m, no máximo a 6 m */
export const reacaoDoMotor = (dist: number) => Math.max(0, Math.min(1, (26 - dist) / 20));

// ── os DROIDS OBSERVADORES ───────────────────────────────────────────────────────────────────────────────────────────
/** um grupo por estação: o LÍDER paira BAIXO na frente dos telões e alterna — lê o PROBLEMA, voa até a SOLUÇÃO, lê,
 *  volta (o feixe vai pra tela que ele lê); os 2 MENORES orbitam o GLOBO, escaneando a Terra */
export const GRUPOS_DROIDS = MIRANTES.map((_, i) => ({ id: i, tela: TELOES[i]!, solucao: TELOES_SOLUCAO[i]!, globo: GLOBOS[i]!, fase: i * 1.7 }));
type P3 = { x: number; y: number; z: number };
type Telao = (typeof TELOES)[number];
/** o ciclo do líder (s): lê os problemas, voa, lê as soluções, volta */
export const RONDA_LIDER = { le: 15, voa: 5 } as const;
const CICLO_LIDER = 2 * (RONDA_LIDER.le + RONDA_LIDER.voa);
/** lendo uma tela: na frente dela (8 m), varrendo de lado a lado a ~6 m do chão; `alvo` = o ponto da tela lido agora */
function lendoATela(T: Telao, t: number, fase: number) {
  const nx = Math.sin(T.rot), nz = Math.cos(T.rot), tx = Math.cos(T.rot), tz = -Math.sin(T.rot);
  const lado = Math.sin(t * 0.18 + fase) * T.larg * 0.32, frente = 8 + Math.sin(t * 0.31 + fase) * 1.2;
  const ciclo = 11, k = (((t + fase * 3) % ciclo) + ciclo) % ciclo / ciclo, lendo = 0.35 + 0.65 * Math.max(0, Math.sin(k * Math.PI * 2));
  const y = 6 + Math.sin(t * 0.6 + fase) * 0.7;
  const alvo = { x: T.x + tx * (lado * 1.1), y: T.y + Math.sin(t * 0.9 + fase) * T.alt * 0.25, z: T.z + tz * (lado * 1.1) };
  return { x: T.x + nx * frente + tx * lado, y, z: T.z + nz * frente + tz * lado, rumo: T.rot + Math.PI, lendo, alvo };
}
/** a pose do líder (s, relógio de parede — a mesma pra todos); `lendoTela` = qual tela ele lê agora (null voando) */
export function poseDoLider(g: (typeof GRUPOS_DROIDS)[number], t: number): P3 & { rumo: number; lendo: number; alvo: P3; lendoTela: "problema" | "solucao" | null } {
  const { le, voa } = RONDA_LIDER, u = (((t + g.fase * 5) % CICLO_LIDER) + CICLO_LIDER) % CICLO_LIDER;
  if (u < le) return { ...lendoATela(g.tela, t, g.fase), lendoTela: "problema" };
  if (u >= le + voa && u < 2 * le + voa) return { ...lendoATela(g.solucao, t, g.fase), lendoTela: "solucao" };
  // VOANDO de uma tela pra outra: sai de onde parou e chega onde vai começar a ler, num arco um pouco mais alto
  const ida = u < le + voa, t0 = t - (ida ? u - le : u - (2 * le + voa)), t1 = t0 + voa;
  const de = lendoATela(ida ? g.tela : g.solucao, t0, g.fase), para = lendoATela(ida ? g.solucao : g.tela, t1, g.fase);
  const k = (t - t0) / voa, e = k * k * (3 - 2 * k), lerp = (a: number, b: number) => a + (b - a) * e;
  const rumo = Math.atan2(para.x - de.x, para.z - de.z);
  return { x: lerp(de.x, para.x), y: lerp(de.y, para.y) + Math.sin(k * Math.PI) * 2.5, z: lerp(de.z, para.z), rumo, lendo: 0.15,
    alvo: { x: lerp(de.alvo.x, para.alvo.x), y: lerp(de.alvo.y, para.alvo.y), z: lerp(de.alvo.z, para.alvo.z) }, lendoTela: null };
}
/** os 2 menores: orbitando o globo (lados opostos), um pouco acima do equador, virados pra ele */
export function poseDosMenores(g: (typeof GRUPOS_DROIDS)[number], t: number): (P3 & { rumo: number })[] {
  return [0, 1].map((i) => {
    const a = t * 0.35 + g.fase + i * Math.PI, R = g.globo.r + 3.5;
    const x = g.globo.x + Math.cos(a) * R, z = g.globo.z + Math.sin(a) * R;
    return { x, y: g.globo.y + 1.5 + Math.sin(t * 0.8 + i * 2) * 1.2, z, rumo: Math.atan2(g.globo.x - x, g.globo.z - z) };
  });
}

/** os PONTOS da Terra nos telões: os PROBLEMAS (telão da esquerda — o que os alunos precisam ver) e as SOLUÇÕES
 *  (telão da direita — projetos e ideias que já estão ajudando), cada um no tema do card que o liga. Lugares, fenômenos
 *  e projetos REAIS, sem números inventados; os eventos AO VIVO (terremotos, incêndios, tempestades) vêm de fontes
 *  públicas (lib/cyber/terraAoVivo) */
export type PontoTerra = { nome: string; lat: number; lon: number; tipo: "problema" | "regeneracao" | "desenvolvimento" | "evento"; tema: Tema };
export const PONTOS_TERRA: readonly PontoTerra[] = [
  { nome: "Desmatamento · Arco da Amazônia", lat: -9, lon: -56, tipo: "problema", tema: "florestas" },
  { nome: "Queimadas · Pantanal", lat: -17.5, lon: -57, tipo: "problema", tema: "florestas" },
  { nome: "Branqueamento de corais · Austrália", lat: -18, lon: 147, tipo: "problema", tema: "oceanos" },
  { nome: "Derretimento do gelo · Groenlândia", lat: 72, lon: -40, tipo: "problema", tema: "clima" },
  { nome: "Ondas de calor · Mediterrâneo", lat: 38, lon: 15, tipo: "problema", tema: "clima" },
  { nome: "Secas · Chifre da África", lat: 5, lon: 45, tipo: "problema", tema: "agua" },
  { nome: "Mar de Aral que secou · Ásia Central", lat: 45, lon: 60, tipo: "problema", tema: "agua" },
  { nome: "Lixo plástico · Pacífico Norte", lat: 32, lon: -145, tipo: "problema", tema: "oceanos" },
  { nome: "Desertificação · Semiárido do Ceará", lat: -5.5, lon: -39.5, tipo: "problema", tema: "agua" },
  // as SOLUÇÕES (projetos e ideias reais)
  { nome: "Energia eólica · litoral do Ceará", lat: -3.2, lon: -39.6, tipo: "desenvolvimento", tema: "clima" },
  { nome: "Camada de ozônio se recuperando · Antártida", lat: -78, lon: 20, tipo: "regeneracao", tema: "clima" },
  { nome: "Grande Muralha Verde · Sahel", lat: 14, lon: 2, tipo: "regeneracao", tema: "florestas" },
  { nome: "Restauração da Mata Atlântica · Brasil", lat: -23, lon: -45, tipo: "regeneracao", tema: "florestas" },
  { nome: "The Ocean Cleanup · Pacífico Norte", lat: 30, lon: -138, tipo: "desenvolvimento", tema: "oceanos" },
  { nome: "Restauração de corais · Grande Barreira", lat: -16, lon: 146, tipo: "regeneracao", tema: "oceanos" },
  { nome: "Cisternas no Semiárido · Nordeste", lat: -7, lon: -38, tipo: "desenvolvimento", tema: "agua" },
  { nome: "Mar de Aral Norte voltando · Cazaquistão", lat: 46.5, lon: 61.5, tipo: "regeneracao", tema: "agua" },
  { nome: "Planalto de Loess restaurado · China", lat: 37, lon: 109, tipo: "regeneracao", tema: "agua" },
  { nome: "Gardens by the Bay · Singapura", lat: 1.28, lon: 103.86, tipo: "desenvolvimento", tema: "clima" },
];
export const ehSolucao = (p: PontoTerra) => p.tipo === "regeneracao" || p.tipo === "desenvolvimento";
/** lat/lon → posição no mapa equiretangular (0..1) */
export const noMapa = (lat: number, lon: number) => ({ u: (lon + 180) / 360, v: (90 - lat) / 180 });
