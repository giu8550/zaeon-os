/**
 * Frota de IAs — os LUGARES no TEMPLO CÓSMICO (PURO): onde a turma fica em cada sala do complexo (out/2026, o dono: "no
 * lounge cósmico, a maior concentração — ao menos 300 divididos entre todas as salas, em grupos, com raras exceções
 * sozinhos; todos os espaços ocupados, o caminho do meio também; só não o da Examiner esperando quem vai pro teste").
 *  - RODAS de 2 a 5 lugares (cada roda é um grupo: em pé conversando, ou sentados no chão com o tablet), espalhadas pelo
 *    salão, pelos 3 andares dos lounges estudantis, pelo disco rasta, pela capela rasta, pelo salão de festas, pelos
 *    casais, pela base e pelo deck da torre — fora dos colisores de cada andar, do caminho das pontes, da chegada e da
 *    boca de saída do buraco negro;
 *  - as CABINES do campus e da torre (codar no computador) — menos as da Nina e do Téo.
 * O caminho a pé entre dois lugares (`caminhoNoTemplo`): pelas pontes e pelo hub na frente da pirâmide; nos andares de
 * cima dos lounges estudantis, pelo CARACOL; pra torre, de mochila (por fora).
 * Tudo no referencial do LAYOUT do lounge (o `templo.yRel` é a altura acima do pátio); o mundo pelo `daSala`.
 */
import { ALTURA_LOUNGE, CIDADE, daSala, mundo, naSala, rumoNaSala } from "../ceu";
import {
  ALTO_TI, ANDARES_ESTUDO, BOCA_SAIDA_SALAO, CABINES_TORRE, CABINE_TI, CAPELA_RASTA, CARACOL, CASAIS, CHEGADA_SALAO, CUBO_CYBER, CYBER, ESTACOES_TI,
  ARVORE_RASTA, FESTAS, PILARES_ALTO, PIRAMIDE, PLATS, POCOS_TC, PONTES, RASTA, SALAO, TEMPLO_RASTA, TORRE_TI, colisoresDaTorre, colisoresDoAndarEstudo,
  colisoresDoComplexo, daCabineTI, doEstudoLocal, naPiramide, solidosDoComplexo, type PlatTC,
} from "../temploCosmico";
import { acasoDe, entre } from "./aleatorio";
import type { Spot } from "./lugares";

type P2 = { x: number; z: number };
/** as SALAS do complexo onde a frota fica */
export type SalaTemplo = "salao" | "estudoL" | "estudoR" | "campus" | "torre" | "rasta" | "capelaRasta" | "festas" | "casais" | "lounge";
/** de onde é um lugar do Templo: a sala, a altura do piso acima do pátio e (lounges estudantis / torre) o andar */
export type NoTemplo = { sala: SalaTemplo; yRel: number; andar: number };
/** o lugar no Templo de um spot: a sala, o andar e o ponto no layout */
export type LugarNoTemplo = NoTemplo & { q: P2 };

const sala = CIDADE.salas.lounge;
const PISO = CIDADE.pisoY + ALTURA_LOUNGE;
/** layout → mundo (com a altura acima do pátio) */
export const doLayoutT = (q: P2, yRel: number) => ({ ...mundo(daSala(sala, q.x, q.z)), y: PISO + yRel });

/** quanto espaço livre cada lugar pede em volta (m) e a distância mínima entre rodas */
const FOLGA = 0.9, ENTRE_RODAS = 3.4;

