/**
 * Cyberespaço — os OUTROS CAMPI flutuantes (PURO), na mesma fundação da UNILAB (disco no céu, base de cristal,
 * propulsores, elevador de luz — lib/cyber/plataformas), cada um com a sua cara e o seu tamanho:
 *  - UFC (a MAIOR, ~8× a área da UNILAB): uma CIDADE universitária — ruas em grade, QUARTEIRÕES de prédios, parques
 *    e praças, a Reitoria no centro e prédios marcantes com placa;
 *  - UNIFOR (grande, menos ampla, PRIVADA — pegada SOFISTICADA): espelho d'água no centro com a torre de vidro, um anel
 *    de pavilhões claros com friso dourado, alamedas e jardins;
 *  - UECE (menor, quase do tamanho da UNILAB): um campus compacto em volta de um pátio central.
 * Bem longe uns dos outros e de tudo que já existe (Zaeon, UNILAB, Solana House, a praça). Tudo aqui é relativo ao
 * piso do disco do campus; coordenadas locais SEM giro, a partir do `centro`.
 * Custo: o layout é DADO (o three desenha tudo instanciado — components/cyber/Campus.ts); a colisão usa uma grade
 * espacial (só os prédios perto de quem anda entram na conta).
 */
import type { Colisor, P2 } from "./colisao";
import type { Pilar } from "./voo";

export type IdCampus = "ufc" | "unifor" | "uece";
export type EstiloCampus = "cidade" | "sofisticado" | "compacto";
export type Campus = {
  id: IdCampus; nome: string; sigla: string; estilo: EstiloCampus;
  /** centro (mundo), piso do disco (m) e raio andável do disco */
  centro: P2; y: number; r: number; espessura: number;
  /** o logo oficial (public/assets/cyber) e se ele é escuro (tinge de claro sobre as placas) */
  logo: string; logoEscuro: boolean;
  /** cores: os frisos de luz, o detalhe (dourado na Unifor) e a pintura dos prédios */
  cores: { friso: number; detalhe: number; predio: number; vidro: number };
};

export const CAMPI: Record<IdCampus, Campus> = {
  ufc: { id: "ufc", nome: "Universidade Federal do Ceará", sigla: "UFC", estilo: "cidade", centro: { x: -1010, z: 160 }, y: 190, r: 425, espessura: 10,
    logo: "/assets/cyber/logo-ufc.svg", logoEscuro: true, cores: { friso: 0x5ab4ff, detalhe: 0xffd27a, predio: 0x16233f, vidro: 0x3a78c8 } },
  unifor: { id: "unifor", nome: "Universidade de Fortaleza", sigla: "UNIFOR", estilo: "sofisticado", centro: { x: 980, z: 640 }, y: 300, r: 270, espessura: 9,
    logo: "/assets/cyber/logo-unifor.svg", logoEscuro: false, cores: { friso: 0xffe2a8, detalhe: 0xd8b26a, predio: 0xe8ecf4, vidro: 0x9fc7ee } },
  uece: { id: "uece", nome: "Universidade Estadual do Ceará", sigla: "UECE", estilo: "compacto", centro: { x: 760, z: -820 }, y: 260, r: 165, espessura: 8,
    logo: "/assets/cyber/logo-uece.png", logoEscuro: false, cores: { friso: 0x7fe0a8, detalhe: 0xe8c04a, predio: 0x1a2a3a, vidro: 0x4aa38a } },
};
export const IDS_CAMPI = Object.keys(CAMPI) as IdCampus[];

/** um PRÉDIO (local): retângulo de planta `lx × lz` centrado em (x,z), girado `rot` (rad) no próprio eixo, com altura.
 *  `tipo`: bloco comum, torre (alta), vidro (fachada toda de vidro), marco (o prédio-símbolo, com o logo) */
export type Predio = { x: number; z: number; lx: number; lz: number; rot: number; alt: number; tipo: "bloco" | "torre" | "vidro" | "marco"; nome?: string };
/** áreas no chão (local): rua, parque (árvores), praça, água (espelho d'água — sólido pra quem anda) */
export type AreaCampus = { x: number; z: number; lx: number; lz: number; rot: number; tipo: "rua" | "parque" | "praca" | "agua" } | { x: number; z: number; r: number; tipo: "aguaR" | "pracaR" };
export type LayoutCampus = { predios: Predio[]; areas: AreaCampus[]; arvores: P2[] };

