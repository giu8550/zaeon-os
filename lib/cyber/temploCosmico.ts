/**
 * Cyberespaço — o TEMPLO CÓSMICO (PURO, sem three e SEM importar o ceu — como lib/cyber/templo: tudo no referencial
 * da SALA do lounge, o mesmo do layout de sempre; o ESPELHO mora no ceu `daSala`/`naSala`). Pedido do dono (out/2026,
 * docs/superpowers/specs/2026-10-20-templo-cosmico-design.md): quem chega pelo buraco negro aparece num SALÃO central
 * e vê, no meio dele, um MONUMENTO ALIENÍGENA em forma de pirâmide; dos lados, conexões subindo pras plataformas mais
 * altas e mais pra fora — à ESQUERDA, o Lounge Cósmico (o lounge de sempre, espelhado); à DIREITA, o Lounge Rasta; e,
 * atrás da pirâmide, na mesma linha, o CAMINHO DO MEIO.
 *
 * No referencial do layout, o salão fica no −x do lounge (onde era a garagem): com o espelho, isso é a DIREITA dele no
 * mundo — então, pra quem chega no salão olhando pra frente (o −z), o lounge fica à esquerda.
 *
 * O LOUNGE RASTA é o lounge espelhado em torno do salão (`ESP`: x → −400 − x): o disco dele, a mesma escadaria
 * tortuosa (com RAÍZES verdes no lugar da muralha-veia) e, lá em cima, a plataforma da capela MAIOR — e dela o SALÃO
 * DE FESTAS, a TORRE e o LOUNGE PRIVATIVO dos casais. Tudo vira uma REDE de plataformas (`PLATS`) e pontes (`PONTES`):
 * o piso, os guarda-corpos (com as aberturas onde as pontes encostam) e os sólidos saem dela.
 */
import { DECK, ESCADARIA, TEMPLO, alturaDaEscadaria, bordasDaEscadaria, curvaDaEscadaria, noCorredorDaEscadaria } from "./templo";

type P2 = { x: number; z: number };

/** o espelho que leva o LOUNGE (e tudo do layout dele) pro lado RASTA: em torno do x do salão */
export const X_ESPELHO_RASTA = -400;
export const ESP = (p: P2): P2 => ({ x: X_ESPELHO_RASTA - p.x, z: p.z });

/** o SALÃO central: centro, raio e quantos metros ABAIXO do pátio do lounge fica o piso dele (os braços sobem) */
export const SALAO = { x: -200, z: 40, r: 48, desce: 14, colR: 0.6, passo: 1 } as const;
/** o MONUMENTO ALIENÍGENA no meio do salão (no lugar do palco): a pirâmide — meia-base e altura */
export const PIRAMIDE = { x: SALAO.x, z: SALAO.z - 4, meia: 10, alt: 24, colR: 0.7, passo: 1.4 } as const;
/** a PONTE do salão até o pátio do lounge: sai da borda do salão (`a`) e chega na borda do lounge (`b`, no raio 70),
 *  subindo `SALAO.desce` m; `meia` = meia-largura */
export const PONTE_LOUNGE = { a: { x: -153.5, z: 32 }, b: { x: -65, z: 26 }, meia: 4.5, colR: 0.5, passo: 0.8 } as const;
/** onde quem chega aparece (na frente do salão, olhando pra pirâmide: o −z) e a BOCA da pista de saída (lib/cyber/
 *  fiosCosmicos — longe o bastante da chegada pra não pegar quem acabou de chegar) */
export const CHEGADA_SALAO = { x: SALAO.x, z: SALAO.z + 33, rumo: Math.PI } as const;
export const BOCA_SAIDA_SALAO = { x: SALAO.x - 27, z: SALAO.z + 31 } as const;

// ───────────── o LOUNGE RASTA (o espelho do lounge em torno do salão) ─────────────
/** o disco do lounge rasta (o mesmo tamanho do lounge, no mesmo nível do pátio) */
export const RASTA = { ...ESP({ x: 0, z: 0 }), r: 70 } as const;
/** a plataforma lá em cima (onde a escadaria das raízes chega): a CAPELA MAIOR — no lugar do templo do lounge, espelhado */
export const TEMPLO_RASTA = { ...ESP(TEMPLO), r: TEMPLO.r, h: TEMPLO.h } as const;
/** a capela maior (raio, altura dos pilares, pilares) */
export const CAPELA_RASTA = { r: 27, altura: 26, pilares: 20, pilarR: 1.2 } as const;
/** o SALÃO DE FESTAS (mais pra fora, no mesmo nível da capela) e o LOUNGE PRIVATIVO dos casais (mais acima) */
export const FESTAS = { x: TEMPLO_RASTA.x - 66, z: TEMPLO_RASTA.z - 66, r: 24, h: TEMPLO.h } as const;
export const CASAIS = { x: FESTAS.x - 30, z: FESTAS.z - 72, r: 12, h: TEMPLO.h + 14 } as const;
/** a ÁRVORE DA VIDA no meio do disco rasta: o raio do tronco (sólido) e até onde ele sobe (a copa por cima) */
export const ARVORE_RASTA = { r: 4.8, alt: 30 } as const;
/** a TORRE (moderna, futurista) na borda do salão de festas: o pé (sólido) e a altura acima do piso dele */
export const TORRE_RASTA = { x: FESTAS.x - 15, z: FESTAS.z + 14, r: 4, alt: 72 } as const;