const plat = (id: string) => PLATS.find((p) => p.id === id)!;
let colCache: { x: number; z: number; r: number }[] | null = null;
const colisoresBase = () => (colCache ??= colisoresDoComplexo(sala.r));
const livreDe = (q: P2, cs: readonly { x: number; z: number; r: number }[]) => cs.every((c) => Math.hypot(q.x - c.x, q.z - c.z) > c.r + FOLGA);
/** fora do caminho das PONTES (as faixas por onde se chega e se sai de cada plataforma, até 6 m pra dentro) */
function noCaminho(q: P2): boolean {
  for (const po of PONTES) for (const e of [po.a, po.b]) if (Math.hypot(q.x - e.x, q.z - e.z) < po.meia + 4.5) return true;
  return Math.abs(q.x - SALAO.x) < 5.5 && q.z < SALAO.z - SALAO.r + 2 && q.z > TORRE_TI.z + TORRE_TI.baseR - 2;   // o corredor do campus
}

/** as RODAS de uma área: sorteia centros (`ponto`) e põe 2–5 lugares em volta, virados pro centro; vale a roda inteira
 *  se todos os lugares estiverem livres (`ok`) */
/** a chance de uma roda ser SENTADA estudando (no chão com o tablet) — out/2026, o dono: "ao menos 80% da frota
 *  estudando constantemente, tem muitos personagens ociosos": as rodas de pé conversando viraram exceção */
export const SENTA_TEMPLO = 0.9;
function rodas(id: string, no: NoTemplo, n: number, ponto: (r: () => number) => P2, ok: (q: P2) => boolean, sentaChance = SENTA_TEMPLO): Spot[] {
  const r = acasoDe("templo-rodas", id), out: Spot[] = [], centros: P2[] = [];
  for (let t = 0, feitas = 0; t < n * 14 && feitas < n; t++) {
    const c = ponto(r); if (centros.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < ENTRE_RODAS)) continue;
    const k = 2 + Math.floor(r() * 4), raio = 0.75 + 0.22 * k, giro = r() * Math.PI * 2, senta = r() < sentaChance;
    const qs = Array.from({ length: k }, (_, j) => { const a = giro + (j / k) * Math.PI * 2; return { x: c.x + Math.cos(a) * raio, z: c.z + Math.sin(a) * raio }; });
    if (!ok(c) || !qs.every(ok)) continue;
    centros.push(c); feitas++;
    qs.forEach((q, j) => {
      const w = doLayoutT(q, no.yRel), rumo = rumoNaSala(sala, Math.atan2(c.x - q.x, c.z - q.z));
      out.push({ id: `templo-${id}-${feitas}-${j}`, ambiente: "lounge", tipo: senta ? "piso" : "pe", x: w.x, z: w.z, y: w.y, rumo, zaeon: true, templo: { ...no, q } });
    });
  }
  return out;
}
const noAnel = (c: P2, r0: number, r1: number) => (r: () => number): P2 => { const a = r() * Math.PI * 2, d = Math.sqrt(r0 * r0 + (r1 * r1 - r0 * r0) * r()); return { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d }; };

/** uma CABINE (a cadeira de frente pro monitor) do campus ou da torre */
function cabine(id: string, e: { x: number; z: number; rot?: number }, no: NoTemplo): Spot {
  const q = daCabineTI(e, 0, CABINE_TI.assentoZ), m = daCabineTI(e, 0, CABINE_TI.monitorZ), w = doLayoutT(q, no.yRel);
  return { id: `templo-${id}`, ambiente: "lounge", tipo: "cabine", x: w.x, z: w.z, y: w.y, rumo: rumoNaSala(sala, Math.atan2(m.x - q.x, m.z - q.z)), zaeon: true, templo: { ...no, q } };
}

