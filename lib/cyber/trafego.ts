/**
 * Cyberespaço — o TRÁFEGO DO CÉU da Zaeon (PURO): os carros e as motos que andam pelas PISTAS CÓSMICAS (lib/cyber/
 * fiosCosmicos). Out/2026, o dono: "o caminho tem que ser trafegado por carros e motos — as naves e bikes vêm de lá
 * (dos buracos negros), em tempo real". Cada veículo SAI do buraco negro de um canto, vem pela pista dele (na contramão
 * da espiral: saindo da órbita) até a Zaeon, contorna a borda pelo ANEL do hub e vai embora por outra pista, entrando
 * em espiral noutro buraco negro (sumindo nele). Cada um numa FAIXA própria (de lado e de altura) — quem é levado pelo
 * fluxo vai no meio.
 *
 * Tudo sai do RELÓGIO (o mesmo `t` pra todo mundo, sem rede): quem olha vê o mesmo trânsito. Referencial LOCAL da ilha
 * (y = acima do piso da central). Determinístico.
 */
import { amostrarCurva, fiosCosmicos, pontoDoFio, type FioCosmico, type V3 } from "./fiosCosmicos";

export type TipoVeiculo = "carro" | "moto";
/** o ANEL do hub: onde as pistas se encontram, contornando a borda da Zaeon (as faixas que se veem de perto) */
export const ANEIS_VOO = [{ r: 304, y: 36, sentido: 1, onda: 5 }] as const;
export const TRAFEGO = {
  carros: 76, motos: 54,
  /** velocidade (m/s) */
  velCarro: 52, velMoto: 68,
  /** fração do caminho em que o veículo cresce saindo do buraco negro / encolhe entrando */
  emergir: 0.035,
  /** respiro entre uma viagem e a próxima (s) */
  pausa: 4,
  /** as faixas: até quantos metros pro lado e pra cima do meio da pista */
  faixaLado: 14, faixaAlto: 8,
} as const;
export const CORES_TRAFEGO = ["#ff7a2a", "#2f8bff", "#3ddc84", "#a066ff", "#ff5fa2", "#2fd6e8", "#ffd23f", "#e8e8f0"] as const;

function rng(s: number) { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export type Viagem = { pts: V3[]; acum: number[]; comprimento: number; dur: number };
/** a fração da pista em que ela cruza o anel do hub (saindo da borda) */
function uNoAnel(f: FioCosmico): number { const R = ANEIS_VOO[0].r; for (let u = 0; u <= 1; u += 0.002) { const p = pontoDoFio(f, u); if (Math.hypot(p.x, p.z) >= R) return u; } return 0.05; }
const cacheU = new Map<FioCosmico, number>();
const uAnel = (f: FioCosmico) => { let u = cacheU.get(f); if (u === undefined) { u = uNoAnel(f); cacheU.set(f, u); } return u; };

/** uma viagem: do buraco negro da pista `a` (vindo pela pista, ao contrário) → o anel do hub (`voltas` a mais) → a
 *  pista `b` até o buraco negro dela. `lado`/`alto` = a faixa (m) */
export function montarViagem(a: number, b: number, _k: number, voltas: number, vel: number, lado = 0, alto = 0): Viagem {
  const fios = fiosCosmicos(), fa = fios[a % fios.length]!, fb = fios[b % fios.length]!, anel = ANEIS_VOO[0];
  const naFaixa = (f: FioCosmico, u: number): V3 => { const p = pontoDoFio(f, u), k = Math.min(1, (1 - u) * 6); return { x: p.x + Math.cos(p.rumo) * lado * k, y: p.y + alto * k, z: p.z - Math.sin(p.rumo) * lado * k }; };   // (a faixa fecha no horizonte)
  const ctrl: V3[] = [];
  const ua = uAnel(fa), ub = uAnel(fb);
  for (let u = 1; u > ua; u -= 0.015) ctrl.push(naFaixa(fa, u));   // vindo do buraco negro A pela pista
  const pa = pontoDoFio(fa, ua), pb = pontoDoFio(fb, ub), angA = Math.atan2(pa.z, pa.x), angB = Math.atan2(pb.z, pb.x);
  let dAng = (angB - angA) * anel.sentido; while (dAng < 0.3) dAng += Math.PI * 2; dAng += voltas * Math.PI * 2;
  const R = anel.r + lado * 0.5, passos = Math.max(2, Math.ceil(dAng / 0.3));
  for (let i = 0; i <= passos; i++) { const ang = angA + anel.sentido * (dAng * i) / passos; ctrl.push({ x: Math.cos(ang) * R, y: anel.y + alto + Math.sin(ang * 3) * anel.onda, z: Math.sin(ang) * R }); }   // o anel do hub
  for (let u = ub; u < 1; u += 0.015) ctrl.push(naFaixa(fb, u));   // indo pela pista até o buraco negro B
  ctrl.push(naFaixa(fb, 1));   // (até o horizonte, sem sobrar pedaço)
  const pts = amostrarCurva(ctrl, ctrl.length * 3), acum = [0];
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y, pts[i]!.z - pts[i - 1]!.z));
  const comprimento = acum[acum.length - 1]!;
  return { pts, acum, comprimento, dur: comprimento / vel };
}

