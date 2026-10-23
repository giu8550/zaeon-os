/**
 * BLUEPRINT PRÁTICO — a MÁQUINA do tema, no padrão do anatomy (wheresryan22/anatomy, MIT: lib/anatomy/iso-kit, lathe e
 * tube copiados 1:1). PURO: gera o SVG em string, ordenado por profundidade, com o vetor de explosão de cada conjunto.
 *
 * Pedido do dono (22–23/10): "o desenho tem que ter o mesmo nível de complexidade que o anatomy oferece". A regra do
 * anatomy é "o objeto é a explicação": UMA máquina real, feita de muitas peças pequenas e precisas (40–80 numa figura),
 * cujo mecanismo é o conceito. Aqui:
 *  - a Zaeon (lib/blueprint/compor) escolhe o ARRANJO (linha, anel, torre, cubo) e a FORMA de cada peça do estudo;
 *  - cada peça vira um CONJUNTO de verdade (lib/blueprint/maquinaFormas: relógio comparador, cilindro de tirantes, vaso de
 *    pressão, arquivo de gavetas, fechadura de pinos…) sobre o seu pedestal, com o número gravado e a lâmpada de estado;
 *  - os pedestais são ligados por um COLETOR de verdade (cano principal, tês de esfera, ramais flangeados, bomba na
 *    origem) — a ordem do fluxo é a ordem das peças;
 *  - tudo sobre a placa-base com pés, sulco, parafusos, régua e plaqueta (craft.md §3), ou numa estante (torre).
 * Cada item leva a chave de profundidade (`data-k`) e o deslocamento quando o conjunto "sai" (`data-m`): a figura viva
 * (components/blueprint/FiguraIso) desmonta a peça em foco com molas, como a vista explodida do Raptor, e reordena.
 */
import * as k from "@/lib/anatomy/iso-kit";
import * as G0 from "@/lib/anatomy/lathe";
import * as T0 from "@/lib/anatomy/tube";
import type { Flat, Plan, Point3, Projection, SolidPaths, SolidStyle, LineStyle, Tone } from "@/lib/anatomy/iso-kit";
import type { DocBlueprint, Peca } from "./tipos";
import { estadoPeca, type EstadoPeca } from "./figura";
import * as F from "./maquinaFormas";

// lathe e tube vêm do anatomy em JS puro (copiados 1:1, sem tipos): as opções deles são inferidas dos valores padrão
// (`P = null`…), então entram aqui sem tipo
const G = G0 as any, { tubePieces, tubeSvg } = T0 as any;

export type Forma = "gaveteiro" | "mostrador" | "fechadura" | "tanque" | "pistao" | "carro" | "giratoria" | "lampada" | "painel" | "engrenagens" | "funil";
export const FORMAS: Record<Forma, string> = {
  gaveteiro: "arquivo de gavetas: guardar, separar, categorias, camadas, arquivos",
  mostrador: "relógio comparador sobre blocos-padrão: medir, avaliar, métrica, nota, limite",
  fechadura: "fechadura de pinos com chave: segurança, privacidade, chave, validar, permissão",
  tanque: "vaso de pressão com visor de nível: reservar, acumular, estado, saldo, estoque, recurso",
  pistao: "cilindro hidráulico com haste: força, pressão, transformar, executar, reação",
  carro: "trilhos com carro e régua: avançar, etapa, transporte, pipeline, entrega",
  giratoria: "mesa giratória graduada: ciclo, revisão, iteração, rodada, repetição",
  lampada: "lâmpada de estúdio: ideia, saída, resultado, ver, iluminar, insight",
  painel: "computador com tela e teclado: interface, produto, uso, controle, pessoa",
  engrenagens: "par de engrenagens com manivela: interação, troca, acoplar, economia, negociação",
  funil: "funil com válvula de saída: filtrar, selecionar, converter, reduzir, concentrar",
};
export const LISTA_FORMAS = Object.keys(FORMAS) as Forma[];
export type Arranjo = "linha" | "anel" | "torre" | "cubo";
export const ARRANJOS: Record<Arranjo, string> = {
  linha: "bancada em linha: uma etapa depois da outra, o fluxo da esquerda pra direita",
  anel: "mesa redonda com coletor em anel: um ciclo que volta ao começo",
  torre: "estante de prateleiras com um tubo subindo: camadas, uma sobre a outra",
  cubo: "peça central com as outras em volta: um núcleo que alimenta o resto",
};
export const LISTA_ARRANJOS = Object.keys(ARRANJOS) as Arranjo[];

