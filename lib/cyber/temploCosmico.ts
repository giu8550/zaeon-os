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
import { DECK, ESCADARIA, TEMPLO, alturaDaEscadaria, bordasDaEscadaria, curvaDaEscadaria, entradaDoTemplo, noCorredorDaEscadaria, noTemplo } from "./templo";

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
/** os LOUNGES ESTUDANTIS (out/2026, o dono): dos dois lados do salão, na altura dele — salas de estudo modernas, cheias
 *  de poltronas e cantos pra ler com os amigos, com o som calmo de estudo; DEPOIS delas, a ESCADA subindo pras festas
 *  (o lounge cósmico à esquerda — o −x do layout é a direita do mundo… o lado do lounge; o rasta, espelhado) */
export const ESTUDO = { x: -112, z: 62, r: 28, h: -SALAO.desce } as const;
/** a ESCADA do lounge estudantil até o pátio do lounge (sobe os `SALAO.desce` m): da borda dele à borda do lounge (raio 70) */
export const PONTE_LOUNGE = (() => {
  const d = Math.hypot(ESTUDO.x, ESTUDO.z), ux = -ESTUDO.x / d, uz = -ESTUDO.z / d;   // (do estudo rumo ao centro do lounge)
  return { a: { x: ESTUDO.x + ux * (ESTUDO.r - 1.5), z: ESTUDO.z + uz * (ESTUDO.r - 1.5) }, b: { x: -ux * 68.5, z: -uz * 68.5 }, meia: 4.5, colR: 0.5, passo: 0.8 } as const;
})();
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

// ───────────── o CAMINHO DO MEIO: o CAMPUS DE TI e a TORRE TECNOLÓGICA (out/2026, o dono: "falta computadores, terminais,
//    massividade — vários estudantes de TI; a torre mais longe, mais alta, com um elevador") ─────────────
/** o CAMPUS: a praça larga atrás da pirâmide (no nível do salão), da borda do salão até o pé da torre */
export const CAMPUS = { meia: 34, zFim: SALAO.z - 262 } as const;
/** a TORRE: a coluna massiva no fim do campus — o anel de chão em volta dela (a base) e o topo, onde fica o monumento */
export const TORRE_TI = { x: SALAO.x, z: SALAO.z - 302, colR: 30.5, baseR: 46 } as const;
/** o monumento (mais sinistro que a pirâmide): a plataforma no TOPO da torre, bem alto, na linha da pirâmide */
export const CYBER = { x: TORRE_TI.x, z: TORRE_TI.z, r: 30, h: 120 } as const;
/** o NÚCLEO do monumento (sólido: a sala ainda está fechada — o resto do caminho do meio vem depois) */
export const NUCLEO_CYBER = { r: 11, alt: 52 } as const;
/** o ELEVADOR da torre: o anel no pé (na base, virado pro campus) SOBE pela coluna de luz e entra no topo; o anel lá em
 *  cima DESCE. `dur` = a viagem (s) */
export const ELEVADOR_TC = { base: { x: TORRE_TI.x, z: TORRE_TI.z + 38 }, topo: { x: TORRE_TI.x, z: TORRE_TI.z + 22 }, r: 2.2, dur: 7 } as const;
/** onde está quem anda no elevador (layout, `h` acima do pátio) na fração `k`: sobe reto colado na torre e desliza pro topo */
export function posElevadorTC(sentido: "sobe" | "desce", k: number): { x: number; z: number; h: number } {
  const E = ELEVADOR_TC, c = Math.max(0, Math.min(1, sentido === "sobe" ? k : 1 - k)), s = (x: number) => x * x * (3 - 2 * x), h0 = -SALAO.desce, h1 = CYBER.h;
  if (c < 0.82) return { x: E.base.x, z: E.base.z, h: h0 + (h1 + 1.2 - h0) * s(c / 0.82) };
  const u = s((c - 0.82) / 0.18); return { x: E.base.x + (E.topo.x - E.base.x) * u, z: E.base.z + (E.topo.z - E.base.z) * u, h: h1 + 1.2 * (1 - u) };
}
/** está num anel do elevador, no piso dele? `q` layout, `h` = a altura acima do pátio */
export function bocaDoElevadorTC(q: P2, h: number): "sobe" | "desce" | null {
  const E = ELEVADOR_TC;
  if (Math.abs(h + SALAO.desce) < 1.5 && Math.hypot(q.x - E.base.x, q.z - E.base.z) < E.r) return "sobe";
  if (Math.abs(h - CYBER.h) < 1.5 && Math.hypot(q.x - E.topo.x, q.z - E.topo.z) < E.r) return "desce";
  return null;
}
/** as ESTAÇÕES dos estudantes de TI no campus: fileiras dos dois lados do CORREDOR do meio (livre), mesas viradas pra
 *  torre (o −z), a cadeira atrás; `ocupada` = tem um estudante digitando ali */
