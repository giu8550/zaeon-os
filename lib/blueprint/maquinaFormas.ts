/**
 * BLUEPRINT PRÁTICO — as FORMAS da máquina do tema, cada uma uma peça de verdade no padrão do anatomy
 * (wheresryan22/anatomy, references/craft.md §3 "Parts vocabulary" e §8 "Round parts and pipes"): muitas peças pequenas
 * e precisas, cada uma apoiada em outra — pés, parafusos, costuras, serrilhado, réguas, porcas sextavadas, peças
 * torneadas no torno (lib/anatomy/lathe) e mangueiras (lib/anatomy/tube). Nenhuma é "um bloco com rótulo".
 *
 * Cada receita desenha UM conjunto (o que sobe quando a pessoa passa o mouse — a vista explodida do anatomy), em ordem
 * de pintor (de trás pra frente, de baixo pra cima), centrado em (x, y) com a base em z (o topo do pedestal). O ESTADO
 * da peça do estudo muda o mecanismo de verdade: o relógio lê a altura do bloco, os pinos da fechadura alinham, o tanque
 * enche, a haste do pistão sai, o carro anda, a gaveta abre, a tela carrega.
 */
import * as k from "@/lib/anatomy/iso-kit";
import * as G0 from "@/lib/anatomy/lathe";
import * as T0 from "@/lib/anatomy/tube";
import type { Plan, Point3, Projection, SolidPaths, SolidStyle, LineStyle, Tone, Flat } from "@/lib/anatomy/iso-kit";
import type { EstadoPeca } from "./figura";

// lathe e tube vêm do anatomy em JS puro (copiados 1:1, sem tipos): as opções deles são inferidas dos valores padrão
const G = G0 as any, { tubePieces, tubeSvg } = T0 as any;
type LineTone = NonNullable<LineStyle["tone"]>;

export type Ctx = { P: Projection; x: number; y: number; z: number; estado: EstadoPeca };
type Pts = Array<Flat | [number, number, number]>;

const S = (paths: SolidPaths, style: SolidStyle = {}) => k.solidSvg(paths, style);
const Ln = (d: string, style: LineStyle = {}) => k.lineSvg(d, style);
const Dt = (pts: Pts, style: { size?: number; tone?: Tone; pulse?: boolean } = {}) => k.dotsSvg(pts, style);
const vert = (x: number, y: number, z: number) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const ao = (x: number, y: number, w: number, d: number, r = 1): Plan => ({ x: x - w / 2, y: y - d / 2, w, d, r });
const porProfundidade = <T,>(P: Projection, xs: T[], f: (x: T) => Point3) => [...xs].sort((a, b) => k.depthOf(f(a), P) - k.depthOf(f(b), P));
/** três "linhas de texto impresso" numa plaqueta (o único lugar onde uma linha pode parar no meio da face) */
const plaqueta = (P: Projection, p: Plan, z: number) =>
  S(k.slabOf(p, z, 0.7, P, 3), { tone: "mid" }) + Ln(k.planOutline(k.insetPlan(p, 1.1), z + 0.7, P), { tone: "faint" }) +
  [0.62, 0.4, 0.5].map((f, i) => Ln(k.lineOnTop([p.x + 2, p.y + 2.2 + i * ((p.d - 4.4) / 2)], [p.x + 2 + (p.w - 4) * f, p.y + 2.2 + i * ((p.d - 4.4) / 2)], z + 0.7, P), { tone: "lo", free: true })).join("");
/** um parafuso de cabeça redonda no topo de uma face (anel + ponto) */
const parafuso = (P: Projection, x: number, y: number, z: number, r = 1.4) => Ln(k.ring(x, y, r, z, P, 14), { tone: "lo" }) + Dt([k.iso([x, y, z], P)], { size: 0.45, tone: "mid" });
/** botão serrilhado com ponteiro (craft.md: "Knurled knob with a pointer") */
const botao = (P: Projection, x: number, y: number, z: number, r: number, h: number, ang = 0) =>
  S(k.cylinder(x, y, r, z, h, P, 32), { tone: "mid" }) + Ln(k.knurl(x, y, r, z, z + h, Math.round(r * 6), P), { tone: "lo" }) +
  Ln(k.lineOnTop([x - Math.cos(ang) * r * 0.45, y - Math.sin(ang) * r * 0.45], [x + Math.cos(ang) * r * 0.8, y + Math.sin(ang) * r * 0.8], z + h, P), { tone: "hi" }) +
  Dt([k.iso([x, y, z + h], P)], { size: 0.45, tone: "hi" });
/** quanto o estado avançou o mecanismo (0 = nada construído, 1 = provado) */
const avanco = (e: EstadoPeca) => (e === "ok" ? 1 : e === "trava" ? 0.45 : 0.1);
const tomEstado = (e: EstadoPeca): LineTone => (e === "ok" ? "green" : e === "trava" ? "red" : "faint");

