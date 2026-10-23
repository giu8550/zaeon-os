/**
 * BLUEPRINT PRÁTICO — a MÁQUINA do tema (PURO: gera o SVG em string com o kit do anatomy, lib/anatomy/iso-kit).
 * Pedido do dono (22/10): "você não está tomando proveito de tudo que tem no anatomy, está colocando blocos em tudo, e na
 * mesma posição". A regra do anatomy é "o objeto é a explicação": um objeto REAL, feito de muitas peças pequenas e
 * precisas, cujo mecanismo é o conceito — nunca caixas com rótulo.
 *
 * Então a Zaeon (lib/blueprint/compor) inventa o OBJETO (uma frase: o que é e o que se move), escolhe o ARRANJO
 * (linha de montagem, anel, torre, cubo central) e dá a cada peça do tema uma FORMA de verdade. Aqui cada forma é uma
 * receita do anatomy (references/craft.md: gaveteiro com puxadores, relógio comparador face pra cima, pinos de
 * fechadura, tanque com costuras e visor, pistão com mola na haste, trilhos com carro e batentes, mesa giratória com
 * graus, lâmpada em pilha de cilindros, painel com grade de furos e botões serrilhados, engrenagens, funil), montada
 * sobre o seu pedestal; tudo em cima da placa-base com pés, sulco, parafusos, régua e plaqueta. Cabos com pontas ligam
 * as estações na ordem do fluxo. Nada de texto solto no desenho: só o número gravado em cada pedestal — a legenda e a
 * frase do objeto vão embaixo (como o anatomy manda). Tons: base `lo`, estrutura `mid`, a peça em foco `lit`; a cor só
 * diz o estado (verde provada, vermelha travada).
 */
import * as k from "@/lib/anatomy/iso-kit";
import type { Point3, Projection, Plan } from "@/lib/anatomy/iso-kit";
import type { DocBlueprint, Peca } from "./tipos";
import { estadoPeca, type EstadoPeca } from "./figura";

export type Forma = "gaveteiro" | "mostrador" | "fechadura" | "tanque" | "pistao" | "carro" | "giratoria" | "lampada" | "painel" | "engrenagens" | "funil";
export const FORMAS: Record<Forma, string> = {
  gaveteiro: "gavetas: guardar, separar, categorias, camadas, arquivos",
  mostrador: "relógio comparador: medir, avaliar, métrica, nota, limite",
  fechadura: "pinos de fechadura: segurança, privacidade, chave, validar, permissão",
  tanque: "tanque com visor: reservar, acumular, estado, saldo, estoque, recurso",
  pistao: "pistão com mola: força, pressão, transformar, executar, reação",
  carro: "trilhos com carro: avançar, etapa, transporte, pipeline, entrega",
  giratoria: "mesa giratória: ciclo, revisão, iteração, rodada, repetição",
  lampada: "lâmpada: ideia, saída, resultado, ver, iluminar, insight",
  painel: "painel com tela e botões: interface, produto, uso, controle, pessoa",
  engrenagens: "engrenagens: interação, troca, acoplar, economia, negociação",
  funil: "funil: filtrar, selecionar, converter, reduzir, concentrar",
};
export const LISTA_FORMAS = Object.keys(FORMAS) as Forma[];
export type Arranjo = "linha" | "anel" | "torre" | "cubo";
export const ARRANJOS: Record<Arranjo, string> = {
  linha: "linha de montagem: uma etapa depois da outra",
  anel: "anel: um ciclo que volta ao começo",
  torre: "torre de prateleiras: camadas, uma sobre a outra",
  cubo: "cubo central: uma peça no meio e as outras em volta",
};
export const LISTA_ARRANJOS = Object.keys(ARRANJOS) as Arranjo[];

/** a forma de cada peça: a que a Zaeon deu; sem ela, uma sequência variada (nunca tudo igual) */
const RODIZIO: Forma[] = ["gaveteiro", "mostrador", "pistao", "tanque", "painel", "engrenagens", "lampada", "funil", "fechadura", "carro", "giratoria"];
export const formaDe = (p: Pick<Peca, "forma">, i: number): Forma => (p.forma && (LISTA_FORMAS as string[]).includes(p.forma) ? (p.forma as Forma) : RODIZIO[i % RODIZIO.length]!);

