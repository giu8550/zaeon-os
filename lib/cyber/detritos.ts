/**
 * Cyberespaço — os DETRITOS do buraco negro (PURO; out/2026, o dono: "realismo e desafio pra chegar nos buracos negros:
 * detritos que tentam nos atingir antes que cheguemos no horizonte de eventos, onde a cutscene ocorre"):
 *  - a ZONA DE APROXIMAÇÃO: do alcance do magnetismo (lib/cyber/fiosCosmicos `raioDeAtracao`) até o PONTO DOCE (perto
 *    do horizonte). Dentro dela o buraco negro puxa de leve e ATIRA detritos: rochas que saem do lado dele, mirando onde
 *    você VAI estar — cada vez mais rápidas e mais seguidas chegando;
 *  - acertou: empurra pra trás, tira um pouco de vida, a tela treme;
 *  - chegou no ponto doce: ele te puxa sozinho (a tragada — a cutscene).
 * Tudo em coordenadas do MUNDO (o engine converte). Cada cliente lança os seus (são só pra quem está chegando).
 */
export type V3 = { x: number; y: number; z: number };

export const DETRITOS = {
  /** o PONTO DOCE: a que distância do CENTRO do buraco negro (× o raio dele) ele puxa sozinho */
  doce: 2.4,
  /** de quanto em quanto tempo sai um detrito (s): na borda da zona → no ponto doce */
  cadencia: [1.5, 0.32] as const,
  /** a velocidade (m/s) e o raio (m) de um detrito */
  vel: [50, 115] as const, raio: [1.6, 4.4] as const,
  /** de onde ele sai: a que distância à frente (rumo ao buraco negro) e quanto espalhado de lado */
  distLanca: [120, 210] as const, espalha: 34,
  /** o meu raio (m) pra colisão; quanto do alvo é a MIRA (o resto, espalhado em volta) */
  euR: 1.7, mira: 0.7,
  /** a batida: o empurrão (m/s), o dano e quanto tempo os comandos ficam tontos (s) */
  empurrao: 36, dano: 7, tonto: 0.45,
  /** o MAGNETISMO dentro da zona (m/s², na borda → no ponto doce) */
  puxao: [1.5, 7] as const,
  /** quantos ficam vivos ao mesmo tempo, no máximo */
  max: 36,
} as const;

export type Detrito = { id: number; p: V3; v: V3; r: number; gira: V3; t: number; vida: number };

const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** onde estou na ZONA de um buraco negro (centro `bn`, raio `R`, alcance do magnetismo `alcance` — do horizonte): `k`
 *  0 na borda → 1 no ponto doce (ou null fora); `doce` = já chegou */
export function naZona(p: V3, bn: V3, R: number, alcance: number): { k: number; d: number; doce: boolean } | null {
  const d = Math.hypot(p.x - bn.x, p.y - bn.y, p.z - bn.z), fora = R + alcance, dentro = R * DETRITOS.doce;
  if (d > fora) return null;
  const k = Math.max(0, Math.min(1, (fora - d) / Math.max(1, fora - dentro)));
  return { k, d, doce: d <= dentro };
}

/** um DETRITO novo: sai do lado do buraco negro, à frente de quem chega, mirando onde ele vai estar (com a velocidade
 *  dele) — `rnd` = o sorteio (0..1) */
export function lancarDetrito(rnd: () => number, id: number, eu: V3, euVel: V3, bn: V3, k: number): Detrito {
  const D = DETRITOS;
  let fx = bn.x - eu.x, fy = bn.y - eu.y, fz = bn.z - eu.z; const L = Math.hypot(fx, fy, fz) || 1; fx /= L; fy /= L; fz /= L;
  // a base em volta do eixo (eu → buraco negro)
  let lx = -fz, lz = fx; const ll = Math.hypot(lx, lz) || 1; lx /= ll; lz /= ll;
  const ux = fy * lz, uy = fz * lx - fx * lz, uz = -fy * lx;
  const dist = Math.min(L * 0.9, lerp(D.distLanca[1], D.distLanca[0], k)), a = rnd() * Math.PI * 2, e = D.espalha * Math.sqrt(rnd());
  const o = { x: eu.x + fx * dist + lx * Math.cos(a) * e + ux * Math.sin(a) * e, y: eu.y + fy * dist + uy * Math.sin(a) * e, z: eu.z + fz * dist + lz * Math.cos(a) * e + uz * Math.sin(a) * e };
  const vel = lerp(D.vel[0], D.vel[1], k) * (0.85 + 0.3 * rnd());
  // a MIRA: onde eu vou estar quando ele chegar (uma iteração de previsão), com um erro de propósito em parte deles
  let tc = Math.hypot(eu.x - o.x, eu.y - o.y, eu.z - o.z) / vel;
  const alvo = { x: eu.x + euVel.x * tc, y: eu.y + euVel.y * tc, z: eu.z + euVel.z * tc };
  tc = Math.hypot(alvo.x - o.x, alvo.y - o.y, alvo.z - o.z) / vel;
  const erro = rnd() < D.mira ? 0 : 6 + rnd() * 10, ae = rnd() * Math.PI * 2;
  alvo.x = eu.x + euVel.x * tc + lx * Math.cos(ae) * erro; alvo.y = eu.y + euVel.y * tc + Math.sin(ae) * erro; alvo.z = eu.z + euVel.z * tc + lz * Math.cos(ae) * erro;
  let vx = alvo.x - o.x, vy = alvo.y - o.y, vz = alvo.z - o.z; const vl = Math.hypot(vx, vy, vz) || 1; vx = (vx / vl) * vel; vy = (vy / vl) * vel; vz = (vz / vl) * vel;
  const r = lerp(D.raio[0], D.raio[1], rnd());
  return { id, p: o, v: { x: vx, y: vy, z: vz }, r, gira: { x: rnd() * 4 - 2, y: rnd() * 4 - 2, z: rnd() * 4 - 2 }, t: 0, vida: (dist * 2.2) / vel + 1 };
}

