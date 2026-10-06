/**
 * Cyberespaço — a UNIVERSIDADE (UNILAB): um castelo de cristal FLUTUANDO num disco no céu (um pouco abaixo da Zaeon),
 * o lugar de encontro dos alunos — chega-se pelo ELEVADOR DE LUZ (anel no chão embaixo dela; lib/cyber/plataformas).
 * As salas são A CÉU ABERTO (sem telhado). PURO, sem three.
 * Referências: o castelo CONCÊNTRICO de Beaumaris (muralha externa com 12 torres, pátio externo, muralha interna mais
 * alta com 4 torres grandes) + as DUAS QUADRAS da Universidade de Glasgow (eixo central com o Grande Salão e a torre
 * com pináculo entre dois pátios/claustros). ~3× a área da Zaeon do céu (210 × 210 m), bem ao NORTE da praça — do lado
 * oposto ao QG do Andrei (sul). Tudo aqui (paredes, alturas, móveis) é RELATIVO ao piso do disco (`y`).
 *
 * Coordenadas: `centro` no mundo; tudo "local" é relativo a ele, SEM giro (−z = sul = rumo à praça, onde fica o portão).
 * Colisão: paredes são SEGMENTOS com espessura e altura (com vãos de porta); torres e fontes são círculos. Quem voa de
 * mochila acima de uma parede passa por cima (as salas não têm teto). As salas são amplas, com móveis (o three fica em
 * components/cyber/Universidade.ts).
 */
import { empurrarParaFora, type Colisor, type P2 } from "./colisao";

export const UNIVERSIDADE = {
  centro: { x: 0, z: 225 },
  /** piso do disco flutuante (m): um pouco abaixo da Zaeon (230); `discoR` = raio andável (a borda é livre: cai) */
  y: 170, discoR: 150, espessura: 8,
  externa: { meia: 105, alt: 12, esp: 2.6, portao: 14 },     // muralha externa (portão ao sul)
  interna: { meia: 80, alt: 18, esp: 3, portoes: [{ x: 0, w: 10 }, { x: -36, w: 8 }, { x: 36, w: 8 }] },   // portões ao sul
  torreCentral: { x: 0, z: -61.5, lado: 14, alt: 50, pinaculo: 22 },
} as const;

export type Lado = "s" | "n" | "l" | "o";   // sul (−z), norte (+z), leste (+x), oeste (−x)
export type Porta = { lado: Lado; em: number; w: number };   // `em` = coordenada ao longo do lado (x pra s/n, z pra l/o)
export type TipoSala = "atrio" | "salao" | "biblioteca" | "auditorio" | "estudo" | "laboratorio" | "cafe" | "atelie";
export type Sala = { id: string; nome: string; tipo: TipoSala; x0: number; x1: number; z0: number; z1: number; alt: number; portas: Porta[] };

/** as salas (amplas) dentro da muralha interna */
export const SALAS: Sala[] = [
  { id: "atrio", nome: "Átrio da Torre", tipo: "atrio", x0: -16, x1: 16, z0: -79, z1: -44, alt: 14, portas: [{ lado: "s", em: 0, w: 10 }, { lado: "o", em: -61.5, w: 6 }, { lado: "l", em: -61.5, w: 6 }, { lado: "n", em: 0, w: 8 }] },
  { id: "salao", nome: "Grande Salão", tipo: "salao", x0: -16, x1: 16, z0: -40, z1: 36, alt: 16, portas: [{ lado: "s", em: 0, w: 8 }, { lado: "n", em: 0, w: 6 }, { lado: "o", em: 0, w: 6 }, { lado: "l", em: 0, w: 6 }] },
  { id: "biblioteca", nome: "Biblioteca", tipo: "biblioteca", x0: -16, x1: 16, z0: 40, z1: 79, alt: 12, portas: [{ lado: "s", em: 0, w: 6 }, { lado: "o", em: 58, w: 5 }, { lado: "l", em: 58, w: 5 }] },
  { id: "auditorio", nome: "Auditório", tipo: "auditorio", x0: -79, x1: -57, z0: 2, z1: 79, alt: 14, portas: [{ lado: "l", em: 30, w: 8 }, { lado: "s", em: -68, w: 6 }] },
  { id: "estudoO", nome: "Salas de Estudo", tipo: "estudo", x0: -79, x1: -57, z0: -79, z1: -3, alt: 9, portas: [{ lado: "l", em: -58, w: 5 }, { lado: "l", em: -22, w: 5 }, { lado: "n", em: -68, w: 5 }] },
  { id: "laboratorio", nome: "Laboratório", tipo: "laboratorio", x0: 57, x1: 79, z0: 2, z1: 79, alt: 12, portas: [{ lado: "o", em: 30, w: 8 }, { lado: "s", em: 68, w: 6 }] },
  { id: "estudoL", nome: "Salas de Estudo", tipo: "estudo", x0: 57, x1: 79, z0: -79, z1: -3, alt: 9, portas: [{ lado: "o", em: -58, w: 5 }, { lado: "o", em: -22, w: 5 }, { lado: "n", em: 68, w: 5 }] },
  { id: "cafe", nome: "Café", tipo: "cafe", x0: -53, x1: -19, z0: 63, z1: 79, alt: 8, portas: [{ lado: "s", em: -36, w: 8 }] },
  { id: "atelie", nome: "Ateliê", tipo: "atelie", x0: 19, x1: 53, z0: 63, z1: 79, alt: 8, portas: [{ lado: "s", em: 36, w: 8 }] },
];