const PASSO = 84, PED = { w: 66, d: 66, h: 6 };
type Estacao = { peca: Peca; i: number; forma: Forma; cx: number; cy: number; z: number; estado: EstadoPeca; acesa: boolean };

/** onde fica cada estação (centro no chão e a altura da prateleira) */
export function posicoes(n: number, arranjo: Arranjo, centro = 0): { cx: number; cy: number; z: number }[] {
  if (!n) return [];
  if (arranjo === "torre") return Array.from({ length: n }, (_, i) => ({ cx: 0, cy: 0, z: i * 62 }));
  if (arranjo === "linha") {
    const porFila = n <= 5 ? n : Math.ceil(n / 2);
    return Array.from({ length: n }, (_, i) => { const f = Math.floor(i / porFila), c = i % porFila; return { cx: (f % 2 ? porFila - 1 - c : c) * PASSO, cy: -f * PASSO, z: 0 }; });
  }
  const outros = arranjo === "cubo" ? n - 1 : n, R = Math.max(PASSO * 0.95, (PASSO * outros) / (2 * Math.PI) * 1.05);
  let j = 0;
  return Array.from({ length: n }, (_, i) => {
    if (arranjo === "cubo" && i === centro) return { cx: 0, cy: 0, z: 0 };
    const a = (j++ / outros) * Math.PI * 2 - Math.PI / 4;
    return { cx: Math.cos(a) * R, cy: Math.sin(a) * R, z: 0 };
  });
}

// ───────────── as receitas (centro cx, cy; z = topo do pedestal) ─────────────
type Pintor = { P: Projection; out: string[]; tom: (e: EstadoPeca) => k.Tone };
const solid = (o: Pintor, paths: k.SolidPaths, s: k.SolidStyle = {}) => o.out.push(k.solidSvg(paths, s));
const linha = (o: Pintor, d: string, s: k.LineStyle = {}) => o.out.push(k.lineSvg(d, s));
const pontos = (o: Pintor, pts: [number, number][], s: { size?: number; tone?: k.Tone; pulse?: boolean } = {}) => o.out.push(k.dotsSvg(pts, s));
const plano = (cx: number, cy: number, w: number, d: number, r = 2): Plan => ({ x: cx - w / 2, y: cy - d / 2, w, d, r });

