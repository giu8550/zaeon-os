/**
 * Os DESENHOS TÉCNICOS dos entregáveis (foguete, motor a jato, PCB, fonte, bateria, painel solar) — PURO, sem three: só
 * a lista de segmentos 3D (x1,y1,z1,x2,y2,z2, …) na ordem em que a caneta passa. Usado pelo blueprint 3D da vitrine do
 * hero (components/research/blueprints, no worker) e pelos EXEMPLOS da seção de blueprints da landing (SVG —
 * components/main/BlueprintsShowcase).
 */
import type { IdEntregavel } from "@/lib/research/roteiroVitrine";

export type V = readonly [number, number, number];

/** o caderno de traços: cada `linha` vira um segmento, na ORDEM em que a caneta passa */
export function caderno() {
  const pts: number[] = [];
  const linha = (a: V, b: V) => { pts.push(a[0], a[1], a[2], b[0], b[1], b[2]); };
  const poli = (vs: V[], fechar = false) => { for (let i = 1; i < vs.length; i++) linha(vs[i - 1]!, vs[i]!); if (fechar && vs.length > 2) linha(vs[vs.length - 1]!, vs[0]!); };
  /** um círculo no plano dado ("xy" de frente, "xz" deitado, "yz" de lado) */
  const circulo = (c: V, r: number, plano: "xy" | "xz" | "yz" = "xz", n = 28, de = 0, ate = Math.PI * 2) => {
    const vs: V[] = [];
    for (let i = 0; i <= n; i++) {
      const a = de + ((ate - de) * i) / n, u = Math.cos(a) * r, v = Math.sin(a) * r;
      vs.push(plano === "xy" ? [c[0] + u, c[1] + v, c[2]] : plano === "xz" ? [c[0] + u, c[1], c[2] + v] : [c[0], c[1] + u, c[2] + v]);
    }
    poli(vs);
  };
  const caixa = (c: V, s: V) => {
    const [x, y, z] = c, [a, b, d] = [s[0] / 2, s[1] / 2, s[2] / 2];
    const v = (i: number, j: number, k: number): V => [x + i * a, y + j * b, z + k * d];
    poli([v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], true);
    poli([v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1)], true);
    for (const [i, k] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) linha(v(i, -1, k), v(i, 1, k));
  };
  /** um retângulo plano no xy (de frente) */
  const ret = (c: V, w: number, h: number) => poli([[c[0] - w / 2, c[1] - h / 2, c[2]], [c[0] + w / 2, c[1] - h / 2, c[2]], [c[0] + w / 2, c[1] + h / 2, c[2]], [c[0] - w / 2, c[1] + h / 2, c[2]]], true);
  /** uma COTA de desenho técnico: a linha com os dois tiques nas pontas */
  const cota = (a: V, b: V, tique: V) => { linha(a, b); linha([a[0] - tique[0], a[1] - tique[1], a[2] - tique[2]], [a[0] + tique[0], a[1] + tique[1], a[2] + tique[2]]); linha([b[0] - tique[0], b[1] - tique[1], b[2] - tique[2]], [b[0] + tique[0], b[1] + tique[1], b[2] + tique[2]]); };
  return { pts, linha, poli, circulo, caixa, ret, cota };
}

