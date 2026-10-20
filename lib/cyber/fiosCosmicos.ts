/**
 * Cyberespaço — o TECIDO CÓSMICO (PURO): no lugar das escadas de pedra (lib/cyber/nivelAtivo — os níveis
 * separados), da borda da Zaeon sai, na direção de cada sala, um FIO CÓSMICO como um NEURÔNIO GIGANTE: o axônio
 * longo (bem mais que a escada — ~480 m), subindo e ondulando pelo céu, com os dendritos ramificando dele, e na
 * PONTA um BURACO NEGRO MASSIVO. Pisou na BOCA do fio (o anel na borda): uma prancha de luz te leva pelo axônio até o
 * buraco negro; lá, a CONFIRMAÇÃO (o túnel só com aquele destino) — entra e vai pro nível; desiste e volta.
 *
 * Tudo no referencial LOCAL da ilha (relativo ao centro, y = acima do piso da central). Determinístico.
 */
import { CIDADE, type NomeSala } from "./ceu";

export type V3 = { x: number; y: number; z: number };
export const FIO = {
  /** o comprimento do axônio no chão (m, da borda pra fora) e quanto sobe (m) */
  comprimento: 480, subida: 150,
  /** a espessura do axônio (raio, m) e o raio do buraco negro da ponta (o horizonte) */
  raio: 1.6, bnR: 24,
  /** a boca (o anel na borda, onde se pisa) */
  bocaR: 3.2,
  /** quanto dura a viagem pela prancha (s, de ponta a ponta) */
  viagem: 13,
  /** dendritos por fio (cada um com 2 galhinhos) */
  dendritos: 12,
} as const;

const SALAS_FIO: readonly NomeSala[] = ["lounge", "garagem", "biblioteca", "jardim"];
/** um gerador pseudoaleatório pequeno (mulberry32) — o desenho é o mesmo pra todo mundo */
function rng(semente: number) { let a = semente >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const semente = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** Catmull-Rom (centrípeta não precisa: os pontos vêm espaçados) entre p1 e p2 */
function cr(p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 {
  const t2 = t * t, t3 = t2 * t, f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z) };
}
/** amostra a curva pelos pontos de controle em `n` pontos (com as pontas repetidas) */
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
  /** o axônio (amostrado), o comprimento acumulado de cada ponto e o total */
  eixo: V3[]; acum: number[]; comprimento: number;
  /** a boca (o anel na borda) e o buraco negro da ponta */
  boca: V3 & { r: number }; bn: V3 & { r: number };
  /** os dendritos (cada um uma polilinha amostrada) e as pontinhas acesas */
  ramos: V3[][]; bulbos: V3[];
};