/** os dois pátios (claustros) abertos, com uma fonte de cristal no meio */
export const PATIOS = [{ x0: -57, x1: -16, z0: -80, z1: 63 }, { x0: 16, x1: 57, z0: -80, z1: 63 }] as const;
export const FONTES = PATIOS.map((p) => ({ x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2 - 8, r: 3.2 }));

export type Torre = { x: number; z: number; r: number; alt: number };
/** torres: 4 de canto + 8 em "D" na externa; 4 grandes nos cantos da interna */
export const TORRES: Torre[] = (() => {
  const e = UNIVERSIDADE.externa.meia, i = UNIVERSIDADE.interna.meia, out: Torre[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { out.push({ x: sx * e, z: sz * e, r: 7, alt: 24 }); out.push({ x: sx * i, z: sz * i, r: 8.5, alt: 34 }); }
  for (const t of [-35, 35]) { out.push({ x: t, z: -e, r: 4.8, alt: 19 }, { x: t, z: e, r: 4.8, alt: 19 }, { x: -e, z: t, r: 4.8, alt: 19 }, { x: e, z: t, r: 4.8, alt: 19 }); }
  return out;
})();

/** parede: segmento a→b (local), espessura e altura */
export type Parede = { ax: number; az: number; bx: number; bz: number; esp: number; alt: number };

/** corta o segmento [a, b] (1D) pelos vãos, devolve os pedaços que sobram */
function cortar(a: number, b: number, vaos: { c: number; w: number }[]): [number, number][] {
  let partes: [number, number][] = [[a, b]];
  for (const v of vaos) {
    const v0 = v.c - v.w / 2, v1 = v.c + v.w / 2, nov: [number, number][] = [];
    for (const [p0, p1] of partes) { if (v1 <= p0 || v0 >= p1) { nov.push([p0, p1]); continue; } if (v0 > p0) nov.push([p0, v0]); if (v1 < p1) nov.push([v1, p1]); }
    partes = nov;
  }
  return partes.filter(([p0, p1]) => p1 - p0 > 0.05);
}
/** as 4 paredes de um retângulo, com vãos por lado */
export function paredesDoRetangulo(x0: number, x1: number, z0: number, z1: number, esp: number, alt: number, vaos: Partial<Record<Lado, { c: number; w: number }[]>>): Parede[] {
  const out: Parede[] = [];
  for (const [p0, p1] of cortar(x0, x1, vaos.s ?? [])) out.push({ ax: p0, az: z0, bx: p1, bz: z0, esp, alt });
  for (const [p0, p1] of cortar(x0, x1, vaos.n ?? [])) out.push({ ax: p0, az: z1, bx: p1, bz: z1, esp, alt });
  for (const [p0, p1] of cortar(z0, z1, vaos.o ?? [])) out.push({ ax: x0, az: p0, bx: x0, bz: p1, esp, alt });
  for (const [p0, p1] of cortar(z0, z1, vaos.l ?? [])) out.push({ ax: x1, az: p0, bx: x1, bz: p1, esp, alt });
  return out;
}
const vaosDaSala = (s: Sala) => { const v: Partial<Record<Lado, { c: number; w: number }[]>> = {}; for (const p of s.portas) (v[p.lado] ??= []).push({ c: p.em, w: p.w }); return v; };

/** todas as paredes (locais): muralhas (com portões) + salas (com portas). Constante → calculado uma vez. */
let paredesCache: Parede[] | null = null;
export function paredesDaUniversidade(): Parede[] {
  if (paredesCache) return paredesCache;
  const { externa: e, interna: i } = UNIVERSIDADE;
  paredesCache = [
    ...paredesDoRetangulo(-e.meia, e.meia, -e.meia, e.meia, e.esp, e.alt, { s: [{ c: 0, w: e.portao }] }),
    ...paredesDoRetangulo(-i.meia, i.meia, -i.meia, i.meia, i.esp, i.alt, { s: i.portoes.map((p) => ({ c: p.x, w: p.w })) }),
    ...SALAS.flatMap((s) => paredesDoRetangulo(s.x0, s.x1, s.z0, s.z1, 0.8, s.alt, vaosDaSala(s))),
  ];
  return paredesCache;
}

export const mundoU = (l: P2): P2 => ({ x: UNIVERSIDADE.centro.x + l.x, z: UNIVERSIDADE.centro.z + l.z });
export const localU = (w: P2): P2 => ({ x: w.x - UNIVERSIDADE.centro.x, z: w.z - UNIVERSIDADE.centro.z });
/** perto o bastante pra colisão/câmera valerem (caixa da muralha externa + folga) */
export const naUniversidade = (w: P2, folga = 8) => { const l = localU(w), m = UNIVERSIDADE.externa.meia + folga; return Math.abs(l.x) < m && Math.abs(l.z) < m; };

/** empurra `p` (local) pra fora das paredes mais altas que `y` (raio do corpo `raio`) */
export function empurrarDasParedes(p: P2, paredes: Parede[], raio = 0.45, y = 0): P2 {
  let { x, z } = p;
  for (const w of paredes) {
    if (w.alt <= y) continue;
    const lim = w.esp / 2 + raio;
    if (x < Math.min(w.ax, w.bx) - lim || x > Math.max(w.ax, w.bx) + lim || z < Math.min(w.az, w.bz) - lim || z > Math.max(w.az, w.bz) + lim) continue;
    const dx = w.bx - w.ax, dz = w.bz - w.az, L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - w.ax) * dx + (z - w.az) * dz) / L2)) : 0;
    const cx = w.ax + dx * t, cz = w.az + dz * t, ex = x - cx, ez = z - cz, d = Math.hypot(ex, ez);
    if (d >= lim) continue;
    if (d < 1e-5) { const nx = -dz, nz = dx, nl = Math.hypot(nx, nz) || 1; x = cx + (nx / nl) * lim; z = cz + (nz / nl) * lim; continue; }
    x = cx + (ex / d) * lim; z = cz + (ez / d) * lim;
  }
  return { x, z };
}