/** quantas rodas no salão da pirâmide */
export const SALAO_RODAS = 4;
let cache: Spot[] | null = null;
/** todos os lugares da frota no Templo Cósmico (fora o disco do lounge — lib/cyber/frota/lugares) */
export function spotsDoTemplo(): Spot[] {
  if (cache) return cache;
  const cs = colisoresBase(), out: Spot[] = [];
  const basico = (q: P2) => livreDe(q, cs) && !noCaminho(q);
  // o SALÃO: só ALGUMAS rodas, coladas em volta da pirâmide (out/2026, o dono: "lá não é lugar pra ter muito fluxo") —
  // longe da chegada e da boca de saída do buraco negro
  const salao = plat("salao");
  out.push(...rodas("salao", { sala: "salao", yRel: salao.h, andar: 0 }, SALAO_RODAS, noAnel(SALAO, 15, 22), (q) => basico(q) && !naPiramide(q, 3) && Math.hypot(q.x - SALAO.x, q.z - SALAO.z) < SALAO.r - 2
    && Math.hypot(q.x - CHEGADA_SALAO.x, q.z - CHEGADA_SALAO.z) > 9 && Math.hypot(q.x - BOCA_SAIDA_SALAO.x, q.z - BOCA_SAIDA_SALAO.z) > 8));
  // os LOUNGES ESTUDANTIS: os 3 andares (no de cima e no do meio, fora do átrio e do guarda-corpo dele)
  for (const p of PLATS.filter((x) => x.id === "estudoL" || x.id === "estudoR")) for (let k = 0; k < ANDARES_ESTUDO.n; k++) {
    const doAndar = colisoresDoAndarEstudo(p, k);
    out.push(...rodas(`${p.id}-${k}`, { sala: p.id as SalaTemplo, yRel: p.h + k * ANDARES_ESTUDO.pe, andar: k }, 7, noAnel(p, CARACOL.r + 3, p.r - 3.5),
      (q) => basico(q) && livreDe(q, doAndar) && Math.hypot(q.x - p.x, q.z - p.z) > CARACOL.r + 2 && Math.hypot(q.x - p.x, q.z - p.z) < p.r - 2.6));
  }
  // o disco RASTA (em volta da árvore), a CAPELA rasta, o salão de FESTAS e os CASAIS (de dois em dois, no sofá redondo não)
  const em = (p: PlatTC, r0: number, r1: number, n: number, sentar = SENTA_TEMPLO) => out.push(...rodas(p.id, { sala: p.id as SalaTemplo, yRel: p.h, andar: 0 }, n, noAnel(p, r0, r1), (q) => basico(q) && Math.hypot(q.x - p.x, q.z - p.z) < p.r - 2.4, sentar));
  em(plat("rasta"), 12, RASTA.r - 4, 30); em(plat("capelaRasta"), 6, CAPELA_RASTA.r - 3, 8); em(plat("festas"), 5, FESTAS.r - 4, 9, 0.6); em(plat("casais"), 4.6, CASAIS.r - 2.4, 2, 1);
  void TEMPLO_RASTA;
  // a TORRE: rodas na BASE (em volta da coluna) e no DECK do topo (fora do cubo, dos pilares e das bocas das cápsulas)
  const fora = (q: P2, y: number) => POCOS_TC.every((po) => (po.de !== y && po.ate !== y) || Math.hypot(q.x - po.x, q.z - po.z) > po.r + 3.5);
  const c0 = colisoresDaTorre(0), c1 = colisoresDaTorre(1);
  out.push(...rodas("torre-base", { sala: "torre", yRel: -SALAO.desce, andar: 0 }, 9, noAnel(TORRE_TI, TORRE_TI.colR + 3, TORRE_TI.baseR - 2), (q) => basico(q) && livreDe(q, c0) && fora(q, -SALAO.desce) && q.z < TORRE_TI.z + 20));
  out.push(...rodas("torre-deck", { sala: "torre", yRel: CYBER.h, andar: 1 }, 10, noAnel(CYBER, CUBO_CYBER.meia * 1.6 + 2, CYBER.r - 2.5), (q) => livreDe(q, c1) && fora(q, CYBER.h)
    && PILARES_ALTO.every((pl) => Math.hypot(q.x - pl.x, q.z - pl.z) > 2) && !CABINES_TORRE.some((c) => c.nivel === 1 && Math.hypot(q.x - c.x, q.z - c.z) < 3.2)));
  // CODAR: as cabines do campus (em baixo) e as da torre (no topo e no mirante — as da Nina e do Téo, não)
  ESTACOES_TI.forEach((e, k) => out.push(cabine(`campus-${k}`, e, { sala: "campus", yRel: -SALAO.desce, andar: 0 })));
  for (const c of CABINES_TORRE) if (!c.quem) out.push(cabine(c.id, c, { sala: "torre", yRel: c.y, andar: c.nivel }));
  void PIRAMIDE; void ALTO_TI;
  return (cache = out);
}