/** perto do rumo da ENTRADA (o lado virado pra praça)? `meia` = meia-abertura (rad) — o boulevard da chegada fica livre */
const naFrente = (c: Campus, a: number, meia: number) => { const e = Math.atan2(-c.centro.z, -c.centro.x); return Math.abs(Math.atan2(Math.sin(a - e), Math.cos(a - e))) < meia; };
/** o rumo da entrada (rad, a partir de +x no plano x/z) e o GIRO que leva um layout feito com a entrada em +x pro campus:
 *  ponto (gx, gz) → local; prédio/área ganham `rot` = −e (o +x deles aponta pra entrada) */
const rumoEntrada = (c: Campus) => Math.atan2(-c.centro.z, -c.centro.x);
function girarLayout(l: LayoutCampus, e: number): LayoutCampus {
  const ce = Math.cos(e), se = Math.sin(e), pt = <T extends P2>(p: T): T => ({ ...p, x: p.x * ce - p.z * se, z: p.x * se + p.z * ce });
  return {
    predios: l.predios.map((p) => ({ ...pt(p), rot: p.rot - e })),
    areas: l.areas.map((a) => ("rot" in a ? { ...pt(a), rot: a.rot - e } : pt(a))),
    arvores: l.arvores.map(pt),
  };
}
/** PRNG determinístico (mulberry32): o campus sai igual pra todo mundo */
function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** UFC — a CIDADE: quarteirões de 50 m em grade (ruas de 14 m), só os que cabem inteiros no disco (folga da borda). A
 *  grade é feita com a ENTRADA em +x e girada: a AVENIDA DA UNIVERSIDADE (as quadras do eixo, do lado da entrada) sai do
 *  elevador de luz e vai reto até a Reitoria, no centro */
export const QUADRA = { passo: 64, lado: 50 } as const;
function layoutCidade(c: Campus): LayoutCampus {
  const r = prng(17), predios: Predio[] = [], areas: AreaCampus[] = [], arvores: P2[] = [];
  const P = QUADRA.passo, L = QUADRA.lado, n = Math.ceil(c.r / P);
  // os prédios com nome (o "mapa" da cidade): no centro a Reitoria; em volta, os marcos
  const nomes: Record<string, string> = { "0,0": "Reitoria", "-2,1": "Biblioteca Central", "2,-1": "Centro de Tecnologia", "1,2": "Centro de Humanidades", "-1,-2": "Restaurante Universitário", "3,2": "Centro de Ciências", "-3,-1": "Faculdade de Medicina", "-2,3": "Instituto de Cultura e Arte" };
  const pracas = new Set(["1,0", "-1,0", "0,1"]);   // a esplanada em volta da Reitoria
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const cx = i * P, cz = j * P;
    if (Math.hypot(Math.abs(cx) + L / 2, Math.abs(cz) + L / 2) > c.r - 18) continue;
    const k = `${i},${j}`, dc = Math.hypot(cx, cz) / c.r;
    if (k === "0,0") { predios.push({ x: 0, z: 0, lx: 30, lz: 30, rot: 0, alt: 64, tipo: "marco", nome: nomes[k] }); areas.push({ x: 0, z: 0, lx: L, lz: L, rot: 0, tipo: "praca" }); continue; }
    if (pracas.has(k)) { areas.push({ x: cx, z: cz, lx: L, lz: L, rot: 0, tipo: "praca" }); continue; }
    if (j === 0 && i > 0) { areas.push({ x: cx, z: cz, lx: P, lz: L, rot: 0, tipo: "rua" }); for (const oz of [-1, 1]) for (const ox of [-1, 1]) arvores.push({ x: cx + ox * 14, z: cz + oz * 20 }); continue; }   // a avenida (com canteiro de árvores)
    if (nomes[k]) { predios.push({ x: cx, z: cz, lx: 38, lz: 30, rot: 0, alt: 22 + r() * 10, tipo: "vidro", nome: nomes[k] }); continue; }
    const sorteio = r();
    if (sorteio < 0.16) {   // PARQUE: árvores em grade solta
      areas.push({ x: cx, z: cz, lx: L, lz: L, rot: 0, tipo: "parque" });
      for (let a = 0; a < 9; a++) arvores.push({ x: cx + (((a % 3) - 1) * 15) + (r() - 0.5) * 5, z: cz + ((Math.floor(a / 3) - 1) * 15) + (r() - 0.5) * 5 });
      continue;
    }
    // QUARTEIRÃO de prédios: 2×2 lotes (às vezes um prédio grande ocupando a quadra), mais altos no centro
    if (sorteio < 0.3) { predios.push({ x: cx, z: cz, lx: 40 + r() * 6, lz: 34 + r() * 8, rot: 0, alt: 12 + (1 - dc) * 20 + r() * 8, tipo: r() < 0.4 ? "vidro" : "bloco" }); continue; }
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      if (r() < 0.12) { arvores.push({ x: cx + ox * 12, z: cz + oz * 12 }); continue; }   // lote vazio: uma árvore
      const lx = 16 + r() * 5, lz = 16 + r() * 5, alt = 8 + (1 - dc) * 26 + r() * 14, alta = r() < 0.12 && dc < 0.7;
      predios.push({ x: cx + ox * 12.5, z: cz + oz * 12.5, lx, lz, rot: 0, alt: alta ? alt + 18 : alt, tipo: alta ? "torre" : r() < 0.25 ? "vidro" : "bloco" });
    }
  }
  // as RUAS: as faixas entre as quadras (só o desenho; anda-se por elas)
  for (let i = -n; i <= n; i++) { const x = i * P + P / 2; const meia = Math.sqrt(Math.max(0, (c.r - 10) ** 2 - x * x)); if (meia > 20) { areas.push({ x, z: 0, lx: P - L, lz: meia * 2, rot: 0, tipo: "rua" }); areas.push({ x: 0, z: x, lx: meia * 2, lz: P - L, rot: 0, tipo: "rua" }); } }
  return girarLayout({ predios, areas, arvores }, rumoEntrada(c));
}