/** a distância (m) que cabe num ciclo de cada veículo: a viagem MAIS LONGA possível (qualquer par de pistas, com a volta a
 *  mais no anel e a faixa mais de fora) + 5% */
export const CICLO_M = (() => { let m = 0; const n = fiosCosmicos().length; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) for (const l of [-TRAFEGO.faixaLado, TRAFEGO.faixaLado]) m = Math.max(m, montarViagem(a, b, 0, 1, 1, l, TRAFEGO.faixaAlto).comprimento); return m * 1.05; })();

/** a posição na viagem na fração `u` (pelo comprimento), o rumo (yaw: +z = frente) e a inclinação (pitch, + = subindo) */
export function naViagem(v: Viagem, u: number): V3 & { rumo: number; sobe: number } {
  const alvo = Math.max(0, Math.min(1, u)) * v.comprimento;
  let lo = 0, hi = v.acum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (v.acum[m]! < alvo) lo = m; else hi = m; }
  const a = v.pts[lo]!, b = v.pts[hi]!, seg = v.acum[hi]! - v.acum[lo]! || 1, k = (alvo - v.acum[lo]!) / seg;
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  return { x: a.x + dx * k, y: a.y + dy * k, z: a.z + dz * k, rumo: Math.atan2(dx, dz), sobe: Math.atan2(dy, Math.hypot(dx, dz)) };
}

/** um VEÍCULO do tráfego: o tipo, a cor e a semente das viagens dele */
export type VeiculoCeu = { i: number; tipo: TipoVeiculo; cor: string; semente: number; vel: number };
export const VEICULOS_CEU: VeiculoCeu[] = Array.from({ length: TRAFEGO.carros + TRAFEGO.motos }, (_, i) => {
  const tipo: TipoVeiculo = i < TRAFEGO.carros ? "carro" : "moto", r = rng(9001 + i * 131);
  return { i, tipo, cor: CORES_TRAFEGO[Math.floor(r() * CORES_TRAFEGO.length)]!, semente: Math.floor(r() * 1e9), vel: (tipo === "carro" ? TRAFEGO.velCarro : TRAFEGO.velMoto) * (0.85 + r() * 0.3) };
});

/** a viagem nº `n` de um veículo (de que buraco a que buraco, por que anel, quantas voltas) — sempre a mesma pro mesmo `n` */
export function viagemDe(ve: VeiculoCeu, n: number): Viagem {
  const r = rng(ve.semente + n * 7919), nf = fiosCosmicos().length;
  const a = Math.floor(r() * nf); let b = Math.floor(r() * nf); if (b === a) b = (b + 1 + Math.floor(r() * (nf - 1))) % nf;
  const lado = (r() < 0.5 ? -1 : 1) * (4 + r() * (TRAFEGO.faixaLado - 4)), alto = (r() - 0.3) * TRAFEGO.faixaAlto;   // (fora do meio: o meio é de quem vai no fluxo)
  return montarViagem(a, b, 0, r() < 0.25 ? 1 : 0, ve.vel, lado, alto);
}

/** onde o veículo está no instante `t` (s, o relógio de todo mundo): a viagem da vez, a fração e a ESCALA (0 dentro do
 *  buraco negro → 1 no voo). Cada viagem dura o comprimento/velocidade + a pausa; a 1ª começa num atraso próprio */
export function estadoDoVeiculo(ve: VeiculoCeu, t: number, cache?: Map<string, Viagem>): { v: Viagem; u: number; escala: number; n: number } | null {
  // uma viagem tem ~4–5 km (duas pistas + o anel): o ciclo se mede pela viagem nº n (sem acumular: n = ⌊(t + atraso) / ciclo⌋)
  const ciclo = CICLO_M / ve.vel + TRAFEGO.pausa, atraso = (ve.semente % 1000) / 1000 * ciclo, n = Math.floor((t + atraso) / ciclo);
  const k = `${ve.i}:${n}`; let v = cache?.get(k);
  if (!v) { v = viagemDe(ve, n); cache?.set(k, v); }
  const dentro = (t + atraso) - n * ciclo; if (dentro > v.dur) return null;   // (no respiro: dentro do buraco negro)
  const u = dentro / v.dur, e = TRAFEGO.emergir, escala = Math.min(1, u / e, (1 - u) / e);
  return { v, u, escala: Math.max(0, escala), n };
}