// ───────────── o CAMINHO DO MEIO: reto, atrás da pirâmide, e a escadaria subindo pro monumento da CYBER ROOM ─────────────
/** o monumento (mais sinistro que a pirâmide): a plataforma dele, bem acima do lounge, na linha da pirâmide */
export const CYBER = { x: SALAO.x, z: SALAO.z - 255, r: 30, h: 40 } as const;
/** o NÚCLEO do monumento (sólido: a sala ainda está fechada — o resto do caminho do meio vem depois) */
export const NUCLEO_CYBER = { r: 11, alt: 52 } as const;
/** onde o caminho reto acaba e a escadaria começa (z) e a meia-largura dos dois */
export const MEIO = { zEscada: SALAO.z - 150, meia: 5 } as const;

// ───────────── a REDE: plataformas e pontes ─────────────
export type PlatTC = { id: string; x: number; z: number; r: number; /** piso acima do pátio do lounge */ h: number };
export type PonteTC = { id: string; a: P2; b: P2; /** piso nas pontas */ ha: number; hb: number; meia: number };
export const PLATS: readonly PlatTC[] = [
  { id: "salao", x: SALAO.x, z: SALAO.z, r: SALAO.r, h: -SALAO.desce },
  { id: "rasta", x: RASTA.x, z: RASTA.z, r: RASTA.r, h: 0 },
  { id: "capelaRasta", x: TEMPLO_RASTA.x, z: TEMPLO_RASTA.z, r: TEMPLO_RASTA.r, h: TEMPLO_RASTA.h },
  { id: "festas", x: FESTAS.x, z: FESTAS.z, r: FESTAS.r, h: FESTAS.h },
  { id: "casais", x: CASAIS.x, z: CASAIS.z, r: CASAIS.r, h: CASAIS.h },
  { id: "cyber", x: CYBER.x, z: CYBER.z, r: CYBER.r, h: CYBER.h },
];
/** uma ponte reta entre duas plataformas (de borda a borda, na linha dos centros) */
function entre(id: string, p: PlatTC, q: PlatTC, meia: number): PonteTC {
  const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
  return { id, a: { x: p.x + ux * (p.r - 1.5), z: p.z + uz * (p.r - 1.5) }, b: { x: q.x - ux * (q.r - 1.5), z: q.z - uz * (q.r - 1.5) }, ha: p.h, hb: q.h, meia };
}
const plat = (id: string) => PLATS.find((p) => p.id === id)!;
export const PONTES: readonly PonteTC[] = [
  { id: "lounge", a: PONTE_LOUNGE.a, b: PONTE_LOUNGE.b, ha: -SALAO.desce, hb: 0, meia: PONTE_LOUNGE.meia },
  { id: "rasta", a: ESP(PONTE_LOUNGE.a), b: ESP(PONTE_LOUNGE.b), ha: -SALAO.desce, hb: 0, meia: PONTE_LOUNGE.meia },
  entre("festas", plat("capelaRasta"), plat("festas"), 4),
  entre("casais", plat("festas"), plat("casais"), 2.6),
  { id: "meio", a: { x: SALAO.x, z: SALAO.z - SALAO.r + 1.5 }, b: { x: SALAO.x, z: MEIO.zEscada }, ha: -SALAO.desce, hb: -SALAO.desce, meia: MEIO.meia },
  { id: "escadaMeio", a: { x: SALAO.x, z: MEIO.zEscada }, b: { x: CYBER.x, z: CYBER.z + CYBER.r - 1.5 }, ha: -SALAO.desce, hb: CYBER.h, meia: MEIO.meia },
];
const COL = { r: 0.6, passo: 1, ponte: 0.5, ponteP: 0.8 } as const;