// ─────────────────────────── TANQUE: vaso de pressão torneado, pernas, visor de nível, volante ───────────────────────────
export function tanque({ P, x, y, z, estado }: Ctx): string {
  const out: string[] = [], F = vert(x, y, z), R = 15.5, V = G.viewOf(P);
  // corpo: domo de baixo e de cima em elipse (nós suaves), costado reto entre as costuras
  const domo = (s0: number, s1: number, sobe: boolean) => Array.from({ length: 7 }, (_, i) => {
    const t = i / 6, s = sobe ? s0 + (s1 - s0) * t : s1 - (s1 - s0) * t, r = R * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2));
    return [s, Math.max(0.01, r), 1] as [number, number, number];
  });
  const fundo = domo(9, 19, true), tampo = domo(55, 65, false).reverse();
  const perfil = [...fundo, [19, R], [55, R], ...tampo] as [number, number, number?][];
  const pernas = porProfundidade(P, [30, 150, 270].map((a) => [x + Math.cos((a * Math.PI) / 180) * 11.5, y + Math.sin((a * Math.PI) / 180) * 11.5] as Flat), ([a, b]) => [a, b, z]);
  const perna = ([a, b]: Flat) => S(k.cylinder(a, b, 2.8, z, 1.2, P, 20), { tone: "lo" }) + S(k.cylinder(a, b, 1.5, z + 1.2, 10.6, P, 16), { tone: "mid", crease: "none" });
  const centro = k.depthOf([x, y, z], P);
  pernas.filter(([a, b]) => k.depthOf([a, b, z], P) <= centro).forEach((p) => out.push(perna(p)));
  out.push(`<path class="iso-halo" d="${k.haloOf(ao(x, y, 30, 30, 15), z + 0.2, 0.1, P)}" style="filter:blur(4px)"/>`);
  const costuras = [19, 37, 55].map((s) => Ln(G.arcOf(F, s, R, P), { tone: "faint" })).join("");
  out.push(S(G.solidOf(perfil, F, P), { tone: "hi", inner: costuras }));
  // visor de nível: dois ressaltos no costado virado pra quem olha e o tubo de vidro entre eles, com o líquido
  const a = G.angleToward(F, V);
  for (const s of [24, 50]) out.push(S(G.disc(0, 2.6, 2.4, G.frameAlong(G.pointOf(F, s, R - 0.4, a), G.radialOf(F, a)), P), { tone: "mid" }));
  const [gx, gy] = G.pointOf(F, 0, R + 1.6, a);
  out.push(S(k.cylinder(gx, gy, 1.15, z + 26.4, 21.2, P, 14), { tone: "hi", crease: "none" }));
  out.push(Ln(k.segment([gx, gy, z + 26.8], [gx, gy, z + 26.8 + 20.4 * avanco(estado)], P), { tone: tomEstado(estado), className: "mq-fluido" }));
  pernas.filter(([a, b]) => k.depthOf([a, b, z], P) > centro).forEach((p) => out.push(perna(p)));
  // bocal de cima com flange aparafusada, haste e volante da válvula
  out.push(S(G.solidOf([[64.4, 4.4], [70, 4.4], [70, 7.6], [72, 7.6]], F, P), { tone: "mid" }));
  out.push(Dt(G.dotsOf(F, 72, 6.1, 6, P, { all: true }), { size: 0.42, tone: "mid" }));
  out.push(S(k.cylinder(x, y, 1.3, z + 72, 6, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(G.ringBand(78, 79.6, 5.4, 7, F, P), { tone: "mid" }));
  out.push(Ln([0, 1, 2, 3].map((i) => k.lineOnTop([x + Math.cos(i * Math.PI / 2 + 0.4) * 1.9, y + Math.sin(i * Math.PI / 2 + 0.4) * 1.9], [x + Math.cos(i * Math.PI / 2 + 0.4) * 5.4, y + Math.sin(i * Math.PI / 2 + 0.4) * 5.4], 79.6 + z, P)).join(""), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 1.9, z + 78, 2.2, P, 16), { tone: "hi" }));
  // manômetro no domo de cima, de lado
  const am = a - 0.9, base = G.pointOf(F, 60, R * 0.72, am), Fm = G.frameAlong(base, G.unit3([Math.cos(am + 0) * 0.9, Math.sin(am) * 0.9, 0.45]));
  out.push(S(G.disc(0, 3.2, 1.3, Fm, P), { tone: "mid" }));
  out.push(S(G.disc(3.2, 5.4, 4.2, Fm, P), { tone: "hi" }));
  out.push(Ln(G.circleOf(Fm, 5.4, 3.4, P, 28), { tone: "lo" }));
  return out.join("");
}