export const ESTACOES_TI: readonly { x: number; z: number; ocupada: boolean }[] = (() => {
  const out: { x: number; z: number; ocupada: boolean }[] = [];
  for (let z = SALAO.z - SALAO.r - 16; z >= CAMPUS.zFim + 20; z -= 9) for (const lado of [-1, 1]) for (const dx of [11, 18, 25]) {
    const i = out.length; out.push({ x: SALAO.x + lado * dx, z, ocupada: (i * 7) % 10 < 7 });
  }
  return out;
})();
export const MESA_TI = { larg: 4.2, prof: 1.2 } as const;

// ───────────── a REDE: plataformas e pontes ─────────────
export type PlatTC = { id: string; x: number; z: number; r: number; /** piso acima do pátio do lounge */ h: number };
export type PonteTC = { id: string; a: P2; b: P2; /** piso nas pontas */ ha: number; hb: number; meia: number };
export const PLATS: readonly PlatTC[] = [
  { id: "salao", x: SALAO.x, z: SALAO.z, r: SALAO.r, h: -SALAO.desce },
  { id: "rasta", x: RASTA.x, z: RASTA.z, r: RASTA.r, h: 0 },
  { id: "estudoL", x: ESTUDO.x, z: ESTUDO.z, r: ESTUDO.r, h: ESTUDO.h },
  { id: "estudoR", ...ESP(ESTUDO), r: ESTUDO.r, h: ESTUDO.h },
  { id: "capelaRasta", x: TEMPLO_RASTA.x, z: TEMPLO_RASTA.z, r: TEMPLO_RASTA.r, h: TEMPLO_RASTA.h },
  { id: "festas", x: FESTAS.x, z: FESTAS.z, r: FESTAS.r, h: FESTAS.h },
  { id: "casais", x: CASAIS.x, z: CASAIS.z, r: CASAIS.r, h: CASAIS.h },
  // (o TOPO da torre antes da BASE: no mesmo xz, quem está dentro do raio do topo está lá em cima — embaixo, ali, é a coluna)
  { id: "cyber", x: CYBER.x, z: CYBER.z, r: CYBER.r, h: CYBER.h },
  { id: "baseTorre", x: TORRE_TI.x, z: TORRE_TI.z, r: TORRE_TI.baseR, h: -SALAO.desce },
];
/** uma ponte reta entre duas plataformas (de borda a borda, na linha dos centros) */
function entre(id: string, p: PlatTC, q: PlatTC, meia: number): PonteTC {
  const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
  return { id, a: { x: p.x + ux * (p.r - 1.5), z: p.z + uz * (p.r - 1.5) }, b: { x: q.x - ux * (q.r - 1.5), z: q.z - uz * (q.r - 1.5) }, ha: p.h, hb: q.h, meia };
}
const plat = (id: string) => PLATS.find((p) => p.id === id)!;
export const PONTES: readonly PonteTC[] = [
  entre("estudoL", plat("salao"), plat("estudoL"), 6), entre("estudoR", plat("salao"), plat("estudoR"), 6),   // (do salão aos lounges estudantis: retas, no mesmo nível)
  { id: "lounge", a: PONTE_LOUNGE.a, b: PONTE_LOUNGE.b, ha: -SALAO.desce, hb: 0, meia: PONTE_LOUNGE.meia },   // as ESCADAS subindo pras festas
  { id: "rasta", a: ESP(PONTE_LOUNGE.a), b: ESP(PONTE_LOUNGE.b), ha: -SALAO.desce, hb: 0, meia: PONTE_LOUNGE.meia },
  entre("festas", plat("capelaRasta"), plat("festas"), 4),
  entre("casais", plat("festas"), plat("casais"), 2.6),
  // o CAMPUS DE TI: uma "ponte" larga (é uma praça retangular) do salão até a base da torre
  { id: "meio", a: { x: SALAO.x, z: SALAO.z - SALAO.r + 1.5 }, b: { x: SALAO.x, z: TORRE_TI.z + TORRE_TI.baseR - 1.5 }, ha: -SALAO.desce, hb: -SALAO.desce, meia: CAMPUS.meia },
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
  out.push({ x: CYBER.x, z: CYBER.z, r: NUCLEO_CYBER.r + 0.5 });   // (lá em cima)
  // a COLUNA da torre: um ANEL de colisores no contorno (não um círculo cheio — a colisão é no plano: o cheio empurrava pra
  // fora quem está LÁ EM CIMA, no topo, que fica no mesmo xz); na base só se anda em volta
  { const n = Math.ceil((2 * Math.PI * TORRE_TI.colR) / 0.9); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push({ x: TORRE_TI.x + Math.cos(a) * TORRE_TI.colR, z: TORRE_TI.z + Math.sin(a) * TORRE_TI.colR, r: 0.7 }); } }
  for (const e of ESTACOES_TI) for (const k of [-1, 0, 1]) out.push({ x: e.x + k * (MESA_TI.larg / 2 - 0.6), z: e.z, r: 0.75 });   // as MESAS do campus   // o NÚCLEO do monumento da Cyber Room (fechado, por ora)   // o tronco da ÁRVORE DA VIDA no meio do disco rasta
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
    { x: CYBER.x, z: CYBER.z, r: NUCLEO_CYBER.r + 1, topo: CYBER.h + NUCLEO_CYBER.alt, base: CYBER.h },
    { x: TORRE_TI.x, z: TORRE_TI.z, r: TORRE_TI.colR, topo: CYBER.h, base: -SALAO.desce },   // a COLUNA da torre (sólida pra quem voa; em cima, pousa no topo)   // o monumento   // a árvore (o tronco até a copa)
  ];
}
/** a curva da escadaria das raízes (no referencial do layout) — o render desenha na do lounge, num grupo espelhado */
export const curvaDaEscadariaRasta = () => curvaDaEscadaria();