function montarFio(sala: NomeSala): FioCosmico {
  const L = CIDADE.salas[sala], a = Math.atan2(L.z, L.x), dir = { x: Math.cos(a), z: Math.sin(a) }, perp = { x: -dir.z, z: dir.x };
  const r = rng(semente(sala)), fase = r() * Math.PI * 2, r0 = CIDADE.andavelR - 3, N = 9;
  const ctrl: V3[] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, d = r0 + t * FIO.comprimento, sobe = FIO.subida * (t * t * (3 - 2 * t)), lado = Math.sin(t * Math.PI * 2.2 + fase) * 34 * t, onda = Math.sin(t * Math.PI * 3 + fase * 0.7) * 10 * t;
    ctrl.push({ x: dir.x * d + perp.x * lado, y: 0.5 + sobe + onda, z: dir.z * d + perp.z * lado });
  }
  ctrl[0] = { x: dir.x * r0, y: 0.5, z: dir.z * r0 }; ctrl[1] = { x: dir.x * (r0 + 14), y: 1.5, z: dir.z * (r0 + 14) };   // (sai rente ao piso, reto)
  const eixo = amostrarCurva(ctrl, 220), acum = [0];
  for (let i = 1; i < eixo.length; i++) acum.push(acum[i - 1]! + Math.hypot(eixo[i]!.x - eixo[i - 1]!.x, eixo[i]!.y - eixo[i - 1]!.y, eixo[i]!.z - eixo[i - 1]!.z));
  const fim = eixo[eixo.length - 1]!, pen = eixo[eixo.length - 6]!, tl = Math.hypot(fim.x - pen.x, fim.y - pen.y, fim.z - pen.z) || 1;
  const bn = { x: fim.x + ((fim.x - pen.x) / tl) * FIO.bnR * 1.5, y: fim.y + ((fim.y - pen.y) / tl) * FIO.bnR * 1.5, z: fim.z + ((fim.z - pen.z) / tl) * FIO.bnR * 1.5, r: FIO.bnR };
  // os DENDRITOS: saem do axônio pros lados (e pra cima/baixo), curvos, cada um com 2 galhinhos
  const ramos: V3[][] = [], bulbos: V3[] = [];
  for (let k = 0; k < FIO.dendritos; k++) {
    const u = 0.12 + (k / FIO.dendritos) * 0.8 + r() * 0.04, i = Math.floor(u * (eixo.length - 1)), o = eixo[i]!;
    const lado = k % 2 ? 1 : -1, comp = 40 + r() * 70, vy = (r() - 0.35) * 0.8;
    const p = (s: number, curva: number): V3 => ({ x: o.x + perp.x * lado * comp * s + dir.x * comp * curva, y: o.y + comp * vy * s + Math.sin(s * Math.PI) * 6, z: o.z + perp.z * lado * comp * s + dir.z * comp * curva });
    const ctrlR = [o, p(0.35, 0.05 + r() * 0.1), p(0.7, 0.15 + r() * 0.15), p(1, 0.2 + r() * 0.25)];
    const ramo = amostrarCurva(ctrlR, 24); ramos.push(ramo); bulbos.push(ramo[ramo.length - 1]!);
    for (let g = 0; g < 2; g++) {   // os galhinhos
      const b = ramo[10 + g * 7]!, cg = 14 + r() * 26, ang = (r() - 0.5) * 2.2, dx = Math.cos(ang) * perp.x * lado + Math.sin(ang) * dir.x, dz = Math.cos(ang) * perp.z * lado + Math.sin(ang) * dir.z;
      const galho = amostrarCurva([b, { x: b.x + dx * cg * 0.5, y: b.y + (r() - 0.4) * cg * 0.4, z: b.z + dz * cg * 0.5 }, { x: b.x + dx * cg, y: b.y + (r() - 0.4) * cg * 0.7, z: b.z + dz * cg }], 12);
      ramos.push(galho); bulbos.push(galho[galho.length - 1]!);
    }
  }
  return { sala, eixo, acum, comprimento: acum[acum.length - 1]!, boca: { ...eixo[0]!, y: 0, r: FIO.bocaR }, bn, ramos, bulbos };
}

let cache: FioCosmico[] | null = null;
/** os fios (um por sala), na ordem das salas */
export const fiosCosmicos = (): FioCosmico[] => (cache ??= SALAS_FIO.map(montarFio));
export const fioDaSala = (s: NomeSala): FioCosmico => fiosCosmicos().find((f) => f.sala === s)!;

/** o ponto do axônio na fração `u` (0 = a boca, 1 = a ponta — pelo comprimento) e o rumo (yaw: +z = frente) */
export function pontoDoFio(f: FioCosmico, u: number): V3 & { rumo: number } {
  const alvo = Math.max(0, Math.min(1, u)) * f.comprimento;
  let lo = 0, hi = f.acum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (f.acum[m]! < alvo) lo = m; else hi = m; }
  const a = f.eixo[lo]!, b = f.eixo[hi]!, seg = f.acum[hi]! - f.acum[lo]! || 1, k = (alvo - f.acum[lo]!) / seg;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, rumo: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** pisou na boca de qual fio? (`l` = local da ilha; `yRel` = altura acima do piso da central) */
export function fioNaBoca(l: { x: number; z: number }, yRel: number): FioCosmico | null {
  if (Math.abs(yRel) > 1.5) return null;
  for (const f of fiosCosmicos()) if (Math.hypot(l.x - f.boca.x, l.z - f.boca.z) < f.boca.r) return f;
  return null;
}

/** a fração da viagem pela prancha (0..1) → a posição no fio (acelera e freia suave) */
export const uDaViagemFio = (k: number) => { const t = Math.max(0, Math.min(1, k)); return t * t * (3 - 2 * t); };