/** o cristal no meio do átrio (debaixo da torre central) */
export const CRISTAL_ATRIO = { x: 0, z: UNIVERSIDADE.torreCentral.z, r: 2.4 };
/** os sólidos redondos (locais): torres, fontes dos pátios e o cristal do átrio */
export const solidosRedondos = (): Colisor[] => [...TORRES.map((t) => ({ x: t.x, z: t.z, r: t.r })), ...FONTES, CRISTAL_ATRIO];

/** móvel (local): retângulo no chão com altura — o three desenha pelo `tipo`; a colisão usa o retângulo */
export type MovelU = {
  tipo: "mesa" | "banco" | "palco" | "estante" | "fileira" | "bancada" | "balcao" | "mesinha" | "atelie" | "pc" | "cadeira" | "bloco";
  x0: number; x1: number; z0: number; z1: number; alt: number;
  /** false = só visual (cadeira, banco colado na mesa); "bloco" = só colisão (não se desenha) */
  solido?: boolean;
  /** pra onde a frente olha (cadeiras/telas): +1/−1 no eixo x ou z */
  frente?: "+x" | "-x" | "+z" | "-z";
};
const ret = (tipo: MovelU["tipo"], cx: number, cz: number, lx: number, lz: number, alt: number, extra: Partial<MovelU> = {}): MovelU => ({ tipo, x0: cx - lx / 2, x1: cx + lx / 2, z0: cz - lz / 2, z1: cz + lz / 2, alt, ...extra });
/** os móveis de cada sala (gerados pelo tipo; deixam livres as portas e um corredor) */
export function moveisDaSala(s: Sala): MovelU[] {
  const out: MovelU[] = [];
  if (s.tipo === "salao") {   // 4 mesas compridas com bancos dos dois lados + o tablado ao norte
    // (mesa + bancos colados = UM bloco sólido: entre a mesa e o banco não cabe gente)
    for (const x of [-10, -3.5, 3.5, 10]) out.push(ret("mesa", x, -4, 1.6, 50, 0.8, { solido: false }), ret("banco", x - 1.35, -4, 0.5, 50, 0.45, { solido: false }), ret("banco", x + 1.35, -4, 0.5, 50, 0.45, { solido: false }), ret("bloco", x, -4, 3.2, 50, 0.8));
    out.push(ret("palco", 0, 31, 16, 6, 0.6));
  } else if (s.tipo === "biblioteca") {   // fileiras de estantes altas (corredor no meio e livre na altura das portas laterais)
    for (const z of [45, 51, 65, 71, 76]) { out.push(ret("estante", -8.75, z, 11.5, 1, 5.5), ret("estante", 8.75, z, 11.5, 1, 5.5)); }
    out.push(ret("mesa", 0, 62, 1.8, 14, 0.8));
  } else if (s.tipo === "auditorio") {   // palco ao norte + fileiras de assentos com corredor no meio
    out.push(ret("palco", -68, 74, 18, 6, 0.8));
    for (let z = 14; z <= 62; z += 3.2) { if (Math.abs(z - 30) < 4.5) continue; out.push(ret("fileira", -74, z, 7, 0.8, 0.9), ret("fileira", -62, z, 7, 0.8, 0.9)); }
  } else if (s.tipo === "estudo") {
    // SALA DE ESTUDO: bancada de COMPUTADORES na parede de fora (com cadeiras), ESTANTES de livros na parede das portas
    // (com os vãos livres) e MESAS de grupo no meio, cada uma com 4 cadeiras
    const fora = s.x0 < 0 ? s.x0 : s.x1, dentro = s.x0 < 0 ? s.x1 : s.x0, sx = s.x0 < 0 ? 1 : -1;   // sx: de fora pra dentro
    for (const [z0, z1] of [[s.z0 + 2, s.z0 + 26], [s.z0 + 29, s.z0 + 50], [s.z0 + 53, s.z1 - 2]] as const) {
      out.push(ret("pc", fora + sx * 1.0, (z0 + z1) / 2, 1.4, z1 - z0, 0.8, { frente: sx > 0 ? "+x" : "-x" }));
      for (let z = z0 + 1.2; z < z1 - 0.6; z += 2.4) out.push(ret("cadeira", fora + sx * 2.4, z, 0.6, 0.6, 0.9, { solido: false, frente: sx > 0 ? "-x" : "+x" }));
    }
    const vaos = s.portas.filter((p) => p.lado === (s.x0 < 0 ? "l" : "o")).map((p) => p.em).sort((a, b) => a - b);
    let z = s.z0 + 2; for (const v of [...vaos, s.z1 + 1.5]) { const fim = v - 4; if (fim - z > 3) out.push(ret("estante", dentro - sx * 0.8, (z + fim) / 2, 1, fim - z, 3)); z = v + 4; }
    const cx = (s.x0 + s.x1) / 2 + sx * 0.5;
    for (let zz = s.z0 + 8; zz < s.z1 - 5; zz += 11) {
      out.push(ret("mesa", cx, zz, 2.2, 3.6, 0.8));
      for (const [dx, dz, f] of [[-1.7, -0.9, "+x"], [-1.7, 0.9, "+x"], [1.7, -0.9, "-x"], [1.7, 0.9, "-x"]] as const) out.push(ret("cadeira", cx + dx, zz + dz, 0.6, 0.6, 0.9, { solido: false, frente: f }));
    }
  } else if (s.tipo === "laboratorio") {   // bancadas atravessadas (livre na altura da porta oeste)
    for (const z of [10, 20, 42, 52, 62, 72]) out.push(ret("bancada", 68, z, 16, 1.6, 0.95));
  } else if (s.tipo === "cafe") {
    out.push(ret("balcao", -43, 76.6, 16, 1.4, 1.1));
    for (const x of [-48, -41, -31, -24]) for (const z of [67.5, 71.5]) out.push(ret("mesinha", x, z, 1.4, 1.4, 0.75));
  } else if (s.tipo === "atelie") {
    for (const x of [24, 31, 41, 48]) out.push(ret("atelie", x, 70.5, 2.2, 5, 0.9));
  }
  return out;
}
let moveisCache: MovelU[] | null = null;
export const todosOsMoveis = () => (moveisCache ??= SALAS.flatMap(moveisDaSala));