function gaveteiro(o: Pintor, e: Estacao) {
  const { P } = o, z = e.z, caixa = plano(e.cx, e.cy, 46, 38, 2), frente = caixa.y + caixa.d;
  solid(o, k.slabOf(caixa, z, 40, P, 4, 0.8), { tone: "mid", inner: k.lineSvg(k.sideSeam(caixa, z + 38, P, 4), { tone: "faint" }) });
  for (let g = 0; g < 3; g++) {
    const zg = z + 3 + g * 12.4, f = { x: caixa.x + 3, y: frente, w: caixa.w - 6, d: 2.2, r: 0.6 };
    solid(o, k.slabOf(f, zg, 10.4, P, 3, 0.4), { tone: e.acesa && g === 1 ? "hi" : "mid", lit: e.acesa && g === 1 });
    solid(o, k.slabOf({ x: e.cx - 6, y: frente + 2.2, w: 12, d: 1.8, r: 0.7 }, zg + 4.4, 1.8, P, 3), { tone: "hi" });
    pontos(o, [k.iso([f.x + 2.4, frente + 2.3, zg + 8.4], P), k.iso([f.x + f.w - 2.4, frente + 2.3, zg + 8.4], P)], { size: 0.45, tone: "mid" });
  }
  linha(o, k.planOutline(k.insetPlan(caixa, 4), z + 40, P), { tone: "faint" });
}
function mostrador(o: Pintor, e: Estacao) {
  const { P } = o, z = e.z, R = 20;
  solid(o, k.cylinder(e.cx - 14, e.cy - 14, 3.4, z, 16, P, 24), { tone: "mid" });   // a haste atrás
  solid(o, k.cylinder(e.cx, e.cy, R, z + 2, 11, P, 64, 0.8), { tone: "hi", lit: e.acesa });
  const topo = z + 13;
  linha(o, k.knurl(e.cx, e.cy, R, topo - 3.4, topo, 84, P, 0.3), { tone: "lo" });
  linha(o, k.sideArc(e.cx, e.cy, R, topo - 3.4, P, 40), { tone: "faint" });
  linha(o, k.ring(e.cx, e.cy, R - 2.2, topo, P, 64), { tone: "lo" });
  const t = k.radialTicks(e.cx, e.cy, R - 3, 50, 5, topo, [1.3, 2.8], P);
  linha(o, t.minor, { tone: "lo" }); linha(o, t.major, { tone: "mid" });
  const ang = e.estado === "ok" ? -0.4 : e.estado === "trava" ? 1.9 : -2.4;
  linha(o, k.lineOnTop([e.cx - Math.cos(ang) * 3, e.cy - Math.sin(ang) * 3], [e.cx + Math.cos(ang) * (R - 5), e.cy + Math.sin(ang) * (R - 5)], topo + 0.2, P), { tone: "lit" });
  linha(o, k.ring(e.cx, e.cy, 1.6, topo + 0.2, P, 16), { tone: "hi" });
}
function fechadura(o: Pintor, e: Estacao) {
  const { P } = o, z = e.z, corpo = plano(e.cx, e.cy, 48, 30, 3);
  solid(o, k.slabOf(corpo, z, 22, P, 5, 1), { tone: "mid", inner: k.lineSvg(k.sideSeam(corpo, z + 8, P, 5), { tone: "faint" }) });
  const alturas = [9, 14, 7, 12, 10];
  alturas.forEach((h, i) => {
    const px = corpo.x + 8 + i * 8, alinhado = e.estado === "ok" || (e.acesa && i === 2);
    solid(o, k.cylinder(px, e.cy, 2.6, z + 22, alinhado ? 6 : h, P, 20), { tone: alinhado ? "hi" : "mid", lit: e.acesa && i === 2 });
    linha(o, k.ring(px, e.cy, 3.6, z + 22, P, 20), { tone: "lo" });
  });
  solid(o, k.cylinder(e.cx, corpo.y + corpo.d - 7, 5.4, z + 22, 2.4, P, 32), { tone: "hi" });   // o tambor da chave
  linha(o, k.lineOnTop([e.cx - 3, corpo.y + corpo.d - 7], [e.cx + 3, corpo.y + corpo.d - 7], z + 24.4, P), { tone: "lo" });
}
function tanque(o: Pintor, e: Estacao) {
  const { P } = o, z = e.z, R = 19, H = 46;
  solid(o, k.cylinder(e.cx, e.cy, R + 2, z, 3, P, 48, 0.6), { tone: "lo" });
  solid(o, k.cylinder(e.cx, e.cy, R, z + 3, H, P, 48, 0.8), { tone: "mid", lit: e.acesa, inner: [12, 28, 40].map((h) => k.lineSvg(k.sideArc(e.cx, e.cy, R, z + 3 + h, P, 40), { tone: "faint" })).join("") });
  const nivel = e.estado === "ok" ? 0.78 : e.estado === "trava" ? 0.35 : 0.15, [vx, vy] = k.towardViewer(P);
  const sx = e.cx + vx * R, sy = e.cy + vy * R;   // o visor de nível no lado que se vê
  linha(o, k.segment([sx, sy, z + 8], [sx, sy, z + H - 4], P), { tone: "lo" });
  linha(o, k.segment([sx, sy, z + 8], [sx, sy, z + 8 + (H - 12) * nivel], P), { tone: e.estado === "trava" ? "red" : e.estado === "ok" ? "green" : "mid" });
  solid(o, k.cylinder(e.cx, e.cy, 6, z + 3 + H, 4, P, 28), { tone: "hi" });
  linha(o, k.ring(e.cx, e.cy, 10, z + 7 + H, P, 32), { tone: "mid" });   // o volante da válvula
  for (let a = 0; a < 4; a++) linha(o, k.lineOnTop([e.cx, e.cy], [e.cx + Math.cos(a * Math.PI / 2) * 10, e.cy + Math.sin(a * Math.PI / 2) * 10], z + 7 + H, P), { tone: "mid" });
}
function pistao(o: Pintor, e: Estacao) {
  const { P } = o, z = e.z, y = e.cy, zr = z + 14;
  solid(o, k.slabOf({ x: e.cx - 30, y: y - 9, w: 4, d: 18, r: 1 }, z, 22, P, 3, 0.4), { tone: "mid" });   // o batente
  solid(o, k.slabOf({ x: e.cx - 26, y: y - 8, w: 24, d: 16, r: 3 }, z + 4, 18, P, 5, 0.8), { tone: "mid" });   // o cilindro
  const avanco = e.estado === "ok" ? 16 : e.estado === "trava" ? 8 : 3, c = k.coil(e.cx - 1, e.cx + 6 + avanco, [y, zr], 5.2, 7, "x", P);
  linha(o, c.back, { tone: "lo" });
  solid(o, k.slabOf({ x: e.cx - 2, y: y - 2, w: 12 + avanco, d: 4, r: 1.8 }, zr - 2, 4, P, 3), { tone: "hi", lit: e.acesa });   // a haste
  linha(o, c.front, { tone: "mid" });
  solid(o, k.slabOf({ x: e.cx + 10 + avanco, y: y - 7, w: 4, d: 14, r: 1.2 }, zr - 7, 14, P, 3, 0.4), { tone: "hi" });   // a sonda
}
function carro(o: Pintor, e: Estacao) {
  const { P } = o, z = e.z;
  for (const dy of [-12, 8]) solid(o, k.slabOf({ x: e.cx - 30, y: e.cy + dy, w: 60, d: 4, r: 1 }, z, 3, P, 3, 0.4), { tone: "mid" });
  for (const dx of [-33, 29]) solid(o, k.slabOf({ x: e.cx + dx, y: e.cy - 15, w: 4, d: 30, r: 1.2 }, z, 7, P, 3, 0.5), { tone: "mid" });
  const pos = e.estado === "ok" ? 14 : e.estado === "trava" ? 0 : -14, base = plano(e.cx + pos, e.cy - 2, 22, 26, 2.5);
  solid(o, k.slabOf(base, z + 3, 4, P, 4, 0.6), { tone: "hi", lit: e.acesa });
  for (const [bx, by] of k.corners(base, 3)) pontos(o, [k.iso([bx, by, z + 7.1], P)], { size: 0.5, tone: "mid" });
  solid(o, k.cylinder(e.cx + pos, e.cy - 2, 5, z + 7, 6, P, 24), { tone: "mid" });   // a carga
}
function giratoria(o: Pintor, e: Estacao) {
  const { P } = o, z = e.z, R = 25;
  solid(o, k.cylinder(e.cx, e.cy, R, z, 5, P, 72, 0.8), { tone: "mid" });
  const t = k.radialTicks(e.cx, e.cy, R - 1, 72, 6, z + 5, [1.2, 2.6], P);
  linha(o, t.minor, { tone: "lo" }); linha(o, t.major, { tone: "mid" });
  const a = e.estado === "ok" ? 0.6 : e.estado === "trava" ? 2.2 : 3.6;
  solid(o, k.cylinder(e.cx + Math.cos(a) * 12, e.cy + Math.sin(a) * 12, 5, z + 5, 10, P, 24), { tone: "hi", lit: e.acesa });
  linha(o, k.ring(e.cx, e.cy, 3, z + 5, P, 16), { tone: "mid" });
}
function lampada(o: Pintor, e: Estacao) {
  const { P } = o, z = e.z;
  solid(o, k.cylinder(e.cx, e.cy, 13, z, 4, P, 36, 0.6), { tone: "mid" });
  solid(o, k.cylinder(e.cx, e.cy, 3, z + 4, 30, P, 20), { tone: "mid", inner: k.lineSvg(k.sideArc(e.cx, e.cy, 3, z + 18, P, 12), { tone: "faint" }) });
  solid(o, k.cylinder(e.cx, e.cy, 5, z + 34, 3, P, 24), { tone: "mid" });
  solid(o, k.cylinder(e.cx, e.cy, 11, z + 37, 9, P, 40, 0.6), { tone: "hi", lit: e.acesa || e.estado === "ok" });
  pontos(o, k.dotGrid(e.cx - 4, e.cy - 4, 3, 3, 4, z + 46, P), { size: 0.5, tone: "mid", pulse: e.estado === "ok" });
}
function painel(o: Pintor, e: Estacao) {
  const { P } = o, z = e.z, corpo = plano(e.cx, e.cy, 54, 36, 3), tela = { x: corpo.x + 5, y: corpo.y + 5, w: 30, d: 22, r: 1.6 };
  solid(o, k.slabOf(corpo, z, 18, P, 5, 1), { tone: "mid", inner: k.lineSvg(k.sideSeam(corpo, z + 6, P, 5), { tone: "faint" }) });
  solid(o, k.slabOf(tela, z + 18, 0.8, P, 4), { tone: "hi", lit: e.acesa, flat: true });
  pontos(o, k.dotGrid(tela.x + 3, tela.y + 3, 7, 5, 4, z + 18.9, P), { size: 0.5, tone: e.estado === "futuro" ? "faint" : "mid", pulse: e.acesa });
  for (const [bx, by] of [[corpo.x + 44, corpo.y + 10], [corpo.x + 44, corpo.y + 24]] as [number, number][]) {
    solid(o, k.cylinder(bx, by, 4, z + 18, 4, P, 28), { tone: "mid" });
    linha(o, k.knurl(bx, by, 4, z + 18, z + 22, 24, P), { tone: "lo" });
    linha(o, k.lineOnTop([bx - 2, by], [bx + 3, by], z + 22, P), { tone: "hi" });
  }
}
function engrenagens(o: Pintor, e: Estacao) {
  const { P } = o, z = e.z;
  const rodas: [number, number, number, number][] = [[e.cx - 9, e.cy - 6, 15, 30], [e.cx + 15, e.cy + 10, 10, 20]];
  for (const [gx, gy, r, dentes] of rodas) {
    solid(o, k.cylinder(gx, gy, 3, z, 10, P, 16), { tone: "mid" });
    solid(o, k.cylinder(gx, gy, r, z + 10, 6, P, dentes * 2, 0.4), { tone: e.acesa ? "hi" : "mid", lit: e.acesa && r > 12 });
    const t = k.radialTicks(gx, gy, r - 0.5, dentes, 1, z + 16, [2.4, 2.4], P);
    linha(o, t.major, { tone: "mid" });
    linha(o, k.ring(gx, gy, r * 0.45, z + 16, P, 32), { tone: "lo" });
    linha(o, k.ring(gx, gy, 2.4, z + 16, P, 16), { tone: "hi" });
  }
}
function funil(o: Pintor, e: Estacao) {
  const { P } = o, z = e.z;
  solid(o, k.cylinder(e.cx, e.cy, 4, z, 14, P, 20), { tone: "mid" });
  [[18, 6], [14, 6], [10, 6], [6.5, 6]].reverse().forEach(([r, h], i) => solid(o, k.cylinder(e.cx, e.cy, r!, z + 14 + i * 6, h!, P, 48, 0.4), { tone: i === 3 ? "hi" : "mid", lit: e.acesa && i === 3 }));
  linha(o, k.ring(e.cx, e.cy, 15, z + 38, P, 48), { tone: "lo" });
  pontos(o, k.dotGrid(e.cx - 6, e.cy - 6, 4, 4, 4, z + 38.2, P), { size: 0.45, tone: "lo" });
}
const RECEITA: Record<Forma, (o: Pintor, e: Estacao) => void> = { gaveteiro, mostrador, fechadura, tanque, pistao, carro, giratoria, lampada, painel, engrenagens, funil };