/** o HUB (na frente da pirâmide, no salão): todo caminho a pé entre salas passa por ele */
const HUB = { x: SALAO.x, z: SALAO.z + 22 };
/** o caminho do hub até a ENTRADA de cada sala (layout, no piso de cada trecho) — as pontes, as escadas */
function entradaDe(s: SalaTemplo): { q: P2; y: number }[] {
  const ponte = (id: string) => PONTES.find((p) => p.id === id)!, salaoY = -SALAO.desce;
  switch (s) {
    case "salao": return [];
    case "lounge": { const p = ponte("lounge"); return [{ q: p.a, y: p.ha }, { q: p.b, y: p.hb }]; }   // (o disco do lounge cósmico: pela escada)
    case "estudoL": case "estudoR": { const p = ponte(s); return [{ q: p.a, y: salaoY }, { q: p.b, y: salaoY }]; }
    case "campus": case "torre": return [{ q: { x: SALAO.x + 16, z: SALAO.z + 12 }, y: salaoY }, { q: { x: SALAO.x + 16, z: SALAO.z - 20 }, y: salaoY }, { q: { x: SALAO.x + 3, z: SALAO.z - SALAO.r + 6 }, y: salaoY }, { q: { x: SALAO.x, z: SALAO.z - SALAO.r - 4 }, y: salaoY }];   // (pelo lado da pirâmide e pelo meio da boca do campus)
    case "rasta": case "capelaRasta": case "festas": case "casais": {
      const r = ponte("rasta"), out = [{ q: r.a, y: r.ha }, { q: r.b, y: r.hb }];
      if (s === "rasta") return out;
      // (a escadaria das raízes até a capela rasta: de mochila — o trecho seguinte é um salto)
      const cap = plat("capelaRasta"), fe = ponte("festas"), ca = ponte("casais");
      out.push({ q: { x: cap.x + 4, z: cap.z + 4 }, y: cap.h });
      if (s === "capelaRasta") return out;
      out.push({ q: fe.a, y: fe.ha }, { q: fe.b, y: fe.hb });
      if (s === "festas") return out;
      out.push({ q: ca.a, y: ca.ha }, { q: ca.b, y: ca.hb });
      return out;
    }
  }
}
/** dentro da sala, da entrada até o lugar (sem ele): no CAMPUS, pelo corredor do meio e pela faixa atrás da fileira da
 *  cabine; na BASE da torre, pelo corredor e em volta da coluna (no meio do anel) */