/** a forma de cada peça: a que a Zaeon deu; sem ela, uma sequência variada (nunca tudo igual) */
const RODIZIO: Forma[] = ["gaveteiro", "mostrador", "pistao", "tanque", "painel", "engrenagens", "lampada", "funil", "fechadura", "carro", "giratoria"];
export const formaDe = (p: Pick<Peca, "forma">, i: number): Forma => (p.forma && (LISTA_FORMAS as string[]).includes(p.forma) ? (p.forma as Forma) : RODIZIO[i % RODIZIO.length]!);

const RECEITA: Record<Forma, (c: F.Ctx) => string> = {
  gaveteiro: F.gaveteiro, mostrador: F.mostrador, fechadura: F.fechadura, tanque: F.tanque, pistao: F.pistao, carro: F.carro,
  giratoria: F.giratoria, lampada: F.lampada, painel: F.painel, engrenagens: F.engrenagens, funil: F.funil,
};

/** os conjuntos são desenhados 30% maiores que a planta (mesma câmera: iso(p/E, P·E) = iso(p, P)) — peça grande, pedestal justo */
const E = 1.3;
const PASSO = 100, LADO = 64, PED_H = 6, NIVEL = 136, R_CANO = 2.4, R_RAMAL = 1.7, R_TE = 3.2;
type Pos = { cx: number; cy: number; z: number };

