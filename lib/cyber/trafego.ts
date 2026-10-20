/**
 * Cyberespaço — o TRÁFEGO DO CÉU da Zaeon (PURO): as ROTAS DE VOO e os carros e motos que passam por elas. Out/2026, o
 * dono: "uma cidade bem dinâmica e movimentada nos céus — as naves e bikes vêm de lá (dos buracos negros), em tempo
 * real". Cada veículo SAI de um buraco negro (a ponta de um fio cósmico — lib/cyber/fiosCosmicos), desce numa rampa até
 * um dos ANÉIS de voo em volta da Zaeon, dá uma parte da volta e sobe pra MERGULHAR noutro buraco negro (sumindo nele).
 *
 * Tudo sai do RELÓGIO (o mesmo `t` pra todo mundo, sem rede): quem olha vê o mesmo trânsito. Referencial LOCAL da ilha
 * (y = acima do piso da central). Determinístico.
 */
import { amostrarCurva, fiosCosmicos, type V3 } from "./fiosCosmicos";

export type TipoVeiculo = "carro" | "moto";
/** os ANÉIS de voo: raio, altura, sentido (+1 anti-horário visto de cima) e a ondulação vertical */
export const ANEIS_VOO = [
  { r: 302, y: 26, sentido: -1, onda: 4 },   // o BAIXO, colado na borda: o trânsito que se vê de perto
  { r: 350, y: 58, sentido: 1, onda: 6 },
  { r: 405, y: 94, sentido: -1, onda: 9 },
  { r: 465, y: 132, sentido: 1, onda: 12 },
] as const;
export const TRAFEGO = {
  carros: 60, motos: 44,
  /** velocidade (m/s) */
  velCarro: 48, velMoto: 64,
  /** fração do caminho em que o veículo cresce saindo do buraco negro / encolhe entrando */
  emergir: 0.06,
  /** respiro entre uma viagem e a próxima (s) — ninguém aparece no mesmo lugar ao mesmo tempo */
  pausa: 4,
} as const;
export const CORES_TRAFEGO = ["#ff7a2a", "#2f8bff", "#3ddc84", "#a066ff", "#ff5fa2", "#2fd6e8", "#ffd23f", "#e8e8f0"] as const;

function rng(s: number) { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export type Viagem = { pts: V3[]; acum: number[]; comprimento: number; dur: number };
/** uma viagem: do buraco negro `a` → o anel `k` (entra no ângulo do buraco, anda `voltas` de volta) → o buraco `b` */
export function montarViagem(a: number, b: number, k: number, voltas: number, vel: number): Viagem {
  const fios = fiosCosmicos(), A = fios[a % fios.length]!.bn, B = fios[b % fios.length]!.bn, anel = ANEIS_VOO[k % ANEIS_VOO.length]!;
  const angA = Math.atan2(A.z, A.x), angB0 = Math.atan2(B.z, B.x);
  // o ângulo de saída no sentido do anel, andando pelo menos um pedaço (e `voltas` a mais)
  let dAng = (angB0 - angA) * anel.sentido; while (dAng < 0.6) dAng += Math.PI * 2; dAng += voltas * Math.PI * 2;
  const noAnel = (ang: number, extra = 0): V3 => ({ x: Math.cos(ang) * anel.r, y: anel.y + Math.sin(ang * 3) * anel.onda + extra, z: Math.sin(ang) * anel.r });
  const ctrl: V3[] = [
    { x: A.x, y: A.y, z: A.z },
    { x: A.x * 0.82, y: A.y * 0.85 + anel.y * 0.15, z: A.z * 0.82 },   // a RAMPA: sai do buraco descendo pra dentro
    noAnel(angA + anel.sentido * 0.12, 8),
  ];
  const passos = Math.max(3, Math.ceil(dAng / 0.35));
  for (let i = 1; i < passos; i++) ctrl.push(noAnel(angA + anel.sentido * (0.12 + ((dAng - 0.24) * i) / passos)));
  ctrl.push(noAnel(angA + anel.sentido * (dAng - 0.12), 8), { x: B.x * 0.82, y: B.y * 0.85 + anel.y * 0.15, z: B.z * 0.82 }, { x: B.x, y: B.y, z: B.z });
  const pts = amostrarCurva(ctrl, Math.max(60, ctrl.length * 10)), acum = [0];
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y, pts[i]!.z - pts[i - 1]!.z));
  const comprimento = acum[acum.length - 1]!;
  return { pts, acum, comprimento, dur: comprimento / vel };
}

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
  return montarViagem(a, b, Math.floor(r() * ANEIS_VOO.length), r() < 0.35 ? 1 : 0, ve.vel);
}

/** onde o veículo está no instante `t` (s, o relógio de todo mundo): a viagem da vez, a fração e a ESCALA (0 dentro do
 *  buraco negro → 1 no voo). Cada viagem dura o comprimento/velocidade + a pausa; a 1ª começa num atraso próprio */
export function estadoDoVeiculo(ve: VeiculoCeu, t: number, cache?: Map<string, Viagem>): { v: Viagem; u: number; escala: number; n: number } | null {
  // o comprimento médio de uma viagem é ~1,8 km: o ciclo se mede pela viagem nº n (sem acumular: n = ⌊(t + atraso) / ciclo⌋)
  const ciclo = 1900 / ve.vel + TRAFEGO.pausa, atraso = (ve.semente % 1000) / 1000 * ciclo, n = Math.floor((t + atraso) / ciclo);
  const k = `${ve.i}:${n}`; let v = cache?.get(k);
  if (!v) { v = viagemDe(ve, n); cache?.set(k, v); }
  const dentro = (t + atraso) - n * ciclo; if (dentro > v.dur) return null;   // (no respiro: dentro do buraco negro)
  const u = dentro / v.dur, e = TRAFEGO.emergir, escala = Math.min(1, u / e, (1 - u) / e);
  return { v, u, escala: Math.max(0, escala), n };
}