/** empurra `p` (local) pra fora dos retângulos mais altos que `y` (pelo lado de menor penetração) */
export function empurrarDosRetangulos(p: P2, rs: { x0: number; x1: number; z0: number; z1: number; alt: number }[], raio = 0.45, y = 0): P2 {
  let { x, z } = p;
  for (const r of rs) {
    if (r.alt <= y || (r as { solido?: boolean }).solido === false) continue;
    const x0 = r.x0 - raio, x1 = r.x1 + raio, z0 = r.z0 - raio, z1 = r.z1 + raio;
    if (x <= x0 || x >= x1 || z <= z0 || z >= z1) continue;
    const d = [x - x0, x1 - x, z - z0, z1 - z], k = d.indexOf(Math.min(...d));
    if (k === 0) x = x0; else if (k === 1) x = x1; else if (k === 2) z = z0; else z = z1;
  }
  return { x, z };
}

/** a sala (se houver) cuja planta contém `l` (local) */
export const salaEm = (l: P2): Sala | null => SALAS.find((s) => l.x > s.x0 && l.x < s.x1 && l.z > s.z0 && l.z < s.z1) ?? null;

/** andar no chão: paredes, torres e fontes (mundo → mundo) */
export function resolverUniversidade(w: P2): P2 {
  if (!naUniversidade(w)) return w;
  let l = localU(w);
  l = empurrarDasParedes(l, paredesDaUniversidade());
  l = empurrarDosRetangulos(l, [...todosOsMoveis(), ...SEBES]);
  l = empurrarParaFora(l, [...solidosRedondos(), ...troncosCache()]);
  return mundoU(l);
}