/** onde fica cada estação: centro no chão e a altura em que o pedestal se apoia (z > 0 só na torre) */
export function posicoes(n: number, arranjo: Arranjo): Pos[] {
  if (!n) return [];
  if (arranjo === "torre") {
    const dois = n > 3;
    return Array.from({ length: n }, (_, i) => ({ cx: dois ? (i % 2 ? 52 : -52) : 0, cy: 0, z: 8 + Math.floor(dois ? i / 2 : i) * NIVEL }));
  }
  if (arranjo === "linha") {
    const porFila = n <= 5 ? n : Math.ceil(n / 2);
    return Array.from({ length: n }, (_, i) => ({ cx: (i % porFila) * PASSO, cy: -Math.floor(i / porFila) * (PASSO + 24), z: 0 }));
  }
  const outros = arranjo === "cubo" ? n - 1 : n, R = raioAnel(n, arranjo);
  return Array.from({ length: n }, (_, i) => {
    if (arranjo === "cubo" && i === 0) return { cx: 0, cy: 0, z: 0 };
    const j = arranjo === "cubo" ? i - 1 : i, a = (j / outros) * Math.PI * 2 + Math.PI * 0.75;
    return { cx: Math.cos(a) * R, cy: Math.sin(a) * R, z: 0 };
  });
}
/** o ângulo do raio que liga o centro (bomba ou núcleo) ao anel: no meio entre duas estações, do lado de trás */
export function anguloRaio(arranjo: Arranjo, n: number): number {
  const m = arranjo === "cubo" ? n - 1 : n, passo = (Math.PI * 2) / Math.max(1, m), alvo = Math.PI * 1.25;
  let melhor = 0, dist = Infinity;
  for (let j = 0; j < m; j++) {
    const a = (((Math.PI * 0.75 + j * passo + passo / 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), d = Math.abs(a - alvo);
    if (d < dist) { dist = d; melhor = a; }
  }
  return melhor;
}
const raioAnel = (n: number, arranjo: Arranjo) => Math.max(arranjo === "cubo" ? 128 : 112, ((arranjo === "cubo" ? n - 1 : n) * (LADO + 40)) / (2 * Math.PI));

// ─────────────────────────────── a lista de itens, em ordem de profundidade ───────────────────────────────
type Item = { k: number; svg: string; peca: number | null; m?: Point3 };
const S = (paths: SolidPaths, style: SolidStyle = {}) => k.solidSvg(paths, style);
const Ln = (d: string, style: LineStyle = {}) => k.lineSvg(d, style);
const Dt = (pts: Array<Flat | [number, number, number]>, style: { size?: number; tone?: Tone } = {}) => k.dotsSvg(pts, style);
type LineTone = NonNullable<LineStyle["tone"]>;

export type Maquina = {
  svg: string; largura: number; altura: number; P: Projection; arranjo: Arranjo;
  /** a direção pra quem olha (pra reordenar pela profundidade enquanto as peças saem) */
  V: Point3;
  /** por peça: o vetor do mundo que ela percorre ao sair (vista explodida) */
  movimentos: Point3[];
  legenda: { n: number; codigo: string; nome: string; sub?: string; estado: EstadoPeca; forma: Forma }[];
};

/** a máquina inteira, pronta pra `dangerouslySetInnerHTML` (o kit escapa todo texto; só números são gravados no desenho) */
export function montarMaquina(doc: Pick<DocBlueprint, "pecas" | "ligacoes" | "criticos" | "fase" | "aguardandoMentor"> & { arranjo?: string }, L = 820, A = 560): Maquina | null {
  const n = doc.pecas.length; if (!n) return null;
  const arranjo: Arranjo = (LISTA_ARRANJOS as string[]).includes(doc.arranjo ?? "") ? (doc.arranjo as Arranjo) : n <= 5 ? "linha" : "anel";
  const estados = doc.pecas.map((p) => estadoPeca(doc as DocBlueprint, p));
  const pos = posicoes(n, arranjo), redondo = arranjo === "anel" || arranjo === "cubo", torre = arranjo === "torre";
  const est = doc.pecas.map((p, i) => ({ peca: p, i, forma: formaDe(p, i), ...pos[i]!, estado: estados[i]! }));

  // ── a planta: a placa (ou a mesa redonda, ou a estante) e o coletor ──
  const xs = est.map((e) => e.cx), ys = est.map((e) => e.cy);
  const R = redondo ? raioAnel(n, arranjo) : 0;
  const base: Plan = redondo ? { x: -R - 58, y: -R - 58, w: 2 * R + 116, d: 2 * R + 116, r: R + 58 }
    : torre ? { x: Math.min(...xs) - 64, y: -62, w: Math.max(...xs) - Math.min(...xs) + 128, d: 120, r: 6 }
    : { x: Math.min(...xs) - 124, y: Math.min(...ys) - 68, w: Math.max(...xs) - Math.min(...xs) + 160, d: Math.max(...ys) - Math.min(...ys) + 136, r: 8 };
  const topo = torre ? Math.max(...est.map((e) => e.z)) + NIVEL - 8 : 90;
  // a moldura cobre a peça desmontada também (ela sobe 44 fora da torre)
  const cantos: Point3[] = [...k.boxCorners(base, -20, 0), ...est.map((e): Point3 => [e.cx, e.cy, e.z + PED_H + 72 * E + (torre ? 0 : 30)]), ...(torre ? [[base.x, base.y, topo], [base.x + base.w, base.y + base.d, topo]] as Point3[] : [])];
  if (arranjo === "linha" && est.every((e) => e.cy === 0)) A = Math.round(A * 0.74);   // uma fila só: cartão mais baixo
  const P = k.fitProjection(cantos, L, A, { pad: 22, azimuth: arranjo === "linha" ? 58 : 45, elevation: redondo ? 34 : 30 });
  const V = G.viewOf(P), dep = (p: Point3) => G.dot3(p, V);
  const itens: Item[] = [];
  // na torre, cada prateleira é uma camada: tudo o que está nela (prateleira, pedestais, conjuntos, ramais) é pintado
  // depois da camada de baixo — uma chave por ponto não ordena uma prateleira larga contra o que está em cima dela
  const camada = (z: number) => (torre ? Math.max(0, Math.floor((z - 4) / NIVEL)) * 1000 : 0);
  const pus = (ref: Point3, svg: string, bias = 0, peca: number | null = null, m?: Point3) => itens.push({ k: dep(ref) + bias + camada(ref[2]), svg, peca, m });

  // a placa-base (craft.md: "Base plate on feet"): fica embaixo de tudo, fora da ordenação
  const fundo: string[] = [`<path class="iso-halo" d="${k.haloOf(base, -17, 12, P)}"/>`];
  const pes = redondo ? [45, 135, 225, 315].map((g) => [Math.cos((g * Math.PI) / 180) * (R + 40), Math.sin((g * Math.PI) / 180) * (R + 40)] as Flat) : k.corners(base, 22);
  for (const [x, y] of [...pes].sort((a, b) => dep([a[0], a[1], 0]) - dep([b[0], b[1], 0]))) {
    fundo.push(S(k.cylinder(x, y, 7, -17, 1.6, P, 28), { tone: "lo" }), S(k.cylinder(x, y, 5.4, -15.4, 3.4, P, 28), { tone: "mid" }));
  }
  if (redondo) {
    const RB = R + 58;
    fundo.push(S(k.cylinder(0, 0, RB, -12, 12, P, 128, 1.6), { tone: "mid", inner: Ln(k.sideArc(0, 0, RB, -4, P, 96), { tone: "faint" }) }));
    fundo.push(Ln(k.ring(0, 0, RB - 5, 0, P, 128), { tone: "lo" }));
    const t = k.radialTicks(0, 0, RB - 5.4, 120, 10, 0, [1.6, 3.2], P);
    fundo.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "mid" }));
    for (const g of [0, 90, 180, 270]) { const a = ((g + 45) * Math.PI) / 180; fundo.push(parafuso(P, Math.cos(a) * (RB - 12), Math.sin(a) * (RB - 12), 0)); }
  } else {
    fundo.push(S(k.slabOf(base, -12, 12, P, 8, 1.6), { tone: "mid" }));
    fundo.push(Ln(k.planOutline(k.insetPlan(base, 5), 0, P), { tone: "lo" }));
    for (const [x, y] of k.corners(base, 10)) fundo.push(parafuso(P, x, y, 0));
    // a régua na frente e a plaqueta
    const regua = { x: base.x + 18, y: base.y + base.d - 15, w: Math.min(220, base.w * 0.5), d: 7, r: 1 };
    fundo.push(S(k.slabOf(regua, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
    const t = k.topTicks(regua.x + 4, regua.x + regua.w - 4, 4, 5, regua.y + 0.8, 0.6, [2, 3.6], P);
    fundo.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "mid" }));
    fundo.push(Dt([k.iso([regua.x + 2, regua.y + 3.5, 0.6], P), k.iso([regua.x + regua.w - 2, regua.y + 3.5, 0.6], P)], { size: 0.45 }));
    const placa = { x: base.x + base.w - 76, y: base.y + base.d - 19, w: 58, d: 13, r: 1.2 };
    fundo.push(S(k.slabOf(placa, 0, 0.8, P, 4), { tone: "mid" }), Ln(k.planOutline(k.insetPlan(placa, 1.6), 0.8, P), { tone: "faint" }));
    [34, 22, 28].forEach((w, i) => fundo.push(Ln(k.lineOnTop([placa.x + 6, placa.y + 3.6 + i * 2.8], [placa.x + 6 + w, placa.y + 3.6 + i * 2.8], 0.8, P), { tone: "lo", free: true })));
    fundo.push(Dt([k.iso([placa.x + 2.6, placa.y + 6.5, 0.8], P), k.iso([placa.x + placa.w - 2.6, placa.y + 6.5, 0.8], P)], { size: 0.45 }));
  }

  // ── a estante da torre: duas colunas em diagonal, prateleiras com mãos-francesas e a viga no alto ──
  if (torre) {
    const xa = base.x + 8, xb = base.x + base.w - 8, colunas: Flat[] = [[xa, 34], [xb, -46]];
    for (const [cx, cy] of colunas) {
      const c = ao(cx, cy, 9, 9, 1.4);
      pus([cx, cy, topo / 2], S(k.slabOf(c, 0, topo, P, 4, 0.6), { tone: "mid", inner: Ln(k.sideSeam(c, 2.4, P, 4), { tone: "faint" }) }) +
        Ln(k.planOutline(k.insetPlan(c, 2), topo, P), { tone: "faint" }), cx > 0 ? 1e6 : -1e6);
    }
    const viga = k.extrude([[xa - 4, 30], [xa + 4, 38], [xb + 4, -42], [xb - 4, -50]], topo, 10, P);
    pus([0, -6, topo + 5], S(viga, { tone: "mid" }), 1e6 + 1);
    const niveis = [...new Set(est.map((e) => e.z))];
    for (const z of niveis) {
      const pr = { x: base.x + 14, y: -44, w: base.w - 28, d: 88, r: 3 };
      pus([0, 0, z - 4], S(k.slabOf(pr, z - 4, 4, P, 4, 0.6), { tone: "mid", inner: Ln(k.sideSeam(pr, z - 2, P, 4), { tone: "faint" }) }) +
        [pr.x + 6, pr.x + pr.w - 6].map((bx) => parafuso(P, bx, pr.y + 6, z, 1.2) + parafuso(P, bx, pr.y + pr.d - 6, z, 1.2)).join(""), -100);
    }
  }

  // ── as ESTAÇÕES: pedestal (fica) + o conjunto da forma (sai quando a pessoa foca) ──
  const sai: Point3 = torre ? [0, 40, 6] : [0, 0, 44];
  const portas: { e: (typeof est)[number]; d: Flat; boca: Point3 }[] = [];
  for (const e of est) {
    const zt = e.z + PED_H, ref: Point3 = [e.cx, e.cy, e.z];
    // a direção da porta (onde o ramal chega): pra trás na linha e na torre, pro centro no anel (o núcleo do cubo, pra trás)
    const aR = anguloRaio(arranjo, n), d: Flat = redondo && (e.cx || e.cy) ? norm([-e.cx, -e.cy]) : redondo ? [Math.cos(aR), Math.sin(aR)] : [0, -1];
    pus(ref, pedestal(P, e, redondo, d, portas), 0);
    pus([e.cx, e.cy, zt], `<g data-estado="${e.estado}">${RECEITA[e.forma]({ P: { ...P, scale: P.scale * E }, x: e.cx / E, y: e.cy / E, z: zt / E, estado: e.estado })}</g>`, 1, e.i, sai);
  }

  // ── o COLETOR: cano principal com tês de esfera, ramais flangeados até as portas e a bomba na origem ──
  coletor(P, arranjo, est, portas, R, base, pus);

  itens.sort((a, b) => a.k - b.k);
  const corpo = itens.map((it) => `<g class="it" data-piece="${it.peca ?? "base"}" data-k="${it.k.toFixed(2)}"${it.m ? ` data-m="${it.m.join(",")}"` : ""}>${it.svg}</g>`).join("");
  return {
    svg: fundo.join("") + corpo, largura: L, altura: A, P, arranjo, V,
    movimentos: est.map(() => sai),
    legenda: est.map((e) => ({ n: e.i + 1, codigo: `C-${String(e.i + 1).padStart(2, "0")}`, nome: e.peca.nome, sub: e.peca.sub, estado: e.estado, forma: e.forma })),
  };
}