function interno(no: NoTemplo, q: P2): { q: P2; y: number }[] {
  const y = -SALAO.desce;
  if (no.sala === "campus") return [{ q: { x: SALAO.x, z: q.z + 1.25 }, y }, { q: { x: q.x, z: q.z + 1.25 }, y }];
  if (no.sala === "torre" && no.andar === 0) {
    const R = (TORRE_TI.colR + TORRE_TI.baseR) / 2 + 0.5, a0 = Math.PI / 2, a1 = Math.atan2(q.z - TORRE_TI.z, q.x - TORRE_TI.x);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const out: { q: P2; y: number }[] = [{ q: { x: SALAO.x, z: TORRE_TI.z + TORRE_TI.baseR - 2 }, y }];
    for (let k = 0; k <= 8; k++) { const a = a0 + (da * k) / 8; out.push({ q: { x: TORRE_TI.x + Math.cos(a) * R, z: TORRE_TI.z + Math.sin(a) * R }, y }); }
    return out;
  }
  return [];
}
/** o caminho no CARACOL de um lounge estudantil, do térreo até o `andar` (pontos no layout com a altura) */
function subidaDoCaracol(p: PlatTC, andar: number): { q: P2; y: number }[] {
  const out: { q: P2; y: number }[] = [], R = (CARACOL.r + CARACOL.col) / 2, aE = CARACOL.boca + CARACOL.abre / 2;
  out.push({ q: doEstudoLocal(p, { x: Math.cos(aE) * (CARACOL.r + 2.2), z: Math.sin(aE) * (CARACOL.r + 2.2) }), y: p.h });   // (entra no átrio pelo vão do térreo)
  for (let f = 0; f <= andar; f += 1 / 8) { const a = CARACOL.boca + f * Math.PI * 2; out.push({ q: doEstudoLocal(p, { x: Math.cos(a) * R, z: Math.sin(a) * R }), y: p.h + f * ANDARES_ESTUDO.pe }); }
  const a = CARACOL.boca + andar * Math.PI * 2;   // (sai do átrio pela boca do andar)
  out.push({ q: doEstudoLocal(p, { x: Math.cos(a) * (CARACOL.r + 2.2), z: Math.sin(a) * (CARACOL.r + 2.2) }), y: p.h + andar * ANDARES_ESTUDO.pe });
  return out;
}
/** contorna a PIRÂMIDE (no salão): um trecho reto que passaria por ela ganha os cantos dela (o lado mais curto) */
function contornarPiramide(pts: { q: P2; y: number }[]): { q: P2; y: number }[] {
  const m = PIRAMIDE.meia + 3.5, cantos = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => ({ x: PIRAMIDE.x + sx! * m, z: PIRAMIDE.z + sz! * m }));
  const corta = (a: P2, b: P2) => { for (let u = 0; u <= 1; u += 0.02) if (naPiramide({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u }, 1.5)) return true; return false; };
  const out = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = out.at(-1)!, b = pts[i]!;
    if (Math.abs(a.y + SALAO.desce) > 0.5 || Math.abs(b.y + SALAO.desce) > 0.5 || !corta(a.q, b.q)) { out.push(b); continue; }
    // as voltas possíveis: por 1 canto ou por 2 cantos vizinhos; a mais curta que não corta
    let melhor: P2[] | null = null, ml = Infinity;
    const comp = (via: P2[]) => [a.q, ...via, b.q].reduce((s, p, k, l) => (k ? s + Math.hypot(p.x - l[k - 1]!.x, p.z - l[k - 1]!.z) : 0), 0);
    for (let k = 0; k < 4; k++) for (const via of [[cantos[k]!], [cantos[k]!, cantos[(k + 1) % 4]!], [cantos[(k + 1) % 4]!, cantos[k]!]]) {
      const l = [a.q, ...via, b.q]; if (l.slice(1).some((p, j) => corta(l[j]!, p))) continue;
      const c = comp(via); if (c < ml) { ml = c; melhor = via; }
    }
    for (const q of melhor ?? []) out.push({ q, y: a.y });
    out.push(b);
  }
  return out;
}
/** os REDONDOS que o caminho contorna: o átrio de cada lounge estudantil (o caracol, e lá em cima o vão) e o tronco da
 *  árvore rasta */