/** UNIFOR — SOFISTICADA: espelho d'água com a torre de vidro no meio, anel interno de pavilhões claros, anel externo de
 *  prédios elegantes girados pro centro, alamedas de árvores e jardins */
function layoutSofisticado(c: Campus): LayoutCampus {
  const r = prng(29), predios: Predio[] = [], areas: AreaCampus[] = [], arvores: P2[] = [];
  areas.push({ x: 0, z: 0, r: 48, tipo: "aguaR" });
  predios.push({ x: 0, z: 0, lx: 18, lz: 18, rot: Math.PI / 4, alt: 78, tipo: "marco", nome: "Reitoria" });
  areas.push({ x: 0, z: 0, r: 62, tipo: "pracaR" });
  const nomesIn = ["Biblioteca", "Centro de Convivência", "Teatro", "Espaço Cultural", "Centro de Ciências da Comunicação", "Centro de Ciências Tecnológicas"];
  // o anel interno desencontrado da entrada: ela cai ENTRE dois pavilhões (o caminho até o espelho d'água fica livre)
  for (let k = 0; k < 6; k++) { const a = rumoEntrada(c) + Math.PI / 6 + (k / 6) * Math.PI * 2, d = 100; predios.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, lx: 34, lz: 18, rot: -a + Math.PI / 2, alt: 14 + (k % 2) * 6, tipo: "vidro", nome: nomesIn[k] }); }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, d = 180 + (k % 2) * 14;
    if (naFrente(c, a, 0.2)) continue;   // o boulevard da chegada (do lado da praça) fica livre
    predios.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, lx: 42, lz: 20, rot: -a + Math.PI / 2, alt: 18 + r() * 16, tipo: k % 3 === 0 ? "torre" : "bloco" });
  }
  // alamedas: anéis de árvores entre os anéis de prédios + jardins
  for (const [d, n] of [[72, 18], [140, 30], [232, 40]] as const) for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + 0.05; if (d === 232 && naFrente(c, a, 0.15)) continue; arvores.push({ x: Math.cos(a) * d, z: Math.sin(a) * d }); }
  for (let k = 0; k < 6; k++) { const a = rumoEntrada(c) + (k / 6) * Math.PI * 2 + Math.PI / 6; areas.push({ x: Math.cos(a) * 140, z: Math.sin(a) * 140, lx: 40, lz: 22, rot: -a + Math.PI / 2, tipo: "parque" }); }
  return { predios, areas, arvores };
}

