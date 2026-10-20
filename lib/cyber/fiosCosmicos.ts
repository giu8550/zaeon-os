/**
 * Cyberespaço — as PISTAS CÓSMICAS (PURO): no lugar das escadas (lib/cyber/nivelAtivo — os níveis separados), da
 * borda da Zaeon sai, por cada vão da muralha (a direção de cada sala), uma PISTA — um FLUXO de luz bem longo e
 * sinuoso que leva pra um dos 4 CANTOS do mapa, longe da cidadela, onde fica um BURACO NEGRO MASSIVO. O fim da pista
 * é uma TRAJETÓRIA DE VERDADE pra um buraco negro: ela entra em ESPIRAL em volta dele, fechando, até cair no horizonte.
 * Quem pisa na BOCA (o anel na borda) é levado pelo fluxo; os carros e as motos do céu (lib/cyber/trafego) andam
 * pelas mesmas pistas. Perto do buraco negro, a tempestade (nuvens e trovões) — components/cyber/FiosCosmicos.
 *
 * Tudo no referencial LOCAL da ilha (relativo ao centro da Zaeon, y = acima do piso da central). Determinístico.
 * (O nome do arquivo ficou "fios" — a 1ª versão eram fios-neurônio.)
 */
import { ALTURA_LOUNGE, CIDADE, daSala, type NomeSala } from "./ceu";
import { VOO } from "./voo";

export type V3 = { x: number; y: number; z: number };
export const FIO = {
  /** a distância (m, do centro da Zaeon) até o buraco negro do canto e o raio dele (o horizonte) */
  alcance: 1150, bnR: 38,
  /** a altura (m, acima do piso) em que o buraco negro fica e o teto da pista no meio do caminho */
  bnY: 70, teto: 150,
  /** a ESPIRAL final: quantas voltas e de que raio começa (fecha até o horizonte) */
  voltas: 1.6, espiralR: 240,
  /** as curvas da pista: quantas e de que largura (m) */
  curvas: 3.5, largura: 150,
  /** a boca (o anel na borda, onde se pisa) */
  bocaR: 3.2,
  /** quanto dura a viagem pelo fluxo (s, da boca ao buraco negro) */
  viagem: 24,
  /** onde o efeito do buraco negro começa (m do centro dele): a tempestade, o vento */
  zonaEfeito: 520,
  /** a que distância (m) da pista o FLUXO pega quem chega (a pé na borda, de mochila, de moto ou de carro) */
  captura: 9,
  /** a pista de SAÍDA de cada sala (da porta antiga pra fora, até o buraco negro que leva de volta pro hub): comprimento */
  saidaComprimento: 520,
} as const;

/** cada sala tem a sua pista e o CANTO dela (o ângulo, local da ilha, do buraco negro) */
const CANTO: Record<NomeSala, number> = { jardim: Math.PI / 4, lounge: (Math.PI * 3) / 4, garagem: (Math.PI * 5) / 4, biblioteca: (Math.PI * 7) / 4 };
const SALAS_FIO: readonly NomeSala[] = ["lounge", "garagem", "biblioteca", "jardim"];
function rng(semente: number) { let a = semente >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const semente = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

function cr(p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 {
  const t2 = t * t, t3 = t2 * t, f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z) };
}
/** amostra a curva pelos pontos de controle em `n` pontos (Catmull-Rom, com as pontas repetidas) */
export function amostrarCurva(ctrl: readonly V3[], n: number): V3[] {
  const out: V3[] = [], k = ctrl.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * k, j = Math.min(k - 1, Math.floor(u)), t = u - j;
    out.push(cr(ctrl[Math.max(0, j - 1)]!, ctrl[j]!, ctrl[j + 1]!, ctrl[Math.min(k, j + 2)]!, t));
  }
  return out;
}

export type FioCosmico = {
  sala: NomeSala;
  /** a pista de SAÍDA de uma sala (leva de volta pro hub) — senão, a do hub (leva pra sala) */
  saida?: boolean;
  /** a pista (amostrada), o comprimento acumulado de cada ponto e o total */
  eixo: V3[]; acum: number[]; comprimento: number;
  /** a boca (o anel na borda) e o buraco negro do canto */
  boca: V3 & { r: number }; bn: V3 & { r: number };
};

/** o buraco negro do canto: no ângulo do canto, a `alcance` m — puxado pra dentro se sairia do mapa */
function centroDoCanto(ang: number): V3 {
  let d: number = FIO.alcance;
  const C = CIDADE.centro, dentro = (dd: number) => Math.hypot(C.x + Math.cos(ang) * dd, C.z + Math.sin(ang) * dd) <= VOO.raioMapa - FIO.espiralR - 40;
  while (d > 600 && !dentro(d)) d -= 10;
  return { x: Math.cos(ang) * d, y: FIO.bnY, z: Math.sin(ang) * d };
}

