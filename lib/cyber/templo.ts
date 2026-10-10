/**
 * Cyberespaço — o LOUNGE EM DOIS NÍVEIS e o TEMPLO (PURO, sem three e SEM importar o ceu: tudo aqui é no referencial
 * da SALA do lounge — +z = a porta, rumo ao centro da ilha; +x = a DIREITA de quem entra — e quem converte pro mundo é
 * lib/cyber/ceu). Pedido do dono (out/2026): o lounge ~3× maior, com um PÁTIO embaixo (a chegada do fio, as MOTOS
 * estacionadas e as calçadas), uma RAMPA larga subindo pra FESTA (o DECK, onde ficam o DJ, a pista e as rodas de sofá)
 * e, saindo do lado direito do deck, uma ESCADARIA em curva acentuada mas contínua, colada numa MURALHA vertical que
 * pulsa como uma VEIA, até o TEMPLO — uma plataforma do tamanho do lounge antigo, mais alta, com uma CAPELA (a irmã
 * pequena da capela da Zaeon) e o SANFONEIRO tocando no meio dela.
 */

type P2 = { x: number; z: number };

/** o DECK da festa: tudo que está atrás de `zFrente` (o −z da sala) fica `h` m acima do pátio; a RAMPA sobe do pátio
 *  até ele pelo meio (|x| ≤ `meia`, de `zFrente + len` até `zFrente`) */
export const DECK = { h: 4, zFrente: 14, rampa: { meia: 7, len: 16 }, colR: 0.5, passo: 0.6 } as const;
/** a calçada central do pátio (da porta até o pé da rampa) e o estacionamento das motos (centro do lote, `corredor` =
 *  o vão da calçada no meio das vagas) */
export const PATIO = { calcadaMeia: 5, lote: { z: 47, corredor: 10, espacamento: 3.8 } } as const;

/** o TEMPLO: centro, raio, altura do piso acima do pátio do lounge e a CAPELA dele (mais estreita que a da Zaeon, mais alta) */
export const TEMPLO = {
  x: 124, z: -124, r: 40, h: 46,   // (o dono: bem mais alto que o deck — a escadaria sobe 42 m)
  /** a capela do templo é MAIS ALTA que a da Zaeon (a ponta passa ~80 m acima da dela) e fura as NUVENS da tempestade */
  capela: { r: 20, pilares: 16, pilarR: 1.3, altura: 22, achata: 0.55, tamborR: 7, tamborAlt: 6, pontaLen: 50 },
  /** o PALCO redondo do sanfoneiro (no centro da capela) */
  palco: { r: 3.4, h: 0.7 },
  colR: 0.6, passo: 1,
} as const;

/** a altura (acima do piso do templo) onde a PONTA da capela do templo começa, e a do topo dela */
export function pontaDaCapelaDoTemplo(): { ini: number; topo: number } {
  const C = TEMPLO.capela, RC = C.r + 1, yT0 = C.altura + Math.sqrt(RC * RC - C.tamborR * C.tamborR) * C.achata - 0.5, ini = yT0 + C.tamborAlt + C.tamborR * 0.92 * 0.9 - 0.3;
  return { ini, topo: ini + C.pontaLen };
}

/** a ESCADARIA: a linha do meio (referencial do lounge), saindo da borda direita do deck e chegando na borda do
 *  templo — vira à direita forte e contínua (a "veia"); `meia` = meia-largura; o piso sobe de DECK.h a TEMPLO.h com
 *  um patamar plano em cada ponta */
export const ESCADARIA = {
  meia: 3.6, patamar: 4, passo: 0.6, colR: 0.5,
  /** os pontos de controle (Catmull-Rom); o 1º fica DENTRO do lounge (na borda do deck), o último dentro do templo */
  controle: [{ x: 64, z: -19 }, { x: 82, z: -21 }, { x: 100, z: -29 }, { x: 114, z: -43 }, { x: 121, z: -62 }, { x: 122, z: -80 }, { x: 122, z: -88 }] as P2[],
  /** a MURALHA (do lado de FORA da curva, o −lat): altura acima do piso da escada */
  muralha: { alt: 22, esp: 1.4 },
} as const;
/** o ângulo (referencial da sala, x = cos·r, z = sen·r — o mesmo do `paredeDaSala`) da SAÍDA pro templo na parede do
 *  lounge, e a meia-abertura dela (rad) */