// ─────────────────────── PISTÃO: cilindro hidráulico de tirantes, haste saindo da bucha, garfo, mangueira ───────────────────────
export function pistao({ P, x, y, z, estado }: Ctx): string {
  const out: string[] = [], pe = ao(x, y, 34, 26, 2), tampa = ao(x, y, 22, 22, 2);
  out.push(`<path class="iso-halo" d="${k.haloOf(pe, z, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.slabOf(pe, z, 4, P, 4, 0.6), { tone: "lo" }));
  for (const [a, b] of k.corners(pe, 3.4)) out.push(parafuso(P, a, b, z + 4, 1.3));
  out.push(S(k.slabOf(tampa, z + 4, 7, P, 4, 0.8), { tone: "mid", inner: Ln(k.sideSeam(tampa, z + 7.5, P, 4), { tone: "faint" }) }));
  const tirantes = porProfundidade(P, k.corners(tampa, 2.8), ([a, b]) => [a, b, z]);
  const tirante = ([a, b]: Flat) => S(k.cylinder(a, b, 1.05, z + 11, 30, P, 12), { tone: "mid", crease: "none" });
  tirantes.slice(0, 2).forEach((t) => out.push(tirante(t)));
  out.push(S(k.cylinder(x, y, 8.6, z + 11, 30, P, 48), { tone: "hi", inner: [14, 38].map((h) => Ln(k.sideArc(x, y, 8.6, z + h, P, 32), { tone: "faint" })).join("") }));
  tirantes.slice(2).forEach((t) => out.push(tirante(t)));
  out.push(S(k.slabOf(tampa, z + 41, 7, P, 4, 0.8), { tone: "mid", inner: Ln(k.sideSeam(tampa, z + 44.5, P, 4), { tone: "faint" }) }));
  for (const [a, b] of tirantes) out.push(S(k.cylinder(a, b, 1.9, z + 48, 1.6, P, 6), { tone: "mid" }));   // porcas sextavadas
  // bucha e a HASTE: sai mais quanto mais a peça avançou
  out.push(S(k.cylinder(x, y, 5.2, z + 48, 3, P, 28), { tone: "mid" }));
  out.push(Ln(k.ring(x, y, 3.5, z + 51, P, 20), { tone: "faint" }));
  const curso = 5 + 17 * avanco(estado), topo = z + 51 + curso;
  out.push(S(k.cylinder(x, y, 3, z + 51, curso, P, 24), { tone: "hi", crease: "none" }));
  // garfo (clevis) com o pino atravessado
  const garfo = ao(x, y, 9, 7, 1.2);
  out.push(S(k.slabOf(garfo, topo, 8, P, 3, 0.5), { tone: "mid" }));
  out.push(S(G.disc(-4.4, 4.4, 1.5, G.frameAlong([x, y, topo + 5], [0, 1, 0]), P), { tone: "hi" }));
  // as duas tomadas de óleo na face +x das tampas e a mangueira que liga uma na outra
  const porta = (zp: number) => S(G.disc(0, 2.4, 2.3, G.frameAlong([x + 11, y, zp], [1, 0, 0]), P), { tone: "mid" }) + S(G.disc(2.4, 3.8, 1.9, G.frameAlong([x + 11, y, zp], [1, 0, 0]), P, { steps: 6 }), { tone: "mid" });
  out.push(porta(z + 7.5), porta(z + 44.5));
  const rota = G.fillet([[x + 14.8, y, z + 7.5], [x + 21, y, z + 7.5], [x + 21, y, z + 44.5], [x + 14.8, y, z + 44.5]], 4, 9, { P, tube: 1.3 });
  for (const peca of tubePieces(rota, 1.3, P, { maxLength: 14 })) out.push(tubeSvg(peca, { tone: "mid" }));
  return out.join("");
}

// ───────────────── MOSTRADOR: relógio comparador (o exemplo dial-indicator do anatomy, encolhido pra estação) ─────────────────
export function mostrador({ P, x, y, z, estado }: Ctx): string {
  const out: string[] = [];
  const MAG = { x: x - 27, y: y - 23, w: 18, d: 18, r: 2 }, POSTE: Flat = [x - 18, y - 14], DIAL: Flat = [x + 12, y - 14], R = 11.5;
  const DIAL_Z = z + 36, TOPO = DIAL_Z + 6, CLAMP_Z = z + 48, POSTE_TOPO = z + 60;
  // base magnética de dois degraus, com o botão de liga/desliga
  out.push(S(k.slabOf(MAG, z, 7, P, 5, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(MAG, 0.7), z + 7, 6, P, 5, 0.6), { tone: "mid" }));
  out.push(Ln(k.planOutline(k.insetPlan(MAG, 2.6), z + 13, P), { tone: "faint" }));
  out.push(botao(P, MAG.x + 13, MAG.y + 13, z + 13, 3.4, 2.6, 0));
  out.push(S(k.cylinder(POSTE[0], POSTE[1], 3, z + 13, 2.4, P, 24), { tone: "mid" }));
  // o conjunto de BLOCOS-PADRÃO sobre o carrinho, debaixo do apalpador
  const car = ao(DIAL[0] + 2, DIAL[1] + 10, 30, 22, 2);
  out.push(S(k.slabOf(car, z, 3, P, 4, 0.5), { tone: "mid" }));
  const alturas = [12, 9, 6];
  alturas.forEach((h, i) => {
    const b = { x: car.x + 3 + i * 8.6, y: car.y + 3, w: 7.6, d: 16, r: 0.8 };
    out.push(S(k.slabOf(b, z + 3, h, P, 3, 0.4), { tone: "hi", crease: "lo" }));
    out.push(Ln(k.planOutline(k.insetPlan(b, 1.4), z + 3 + h, P, 3), { tone: "faint" }));
  });
  // o poste com costuras, a braçadeira com o parafuso de aperto e o braço até o relógio
  out.push(S(k.cylinder(POSTE[0], POSTE[1], 1.9, z + 15.4, CLAMP_Z - z - 15.4, P, 20), { tone: "mid", crease: "none", inner: [28, 40].map((h) => Ln(k.sideArc(POSTE[0], POSTE[1], 1.9, z + h, P, 12), { tone: "faint" })).join("") }));
  const clamp = ao(POSTE[0], POSTE[1], 8.6, 8.6, 1.6);
  out.push(S(k.slabOf(clamp, CLAMP_Z - 2.4, 7.2, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(POSTE[0], POSTE[1], 1.9, CLAMP_Z + 4.8, POSTE_TOPO - CLAMP_Z - 4.8, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(POSTE[0], POSTE[1], 2.4, POSTE_TOPO, 1.3, P, 20), { tone: "mid" }));
  const ts: Flat = [clamp.x + 4.3, clamp.y + clamp.d + 2];
  out.push(S(k.slabOf({ x: ts[0] - 0.9, y: clamp.y + clamp.d, w: 1.8, d: 1.8, r: 0.5 }, CLAMP_Z - 1.6, 2.6, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(ts[0], ts[1] + 0.9, 1.7, CLAMP_Z - 2.4, 4, P, 18), { tone: "mid" }));
  out.push(Ln(k.knurl(ts[0], ts[1] + 0.9, 1.7, CLAMP_Z - 2.4, CLAMP_Z + 1.6, 12, P), { tone: "lo" }));
  const braco = { x: POSTE[0] + 4.3, y: POSTE[1] - 1.8, w: DIAL[0] - R - POSTE[0] - 4.3 + 1.2, d: 3.6, r: 1.2 };
  out.push(S(k.slabOf(braco, CLAMP_Z, 2.4, P, 3, 0.4), { tone: "mid" }));
  out.push(Dt([k.iso([braco.x + 2.4, POSTE[1], CLAMP_Z + 2.4], P), k.iso([braco.x + braco.w - 3, POSTE[1], CLAMP_Z + 2.4], P)], { size: 0.42 }));
  // o apalpador (lit: é o que mexe) desce até o bloco do estado
  const lido = alturas[estado === "ok" ? 0 : estado === "trava" ? 1 : 2]!;
  out.push(S(k.cylinder(DIAL[0], DIAL[1], 1.6, z + 3 + lido, 1.4, P, 16), { tone: "hi" }));
  out.push(S(k.cylinder(DIAL[0], DIAL[1], 0.8, z + 4.4 + lido, DIAL_Z - 8 - z - 4.4 - lido, P, 12), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(DIAL[0], DIAL[1], 1.8, DIAL_Z - 8, 8, P, 16), { tone: "mid" }));
  out.push(Ln(k.sideArc(DIAL[0], DIAL[1], 1.8, DIAL_Z - 4, P, 10), { tone: "lo" }));
  // o relógio: corpo, aro serrilhado, anel, graduação, coroa, cubo e ponteiro
  out.push(S(k.slabOf({ x: DIAL[0] - R - 3.6, y: DIAL[1] - 2.2, w: 4.6, d: 4.4, r: 1 }, DIAL_Z + 1, CLAMP_Z - DIAL_Z - 1, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(DIAL[0], DIAL[1], R, DIAL_Z, 6, P, 64, 0.6), { tone: "hi", crease: "lo" }));
  out.push(Ln(k.knurl(DIAL[0], DIAL[1], R, TOPO - 2.2, TOPO, 64, P, 0.3), { tone: "lo" }));
  out.push(Ln(k.sideArc(DIAL[0], DIAL[1], R, TOPO - 2.2, P, 40), { tone: "faint" }));
  out.push(Ln(k.ring(DIAL[0], DIAL[1], R - 1.4, TOPO, P, 64), { tone: "lo" }));
  const t = k.radialTicks(DIAL[0], DIAL[1], R - 2, 50, 5, TOPO, [0.8, 1.7], P);
  out.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "mid" }));
  out.push(S(k.slabOf({ x: DIAL[0] + R - 0.6, y: DIAL[1] - 1.5, w: 3, d: 3, r: 0.8 }, DIAL_Z + 1.4, 3, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: DIAL[0] + R + 2.2, y: DIAL[1] - 2, w: 1.6, d: 4, r: 0.7 }, DIAL_Z + 0.9, 4, P, 3), { tone: "mid" }));
  const volta = (lido - 6) / 8, ang = volta * Math.PI * 2;
  out.push(`<path class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1" d="${k.lineOnTop([DIAL[0] - Math.sin(ang) * 2.2, DIAL[1] + Math.cos(ang) * 2.2], [DIAL[0] + Math.sin(ang) * (R - 3), DIAL[1] - Math.cos(ang) * (R - 3)], TOPO + 0.2, P)}"/>`);
  out.push(Ln(k.ring(DIAL[0], DIAL[1], 1, TOPO, P, 14), { tone: "mid" }));
  return out.join("");
}

// ───────────────── GAVETEIRO: arquivo com rodapé, tampo, quatro gavetas com puxador e porta-etiqueta ─────────────────
export function gaveteiro({ P, x, y, z, estado }: Ctx): string {
  const out: string[] = [], caixa = ao(x, y, 40, 30, 2), frente = caixa.y + caixa.d, H = 44, N = 4, GH = (H - 4) / N;
  out.push(`<path class="iso-halo" d="${k.haloOf(caixa, z, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.slabOf(k.insetPlan(caixa, 1.6), z, 3, P, 4, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(caixa, z + 3, H, P, 4, 0.8), { tone: "mid", inner: Ln(k.sideSeam(caixa, z + 3.8, P, 4), { tone: "faint" }) }));
  // as aletas de ventilação na lateral +x (fendas fechadas, na face)
  const lateral = k.sideMatrix([caixa.x + caixa.w, caixa.y + caixa.d], z + 3 + H - 6, P, "right");
  out.push(`<g transform="${lateral}">${Ln(Array.from({ length: 6 }, (_, i) => `M ${6 + i * 3.4} 0 h 1.4 v 10 h -1.4 Z`).join(" "), { tone: "lo" })}</g>`);
  const tampo = k.insetPlan(caixa, -1.4);
  out.push(S(k.slabOf(tampo, z + 3 + H, 2.4, P, 4, 0.6), { tone: "mid" }));
  out.push(plaqueta(P, ao(x - 6, y - 2, 18, 9, 1), z + 5.4 + H));
  for (const [a, b] of k.corners(tampo, 2.6)) out.push(Dt([k.iso([a, b, z + 5.4 + H], P)], { size: 0.42, tone: "mid" }));
  // as gavetas, de cima pra baixo; a do estado sai do arquivo e mostra o que tem dentro
  const aberta = estado === "ok" ? 1 : estado === "trava" ? 2 : -1, saida = 12;
  for (let g = 0; g < N; g++) {
    const zg = z + 3 + H - (g + 1) * GH, dy = g === aberta ? saida : 0, fy = frente + dy;
    const f = { x: caixa.x + 2, y: fy, w: caixa.w - 4, d: 1.6, r: 0.5 };
    if (dy) {   // a caixa da gaveta: fundo, laterais e o conteúdo (fichas em pé)
      const fundo = { x: caixa.x + 3, y: frente - 1, w: caixa.w - 6, d: dy + 1, r: 0.3 };
      out.push(S(k.slabOf({ ...fundo, w: 0.9 }, zg + 1, GH - 3, P, 2), { tone: "mid", crease: "none" }));
      out.push(S(k.slabOf(fundo, zg + 1, 0.8, P, 2), { tone: "lo", flat: true }));
      for (let c = 0; c < 4; c++) out.push(S(k.slabOf({ x: fundo.x + 4 + c * 7.6, y: frente + 1 + c * 0.4, w: 5.4, d: 0.6, r: 0.1 }, zg + 1.8, GH - 5 - (c % 2) * 1.6, P, 2), { tone: c === 1 ? "hi" : "mid", crease: "none" }));
      out.push(S(k.slabOf({ ...fundo, x: fundo.x + fundo.w - 0.9, w: 0.9 }, zg + 1, GH - 3, P, 2), { tone: "mid", crease: "none" }));
    }
    out.push(S(k.slabOf(f, zg + 0.4, GH - 0.8, P, 3, 0.4), { tone: "hi" }));
    // porta-etiqueta (moldura na face com o cartão) e o puxador: dois postes e a barra
    out.push(`<g transform="${k.sideMatrix([f.x, fy + 1.6], zg + GH - 1.6, P, "left")}">${Ln(`M ${f.w / 2 - 6} 0.8 h 12 v 3.4 h -12 Z`, { tone: "lo" })}${Ln(`M ${f.w / 2 - 4.4} 2.5 h 7`, { tone: "faint", free: true })}</g>`);
    for (const px of [x - 6, x + 4.6]) out.push(S(k.slabOf({ x: px, y: fy + 1.6, w: 1.4, d: 1.6, r: 0.3 }, zg + GH / 2 - 2.6, 1.6, P, 2), { tone: "mid", crease: "none" }));
    out.push(S(k.slabOf({ x: x - 6.4, y: fy + 3.2, w: 12.8, d: 1.2, r: 0.5 }, zg + GH / 2 - 2.8, 2, P, 3), { tone: "hi" }));
    out.push(Dt([k.iso([f.x + 1.6, fy + 1.6, zg + GH - 1.6], P), k.iso([f.x + f.w - 1.6, fy + 1.6, zg + GH - 1.6], P)], { size: 0.4, tone: "mid" }));
  }
  return out.join("");
}

// ───────────────── FECHADURA: cilindro de pinos (pin tumbler) com tambor torneado, chave e os pinos por cima ─────────────────
export function fechadura({ P, x, y, z, estado }: Ctx): string {
  const out: string[] = [], base = ao(x, y, 46, 30, 2), corpo = ao(x - 3, y, 36, 22, 2.4), zc = z + 2 + 11;
  out.push(`<path class="iso-halo" d="${k.haloOf(base, z, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.slabOf(base, z, 2, P, 4, 0.4), { tone: "lo" }));
  for (const [a, b] of k.corners(base, 3)) out.push(parafuso(P, a, b, z + 2, 1.2));
  out.push(S(k.slabOf(corpo, z + 2, 20, P, 5, 0.8), { tone: "mid", inner: Ln(k.sideSeam(corpo, z + 9, P, 5), { tone: "faint" }) }));
  // a barra dos pinos em cima, com os furos e os pinos de segredo (alinhados na linha de corte quando a peça está provada)
  const barra = { x: corpo.x + 3, y: y - 4, w: corpo.w - 8, d: 8, r: 1.2 };
  out.push(S(k.slabOf(barra, z + 22, 4, P, 4, 0.5), { tone: "mid" }));
  const alturas = estado === "ok" ? [3, 3, 3, 3, 3] : estado === "trava" ? [3, 6.4, 3, 8, 4.6] : [7, 5, 8.6, 6, 7.4];
  alturas.forEach((h, i) => {
    const px = barra.x + 3.6 + i * 5.6;
    out.push(Ln(k.ring(px, y, 2, z + 26, P, 18), { tone: "lo" }));
    out.push(S(k.cylinder(px, y, 1.45, z + 26, h, P, 16), { tone: estado === "ok" ? "hi" : "mid" }));
    out.push(S(k.cylinder(px, y, 1.7, z + 26 + h, 0.8, P, 16), { tone: "mid" }));
  });
  // o tambor torneado saindo da face +x, com a fenda da chave e a chave enfiada (o aro da chave em pé)
  const Fx = G.frameOf([corpo.x + corpo.w, y, zc], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  out.push(S(G.solidOf([[0, 8.6], [1.8, 8.6], [1.8, 6.6], [4.6, 6.6]], Fx, P), { tone: "hi", inner: Ln(G.arcOf(Fx, 1.8, 8.6, P), { tone: "faint" }) }));
  const face = k.sideMatrix([corpo.x + corpo.w + 4.6, y + 6.6], zc + 6.6, P, "right");
  out.push(`<g transform="${face}">${Ln(`M 5.9 2.2 h 1.4 v 6 l 1.2 1.4 v 2.4 h -2.6 Z`, { tone: "lo" })}</g>`);
  const giro = estado === "ok" ? Math.PI / 2 : 0, chave = G.frameOf([corpo.x + corpo.w + 4.6, y, zc], [1, 0, 0], [0, Math.cos(giro), Math.sin(giro)], [0, -Math.sin(giro), Math.cos(giro)]);
  out.push(S(G.disc(0, 5, 0.9, chave, P, { steps: 6 }), { tone: "hi" }));
  // o aro fica no plano da lâmina (que gira com a chave): a normal dele é perpendicular ao eixo e à lâmina
  out.push(S(G.ringBand(-0.8, 0.8, 2, 4.8, G.frameAlong(G.pointOf(chave, 9.6, 0, 0), [0, Math.cos(giro), Math.sin(giro)]), P), { tone: "hi" }));
  return out.join("");
}

// ───────────────── CARRO: trilhos com batentes, carro com buchas, blocos-padrão e a manopla serrilhada ─────────────────
export function carro({ P, x, y, z, estado }: Ctx): string {
  const out: string[] = [], de = x - 27, ate = x + 27;
  for (const ry of [y - 11, y + 7]) {
    out.push(S(k.slabOf({ x: de, y: ry, w: ate - de, d: 4, r: 1 }, z, 3, P, 3, 0.4), { tone: "mid" }));
    out.push(Dt([de + 4, ate - 4].map((rx) => k.iso([rx, ry + 2, z + 3], P)), { size: 0.4 }));
  }
  for (const bx of [de - 4, ate]) {
    out.push(S(k.slabOf({ x: bx, y: y - 14, w: 4, d: 28, r: 1.2 }, z, 7, P, 3, 0.5), { tone: "mid" }));
    out.push(Dt([k.iso([bx + 2, y - 10, z + 7], P), k.iso([bx + 2, y + 10, z + 7], P)], { size: 0.42 }));
  }
  // a régua presa no trilho da frente
  const regua = { x: de + 2, y: y + 11, w: ate - de - 4, d: 3.4, r: 0.6 };
  out.push(S(k.slabOf(regua, z, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const tk = k.topTicks(regua.x + 2, regua.x + regua.w - 2, 2.5, 4, regua.y + 0.4, 0.6, [1, 2], P);
  out.push(Ln(tk.minor, { tone: "lo" }), Ln(tk.major, { tone: "mid" }));
  // o carro anda conforme a peça avança
  const cx = de + 15 + (ate - de - 30) * avanco(estado), car = { x: cx - 13, y: y - 13, w: 26, d: 24, r: 2 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(car, 2), z + 3, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.slabOf(car, z + 3, 4, P, 4, 0.6), { tone: "mid" }));
  for (const [bx, by] of porProfundidade(P, k.corners(car, 3.2), ([a, b]) => [a, b, z])) {
    out.push(S(k.slabOf(ao(bx, by, 4.4, 4, 0.8), z + 7, 2.4, P, 3, 0.3), { tone: "mid" }));
    out.push(Dt([k.iso([bx, by, z + 9.4], P)], { size: 0.4, tone: "mid" }));
  }
  out.push(Dt([-8, -2.6, 2.6, 8].map((dx) => k.iso([cx + dx, car.y + car.d - 1.6, z + 7], P)), { size: 0.38, tone: "lo" }));
  [11, 8, 5].forEach((h, i) => {
    const b = { x: car.x + 4 + i * 6.4, y: car.y + 6, w: 5.6, d: 12, r: 0.6 };
    out.push(S(k.slabOf(b, z + 7, h, P, 3, 0.4), { tone: "hi", crease: "lo" }));
    out.push(Ln(k.planOutline(k.insetPlan(b, 1.2), z + 7 + h, P, 3), { tone: "faint" }));
  });
  const mp: Flat = [car.x + car.w - 5, car.y + car.d + 2.4];
  out.push(S(k.slabOf({ x: mp[0] - 1.3, y: car.y + car.d - 0.6, w: 2.6, d: 3, r: 0.6 }, z + 4, 2.4, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(mp[0], mp[1] + 0.8, 2.2, z + 3, 4.6, P, 18), { tone: "mid" }));
  out.push(Ln(k.knurl(mp[0], mp[1] + 0.8, 2.2, z + 3, z + 7.6, 14, P), { tone: "lo" }));
  return out.join("");
}

// ───────────────── GIRATÓRIA: mesa giratória com graus, rolamento, a peça torneada em cima e o índice ─────────────────
export function giratoria({ P, x, y, z, estado }: Ctx): string {
  const out: string[] = [], F = vert(x, y, z), ang = -Math.PI / 2 + Math.PI * 1.5 * avanco(estado);
  out.push(`<path class="iso-halo" d="${k.haloOf(ao(x, y, 46, 46, 23), z, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.cylinder(x, y, 21, z, 7, P, 72, 0.6), { tone: "mid", inner: Ln(k.sideArc(x, y, 21, z + 2.4, P, 48), { tone: "faint" }) }));
  // o botão de acionamento, numa orelha na lateral
  const [ox, oy] = [x + 24, y + 8];
  out.push(S(k.slabOf({ x: x + 18, y: oy - 3, w: 7, d: 6, r: 1.2 }, z, 5, P, 3, 0.4), { tone: "mid" }));
  out.push(botao(P, ox, oy, z + 5, 2.8, 3.4, ang));
  out.push(S(k.cylinder(x, y, 18, z + 7, 1.4, P, 64), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 23.5, z + 8.4, 3.4, P, 96, 0.8), { tone: "hi", crease: "lo" }));
  const t = k.radialTicks(x, y, 22.6, 72, 6, z + 11.8, [1.1, 2.4], P);
  out.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "mid" }));
  out.push(Ln(k.ring(x, y, 19.4, z + 11.8, P, 72), { tone: "faint" }));
  // a marca na mesa (gira com a peça) e o índice fixo no corpo, apontando pra graduação
  out.push(`<path class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1" d="${k.lineOnTop([x + Math.cos(ang) * 8, y + Math.sin(ang) * 8], [x + Math.cos(ang) * 19, y + Math.sin(ang) * 19], z + 11.8, P)}"/>`);
  // a peça na mesa: um vaso torneado (perfil suave), o assunto que gira
  const Fv = vert(x + Math.cos(ang + 2.4) * 7, y + Math.sin(ang + 2.4) * 7, z + 11.8);
  out.push(S(G.solidOf([[0, 4.2], [0.8, 4.6, 1], [3, 5.8, 1], [7, 5, 1], [11, 3, 1], [13.6, 2.6, 1], [15, 3.4, 1], [16, 3.6]], Fv, P), { tone: "hi" }));
  out.push(S(k.cylinder(x, y, 2.4, z + 11.8, 1.6, P, 18), { tone: "mid" }));
  const idx = { x: x - 1.6, y: y + 19.6, w: 3.2, d: 6.4, r: 0.8 };
  out.push(S(k.slabOf(idx, z + 7, 6.6, P, 3, 0.3), { tone: "mid" }));
  out.push(Ln(k.lineOnTop([x, y + 21], [x, y + 23.4], z + 13.6, P), { tone: "hi" }));
  return out.join("");
}

// ───────────────── LÂMPADA: lâmpada de estúdio — base com contrapeso, haste com colar, rótula e a cúpula torneada ─────────────────
export function lampada({ P, x, y, z, estado }: Ctx): string {
  const out: string[] = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(ao(x, y, 28, 28, 14), z, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.cylinder(x, y, 14, z, 2.6, P, 48, 0.4), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 12, z + 2.6, 3, P, 48, 0.6), { tone: "mid" }));
  // o interruptor de alavanca na base
  out.push(S(k.slabOf(ao(x + 7, y + 4, 5, 3.4, 0.8), z + 5.6, 1.6, P, 3), { tone: "mid" }));
  out.push(Ln(k.segment([x + 7, y + 4, z + 7.2], [x + 8.6, y + 4, z + 9.6], P), { tone: "hi" }));
  out.push(S(k.cylinder(x, y, 1.9, z + 5.6, 36, P, 18), { tone: "mid", crease: "none", inner: [12, 30].map((h) => Ln(k.sideArc(x, y, 1.9, z + h, P, 12), { tone: "faint" })).join("") }));
  out.push(S(k.cylinder(x, y, 3, z + 20, 3.4, P, 24), { tone: "mid" }));
  out.push(S(G.disc(0, 3, 1.1, G.frameAlong([x + 3, y, z + 21.7], [1, 0, 0]), P), { tone: "mid" }));
  out.push(S(G.disc(3, 4.6, 1.8, G.frameAlong([x + 3, y, z + 21.7], [1, 0, 0]), P), { tone: "mid" }));
  // a rótula e a cúpula apontada pra frente e pra baixo (pra estação)
  const bola: Point3 = [x, y, z + 44];
  out.push(S(G.sphereOf(bola, 3.4, P), { tone: "mid" }));
  const eixo = G.unit3([0.62, 0.48, -0.62]), F = G.frameAlong(bola, eixo), s0 = Math.sqrt(3.4 ** 2 - 1.6 ** 2);
  out.push(S(G.disc(s0, 6, 1.6, F, P), { tone: "mid" }));
  const cupula: [number, number, number?][] = [[6, 3.2], [7.4, 4.8, 1], [10, 7.6, 1], [13.6, 10, 1], [17, 11.2, 1], [18.4, 11.4]];
  const nervuras = G.ribsOf(F, 7.6, 9.4, 5.6, 14, P, { fade: [0.1, 0.55] });
  out.push(S(G.solidOf(cupula, F, P), { tone: "hi", inner: Ln(G.arcOf(F, 13.6, 10, P, { slope: 0.55 }), { tone: "faint" }) }) + k.fadedSvg(nervuras, { tone: "lo" }));
  // a lente na boca: acende quando a peça está provada
  out.push(S(G.disc(18.4, 18.9, 10.4, F, P), { tone: "mid", className: `mq-lente mq-lente-${estado}` }));
  out.push(Ln(G.circleOf(F, 18.9, 8.4, P, 40), { tone: "faint" }));
  return out.join("");
}

// ───────────────── PAINEL: computador de mesa — pé, pescoço, gabinete com tela embutida (no plano da face) e teclado ─────────────────
export function painel({ P, x, y, z, estado }: Ctx): string {
  const out: string[] = [], gab = { x: x - 21, y: y - 12, w: 42, d: 9, r: 2 }, zg = z + 13, HG = 30;
  out.push(`<path class="iso-halo" d="${k.haloOf(ao(x, y - 6, 26, 16, 3), z, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.slabOf(ao(x, y - 7.5, 24, 14, 3), z, 2.2, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf(ao(x, y - 9, 6, 4, 1), z + 2.2, zg - z - 2.2, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf(gab, zg, HG, P, 4, 0.8), { tone: "mid", inner: Ln(k.sideSeam(gab, zg + HG - 2.4, P, 4), { tone: "faint" }) }));
  // a TELA no plano da face da frente (y = gab.y + gab.d): moldura, vidro, linhas de varredura e o que ela mostra
  const fy = gab.y + gab.d, W = gab.w, prog = avanco(estado);
  const tela = `M 3.4 3.4 h ${W - 6.8} v 19 h ${-(W - 6.8)} Z`;
  const varredura = Array.from({ length: 11 }, (_, i) => `M 3.6 ${4.8 + i * 1.6} h ${W - 7.2}`).join(" ");
  const cor = estado === "ok" ? "green" : estado === "trava" ? "red" : "mid";
  out.push(`<g transform="${k.sideMatrix([gab.x, fy], zg + HG, P, "left")}">` +
    `<path class="mq-tela" d="${tela}"/>` + Ln(tela, { tone: "lo" }) + Ln(varredura, { tone: "faint", className: "mq-varredura" }) +
    Ln(`M 6 7 h ${W * 0.42} M 6 9.6 h ${W * 0.3} M 6 12.2 h ${W * 0.36}`, { tone: "mid", free: true }) +
    Ln(`M 6 17 h ${W - 12} v 2.4 h ${-(W - 12)} Z`, { tone: "lo" }) +
    `<path class="iso-line" data-tone="${cor}" style="stroke-width:2" d="M 6.6 18.2 h ${Math.max(0.4, (W - 13.2) * prog)}"/>` +
    Ln(`M ${W - 5.4} 26.6 h 2`, { tone: "lo", free: true }) + `<circle class="mq-led mq-led-${estado}" cx="6" cy="26.6" r="0.9"/>` + Dt([[9, 26.6]], { size: 0.45, tone: "lo" }) +
    `</g>`);
  // o teclado: tampa com as teclas em fileiras (sólidos de verdade) e a barra de espaço
  const tec = { x: x - 19, y: y + 2, w: 38, d: 13, r: 1.6 };
  out.push(S(k.slabOf(tec, z, 2.4, P, 4, 0.5), { tone: "mid" }));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 11; c++) out.push(S(k.slabOf({ x: tec.x + 1.6 + c * 3.2 + (r % 2) * 0.8, y: tec.y + 1.4 + r * 3.1, w: 2.5, d: 2.4, r: 0.4 }, z + 2.4, 0.8, P, 2), { tone: "hi", crease: "none" }));
  out.push(S(k.slabOf({ x: tec.x + 9, y: tec.y + 10.6, w: 18, d: 1.8, r: 0.4 }, z + 2.4, 0.8, P, 2), { tone: "hi", crease: "none" }));
  return out.join("");
}

// ───────────────── ENGRENAGENS: caixa com duas rodas dentadas engrenadas nos eixos, furos de alívio e a manivela ─────────────────
function roda(cx: number, cy: number, r: number, dentes: number, fase = 0): [number, number][] {
  const pts: [number, number][] = [], passo = (Math.PI * 2) / dentes;
  for (let i = 0; i < dentes; i++) {
    const a = fase + i * passo;
    for (const [da, rr] of [[0, r - 1.6], [0.18, r + 1.1], [0.5, r + 1.1], [0.68, r - 1.6]] as const) pts.push([cx + Math.cos(a + da * passo) * rr, cy + Math.sin(a + da * passo) * rr]);
  }
  return pts;
}
export function engrenagens({ P, x, y, z, estado }: Ctx): string {
  const out: string[] = [], placa = ao(x, y, 52, 46, 2.4);
  out.push(`<path class="iso-halo" d="${k.haloOf(placa, z, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.slabOf(placa, z, 3, P, 5, 0.6), { tone: "mid" }));
  out.push(Ln(k.planOutline(k.insetPlan(placa, 3), z + 3, P), { tone: "faint" }));
  for (const [a, b] of k.corners(placa, 4)) out.push(parafuso(P, a, b, z + 3, 1.2));
  const giro = avanco(estado) * 0.9;
  const A = { cx: x - 8, cy: y - 7, r: 14.5, n: 22 }, d = 14.5 + 8.5 + 0.6, u = G.unit3([1, 0.82, 0]);
  const B = { cx: A.cx + u[0] * d, cy: A.cy + u[1] * d, r: 8.5, n: 13 };
  const desenha = (g: typeof A, tom: Tone, fase: number, manivela: boolean) => {
    const zt = z + 10, h = 4;
    out.push(S(k.cylinder(g.cx, g.cy, 3.4, z + 3, 7, P, 24), { tone: "mid" }));   // o mancal
    out.push(S(k.extrude(roda(g.cx, g.cy, g.r, g.n, fase), zt, h, P, { convex: false }), { tone: tom }));
    out.push(Ln(k.ring(g.cx, g.cy, g.r - 3.4, zt + h, P, 48), { tone: "faint" }));
    if (g.r > 10) for (let i = 0; i < 5; i++) { const a = fase + (i * Math.PI * 2) / 5; out.push(Ln(k.ring(g.cx + Math.cos(a) * 7.4, g.cy + Math.sin(a) * 7.4, 2.2, zt + h, P, 18), { tone: "lo" })); }
    out.push(S(k.cylinder(g.cx, g.cy, 3, zt + h, 1.6, P, 24), { tone: "mid" }));
    out.push(S(k.cylinder(g.cx, g.cy, 1.6, zt + h + 1.6, 1.4, P, 6), { tone: "hi" }));
    if (manivela) {
      const a = fase + 0.6, mx = g.cx + Math.cos(a) * 10.5, my = g.cy + Math.sin(a) * 10.5, zm = zt + h + 3;
      const braco = k.extrude([[g.cx + Math.cos(a + 1.57) * 1.8, g.cy + Math.sin(a + 1.57) * 1.8], [mx + Math.cos(a + 1.57) * 1.8, my + Math.sin(a + 1.57) * 1.8], [mx - Math.cos(a + 1.57) * 1.8, my - Math.sin(a + 1.57) * 1.8], [g.cx - Math.cos(a + 1.57) * 1.8, g.cy - Math.sin(a + 1.57) * 1.8]], zm, 1.6, P);
      out.push(S(braco, { tone: "mid" }));
      out.push(S(k.cylinder(mx, my, 1.9, zm + 1.6, 7, P, 18), { tone: "hi" }));
      out.push(Ln(k.knurl(mx, my, 1.9, zm + 2.4, zm + 8, 12, P), { tone: "lo" }));
    }
  };
  // a roda de trás primeiro (a de profundidade menor)
  const ordem = porProfundidade(P, [A, B], (g) => [g.cx, g.cy, z]);
  for (const g of ordem) desenha(g, g === A ? "hi" : "mid", g === A ? giro : -giro * (A.n / B.n) + Math.PI / B.n, g === A);
  return out.join("");
}

// ───────────────── FUNIL: tremonha torneada no cavalete, aba aparafusada, válvula de saída com atuador, bandeja ─────────────────
export function funil({ P, x, y, z, estado }: Ctx): string {
  const out: string[] = [], F = vert(x, y, z + 16), L = 17;
  out.push(`<path class="iso-halo" d="${k.haloOf(ao(x, y, 40, 40, 6), z, 0.1, P)}" style="filter:blur(4px)"/>`);
  // a bandeja que recebe o que passou, com o que já caiu nela
  const band = ao(x, y, 18, 18, 1.6);
  out.push(S(k.slabOf(band, z, 3.6, P, 4, 0.4), { tone: "mid" }));
  out.push(Ln(k.planOutline(k.insetPlan(band, 1.6), z + 3.6, P), { tone: "lo" }));
  out.push(Dt(k.dotGrid(x - 4, y - 4, 4, 4, 2.6, z + 3.6, P).slice(0, Math.round(16 * avanco(estado))), { size: 0.5, tone: "mid" }));
  const pernas = porProfundidade(P, k.corners(ao(x, y, L * 2, L * 2), 0), ([a, b]) => [a, b, z]);
  const perna = ([a, b]: Flat) => S(k.cylinder(a, b, 2.2, z, 1, P, 16), { tone: "lo" }) + S(k.cylinder(a, b, 1.3, z + 1, 41, P, 14), { tone: "mid", crease: "none" });
  pernas.slice(0, 2).forEach((p) => out.push(perna(p)));
  // o quadro do cavalete em cima (as barras de trás antes do funil)
  const barras = [
    { x: x - L - 1, y: y - L - 1, w: 2 * L + 2, d: 2, r: 0.4 }, { x: x - L - 1, y: y - L - 1, w: 2, d: 2 * L + 2, r: 0.4 },
    { x: x - L - 1, y: y + L - 1, w: 2 * L + 2, d: 2, r: 0.4 }, { x: x + L - 1, y: y - L - 1, w: 2, d: 2 * L + 2, r: 0.4 },
  ];
  barras.slice(0, 2).forEach((b) => out.push(S(k.slabOf(b, z + 40, 2, P, 2, 0.3), { tone: "mid" })));
  // a válvula de saída (corpo abaulado) e o atuador de lado
  out.push(S(G.solidOf([[-10.4, 2.2], [-9.4, 3.6, 1], [-7, 4.6, 1], [-4.6, 3.6, 1], [-3.6, 2.2]], F, P), { tone: "mid" }));
  out.push(S(G.disc(-3.6, 0, 2.2, F, P), { tone: "mid" }));
  out.push(S(G.disc(-12.4, -10.4, 1.6, F, P), { tone: "mid" }));
  const at = { x: x + 4.4, y: y - 3, w: 6, d: 6, r: 1 };
  out.push(S(k.slabOf(at, z + 16 - 10, 5.4, P, 3, 0.4), { tone: "mid" }));
  out.push(Ln(k.planOutline(k.insetPlan(at, 1), z + 16 - 4.6, P), { tone: "faint" }));
  out.push(Dt([k.iso([at.x + 1.4, at.y + 1.4, z + 11.4], P), k.iso([at.x + at.w - 1.4, at.y + at.d - 1.4, z + 11.4], P)], { size: 0.4 }));
  // o cone (perfil suave) e a aba com os parafusos
  const cone: [number, number, number?][] = [[0, 2.2], [1.6, 3, 1], [6, 5.8, 1], [12, 10.2, 1], [18, 14.4, 1], [24, 17.6]];
  out.push(S(G.solidOf(cone, F, P), { tone: "hi", inner: Ln(G.arcOf(F, 12, 10.2, P, { slope: 0.72 }), { tone: "faint" }) }));
  out.push(S(G.ringBand(24, 25.6, 16.4, 19.6, F, P), { tone: "mid" }));
  out.push(`<path class="mq-vazio" d="${G.circleOf(F, 25.6, 16.4, P, 64)}"/>`);
  out.push(Ln(G.arcOf(F, 25.6, 16.4, P, { inward: true, least: -1 }), { tone: "faint" }));
  out.push(Dt(G.dotsOf(F, 25.6, 18, 12, P, { all: true }), { size: 0.42, tone: "mid" }));
  // o que está no funil (os grãos que ainda não passaram)
  out.push(Dt(k.dotGrid(x - 6, y - 6, 5, 5, 3, z + 16 + 25.6, P).filter((_, i) => i % 2 === (estado === "ok" ? 1 : 0)).slice(0, Math.round(13 * (1 - avanco(estado) * 0.7))), { size: 0.55, tone: "hi" }));
  barras.slice(2).forEach((b) => out.push(S(k.slabOf(b, z + 40, 2, P, 2, 0.3), { tone: "mid" })));
  pernas.slice(2).forEach((p) => out.push(perna(p)));
  return out.join("");
}