function montarPista(sala: NomeSala): FioCosmico {
  const L = CIDADE.salas[sala], a0 = Math.atan2(L.z, L.x), a1 = CANTO[sala], r = rng(semente(sala)), fase = r() * Math.PI * 2;
  const r0 = CIDADE.andavelR - 3, bn = centroDoCanto(a1), dBn = Math.hypot(bn.x, bn.z);
  // o ângulo vai da direção da sala pro do canto pelo caminho curto
  let da = a1 - a0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  const ctrl: V3[] = [{ x: Math.cos(a0) * r0, y: 0.5, z: Math.sin(a0) * r0 }, { x: Math.cos(a0) * (r0 + 40), y: 3, z: Math.sin(a0) * (r0 + 40) }];
  // o MEIO: sai da borda, serpenteia (as curvas crescem no meio e somem na chegada) subindo até o teto e descendo
  const rFim = dBn - FIO.espiralR, N = 14;
  for (let k = 1; k <= N; k++) {
    const t = k / N, ang = a0 + da * (t * t * (3 - 2 * t)), rr = r0 + 40 + (rFim - r0 - 40) * t;
    const curva = Math.sin(t * Math.PI * FIO.curvas * 2 + fase) * FIO.largura * Math.sin(t * Math.PI), onda = Math.sin(t * Math.PI * 5 + fase * 1.3) * 18 * Math.sin(t * Math.PI);
    const px = Math.cos(ang) * rr, pz = Math.sin(ang) * rr, tx = -Math.sin(ang), tz = Math.cos(ang);
    ctrl.push({ x: px + tx * curva, y: 3 + (FIO.teto - 3) * Math.sin(t * Math.PI * 0.85) + (FIO.bnY - 3) * t * 0.4 + onda, z: pz + tz * curva });
  }
  // a ESPIRAL: entra na órbita do buraco negro (no sentido que a pista já vinha) e fecha até o horizonte
  const ult = ctrl[ctrl.length - 1]!, angEntra = Math.atan2(ult.z - bn.z, ult.x - bn.x), sentido = r() < 0.5 ? 1 : -1, M = 16;
  for (let k = 1; k <= M; k++) {
    const t = k / M, ang = angEntra + sentido * t * FIO.voltas * Math.PI * 2, rr = FIO.espiralR + (FIO.bnR * 1.05 - FIO.espiralR) * Math.pow(t, 1.4);
    ctrl.push({ x: bn.x + Math.cos(ang) * rr, y: ult.y + (bn.y - ult.y) * t + Math.sin(t * Math.PI * 2) * 12 * (1 - t), z: bn.z + Math.sin(ang) * rr });
  }
  const eixo = amostrarCurva(ctrl, 700), acum = [0];
  for (let i = 1; i < eixo.length; i++) acum.push(acum[i - 1]! + Math.hypot(eixo[i]!.x - eixo[i - 1]!.x, eixo[i]!.y - eixo[i - 1]!.y, eixo[i]!.z - eixo[i - 1]!.z));
  return { sala, eixo, acum, comprimento: acum[acum.length - 1]!, boca: { ...eixo[0]!, y: 0, r: FIO.bocaR }, bn: { ...bn, r: FIO.bnR } };
}

/** a pista de SAÍDA de uma sala: da porta antiga (o lado que dava pra escada), pra FORA, serpenteando e subindo, até
 *  o buraco negro que leva de volta pro hub — a mesma espiral no fim */
function montarSaida(sala: NomeSala): FioCosmico {
  const L = CIDADE.salas[sala], r = rng(semente(sala + ":saida")), fase = r() * Math.PI * 2;
  const dL = Math.hypot(L.x, L.z), dir = { x: L.x / dL, z: L.z / dL }, perp = { x: -dir.z, z: dir.x };
  // a porta antiga fica no lado da sala que olha pro centro da Zaeon: a pista sai dali e dá a volta por fora da sala
  const porta = daSala(L, 0, L.r - 3), y0 = ALTURA_LOUNGE + 0.6, lado = r() < 0.5 ? 1 : -1;
  const ctrl: V3[] = [{ x: porta.x, y: y0, z: porta.z }, { x: porta.x - dir.x * 30, y: y0 + 2, z: porta.z - dir.z * 30 }];
  // contorna a sala por um lado (fora do disco) e segue pra fora
  for (const [ang, rr] of [[0.6, L.r + 40], [1.4, L.r + 70], [2.2, L.r + 90]] as const) { const a = Math.atan2(-dir.z, -dir.x) + lado * ang; ctrl.push({ x: L.x + Math.cos(a) * rr, y: y0 + 10 + ang * 12, z: L.z + Math.sin(a) * rr }); }
  const ini = ctrl[ctrl.length - 1]!, bn: V3 = { x: L.x + dir.x * (FIO.saidaComprimento + L.r), y: y0 + 60, z: L.z + dir.z * (FIO.saidaComprimento + L.r) };
  for (let k = 1; k <= 8; k++) {
    const t = k / 8, curva = Math.sin(t * Math.PI * 3 + fase) * 90 * Math.sin(t * Math.PI);
    ctrl.push({ x: ini.x + (bn.x - ini.x) * t * 0.82 + perp.x * curva, y: ini.y + (bn.y - ini.y) * t + Math.sin(t * Math.PI) * 50, z: ini.z + (bn.z - ini.z) * t * 0.82 + perp.z * curva });
  }
  const ult = ctrl[ctrl.length - 1]!, angEntra = Math.atan2(ult.z - bn.z, ult.x - bn.x), sentido = r() < 0.5 ? 1 : -1, R0 = FIO.espiralR * 0.7;
  for (let k = 1; k <= 14; k++) { const t = k / 14, ang = angEntra + sentido * t * FIO.voltas * Math.PI * 2, rr = R0 + (FIO.bnR * 1.05 - R0) * Math.pow(t, 1.4); ctrl.push({ x: bn.x + Math.cos(ang) * rr, y: ult.y + (bn.y - ult.y) * t, z: bn.z + Math.sin(ang) * rr }); }
  const eixo = amostrarCurva(ctrl, 600), acum = [0];
  for (let i = 1; i < eixo.length; i++) acum.push(acum[i - 1]! + Math.hypot(eixo[i]!.x - eixo[i - 1]!.x, eixo[i]!.y - eixo[i - 1]!.y, eixo[i]!.z - eixo[i - 1]!.z));
  return { sala, saida: true, eixo, acum, comprimento: acum[acum.length - 1]!, boca: { ...eixo[0]!, r: FIO.bocaR }, bn: { ...bn, r: FIO.bnR } };
}
let cacheSaida: FioCosmico[] | null = null;
/** as pistas de SAÍDA (uma por sala) */
export const pistasDeSaida = (): FioCosmico[] => (cacheSaida ??= SALAS_FIO.map(montarSaida));
export const saidaDaSala = (s: NomeSala): FioCosmico => pistasDeSaida().find((f) => f.sala === s)!;