export const saidaDoLounge = (r: number) => { const p = ESCADARIA.controle[0]!; return { ang: Math.atan2(p.z, p.x), meia: (ESCADARIA.meia + 0.9) / r }; };
/** a ENTRADA do templo (o ângulo da escada chegando, no referencial do TEMPLO — x = cos, z = sen) e a meia-abertura */
export const entradaDoTemplo = () => { const p = ESCADARIA.controle[ESCADARIA.controle.length - 2]!; return { ang: Math.atan2(p.z - TEMPLO.z, p.x - TEMPLO.x), meia: (ESCADARIA.meia + 0.9) / TEMPLO.r }; };

/** a curva amostrada (Catmull-Rom centrípeta simples, uniforme): pontos, tangentes e o comprimento acumulado */
type Amostra = { x: number; z: number; tx: number; tz: number; s: number };
let curvaCache: { pts: Amostra[]; len: number } | null = null;
export function curvaDaEscadaria(): { pts: Amostra[]; len: number } {
  if (curvaCache) return curvaCache;
  const C = ESCADARIA.controle, N = 24, pts: Amostra[] = [];
  const cr = (a: number, b: number, c: number, d: number, t: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < C.length - 1; i++) {
    const p0 = C[Math.max(0, i - 1)]!, p1 = C[i]!, p2 = C[i + 1]!, p3 = C[Math.min(C.length - 1, i + 2)]!;
    for (let k = 0; k < N; k++) { const t = k / N; pts.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), z: cr(p0.z, p1.z, p2.z, p3.z, t), tx: 0, tz: 0, s: 0 }); }
  }
  const ult = C[C.length - 1]!; pts.push({ x: ult.x, z: ult.z, tx: 0, tz: 0, s: 0 });
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!, d = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    pts[i]!.tx = (b.x - a.x) / d; pts[i]!.tz = (b.z - a.z) / d;
    if (i > 0) s += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z);
    pts[i]!.s = s;
  }
  curvaCache = { pts, len: s };
  return curvaCache;
}
/** onde na escadaria um ponto (referencial do lounge) está: `s` ao longo (m), `lat` de lado (+ = o lado de DENTRO da
 *  curva; a MURALHA fica no −) e a distância até a linha */
export function naEscadaria(q: P2): { s: number; lat: number; d: number } {
  const { pts } = curvaDaEscadaria();
  let best = { s: 0, lat: 0, d: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!, vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz || 1;
    const u = Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.z - a.z) * vz) / L2)), px = a.x + vx * u, pz = a.z + vz * u, d = Math.hypot(q.x - px, q.z - pz);
    if (d < best.d) { const L = Math.sqrt(L2); best = { s: a.s + u * L, lat: ((q.x - a.x) * vz - (q.z - a.z) * vx) / L, d }; }
  }
  return best;
}
/** a altura do piso da escadaria (acima do pátio do lounge) a `s` m do começo: patamar, sobe por igual, patamar */
export function alturaDaEscadaria(s: number): number {
  const { len } = curvaDaEscadaria(), P = ESCADARIA.patamar, k = Math.max(0, Math.min(1, (s - P) / Math.max(1, len - 2 * P)));
  return DECK.h + (TEMPLO.h - DECK.h) * k;
}
/** está no corredor da escadaria (referencial do lounge)? — só o trecho FORA do lounge e do templo conta */
export function noCorredorDaEscadaria(q: P2, folga = 0): { s: number; lat: number } | null {
  const e = naEscadaria(q);
  return Math.abs(e.lat) <= ESCADARIA.meia + folga && e.d <= ESCADARIA.meia + folga + 0.01 ? { s: e.s, lat: e.lat } : null;
}
export const noTemplo = (q: P2, folga = 0) => Math.hypot(q.x - TEMPLO.x, q.z - TEMPLO.z) <= TEMPLO.r + folga;