/** os desenhos (unidades ~ -0.5..0.5, de pé no y) */
export const DESENHOS: Record<IdEntregavel, () => number[]> = {
  foguete: () => {
    const k = caderno(), R = 0.1;
    for (const y of [-0.3, -0.18, -0.06, 0.06, 0.18]) k.circulo([0, y, 0], R);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.linha([Math.cos(a) * R, -0.3, Math.sin(a) * R], [Math.cos(a) * R, 0.18, Math.sin(a) * R]); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.linha([Math.cos(a) * R, 0.18, Math.sin(a) * R], [0, 0.44, 0]); }   // a coifa
    k.circulo([0, 0.3, 0], R * 0.48);
    k.circulo([0, 0.04, R], 0.035, "xy");                                                                                          // a janela
    for (let i = 0; i < 3; i++) {                                                                                                  // as aletas
      const a = (i / 3) * Math.PI * 2 + 0.5, c = Math.cos(a), s = Math.sin(a);
      k.poli([[c * R, -0.12, s * R], [c * 0.22, -0.32, s * 0.22], [c * 0.22, -0.4, s * 0.22], [c * R, -0.3, s * R]]);
    }
    k.circulo([0, -0.36, 0], 0.07); k.circulo([0, -0.43, 0], 0.09);                                                                // o bocal
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.linha([Math.cos(a) * 0.06, -0.3, Math.sin(a) * 0.06], [Math.cos(a) * 0.09, -0.43, Math.sin(a) * 0.09]); }
    k.cota([0.26, -0.43, 0], [0.26, 0.44, 0], [0.02, 0, 0]);
    return k.pts;
  },
  motor: () => {
    const k = caderno();
    const aneis: [number, number][] = [[-0.38, 0.17], [-0.3, 0.19], [-0.1, 0.18], [0.1, 0.15], [0.26, 0.12], [0.38, 0.08]];
    for (const [x, r] of aneis) k.circulo([x, 0, 0], r, "yz");
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.poli(aneis.map(([x, r]) => [x, Math.cos(a) * r, Math.sin(a) * r] as V)); }
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; k.poli([[-0.36, 0, 0], [-0.36, Math.cos(a) * 0.15, Math.sin(a) * 0.15], [-0.36, Math.cos(a + 0.25) * 0.16, Math.sin(a + 0.25) * 0.16]]); }   // o fan
    k.circulo([-0.36, 0, 0], 0.04, "yz");
    k.linha([-0.4, 0, 0], [0.46, 0, 0]);                                                                                          // o eixo
    k.poli([[0.38, 0.06, 0], [0.47, 0, 0], [0.38, -0.06, 0]]);                                                                    // o cone de saída
    k.cota([-0.38, -0.27, 0], [0.38, -0.27, 0], [0, 0.02, 0]);
    return k.pts;
  },
  pcb: () => {
    const k = caderno(), z = 0;
    k.ret([0, 0, z], 0.8, 0.52); k.ret([0, 0, z], 0.76, 0.48);
    k.ret([-0.12, 0.05, z], 0.18, 0.18); k.ret([-0.12, 0.05, z], 0.13, 0.13);                                                      // o processador
    for (let i = -3; i <= 3; i++) { const d = i * 0.022; k.linha([-0.21, 0.05 + d, z], [-0.25, 0.05 + d, z]); k.linha([-0.03, 0.05 + d, z], [0.01, 0.05 + d, z]); k.linha([-0.12 + d, 0.14, z], [-0.12 + d, 0.18, z]); k.linha([-0.12 + d, -0.04, z], [-0.12 + d, -0.08, z]); }
    k.ret([0.2, 0.12, z], 0.14, 0.08); k.ret([0.2, -0.04, z], 0.14, 0.08);                                                          // as memórias
    k.poli([[0.01, 0.07, z], [0.08, 0.07, z], [0.08, 0.12, z], [0.13, 0.12, z]]);                                                   // as trilhas
    k.poli([[0.01, 0.03, z], [0.1, 0.03, z], [0.1, -0.04, z], [0.13, -0.04, z]]);
    k.poli([[-0.12, -0.08, z], [-0.12, -0.16, z], [0.05, -0.16, z], [0.05, -0.2, z]]);
    k.poli([[-0.25, 0.08, z], [-0.32, 0.08, z], [-0.32, -0.18, z]]);
    for (const [x, y] of [[0.05, -0.2], [-0.32, -0.18], [0.3, 0.2], [-0.33, 0.2], [0.3, -0.2]] as const) k.circulo([x, y, z], 0.014, "xy", 10);   // as vias
    for (let i = 0; i < 8; i++) k.ret([-0.3 + i * 0.05, -0.235, z], 0.03, 0.02);                                                   // o conector
    for (const x of [0.2, 0.26]) k.circulo([x, -0.17, z], 0.025, "xy", 14);                                                        // os capacitores
    return k.pts;
  },
  fonte: () => {
    const k = caderno();
    k.caixa([0, 0, 0], [0.62, 0.3, 0.42]);
    k.circulo([0, 0.15, 0], 0.13); k.circulo([0, 0.15, 0], 0.03);                                                                  // a ventoinha (em cima)
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; k.poli([[Math.cos(a) * 0.03, 0.15, Math.sin(a) * 0.03], [Math.cos(a + 0.5) * 0.09, 0.15, Math.sin(a + 0.5) * 0.09], [Math.cos(a + 0.75) * 0.125, 0.15, Math.sin(a + 0.75) * 0.125]]); }
    for (let i = 0; i < 7; i++) { const x = -0.26 + i * 0.03; k.linha([x, -0.08, 0.21], [x, 0.08, 0.21]); }                     // as aletas (frente)
    k.ret([0.15, 0, 0.21], 0.12, 0.08); k.ret([0.15, 0, 0.21], 0.06, 0.04);                                                       // a tomada
    k.linha([0.08, 0.06, 0.21], [0.08, 0.1, 0.21]);
    k.poli([[0.31, -0.06, 0], [0.4, -0.06, 0], [0.42, -0.12, 0.05], [0.48, -0.16, 0.06]]);                                         // o cabo
    k.cota([-0.31, -0.22, 0.21], [0.31, -0.22, 0.21], [0, 0.02, 0]);
    return k.pts;
  },
  bateria: () => {
    const k = caderno(), R = 0.13;
    for (const y of [-0.3, 0.26]) k.circulo([0, y, 0], R);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.linha([Math.cos(a) * R, -0.3, Math.sin(a) * R], [Math.cos(a) * R, 0.26, Math.sin(a) * R]); }
    k.circulo([0, 0.26, 0], 0.045); k.circulo([0, 0.32, 0], 0.045);                                                                // o polo +
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.linha([Math.cos(a) * 0.045, 0.26, Math.sin(a) * 0.045], [Math.cos(a) * 0.045, 0.32, Math.sin(a) * 0.045]); }
    for (let i = 0; i < 4; i++) { const y = -0.24 + i * 0.12; k.ret([0, y, R + 0.002], 0.14, 0.08); }                             // a carga (4 barras)
    k.linha([-0.03, 0.42, 0], [0.03, 0.42, 0]); k.linha([0, 0.39, 0], [0, 0.45, 0]);                                               // o "+"
    k.cota([0.24, -0.3, 0], [0.24, 0.32, 0], [0.02, 0, 0]);
    return k.pts;
  },
  solar: () => {
    const k = caderno(), W = 0.62, H = 0.4, inc = 0.5;
    // a placa inclinada (no plano xy girado no x)
    const p = (x: number, y: number): V => [x, Math.cos(inc) * y, -Math.sin(inc) * y];
    k.poli([p(-W / 2, -H / 2), p(W / 2, -H / 2), p(W / 2, H / 2), p(-W / 2, H / 2)], true);
    for (let i = 1; i < 6; i++) { const x = -W / 2 + (W * i) / 6; k.linha(p(x, -H / 2), p(x, H / 2)); }
    for (let j = 1; j < 4; j++) { const y = -H / 2 + (H * j) / 4; k.linha(p(-W / 2, y), p(W / 2, y)); }
    const base = -0.36;                                                                                                           // o suporte
    k.linha(p(-0.18, -H / 2), [-0.18, base, -Math.sin(inc) * -H / 2]); k.linha(p(0.18, -H / 2), [0.18, base, -Math.sin(inc) * -H / 2]);
    k.linha(p(-0.18, 0.05), [-0.18, base, 0.02]); k.linha(p(0.18, 0.05), [0.18, base, 0.02]);
    k.linha([-0.28, base, 0.15], [0.28, base, 0.15]); k.linha([-0.28, base, -0.1], [0.28, base, -0.1]);
    k.circulo([0.3, 0.38, 0], 0.06, "xy", 20);                                                                                    // o sol e os raios
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.linha([0.3 + Math.cos(a) * 0.08, 0.38 + Math.sin(a) * 0.08, 0], [0.3 + Math.cos(a) * 0.12, 0.38 + Math.sin(a) * 0.12, 0]); }
    return k.pts;
  },
};