const norm = ([x, y]: Flat): Flat => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
const ao = (x: number, y: number, w: number, d: number, r = 1): Plan => ({ x: x - w / 2, y: y - d / 2, w, d, r });
const parafuso = (P: Projection, x: number, y: number, z: number, r = 2.2) => Ln(k.ring(x, y, r, z, P, 16), { tone: "lo" }) + Dt([k.iso([x, y, z], P)], { size: 0.5 });

/** o pedestal da estação: bloco (quadrado ou redondo) com sulco, parafusos, número gravado, lâmpada de estado e a porta flangeada */
function pedestal(P: Projection, e: { cx: number; cy: number; z: number; i: number; estado: EstadoPeca }, redondo: boolean, d: Flat, portas: { e: any; d: Flat; boca: Point3 }[]): string {
  const out: string[] = [], z0 = e.z, zt = z0 + PED_H, num = String(e.i + 1).padStart(2, "0");
  const lampada = (x: number, y: number) =>
    S(k.cylinder(x, y, 2.6, zt, 1.2, P, 20), { tone: "mid" }) + S(G.sphereOf([x, y, zt + 3], 2, P), { tone: "mid", className: `mq-lampada mq-lampada-${e.estado}` });
  // a porta (ressalto + flange com parafusos) na face que dá pro coletor
  const rFace = redondo ? LADO / 2 : LADO / 2, face: Point3 = [e.cx + d[0] * rFace, e.cy + d[1] * rFace, z0 + PED_H / 2];
  const Fp = G.frameAlong(face, [d[0], d[1], 0]);
  const porta = S(G.disc(-0.4, 2.4, 2.4, Fp, P), { tone: "mid" }) + S(G.disc(2.4, 3.4, 3.2, Fp, P), { tone: "mid" });
  portas.push({ e, d, boca: G.add3(face, [d[0] * 3.4, d[1] * 3.4, 0]) });
  const portaAtras = G.dot3([d[0], d[1], 0], G.viewOf(P)) < 0;
  if (portaAtras) out.push(porta);
  if (redondo) {
    const r = LADO / 2;
    out.push(S(k.cylinder(e.cx, e.cy, r, z0, PED_H, P, 64, 0.8), { tone: e.estado === "trava" ? "hi" : "mid" }));
    out.push(Ln(k.ring(e.cx, e.cy, r - 3.6, zt, P, 64), { tone: e.estado === "ok" ? "green" : e.estado === "trava" ? "red" : "faint" }));
    for (let j = 0; j < 4; j++) { const a = Math.PI / 4 + (j * Math.PI) / 2; out.push(Dt([k.iso([e.cx + Math.cos(a) * (r - 7), e.cy + Math.sin(a) * (r - 7), zt], P)], { size: 0.45 })); }
    const [vx, vy] = k.towardViewer(P), a = Math.atan2(vy, vx) + 0.55;
    out.push(k.faceTextSvg(k.topMatrix([e.cx + Math.cos(a) * (r - 9), e.cy + Math.sin(a) * (r - 9)], zt, P, "x"), num, { size: 4.6, tone: "mid", anchor: "middle" }));
    out.push(lampada(e.cx + Math.cos(a - 1.1) * (r - 6), e.cy + Math.sin(a - 1.1) * (r - 6)));
  } else {
    const ped = ao(e.cx, e.cy, LADO, LADO, 4);
    out.push(S(k.slabOf(ped, z0, PED_H, P, 5, 0.8), { tone: e.estado === "trava" ? "hi" : "mid" }));
    out.push(Ln(k.planOutline(k.insetPlan(ped, 3.5), zt, P), { tone: e.estado === "ok" ? "green" : e.estado === "trava" ? "red" : "faint" }));
    for (const [x, y] of k.corners(ped, 6.4)) out.push(Dt([k.iso([x, y, zt], P)], { size: 0.45 }));
    out.push(k.faceTextSvg(k.sideMatrix([ped.x + 6, ped.y + ped.d], zt - 1.4, P, "left"), num, { size: 3.6, tone: "mid" }));
    out.push(lampada(ped.x + ped.w - 7, ped.y + ped.d - 7));
  }
  if (!portaAtras) out.push(porta);
  return out.join("");
}