/** um passo do detrito; `acertou` = passou por mim nesse passo (o segmento contra a esfera — rápido não atravessa) */
export function passoDetrito(d: Detrito, dt: number, eu: V3): { acertou: boolean; morreu: boolean } {
  const a = { ...d.p };
  d.p.x += d.v.x * dt; d.p.y += d.v.y * dt; d.p.z += d.v.z * dt; d.t += dt;
  // a menor distância do segmento a→p até mim
  const sx = d.p.x - a.x, sy = d.p.y - a.y, sz = d.p.z - a.z, s2 = sx * sx + sy * sy + sz * sz;
  const u = s2 > 0 ? Math.max(0, Math.min(1, ((eu.x - a.x) * sx + (eu.y - a.y) * sy + (eu.z - a.z) * sz) / s2)) : 0;
  const dist = Math.hypot(a.x + sx * u - eu.x, a.y + sy * u - eu.y, a.z + sz * u - eu.z);
  return { acertou: dist < d.r + DETRITOS.euR, morreu: d.t > d.vida };
}

/** vai me acertar se eu não fizer nada? (a marca vermelha) — a menor distância futura, parado na minha velocidade */
export function vaiAcertar(d: Detrito, eu: V3, euVel: V3, folga = 2.5): boolean {
  const rx = d.p.x - eu.x, ry = d.p.y - eu.y, rz = d.p.z - eu.z, vx = d.v.x - euVel.x, vy = d.v.y - euVel.y, vz = d.v.z - euVel.z;
  const v2 = vx * vx + vy * vy + vz * vz; if (v2 < 1e-6) return false;
  const t = -(rx * vx + ry * vy + rz * vz) / v2; if (t < 0 || t > 4) return false;
  return Math.hypot(rx + vx * t, ry + vy * t, rz + vz * t) < d.r + DETRITOS.euR + folga;
}

/** o EMPURRÃO de uma batida: na direção do detrito, e um pouco pra trás (pra longe do buraco negro) */
export function empurraoDaBatida(d: Detrito, eu: V3, bn: V3): V3 {
  const v = len(d.v) || 1, b = { x: eu.x - bn.x, y: eu.y - bn.y, z: eu.z - bn.z }, bl = len(b) || 1, E = DETRITOS.empurrao;
  return { x: (d.v.x / v) * E * 0.7 + (b.x / bl) * E * 0.5, y: (d.v.y / v) * E * 0.7 + (b.y / bl) * E * 0.5 + 6, z: (d.v.z / v) * E * 0.7 + (b.z / bl) * E * 0.5 };
}
/** o MAGNETISMO dentro da zona: a aceleração (m/s²) rumo ao centro */
export function puxaoDaZona(eu: V3, bn: V3, k: number): V3 {
  const a = lerp(DETRITOS.puxao[0], DETRITOS.puxao[1], k * k), d = { x: bn.x - eu.x, y: bn.y - eu.y, z: bn.z - eu.z }, l = len(d) || 1;
  return { x: (d.x / l) * a, y: (d.y / l) * a, z: (d.z / l) * a };
}
/** quanto tempo até o próximo lançamento */
export const proximoLancamento = (k: number, rnd: () => number) => lerp(DETRITOS.cadencia[0], DETRITOS.cadencia[1], k) * (0.7 + 0.6 * rnd());