const REDONDOS: readonly (P2 & { r: number })[] = [
  ...PLATS.filter((p) => p.id === "estudoL" || p.id === "estudoR").map((p) => ({ x: p.x, z: p.z, r: CARACOL.r + 1.4 })),
  { x: RASTA.x, z: RASTA.z, r: ARVORE_RASTA.r + 2.6 },
];
/** contorna os redondos: um trecho que passaria por dentro de um ganha pontos no arco dele (pelo lado mais curto) */
function contornarRedondos(pts: { q: P2; y: number }[], livres: ReadonlySet<P2 & { r: number }>): { q: P2; y: number }[] {
  const out = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = out.at(-1)!, b = pts[i]!;
    const dentro = (p: P2, c: P2 & { r: number }) => Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.3;
    const c = REDONDOS.find((c) => !livres.has(c) && !dentro(a.q, c) && !dentro(b.q, c) && (() => { for (let u = 0.02; u < 0.98; u += 0.02) if (Math.hypot(a.q.x + (b.q.x - a.q.x) * u - c.x, a.q.z + (b.q.z - a.q.z) * u - c.z) < c.r) return true; return false; })());
    if (c) {
      const a0 = Math.atan2(a.q.z - c.z, a.q.x - c.x), a1 = Math.atan2(b.q.z - c.z, b.q.x - c.x);
      let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const R = c.r + 0.6, n = Math.max(2, Math.ceil(Math.abs(da) / 0.35));
      for (let k = 1; k < n; k++) { const ang = a0 + (da * k) / n, t = k / n; out.push({ q: { x: c.x + Math.cos(ang) * R, z: c.z + Math.sin(ang) * R }, y: a.y + (b.y - a.y) * t }); }
    }
    out.push(b);
  }
  return out;
}
/** um trecho do caminho: os pontos no MUNDO e se é um SALTO de mochila (a escadaria das raízes, a torre) */
export type TrechoTemplo = { pts: { x: number; y: number; z: number }[]; salto: boolean };
/** o caminho de um lugar do Templo a outro: desce do andar (o caracol), sai da sala até o hub e entra na outra; quem vai
 *  pro alto da torre ou pra capela rasta dá um SALTO de mochila no meio */