export function naPonte(p: PonteTC, q: P2, folga = 0): { u: number; lat: number } | null {
  const vx = p.b.x - p.a.x, vz = p.b.z - p.a.z, L = Math.hypot(vx, vz);
  const t = ((q.x - p.a.x) * vx + (q.z - p.a.z) * vz) / (L * L), lat = ((q.x - p.a.x) * vz - (q.z - p.a.z) * vx) / L;
  if (t < -folga / L || t > 1 + folga / L || Math.abs(lat) > p.meia + folga) return null;
  return { u: Math.max(0, Math.min(1, t)), lat };
}
export const naPlat = (p: PlatTC, q: P2, folga = 0) => Math.hypot(q.x - p.x, q.z - p.z) <= p.r + folga;
/** a escadaria das RAÍZES (a do lounge, espelhada): onde nela `q` está (só o trecho fora do disco rasta e da capela) */
export function naEscadariaRasta(q: P2, folga = 0): { s: number; lat: number } | null {
  const r = ESP(q);
  if (Math.hypot(r.x, r.z) < 69 || Math.hypot(r.x - TEMPLO.x, r.z - TEMPLO.z) < TEMPLO.r - 1) return null;
  if (r.x < 40 || r.z > 0) return null;   // (o mesmo recorte do lounge: a escadaria fica no quadrante do templo)
  return noCorredorDaEscadaria(r, folga);
}
/** a altura da escadaria rasta (acima do pátio) a `s` m do começo: sobe do PISO do disco rasta (não há deck) até a capela */
export const alturaDaEscadariaRasta = (s: number) => ((alturaDaEscadaria(s) - DECK.h) / (TEMPLO.h - DECK.h)) * TEMPLO_RASTA.h;

export const noSalao = (q: P2, folga = 0) => naPlat(PLATS[0]!, q, folga);
export const naPonteLounge = (q: P2, folga = 0) => naPonte(PONTES[0]!, q, folga);
/** está no complexo do Templo Cósmico FORA do disco do lounge (o salão, os braços, as pontes e a escadaria rasta)? */
export const noComplexo = (q: P2, folga = 0) => PLATS.some((p) => naPlat(p, q, folga)) || PONTES.some((p) => naPonte(p, q, folga) !== null) || naEscadariaRasta(q, folga) !== null;
/** até onde (m, do centro do lounge) o complexo vai — o ceu nem calcula além disso */
export const ALCANCE_COMPLEXO = Math.max(...PLATS.map((p) => Math.hypot(p.x, p.z) + p.r)) + 20;
/** a altura do piso (acima do PÁTIO do lounge — negativa no salão) num ponto do complexo, ou null fora dele */
export function alturaNoComplexo(q: P2): number | null {
  for (const p of PONTES) { const n = naPonte(p, q); if (n) return p.ha + (p.hb - p.ha) * n.u; }
  for (const p of PLATS) if (naPlat(p, q)) return p.h;
  const e = naEscadariaRasta(q); if (e) return alturaDaEscadariaRasta(e.s);
  return null;
}
/** dentro da base da pirâmide (não se anda: é sólida)? */
export const naPiramide = (q: P2, folga = 0) => Math.abs(q.x - PIRAMIDE.x) <= PIRAMIDE.meia + folga && Math.abs(q.z - PIRAMIDE.z) <= PIRAMIDE.meia + folga;

/** a abertura na parede do LOUNGE onde a ponte chega (ângulo no referencial da sala e a meia-abertura, rad) */
export const entradaDaPonteNoLounge = (r: number) => ({ ang: Math.atan2(PONTE_LOUNGE.b.z, PONTE_LOUNGE.b.x), meia: (PONTE_LOUNGE.meia + 0.9) / r });
/** as aberturas na borda de uma plataforma (ângulo no referencial dela): onde as pontes encostam e, no disco rasta e na
 *  capela rasta, onde a escadaria das raízes sai/chega */
export function aberturasDe(p: PlatTC): { ang: number; meia: number }[] {
  const out: { ang: number; meia: number }[] = [];
  for (const po of PONTES) for (const e of [po.a, po.b]) if (Math.abs(Math.hypot(e.x - p.x, e.z - p.z) - p.r) < 3) out.push({ ang: Math.atan2(e.z - p.z, e.x - p.x), meia: (po.meia + 0.9) / p.r });
  const C = ESCADARIA.controle;
  if (p.id === "rasta") { const s = ESP(C[0]!); out.push({ ang: Math.atan2(s.z - p.z, s.x - p.x), meia: (ESCADARIA.meia + 0.9) / p.r }); }
  if (p.id === "capelaRasta") { const s = ESP(C[C.length - 2]!); out.push({ ang: Math.atan2(s.z - p.z, s.x - p.x), meia: (ESCADARIA.meia + 0.9) / p.r }); }
  return out;
}
export const aberturasDoSalao = () => aberturasDe(PLATS[0]!);
const dentroDe = (ang: number, ab: { ang: number; meia: number }) => { let d = ang - ab.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) < ab.meia; };