/** UECE — COMPACTA: prédios em volta de um pátio central (quadra 3×3 sem o meio) + uns de apoio na borda */
function layoutCompacto(c: Campus): LayoutCampus {
  const r = prng(41), predios: Predio[] = [], areas: AreaCampus[] = [], arvores: P2[] = [];
  // (feito com a ENTRADA em +x e girado no fim: o boulevard do eixo leva do elevador de luz ao pátio e à Reitoria)
  areas.push({ x: 0, z: 0, lx: 56, lz: 56, rot: 0, tipo: "praca" });
  areas.push({ x: 75, z: 0, lx: 95, lz: 12, rot: 0, tipo: "rua" });
  predios.push({ x: -50, z: 0, lx: 16, lz: 34, rot: 0, alt: 26, tipo: "marco", nome: "Reitoria" });
  const nomes = ["Biblioteca Central", "Centro de Ciências e Tecnologia", "Centro de Humanidades", "Centro de Educação", "Centro de Ciências da Saúde", "Restaurante Universitário"];
  let ni = 0;
  for (const gx of [-46, 4, 54]) for (const gz of [-52, 52]) predios.push({ x: gx, z: gz, lx: 30, lz: 24, rot: 0, alt: 10 + r() * 8, tipo: r() < 0.35 ? "vidro" : "bloco", nome: nomes[ni++] });
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + 0.3, d = 118; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35) continue; predios.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, lx: 22, lz: 14, rot: -a + Math.PI / 2, alt: 7 + r() * 6, tipo: "bloco" }); }
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; arvores.push({ x: Math.cos(a) * 34, z: Math.sin(a) * 34 }); }
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2 + 0.13; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 0.12) arvores.push({ x: Math.cos(a) * 92, z: Math.sin(a) * 92 }); }
  return girarLayout({ predios, areas, arvores }, rumoEntrada(c));
}

const cacheLayout = new Map<IdCampus, LayoutCampus>();
/** o layout de um campus (constante: calculado uma vez) */
export function layoutDoCampus(id: IdCampus): LayoutCampus {
  let l = cacheLayout.get(id);
  if (!l) { const c = CAMPI[id]; l = c.estilo === "cidade" ? layoutCidade(c) : c.estilo === "sofisticado" ? layoutSofisticado(c) : layoutCompacto(c); cacheLayout.set(id, l); }
  return l;
}

/** a ENTRADA de cada campus (o lado virado pra praça): direção unitária do centro do campus → a praça */
export function rumoDaPraca(id: IdCampus): P2 { const c = CAMPI[id].centro, d = Math.hypot(c.x, c.z) || 1; return { x: -c.x / d, z: -c.z / d }; }
/** um ponto local a `dist` m do centro, na direção da praça (a entrada) */
export const naEntrada = (id: IdCampus, dist: number): P2 => { const u = rumoDaPraca(id); return { x: u.x * dist, z: u.z * dist }; };

export const mundoC = (id: IdCampus, l: P2): P2 => ({ x: CAMPI[id].centro.x + l.x, z: CAMPI[id].centro.z + l.z });
export const localC = (id: IdCampus, w: P2): P2 => ({ x: w.x - CAMPI[id].centro.x, z: w.z - CAMPI[id].centro.z });