/**
 * Voando de mochila (mundo; `y` RELATIVO ao piso do disco): paredes, torres, móveis e árvores só barram abaixo do alto
 * deles — as salas são a céu aberto, dá pra subir e sair por cima.
 */
export function resolverUniversidadeNoAr(w: P2, y: number): P2 {
  if (!naUniversidade(w)) return w;
  let l = localU(w);
  l = empurrarDasParedes(l, paredesDaUniversidade(), 0.45, y);
  l = empurrarParaFora(l, TORRES.filter((t) => t.alt > y).map((t) => ({ x: t.x, z: t.z, r: t.r })));
  l = empurrarDosRetangulos(l, [...todosOsMoveis(), ...SEBES], 0.45, y);
  l = empurrarParaFora(l, ARVORES.filter((a) => a.h > y).map((a) => ({ x: a.x, z: a.z, r: a.tipo === "fruta" ? 1.6 : 2.2 })));
  if (y < 2.5) l = empurrarParaFora(l, [...FONTES, CRISTAL_ATRIO]);
  return mundoU(l);
}

/** os sólidos pra NAVE/MOTO (cilindros com topo, no MUNDO): o DISCO (pousa em cima; por baixo/de lado não passa),
 *  as torres e a torre central (as muralhas não — passa-se por cima) */
export function pilaresDaUniversidade(): { x: number; z: number; r: number; topo: number; base?: number }[] {
  const tc = UNIVERSIDADE.torreCentral, y = UNIVERSIDADE.y;
  return [
    { ...UNIVERSIDADE.centro, r: UNIVERSIDADE.discoR, topo: y, base: y - UNIVERSIDADE.espessura },
    ...TORRES.map((t) => ({ ...mundoU(t), r: t.r + 1, topo: y + t.alt + 6, base: y })),
    { ...mundoU(tc), r: tc.lado * 0.75, topo: y + tc.alt + tc.pinaculo, base: y },
  ];
}