// ───────────── a GUARDIÃ do braço esquerdo: a Examiner e a CÚPULA fechada ─────────────
/** a CÚPULA fechada em volta da capela do lounge (o templo lá em cima): raio, altura (acima do piso do templo) e a
 *  PORTA — na entrada da escadaria-veia. Fechada pra quem não venceu o duelo de linguagem (lib/cyber/dueloIngles): sem
 *  outra entrada nem portal — a cúpula É o bloqueio (o dono, out/2026) */
export const CUPULA = { r: TEMPLO.r + 0.8, alt: 44, portaAlt: 9 } as const;
/** a porta da cúpula (referencial do lounge): o centro dela, na borda do templo, e pra onde ela dá (o rumo de quem sai) */
export function portaDaCupula(): { x: number; z: number; ang: number; meia: number } {
  const e = entradaDoTemplo();
  return { x: TEMPLO.x + Math.cos(e.ang) * TEMPLO.r, z: TEMPLO.z + Math.sin(e.ang) * TEMPLO.r, ang: e.ang, meia: e.meia };
}
/** onde a EXAMINER monta guarda: na escadaria, logo antes da porta, de frente pra quem sobe (referencial do lounge) */
export function postoDaGuardia(): { x: number; z: number; rumoLocal: number } {
  const p = portaDaCupula(), d = 6, x = TEMPLO.x + Math.cos(p.ang) * (TEMPLO.r + d), z = TEMPLO.z + Math.sin(p.ang) * (TEMPLO.r + d);
  return { x, z, rumoLocal: Math.atan2(Math.cos(p.ang), Math.sin(p.ang)) };   // (yaw: olhando pra fora da porta, escada abaixo)
}
/** a que distância (m) da guardiã o duelo começa (quem vem subindo a escadaria) */
export const ALCANCE_DUELO = 14;
/** quem ainda NÃO venceu o duelo e está DENTRO da cúpula (pela porta ou voando) é posto de volta no posto da guardiã,
 *  um pouco escada abaixo; null = pode ficar (já venceu, ou está fora) — `q` no referencial do lounge */
export function barradoNaCupula(q: P2, liberado: boolean): P2 | null {
  if (liberado || !noTemplo(q, 0.3)) return null;
  const p = portaDaCupula(), d = 9;
  return { x: TEMPLO.x + Math.cos(p.ang) * (TEMPLO.r + d), z: TEMPLO.z + Math.sin(p.ang) * (TEMPLO.r + d) };
}