export function caminhoNoTemplo(de: { q: P2; no: NoTemplo }, para: { q: P2; no: NoTemplo }): TrechoTemplo[] {
  const trechos: TrechoTemplo[] = []; let atual: { q: P2; y: number }[] = [{ q: de.q, y: de.no.yRel }];
  const noCaracol = new Set<P2 & { r: number }>();   // (os pontos do caracol ficam DENTRO do átrio de propósito: o trecho que entra ou sai dele não contorna)
  const fecha = (salto: boolean, ate?: { q: P2; y: number }) => { if (ate) atual.push(ate); if (atual.length > 1) trechos.push({ pts: (salto ? atual : contornarRedondos(contornarPiramide(atual), noCaracol)).map((p) => doLayoutT(p.q, p.y)), salto }); atual = ate ? [ate] : [atual.at(-1)!]; };
  const mesmaSala = de.no.sala === para.no.sala;
  // SAINDO: do alto da torre, um salto até a base; dos andares de cima, o caracol de volta
  if (de.no.sala === "torre" && de.no.andar > 0) { fecha(false); fecha(true, { q: { x: TORRE_TI.x, z: TORRE_TI.z + TORRE_TI.baseR + 3 }, y: -SALAO.desce }); }
  else if ((de.no.sala === "estudoL" || de.no.sala === "estudoR") && de.no.andar > 0 && !(mesmaSala && para.no.andar === de.no.andar)) atual.push(...subidaDoCaracol(plat(de.no.sala), de.no.andar).reverse());
  else atual.push(...interno(de.no, de.q).reverse());
  if (!mesmaSala) {
    const ida = entradaDe(de.no.sala), volta = entradaDe(para.no.sala);
    for (const p of [...ida].reverse()) { if (Math.abs(p.y - atual.at(-1)!.y) > 4) fecha(true, p); else atual.push(p); }   // (um desnível grande — a escadaria das raízes: salto)
    atual.push({ q: HUB, y: -SALAO.desce });
    for (const p of volta) { if (Math.abs(p.y - atual.at(-1)!.y) > 4) fecha(true, p); else atual.push(p); }
  }
  // ENTRANDO: o caracol até o andar; o salto até o alto da torre
  if ((para.no.sala === "estudoL" || para.no.sala === "estudoR") && para.no.andar > 0 && !(mesmaSala && de.no.andar === para.no.andar)) atual.push(...subidaDoCaracol(plat(para.no.sala), para.no.andar));
  if (para.no.sala === "torre" && para.no.andar > 0) { atual.push({ q: { x: TORRE_TI.x, z: TORRE_TI.z + TORRE_TI.baseR + 3 }, y: -SALAO.desce }); fecha(false); fecha(true, { q: para.q, y: para.no.yRel }); }
  else atual.push(...interno(para.no, para.q), { q: para.q, y: para.no.yRel });
  fecha(false);
  return trechos;
}
/** o LUGAR no Templo de um ponto do mundo que é do disco do LOUNGE CÓSMICO (os assentos e o chão do pátio) */
export const noDiscoDoLounge = (w: { x: number; y: number; z: number }): LugarNoTemplo => ({ sala: "lounge", yRel: w.y - PISO, andar: 0, q: noLayout(w) });
/** o ponto de CHEGADA de quem sai do buraco negro no Templo e a BOCA da saída (no salão) como lugares */
export const CHEGADA_NO_TEMPLO: LugarNoTemplo = { sala: "salao", yRel: -SALAO.desce, andar: 0, q: { x: CHEGADA_SALAO.x, z: CHEGADA_SALAO.z } };
export const BOCA_NO_TEMPLO: LugarNoTemplo = { sala: "salao", yRel: -SALAO.desce, andar: 0, q: { x: BOCA_SAIDA_SALAO.x, z: BOCA_SAIDA_SALAO.z } };
/** onde quem chega de MOTO pelo buraco negro POUSA no salão (um ponto livre do anel, longe da chegada a pé) */
export function pousoNoSalao(r: () => number): LugarNoTemplo {
  const cs = colisoresBase();
  for (let t = 0; t < 30; t++) {
    const a = Math.PI * 0.15 + r() * Math.PI * 0.7, d = 18 + r() * 22, q = { x: SALAO.x + Math.cos(a) * d, z: SALAO.z + Math.sin(a) * d };
    if (livreDe(q, cs) && !naPiramide(q, 3) && Math.hypot(q.x - CHEGADA_SALAO.x, q.z - CHEGADA_SALAO.z) > 9 && !noCaminho(q)) return { sala: "salao", yRel: -SALAO.desce, andar: 0, q };
  }
  return { ...CHEGADA_NO_TEMPLO, q: { x: SALAO.x + 20, z: SALAO.z + 20 } };
}
/** o céu LIVRE em cima de um ponto (nenhuma laje, cobertura, cúpula ou teto acima) — pra moto descer na vertical */
function ceuLivre(q: P2, yRel: number): boolean {
  return solidosDoComplexo().every((o) => Math.hypot(q.x - o.x, q.z - o.z) > o.r + 2.5 || o.topo <= yRel + 0.3);
}
/** onde a moto POUSA perto de um lugar do Templo (out/2026, o dono: "qualquer lugar pode servir de estacionamento — as
 *  motos não ficam só no salão principal"): um chão aberto (céu livre) da área de quem chega — o salão (pros que vão
 *  pro salão, pros lounges estudantis e pro lounge cósmico, do lado da ponte deles), o disco rasta (rasta, capela,
 *  festas, casais), a beirada do campus (na altura da cabine), a base ou o deck da torre — fora dos colisores e do
 *  caminho das pontes */