/** a altura do piso (acima do pátio do lounge) num ponto DENTRO do disco do lounge (referencial do lounge): o pátio
 *  (0), a rampa e o deck — o palco e a torre do DJ o ceu soma por cima */
export function alturaNoLounge(q: P2): number {
  const { zFrente, rampa, h } = DECK;
  if (q.z <= zFrente) return h;
  if (Math.abs(q.x) <= rampa.meia && q.z <= zFrente + rampa.len) return h * (1 - (q.z - zFrente) / rampa.len);
  return 0;
}

/** os COLISORES (referencial do lounge) do desnível: a frente do deck (menos a boca da rampa) e as laterais da rampa —
 *  sobe-se só pela rampa; em `r` = raio do lounge (a frente vai de parede a parede) */
export function bordaDoDeck(r: number): P2[] {
  const { zFrente, rampa, passo } = DECK, out: P2[] = [], X = Math.sqrt(r * r - zFrente * zFrente) - 0.8;
  for (let x = -X; x <= X; x += passo) if (Math.abs(x) > rampa.meia + 0.1) out.push({ x, z: zFrente + 0.25 });
  for (let k = 0; k <= rampa.len; k += passo) for (const sx of [-1, 1]) out.push({ x: sx * (rampa.meia + 0.3), z: zFrente + 0.25 + k });
  return out;
}
/** os COLISORES (referencial do lounge) da escadaria: a muralha de fora e o guarda-corpo de dentro, do lado de FORA da
 *  parede do lounge até a borda do templo (`rLounge` = raio do lounge) */
export function bordasDaEscadaria(rLounge: number): P2[] {
  const { pts } = curvaDaEscadaria(), off = ESCADARIA.meia + 0.35, out: P2[] = [];
  for (const lado of [-1, 1]) {
    let ant: P2 | null = null;
    for (const p of pts) {
      const c = { x: p.x + p.tz * off * lado, z: p.z - p.tx * off * lado };   // a normal (tz, −tx) aponta pro lado +lat
      if (Math.hypot(c.x, c.z) < rLounge + 0.4 || noTemplo(c, 0.4)) { ant = null; continue; }
      if (ant) { const d = Math.hypot(c.x - ant.x, c.z - ant.z); if (d < ESCADARIA.passo) continue; for (let k = 1; k < d / ESCADARIA.passo; k++) out.push({ x: ant.x + ((c.x - ant.x) * k * ESCADARIA.passo) / d, z: ant.z + ((c.z - ant.z) * k * ESCADARIA.passo) / d }); }
      out.push(c); ant = c;
    }
  }
  return out;
}
/** os COLISORES (referencial do lounge) do templo: a parede em volta (menos a entrada da escadaria), os pilares da
 *  capela e o palco do sanfoneiro */
export function colisoresDoTemplo(): { x: number; z: number; r: number }[] {
  const T = TEMPLO, out: { x: number; z: number; r: number }[] = [], ent = entradaDoTemplo(), n = Math.ceil((2 * Math.PI * T.r) / T.passo);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; let d = a - ent.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) < ent.meia) continue;
    out.push({ x: T.x + Math.cos(a) * T.r, z: T.z + Math.sin(a) * T.r, r: T.colR });
  }
  const C = T.capela;
  for (let i = 0; i < C.pilares; i++) { const a = (i / C.pilares) * Math.PI * 2 + Math.PI / C.pilares; out.push({ x: T.x + Math.cos(a) * C.r, z: T.z + Math.sin(a) * C.r, r: C.pilarR + 0.2 }); }
  out.push({ x: T.x, z: T.z, r: T.palco.r });
  return out;
}
/** pra onde o SANFONEIRO olha (ângulo no referencial do lounge, atan2(dx, dz)): pra entrada do templo */
export const rumoDoSanfoneiro = () => { const e = entradaDoTemplo(); return Math.atan2(Math.cos(e.ang), Math.sin(e.ang)); };