/** o coletor: um cano por trás das estações (ou em anel, ou subindo na torre), tês de esfera e ramais até as portas */
function coletor(P: Projection, arranjo: Arranjo, est: { cx: number; cy: number; z: number; i: number }[], portas: { e: { i: number; cx: number; cy: number; z: number }; d: Flat; boca: Point3 }[], R: number, base: Plan, pus: (ref: Point3, svg: string, bias?: number) => void) {
  const cano = (rota: Point3[], r: number, { gaps = [] as [number, number][], closed = false, caps = true as boolean | [boolean, boolean], tom = "mid" as Tone } = {}) => {
    for (const peca of tubePieces(rota, r, P, { maxLength: 18, gaps, closed, caps })) pus(peca.mid, tubeSvg(peca, { tone: tom }), -0.5);
  };
  const te = (p: Point3) => pus(p, S(G.sphereOf(p, R_TE, P), { tone: "mid" }), -0.4);
  const meiaCorda = Math.sqrt(R_TE ** 2 - R_CANO ** 2), saidaRamal = Math.sqrt(R_TE ** 2 - R_RAMAL ** 2);
  /** do tê (sai da esfera onde a borda do ramal encosta nela) até a boca da porta; `curva` = primeiro anda em x */
  const ramal = (de: Point3, ate: Point3, curva = false) => {
    const quina: Point3 = [ate[0], de[1], de[2]], prox = curva ? quina : ate, ini = G.add3(de, G.mul3(G.unit3(G.sub3(prox, de)), saidaRamal));
    cano(curva ? G.fillet([ini, quina, ate], 6, 9, { P, tube: R_RAMAL }) : [ini, ate], R_RAMAL, { caps: [false, true] });
  };
  /** um cano reto com tês nos pontos `em` (comprimento ao longo dele) */
  const principal = (rota: Point3[], em: number[], closed = false) => {
    const total = G.pathLength(rota);
    cano(rota, R_CANO, { gaps: em.map((s) => [Math.max(0, s - meiaCorda), Math.min(total, s + meiaCorda)] as [number, number]), closed });
    for (const s of em) te(G.pointAlong(rota, s));
  };
  const zc = (z: number) => z + PED_H / 2;
  if (arranjo === "linha") {
    const filas = [...new Set(est.map((e) => e.cy))];
    const x0 = Math.min(...est.map((e) => e.cx)) - 58, x1 = Math.max(...est.map((e) => e.cx)) + 30;
    filas.forEach((fy, f) => {
      const yh = fy - LADO / 2 - 3.4 - 11, rota: Point3[] = [[x0, yh, zc(0)], [x1, yh, zc(0)]];
      const daFila = portas.filter((p) => p.e.cy === fy);
      principal(rota, daFila.map((p) => p.e.cx - x0));
      daFila.forEach((p) => ramal([p.e.cx, yh, zc(0)], p.boca));
      for (let s = 0; s < daFila.length - 1; s++) berco(P, [(daFila[s]!.e.cx + daFila[s + 1]!.e.cx) / 2, yh, 0], pus);   // os berços entre os tês
      // a ponta de cada fila: a bomba (na primeira) ou um flange cego; as filas se ligam pela direita
      if (f === 0) bomba(P, [x0, yh, zc(0)], pus);
      else pus([x0, yh, zc(0)], S(G.disc(-2, 0, 4, G.frameAlong([x0, yh, zc(0)], [1, 0, 0]), P), { tone: "mid" }), 0.2);
      if (f > 0) {
        const yAnt = filas[f - 1]! - LADO / 2 - 3.4 - 11;
        cano(G.fillet([[x1, yAnt, zc(0)], [x1 + 14, yAnt, zc(0)], [x1 + 14, yh, zc(0)], [x1, yh, zc(0)]], 7, 9, { P, tube: R_CANO }), R_CANO);
      } else if (filas.length === 1) pus([x1, yh, zc(0)], S(G.disc(0, 2, 4, G.frameAlong([x1, yh, zc(0)], [1, 0, 0]), P), { tone: "mid" }) + Dt(G.dotsOf(G.frameAlong([x1, yh, zc(0)], [1, 0, 0]), 2, 3, 6, P, { all: true }), { size: 0.4 }), 0.2);
    });
  } else if (arranjo === "torre") {
    const yr = -LADO / 2 - 3.4 - 14, zs = [...new Set(est.map((e) => e.z))], topoR = zc(Math.max(...zs));
    // o tubo sobe fora do eixo das estações: alinhado com uma delas na tela, ele parecia a haste da peça
    const rx = -30, rota: Point3[] = [[rx, yr, 10], [rx, yr, topoR]];
    principal(rota, zs.map((z) => zc(z) - 10));
    for (const p of portas) ramal([rx, yr, zc(p.e.z)], p.boca, p.e.cx !== rx);
    bomba(P, [rx, yr, 10], pus, true);
    pus([rx, yr, topoR], S(G.disc(0, 2, 4, G.frameAlong([rx, yr, topoR], [0, 0, 1]), P), { tone: "mid" }), 0.2);
  } else {
    // anel: o coletor é um círculo por dentro das estações; o núcleo do cubo (ou a bomba) se liga a ele por um raio
    const rr = R - LADO / 2 - 3.4 - 12, Fr = G.frameOf([0, 0, zc(0)], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const rota: Point3[] = G.arcPoints(Fr, 0, rr, 0, Math.PI * 2 * (1 - 1 / 160), 159), total = Math.PI * 2 * rr;
    const anguloDe = (x: number, y: number) => { const a = Math.atan2(y, x); return a < 0 ? a + Math.PI * 2 : a; };
    const doAnel = portas.filter((p) => p.e.cx || p.e.cy);
    const centro = portas.find((p) => !p.e.cx && !p.e.cy);
    const aRaio = anguloRaio(arranjo, est.length);
    principal(rota, [...doAnel.map((p) => (anguloDe(p.e.cx, p.e.cy) / (Math.PI * 2)) * total), (aRaio / (Math.PI * 2)) * total], true);
    doAnel.forEach((p) => { const a = anguloDe(p.e.cx, p.e.cy); ramal([Math.cos(a) * rr, Math.sin(a) * rr, zc(0)], p.boca); });
    const naRoda: Point3 = [Math.cos(aRaio) * rr, Math.sin(aRaio) * rr, zc(0)];
    if (centro) ramal(naRoda, centro.boca);
    else { const saida: Point3 = [Math.cos(aRaio) * 26, Math.sin(aRaio) * 26, zc(0)]; bomba(P, saida, pus, false, aRaio); ramal(naRoda, saida); }
  }
  void base;
}

/** um berço de apoio sob o cano (dois montantes e a abraçadeira por cima) */
function berco(P: Projection, [x, y, z]: Point3, pus: (ref: Point3, svg: string, bias?: number) => void) {
  const svg = S(k.slabOf(ao(x, y, 4, 9, 0.6), z, 0.9, P, 3, 0.2), { tone: "lo" }) + S(k.slabOf(ao(x, y, 2.4, 7, 0.4), z + 0.9, 1.2, P, 2), { tone: "mid", crease: "none" });
  pus([x, y, z], svg, -1);
}

/** a BOMBA na origem do fluxo: base, motor com aletas (nervuras que somem na curva), luva, carcaça e flange de saída */
function bomba(P: Projection, saida: Point3, pus: (ref: Point3, svg: string, bias?: number) => void, vertical = false, ang = 0) {
  const dir: Point3 = vertical ? [0, 0, 1] : [Math.cos(ang), Math.sin(ang), 0];
  const o = G.add3(saida, G.mul3(dir, vertical ? -2 : -48)), Fm = vertical ? G.frameOf([saida[0] - 30, saida[1], 9], [1, 0, 0], [0, 1, 0], [0, 0, 1]) : G.frameAlong(o, dir);
  const out: string[] = [];
  if (vertical) {
    // na torre: a bomba deitada no chão, a saída subindo pelo cotovelo até o tubo
    const b = ao(saida[0] - 22, saida[1], 40, 16, 2);
    out.push(S(k.slabOf(b, 0, 3, P, 4, 0.5), { tone: "lo" }));
    out.push(S(G.solidOf([[0, 6.4], [2, 7], [22, 7], [24, 6.4]], Fm, P), { tone: "mid", inner: Ln(G.arcOf(Fm, 12, 7, P), { tone: "faint" }) }) + k.fadedSvg(G.ribsOf(Fm, 3, 21, 7.3, 18, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }));
    out.push(S(G.solidOf([[24, 3], [27, 3], [27, 8.4], [33, 8.4]], Fm, P), { tone: "hi" }));
    out.push(S(G.sphereOf([saida[0], saida[1], 9], 3.4, P), { tone: "mid" }));
    pus([saida[0] - 20, saida[1], 6], out.join(""), -2);
    return;
  }
  const pe = ao(o[0] + dir[0] * 22, o[1] + dir[1] * 22, Math.abs(dir[0]) > 0.7 ? 48 : 20, Math.abs(dir[0]) > 0.7 ? 18 : 48, 2);
  out.push(S(k.slabOf(pe, 0, 1.4, P, 4, 0.3), { tone: "lo" }));
  out.push(S(G.solidOf([[0, 0.01], [0.6, 4, 1], [2.4, 6.6, 1], [4, 7.2], [26, 7.2], [27.6, 6]], Fm, P), { tone: "mid", inner: Ln(G.arcOf(Fm, 4, 7.2, P), { tone: "faint" }) }) + k.fadedSvg(G.ribsOf(Fm, 4, 26, 7.5, 20, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }));
  out.push(S(G.disc(27.6, 31, 3, Fm, P), { tone: "mid" }));
  out.push(S(G.solidOf([[31, 8.6], [33, 9.4, 1], [38, 9.6, 1], [42, 8.6], [44, 4.4], [48, 4.4]], Fm, P), { tone: "hi" }));
  out.push(Dt(G.dotsOf(Fm, 33, 8, 8, P, { fade: [0.04, 0.42] }), { size: 0.42 }));
  pus(G.add3(o, G.mul3(dir, 20)), out.join(""), -2);
}