export function pousoPerto(l: LugarNoTemplo | undefined, r: () => number): LugarNoTemplo {
  const cs = colisoresBase(), y0 = -SALAO.desce;
  const bom = (q: P2, y: number, extra: readonly { x: number; z: number; r: number }[] = []) => livreDe(q, cs) && livreDe(q, extra) && !noCaminho(q) && !naPiramide(q, 4) && ceuLivre(q, y)
    && Math.hypot(q.x - CHEGADA_SALAO.x, q.z - CHEGADA_SALAO.z) > 9 && Math.hypot(q.x - BOCA_SAIDA_SALAO.x, q.z - BOCA_SAIDA_SALAO.z) > 8;
  const tenta = (ponto: () => P2, y: number, sala: SalaTemplo, andar = 0, extra: readonly { x: number; z: number; r: number }[] = []): LugarNoTemplo | null => {
    for (let t = 0; t < 40; t++) { const q = ponto(); if (bom(q, y, extra)) return { sala, yRel: y, andar, q }; }
    return null;
  };
  const noSalaoPara = (alvo: P2) => { const a0 = Math.atan2(alvo.z - SALAO.z, alvo.x - SALAO.x); return () => { const a = a0 + (r() - 0.5) * 1.2, d = 20 + r() * 24; return { x: SALAO.x + Math.cos(a) * d, z: SALAO.z + Math.sin(a) * d }; }; };
  let p: LugarNoTemplo | null = null;
  switch (l?.sala) {
    case "rasta": case "capelaRasta": case "festas": case "casais": { const R = plat("rasta"); p = tenta(() => { const a = r() * Math.PI * 2, d = 14 + r() * (R.r - 20); return { x: R.x + Math.cos(a) * d, z: R.z + Math.sin(a) * d }; }, R.h, "rasta"); break; }
    // (no CAMPUS: entre duas colunas de cabines, no meio do vão entre as fileiras — a beirada é dos racks)
    case "campus": { const e = ESTACOES_TI.reduce((m, x) => (Math.abs(x.z - l.q.z) < Math.abs(m.z - l.q.z) ? x : m)); p = tenta(() => ({ x: SALAO.x + (r() < 0.5 ? -1 : 1) * (r() < 0.5 ? 14.5 : 21.5), z: e.z + (r() < 0.5 ? -4.5 : 4.5) }), y0, "campus"); break; }
    // (a BASE da torre fica embaixo do deck: pousa no fim do campus, na frente dela)
    case "torre": if (l.andar === 0) { p = tenta(() => ({ x: SALAO.x + (r() < 0.5 ? -1 : 1) * (r() < 0.5 ? 14.5 : 21.5), z: ESTACOES_TI.at(-1)!.z - 4.5 }), y0, "campus"); break; }
      p = tenta(() => { const a = r() * Math.PI * 2, d = ALTO_TI.rOut + 4 + r() * (CYBER.r - ALTO_TI.rOut - 6.5); return { x: CYBER.x + Math.cos(a) * d, z: CYBER.z + Math.sin(a) * d }; }, CYBER.h, "torre", 1, colisoresDaTorre(1));
      break;
    default: p = l && l.sala !== "salao" ? tenta(noSalaoPara(l.q), y0, "salao") : null;
  }
  return p ?? pousoNoSalao(r);
}
/** a altura (acima do pátio) em que a moto CRUZA o Templo de `a` até `b`: acima de tudo que fica no caminho (a torre, as
 *  cúpulas, as lajes — com folga), e nunca abaixo de 22 m sobre o mais alto dos dois pontos */
export function cruzeiroNoTemplo(a: P2, b: P2, yA: number, yB: number): number {
  let topo = Math.max(yA, yB) + 22;
  const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  for (const o of solidosDoComplexo()) {
    const u = Math.max(0, Math.min(1, ((o.x - a.x) * (b.x - a.x) + (o.z - a.z) * (b.z - a.z)) / (L * L)));
    if (Math.hypot(a.x + (b.x - a.x) * u - o.x, a.z + (b.z - a.z) * u - o.z) < o.r + 6) topo = Math.max(topo, o.topo + 14);
  }
  return topo;
}
/** um ponto do mundo no layout do Templo */
export const noLayout = (w: P2): P2 => naSala(sala, w.x - CIDADE.centro.x, w.z - CIDADE.centro.z);
void entre;