// ───────────── NATUREZA: árvores, sebes, canteiros e PLANTAÇÕES (layout; o three em components/cyber/Natureza.ts) ─────────────
export type Arvore = { x: number; z: number; h: number; tipo: "copa" | "fruta" | "conifera" };
export type Campo = { tipo: "trigo" | "milho" | "horta" | "girassol" | "flores" | "gramado"; x0: number; x1: number; z0: number; z1: number };
/** PRNG determinístico (o mesmo campus pra todo mundo) */
function prngU(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const longeDasTorres = (x: number, z: number, folga: number) => TORRES.every((t) => Math.hypot(x - t.x, z - t.z) > t.r + folga);

/** os campos do pátio EXTERNO (entre as muralhas): trigo e milho a oeste, horta e girassóis a leste, pomar ao norte, jardins ao sul */
export const CAMPOS: Campo[] = (() => {
  const e = UNIVERSIDADE.externa.meia - UNIVERSIDADE.externa.esp, i = UNIVERSIDADE.interna.meia + UNIVERSIDADE.interna.esp, m = 2.5;
  return [
    { tipo: "trigo", x0: -e + m, x1: -i - m, z0: -i, z1: -6 },
    { tipo: "milho", x0: -e + m, x1: -i - m, z0: 6, z1: i },
    { tipo: "horta", x0: i + m, x1: e - m, z0: -i, z1: -6 },
    { tipo: "girassol", x0: i + m, x1: e - m, z0: 6, z1: i },
    { tipo: "flores", x0: -60, x1: -12, z0: -e + m, z1: -i - m },
    { tipo: "flores", x0: 12, x1: 60, z0: -e + m, z1: -i - m },
    // gramados dos pátios internos (com canteiros de flores nas bordas)
    ...PATIOS.map((p) => ({ tipo: "gramado" as const, x0: p.x0 + 1.5, x1: p.x1 - 1.5, z0: p.z0 + 1.5, z1: p.z1 - 1.5 })),
  ];
})();

/** as árvores: alamedas nos pátios internos, o POMAR ao norte, coníferas nos cantos e a avenida até o portão */
export const ARVORES: Arvore[] = (() => {
  const r = prngU(42), out: Arvore[] = [], e = UNIVERSIDADE.externa.meia, i = UNIVERSIDADE.interna.meia;
  for (const p of PATIOS) for (let z = p.z0 + 10; z < p.z1 - 6; z += 13) for (const x of [p.x0 + 5, p.x1 - 5]) out.push({ x, z, h: 7 + r() * 3, tipo: "copa" });
  for (let x = -e + 8; x < e - 6; x += 7) for (let z = i + 7; z < e - 4; z += 6.5) if (longeDasTorres(x, z, 3) && Math.abs(x) > 6) out.push({ x: x + (r() - 0.5), z: z + (r() - 0.5), h: 3.6 + r() * 1.2, tipo: "fruta" });
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) { const x = sx * (e - 12 - (k % 2) * 4), z = -e + 14 + k * 4.5; if (longeDasTorres(x, z, 3)) out.push({ x, z, h: 9 + r() * 4, tipo: "conifera" }); }
  for (let z = -e - 38; z < -e - 6; z += 9) for (const x of [-11, 11]) out.push({ x, z, h: 8 + r() * 2, tipo: "copa" });   // avenida do elevador de luz até o portão (no disco)
  return out;
})();

/** sebes (sólidas, baixas) contornando os gramados dos pátios — com aberturas nos caminhos (meio de cada lado) */
export const SEBES: { x0: number; x1: number; z0: number; z1: number; alt: number }[] = (() => {
  const out: { x0: number; x1: number; z0: number; z1: number; alt: number }[] = [], a = 1.1, t = 0.9;
  for (const p of PATIOS) {
    const x0 = p.x0 + 2.5, x1 = p.x1 - 2.5, z0 = p.z0 + 2.5, z1 = p.z1 - 2.5, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, g = 3;
    out.push({ x0, x1: cx - g, z0, z1: z0 + t, alt: a }, { x0: cx + g, x1, z0, z1: z0 + t, alt: a }, { x0, x1: cx - g, z0: z1 - t, z1, alt: a }, { x0: cx + g, x1, z0: z1 - t, z1, alt: a });
    out.push({ x0, x1: x0 + t, z0, z1: cz - g, alt: a }, { x0, x1: x0 + t, z0: cz + g, z1, alt: a }, { x0: x1 - t, x1, z0, z1: cz - g, alt: a }, { x0: x1 - t, x1, z0: cz + g, z1, alt: a });
  }
  return out;
})();
/** colisores da natureza (locais): troncos das árvores */
export const troncos = (): Colisor[] => ARVORES.map((a) => ({ x: a.x, z: a.z, r: a.tipo === "fruta" ? 0.45 : 0.6 }));
let troncosC: Colisor[] | null = null;
const troncosCache = () => (troncosC ??= troncos());