/** o FLUXO pega quem chega perto de uma pista: a pista e a fração mais perto (ou null). `p` local da ilha (y acima do
 *  piso da central). Não pega no trecho final (a espiral, já no buraco negro) */
export function capturaDoFluxo(pistas: readonly FioCosmico[], p: V3, raio: number = FIO.captura): { f: FioCosmico; u: number } | null {
  let melhor: { f: FioCosmico; u: number } | null = null, dm = raio;
  for (const f of pistas) {
    const n = f.eixo.length - 1, ate = Math.floor(n * 0.9);
    for (let i = 0; i <= ate; i++) { const q = f.eixo[i]!, d = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z); if (d < dm) { dm = d; melhor = { f, u: f.acum[i]! / f.comprimento }; } }
  }
  return melhor;
}
/** a velocidade do fluxo (m/s) na fração `u`: puxa forte e ACELERA chegando no buraco negro */
export const velDoFluxo = (u: number) => 55 + 170 * Math.pow(Math.max(0, Math.min(1, u)), 3);

let cache: FioCosmico[] | null = null;
/** as pistas (uma por sala), na ordem das salas */
export const fiosCosmicos = (): FioCosmico[] => (cache ??= SALAS_FIO.map(montarPista));
export const fioDaSala = (s: NomeSala): FioCosmico => fiosCosmicos().find((f) => f.sala === s)!;

/** o ponto da pista na fração `u` (0 = a boca, 1 = o horizonte — pelo comprimento) e o rumo (yaw: +z = frente) */
export function pontoDoFio(f: FioCosmico, u: number): V3 & { rumo: number } {
  const alvo = Math.max(0, Math.min(1, u)) * f.comprimento;
  let lo = 0, hi = f.acum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (f.acum[m]! < alvo) lo = m; else hi = m; }
  const a = f.eixo[lo]!, b = f.eixo[hi]!, seg = f.acum[hi]! - f.acum[lo]! || 1, k = (alvo - f.acum[lo]!) / seg;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, rumo: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** pisou na boca de qual pista? (`l` = local da ilha; `yRel` = altura acima do piso da central) */
export function fioNaBoca(l: { x: number; z: number }, yRel: number): FioCosmico | null {
  if (Math.abs(yRel) > 1.5) return null;
  for (const f of fiosCosmicos()) if (Math.hypot(l.x - f.boca.x, l.z - f.boca.z) < f.boca.r) return f;
  return null;
}

/** a fração da viagem pelo fluxo (0..1) → a posição na pista: arranca suave e ACELERA no fim (caindo no buraco negro) */
export const uDaViagemFio = (k: number) => { const t = Math.max(0, Math.min(1, k)); return t < 0.08 ? (t * t) / 0.16 : 0.04 + (t - 0.08) * (0.96 / 0.92) * (0.85 + 0.15 * t); };

/** o quanto o buraco negro da pista está "perto" (0 longe → 1 no horizonte): a tempestade, o vento, o tremor */
export function pertoDoBuraco(f: FioCosmico, p: V3): number {
  const d = Math.hypot(p.x - f.bn.x, p.y - f.bn.y, p.z - f.bn.z) - f.bn.r;
  return Math.max(0, Math.min(1, 1 - d / FIO.zonaEfeito));
}