/** o desenho de `id` como um PATH de SVG (um "M x y L x y" por segmento), visto de três-quartos (`giro` no y e
 *  `inclina` no x, rad — projeção ortográfica, como um desenho técnico isométrico), encaixado num quadro de `lado`
 *  unidades com `margem` */
export function desenhoEmSvg(id: IdEntregavel, o: { giro?: number; inclina?: number; lado?: number; margem?: number } = {}) {
  const { giro = 0.6, inclina = 0.32, lado = 100, margem = 8 } = o;
  const pts = DESENHOS[id](), cy = Math.cos(giro), sy = Math.sin(giro), cx = Math.cos(inclina), sx = Math.sin(inclina);
  const xy: number[] = [];
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i]!, y = pts[i + 1]!, z = pts[i + 2]!;
    const X = x * cy + z * sy, Z = -x * sy + z * cy;
    xy.push(X, -(y * cx - Z * sx));   // (o y do SVG desce)
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < xy.length; i += 2) { minX = Math.min(minX, xy[i]!); maxX = Math.max(maxX, xy[i]!); minY = Math.min(minY, xy[i + 1]!); maxY = Math.max(maxY, xy[i + 1]!); }
  const k = (lado - margem * 2) / Math.max(maxX - minX, maxY - minY, 1e-6);
  const ox = (lado - (maxX - minX) * k) / 2 - minX * k, oy = (lado - (maxY - minY) * k) / 2 - minY * k;
  const f = (v: number) => +v.toFixed(2);
  let d = "";
  for (let i = 0; i < xy.length; i += 4) d += `M${f(xy[i]! * k + ox)} ${f(xy[i + 1]! * k + oy)}L${f(xy[i + 2]! * k + ox)} ${f(xy[i + 3]! * k + oy)}`;
  return { d, viewBox: `0 0 ${lado} ${lado}`, segmentos: xy.length / 4 };
}