/** os COLISORES (referencial do lounge) do complexo: o guarda-corpo de cada plataforma (menos as aberturas), os das
 *  pontes (dos dois lados, fora das plataformas e do lounge), a escadaria das raízes, a base da PIRÂMIDE, os pilares
 *  da capela maior e o pé da TORRE */
export function colisoresDoComplexo(rLounge: number): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (const p of PLATS) {
    const abs = aberturasDe(p), n = Math.ceil((2 * Math.PI * p.r) / COL.passo);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; if (abs.some((ab) => dentroDe(a, ab))) continue; out.push({ x: p.x + Math.cos(a) * p.r, z: p.z + Math.sin(a) * p.r, r: COL.r }); }
  }
  for (const po of PONTES) {
    const vx = po.b.x - po.a.x, vz = po.b.z - po.a.z, L = Math.hypot(vx, vz), nx = vz / L, nz = -vx / L;
    for (let s = 0; s <= L; s += COL.ponteP) for (const lado of [-1, 1]) {
      const c = { x: po.a.x + (vx * s) / L + nx * (po.meia + COL.ponte) * lado, z: po.a.z + (vz * s) / L + nz * (po.meia + COL.ponte) * lado };
      if (PLATS.some((p) => naPlat(p, c, -0.5)) || Math.hypot(c.x, c.z) < rLounge - 0.5) continue;
      out.push({ ...c, r: COL.ponte });
    }
  }
  for (const c of bordasDaEscadaria(RASTA.r)) out.push({ ...ESP(c), r: 0.5 });   // a escadaria das raízes (a do lounge, espelhada)
  const P = PIRAMIDE;
  for (let k = -P.meia; k <= P.meia; k += P.passo) for (const [x, z] of [[k, -P.meia], [k, P.meia], [-P.meia, k], [P.meia, k]] as const) out.push({ x: P.x + x, z: P.z + z, r: P.colR });
  const C = CAPELA_RASTA;
  for (let i = 0; i < C.pilares; i++) { const a = (i / C.pilares) * Math.PI * 2 + Math.PI / C.pilares; out.push({ x: TEMPLO_RASTA.x + Math.cos(a) * C.r, z: TEMPLO_RASTA.z + Math.sin(a) * C.r, r: C.pilarR + 0.2 }); }
  out.push({ x: RASTA.x, z: RASTA.z, r: ARVORE_RASTA.r });
  out.push({ x: CYBER.x, z: CYBER.z, r: NUCLEO_CYBER.r + 0.5 });   // o NÚCLEO do monumento da Cyber Room (fechado, por ora)   // o tronco da ÁRVORE DA VIDA no meio do disco rasta
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; out.push({ x: TORRE_RASTA.x + Math.cos(a) * TORRE_RASTA.r, z: TORRE_RASTA.z + Math.sin(a) * TORRE_RASTA.r, r: 0.8 }); }
  return out;
}
/** os SÓLIDOS de voo do complexo (referencial do lounge; `topo`/`base` acima do pátio): as lajes, a pirâmide, a capela
 *  maior e a torre */
export function solidosDoComplexo(): { x: number; z: number; r: number; topo: number; base: number }[] {
  return [
    ...PLATS.map((p) => ({ x: p.x, z: p.z, r: p.r, topo: p.h, base: p.h - 2.5 })),
    { x: PIRAMIDE.x, z: PIRAMIDE.z, r: PIRAMIDE.meia * 1.05, topo: -SALAO.desce + PIRAMIDE.alt * 0.75, base: -SALAO.desce },
    { x: TEMPLO_RASTA.x, z: TEMPLO_RASTA.z, r: CAPELA_RASTA.r + 1, topo: TEMPLO_RASTA.h + CAPELA_RASTA.altura + 12, base: TEMPLO_RASTA.h + CAPELA_RASTA.altura - 1 },   // (o teto: por baixo dele, a capela é aberta)
    { x: TORRE_RASTA.x, z: TORRE_RASTA.z, r: TORRE_RASTA.r + 0.5, topo: FESTAS.h + TORRE_RASTA.alt, base: FESTAS.h },
    { x: RASTA.x, z: RASTA.z, r: ARVORE_RASTA.r, topo: ARVORE_RASTA.alt, base: 0 },
    { x: CYBER.x, z: CYBER.z, r: NUCLEO_CYBER.r + 1, topo: CYBER.h + NUCLEO_CYBER.alt, base: CYBER.h },   // o monumento   // a árvore (o tronco até a copa)
  ];
}
/** a curva da escadaria das raízes (no referencial do layout) — o render desenha na do lounge, num grupo espelhado */
export const curvaDaEscadariaRasta = () => curvaDaEscadaria();