// ── COLISÃO ──
/** grade espacial dos sólidos (prédios + água) de cada campus: célula de 40 m → índices */
const CEL = 40;
type Solido = { x: number; z: number; hx: number; hz: number; c: number; s: number; alt: number } | { x: number; z: number; r: number; alt: number };
const cacheSolidos = new Map<IdCampus, { lista: Solido[]; grade: Map<string, number[]> }>();
function solidos(id: IdCampus) {
  let s = cacheSolidos.get(id);
  if (s) return s;
  const l = layoutDoCampus(id), lista: Solido[] = [];
  for (const p of l.predios) lista.push({ x: p.x, z: p.z, hx: p.lx / 2, hz: p.lz / 2, c: Math.cos(p.rot), s: Math.sin(p.rot), alt: p.alt });
  for (const a of l.areas) if (a.tipo === "aguaR") lista.push({ x: a.x, z: a.z, r: a.r, alt: 0.6 });
  const grade = new Map<string, number[]>();
  lista.forEach((q, i) => {
    const raio = "r" in q ? q.r : Math.hypot(q.hx, q.hz);
    for (let gx = Math.floor((q.x - raio) / CEL); gx <= Math.floor((q.x + raio) / CEL); gx++) for (let gz = Math.floor((q.z - raio) / CEL); gz <= Math.floor((q.z + raio) / CEL); gz++) { const k = `${gx},${gz}`; const a = grade.get(k) ?? []; a.push(i); grade.set(k, a); }
  });
  s = { lista, grade }; cacheSolidos.set(id, s);
  return s;
}
/** empurra `p` (local) pra fora dos sólidos mais altos que `y` perto dele (raio do corpo `raio`) */
export function empurrarNoCampus(id: IdCampus, p: P2, y = 0, raio = 0.45): P2 {
  const { lista, grade } = solidos(id); let { x, z } = p;
  const ids = grade.get(`${Math.floor(x / CEL)},${Math.floor(z / CEL)}`); if (!ids) return { x, z };
  for (const i of ids) {
    const q = lista[i]!; if (q.alt <= y) continue;
    if ("r" in q) { const dx = x - q.x, dz = z - q.z, d = Math.hypot(dx, dz), lim = q.r + raio; if (d < lim) { const k = d > 1e-5 ? lim / d : 1; x = q.x + (d > 1e-5 ? dx * k : lim); z = q.z + (d > 1e-5 ? dz * k : 0); } continue; }
    // retângulo girado: leva o ponto pro referencial dele, empurra pela face mais perto, volta
    const dx = x - q.x, dz = z - q.z, u = dx * q.c - dz * q.s, v = dx * q.s + dz * q.c, hx = q.hx + raio, hz = q.hz + raio;
    if (Math.abs(u) >= hx || Math.abs(v) >= hz) continue;
    let nu = u, nv = v;
    if (hx - Math.abs(u) < hz - Math.abs(v)) nu = Math.sign(u || 1) * hx; else nv = Math.sign(v || 1) * hz;
    x = q.x + nu * q.c + nv * q.s; z = q.z - nu * q.s + nv * q.c;
  }
  return { x, z };
}
/** um passo ANDANDO no campus (mundo → mundo): os prédios barram; `fora` = passou da borda do disco (cai) */
export function andarNoCampus(id: IdCampus, w: P2): P2 & { fora: boolean } {
  const q = empurrarNoCampus(id, localC(id, w)), m = mundoC(id, q);
  return { ...m, fora: Math.hypot(q.x, q.z) > CAMPI[id].r };
}
/** voando de mochila: os prédios mais altos que `y` (relativo ao disco) barram */
export const noArNoCampus = (id: IdCampus, w: P2, y: number): P2 => mundoC(id, empurrarNoCampus(id, localC(id, w), y));
/** os sólidos de voo (nave/moto): o disco + os prédios (círculo que cobre a planta), no mundo */
export function pilaresDoCampus(id: IdCampus): Pilar[] {
  const c = CAMPI[id], out: Pilar[] = [{ ...c.centro, r: c.r, topo: c.y, base: c.y - c.espessura }];
  for (const p of layoutDoCampus(id).predios) out.push({ ...mundoC(id, p), r: Math.hypot(p.lx, p.lz) / 2, topo: c.y + p.alt, base: c.y });
  return out;
}
/** os prédios como colisores redondos (pra o que só precisa de um círculo: câmera, motos estacionadas…) */
export const colisoresDoCampus = (id: IdCampus): Colisor[] => layoutDoCampus(id).predios.map((p) => ({ x: p.x, z: p.z, r: Math.min(p.lx, p.lz) / 2 }));