export type Maquina = { svg: string; largura: number; altura: number; legenda: { n: number; codigo: string; nome: string; sub?: string; estado: EstadoPeca; forma: Forma }[] };

/** a máquina inteira, pronta pra `dangerouslySetInnerHTML` (o kit escapa todo texto; só números são gravados no desenho) */
export function montarMaquina(doc: Pick<DocBlueprint, "pecas" | "ligacoes" | "criticos" | "fase" | "aguardandoMentor"> & { arranjo?: string }, L = 760, A = 470): Maquina | null {
  const n = doc.pecas.length; if (!n) return null;
  const arranjo: Arranjo = (LISTA_ARRANJOS as string[]).includes(doc.arranjo ?? "") ? (doc.arranjo as Arranjo) : n <= 5 ? "linha" : "anel";
  const estados = doc.pecas.map((p) => estadoPeca(doc as DocBlueprint, p));
  const iAcesa = Math.max(0, estados.indexOf("trava") >= 0 ? estados.indexOf("trava") : estados.lastIndexOf("ok"));
  const pos = posicoes(n, arranjo, iAcesa);
  const est: Estacao[] = doc.pecas.map((p, i) => ({ peca: p, i, forma: formaDe(p, i), ...pos[i]!, z: pos[i]!.z + PED.h, estado: estados[i]!, acesa: i === iAcesa }));
  // a placa-base cobre todas as estações (com margem pra régua e plaqueta)
  const xs = est.map((e) => e.cx), ys = est.map((e) => e.cy), torre = arranjo === "torre";
  const base: Plan = { x: Math.min(...xs) - 48, y: Math.min(...ys) - 48, w: Math.max(...xs) - Math.min(...xs) + 96, d: Math.max(...ys) - Math.min(...ys) + 96 + (torre ? 0 : 20), r: 8 };
  const topoTorre = torre ? (n - 1) * 62 + 70 : 0;
  const cantos: Point3[] = [[base.x, base.y, -20], [base.x + base.w, base.y, -20], [base.x, base.y + base.d, -20], [base.x + base.w, base.y + base.d, -20], ...est.map((e): Point3 => [e.cx, e.cy, e.z + 56]), [base.x, base.y, topoTorre + 60]];
  const P = k.fitProjection(cantos, L, A, { pad: 18 });
  const o: Pintor = { P, out: [], tom: () => "mid" };
  const porProfundidade = <T,>(xs: T[], f: (x: T) => Point3) => [...xs].sort((a, b) => k.depthOf(f(a), P) - k.depthOf(f(b), P));
  // ── a placa-base (craft.md: "Base plate on feet") ──
  o.out.push(`<path class="iso-halo" d="${k.haloOf(base, -17, 12, P)}"/>`);
  for (const [x, y] of porProfundidade(k.corners(base, 22), ([x, y]) => [x, y, 0])) { solid(o, k.cylinder(x, y, 7, -17, 1.6, P, 28), { tone: "lo" }); solid(o, k.cylinder(x, y, 5.4, -15.4, 3.4, P, 28), { tone: "mid" }); }
  solid(o, k.slabOf(base, -12, 12, P, 8, 1.6), { tone: "mid" });
  linha(o, k.planOutline(k.insetPlan(base, 5), 0, P), { tone: "lo" });
  for (const [x, y] of k.corners(base, 10)) { linha(o, k.ring(x, y, 2.2, 0, P, 16), { tone: "lo" }); pontos(o, [k.iso([x, y, 0], P)], { size: 0.5, tone: "mid" }); }
  if (!torre) {   // a régua na frente e a plaqueta (as linhas da plaqueta são o "texto impresso")
    const regua = { x: base.x + 14, y: base.y + base.d - 15, w: base.w * 0.55, d: 7, r: 1 };
    solid(o, k.slabOf(regua, 0, 0.6, P, 3), { tone: "lo", crease: "none" });
    const t = k.topTicks(regua.x + 4, regua.x + regua.w - 4, 4, 5, regua.y + 0.8, 0.6, [2, 3.6], P);
    linha(o, t.minor, { tone: "lo" }); linha(o, t.major, { tone: "mid" });
    const placa = { x: base.x + base.w - 70, y: base.y + base.d - 18, w: 56, d: 12, r: 1.2 };
    solid(o, k.slabOf(placa, 0, 0.8, P, 4), { tone: "mid" });
    linha(o, k.planOutline(k.insetPlan(placa, 1.6), 0.8, P), { tone: "faint" });
    [34, 24, 28].forEach((w, i) => linha(o, k.lineOnTop([placa.x + 6, placa.y + 3.4 + i * 2.6], [placa.x + 6 + w, placa.y + 3.4 + i * 2.6], 0.8, P), { tone: "lo", free: true }));
  }
  // ── a torre: postes e prateleiras ──
  const prateleiras = torre ? est.map((e) => ({ plan: plano(e.cx, e.cy, PED.w + 16, PED.d + 16, 3), z: e.z - PED.h - 3 })) : [];
  const postes = torre ? k.corners(plano(0, 0, PED.w + 16, PED.d + 16, 3), 4) : [];
  if (torre) for (const [x, y] of porProfundidade(postes, ([x, y]) => [x, y, 0]).slice(0, 2)) solid(o, k.cylinder(x, y, 2.6, 0, topoTorre, P, 20), { tone: "mid" });
  // ── as estações, de trás pra frente (de baixo pra cima, na torre) ──
  const ordem = torre ? est : porProfundidade(est, (e) => [e.cx, e.cy, 0]);
  for (const e of ordem) {
    if (torre) { const pr = prateleiras[e.i]!; solid(o, k.slabOf(pr.plan, pr.z, 3, P, 4, 0.6), { tone: "mid" }); }
    const ped = plano(e.cx, e.cy, PED.w, PED.d, 4);
    o.out.push(`<g data-estado="${e.estado}"${e.estado === "futuro" ? ' opacity="0.42"' : ""}>`);
    solid(o, k.slabOf(ped, e.z - PED.h, PED.h, P, 5, 0.8), { tone: e.estado === "trava" ? "hi" : "mid" });
    linha(o, k.planOutline(k.insetPlan(ped, 3.5), e.z, P), { tone: e.estado === "ok" ? "green" : e.estado === "trava" ? "red" : "faint" });
    for (const [x, y] of k.corners(ped, 6)) pontos(o, [k.iso([x, y, e.z], P)], { size: 0.45, tone: "mid" });
    // o número gravado na face da frente do pedestal (o único texto no desenho — a legenda diz o que é)
    o.out.push(k.faceTextSvg(k.sideMatrix([ped.x + 6, ped.y + ped.d], e.z - 1.6, P, "left"), String(e.i + 1).padStart(2, "0"), { size: 4.4, tone: e.acesa ? "hi" : "mid" }));
    RECEITA[e.forma](o, e);
    o.out.push("</g>");
  }
  if (torre) for (const [x, y] of porProfundidade(postes, ([x, y]) => [x, y, 0]).slice(2)) solid(o, k.cylinder(x, y, 2.6, 0, topoTorre, P, 20), { tone: "mid" });
  // ── os cabos (na ordem do fluxo), com as pontas nos pedestais ──
  const porId = new Map(est.map((e) => [e.peca.id, e] as const));
  for (const [a, b] of doc.ligacoes) {
    const A1 = porId.get(a), B1 = porId.get(b); if (!A1 || !B1) continue;
    const vivo = A1.estado === "ok" && B1.estado === "ok";
    const de = k.iso([A1.cx + PED.w / 2 - 6, A1.cy + PED.d / 2 - 6, A1.z], P), ate = k.iso([B1.cx - PED.w / 2 + 6, B1.cy - PED.d / 2 + 6, B1.z], P);
    const meio = k.iso([(A1.cx + B1.cx) / 2, (A1.cy + B1.cy) / 2, torre ? (A1.z + B1.z) / 2 : 0.4], P);
    o.out.push(k.wireSvg(de, ate, { via: [meio], tone: vivo ? "green" : "mid", flow: vivo, dashed: !vivo && (A1.estado === "futuro" || B1.estado === "futuro") }));
  }
  return {
    svg: o.out.join(""), largura: L, altura: A,
    legenda: est.map((e) => ({ n: e.i + 1, codigo: `C-${String(e.i + 1).padStart(2, "0")}`, nome: e.peca.nome, sub: e.peca.sub, estado: e.estado, forma: e.forma })),
  };
}
