/**
 * Corridas de moto — as PISTAS (PURO). Cada pista é uma curva FECHADA (Catmull-Rom pelos pontos de controle) rasante,
 * a poucos metros do "chão" do hiperespaço (lib/cyber/praca `CHAO` — a moto voa no máximo `PILOTAGEM.alturaMax` acima
 * dele, lib/cyber/motoFisica). O ANEL DA PRAÇA dá a volta na praça pelo lado de fora da Zaeon; o GRANDE CIRCUITO
 * contorna a Zaeon por fora. Os anéis só aparecem pra quem está na praça (ou correndo — components/cyber/PistaCorrida).
 * Ao longo dela, PORTÕES (anéis de luz) a cada ~`passo` metros: o 0 é a LARGADA/CHEGADA; alguns são de BOOST (enchem o
 * tanque). O `grid` (onde a moto larga) fica logo DEPOIS da linha de largada, virado pro portão 1 — a volta conta ao
 * cruzar a largada de novo.
 */
import { CHAO, PRACA } from "../praca";

export type P3 = { x: number; y: number; z: number };
export type TipoPortao = "largada" | "portao" | "boost";
/** `rumo` = a direção de passagem (frente = (sen rumo, cos rumo), como a moto); `r` = o raio do anel */
export type Portao = P3 & { i: number; rumo: number; r: number; tipo: TipoPortao; s: number };
export type Pista = {
  id: string; nome: string; desc: string; voltas: number; cor: string;
  portoes: Portao[];
  /** comprimento de uma volta (m) */
  comprimento: number;
  /** o ponto da pista a `s` metros da largada (dá a volta) */
  ponto(s: number): P3 & { rumo: number };
  /** onde a moto larga */
  grid: P3 & { rumo: number };
};

type Def = { id: string; nome: string; desc: string; voltas: number; cor: string; pontos: [number, number, number][]; passo: number; boosts: number[] };

/** as pistas: pontos de controle [x, y, z] no mundo (y = altura acima do CHÃO do hiperespaço; somada na montagem) */
const DEFS: Def[] = [
  {
    id: "grande-circuito", nome: "Grande Circuito", voltas: 3, cor: "#45d6ff", passo: 520, boosts: [0.27, 0.62],
    desc: "Rasante em volta de todo o mapa, contornando a Zaeon por fora. ~9 km por volta.",
    pontos: [
      [200, 5, 640], [620, 6, 610], [1000, 5, 760], [1270, 5, 360], [1100, 6, -340], [780, 5, -830], [340, 5, -1080],
      [0, 6, -1120], [-580, 5, -930], [-1000, 5, -360], [-1180, 6, 200], [-820, 5, 620], [-300, 5, 700],
    ],
  },
  {
    id: "anel-da-praca", nome: "Anel da Praça", voltas: 5, cor: "#ff6ad5", passo: 215, boosts: [0.5],
    desc: "Curto e técnico, em volta da Praça das bases — a reta de trás passa entre a praça e a Zaeon. ~2 km por volta.",
    // (no referencial da PRAÇA: a borda da Zaeon fica a 154 m ao sul do centro dela e a nave-QG paira na doca, entre as duas)
    pontos: ([
      [0, 4, 330], [250, 5, 270], [340, 4, 60], [235, 6, -104], [90, 4, -100], [-90, 5, -100], [-235, 4, -104],
      [-340, 6, 60], [-250, 5, 270],
    ] as [number, number, number][]).map(([x, y, z]) => [PRACA.x + x, y, PRACA.z + z]),
  },
];

/** Catmull-Rom FECHADA (centrípeta não precisa: os pontos são bem espaçados) */
function curva(pts: [number, number, number][]): (u: number) => P3 {
  const n = pts.length, P = (k: number) => pts[((k % n) + n) % n]!;
  return (u) => {
    const f = (((u % 1) + 1) % 1) * n, i = Math.floor(f), t = f - i, a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2);
    const cr = (k: 0 | 1 | 2) => 0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t * t * t);
    return { x: cr(0), y: cr(1), z: cr(2) };
  };
}

function montar(d: Def): Pista {
  const c = curva(d.pontos.map(([x, y, z]) => [x, CHAO + y, z])), N = d.pontos.length * 200;
  // amostra densa + o comprimento acumulado (pra andar em METROS, não em parâmetro)
  const amostras: P3[] = [], acum: number[] = [0];
  for (let k = 0; k <= N; k++) amostras.push(c(k / N));
  for (let k = 1; k <= N; k++) acum.push(acum[k - 1]! + Math.hypot(amostras[k]!.x - amostras[k - 1]!.x, amostras[k]!.y - amostras[k - 1]!.y, amostras[k]!.z - amostras[k - 1]!.z));
  const L = acum[N]!;
  const ponto = (s: number): P3 & { rumo: number } => {
    const alvo = ((s % L) + L) % L; let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (acum[m]! <= alvo) lo = m; else hi = m; }
    const a = amostras[lo]!, b = amostras[hi]!, u = (alvo - acum[lo]!) / Math.max(1e-9, acum[hi]! - acum[lo]!);
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u, rumo: Math.atan2(b.x - a.x, b.z - a.z) };
  };
  const n = Math.max(4, Math.round(L / d.passo)), portoes: Portao[] = [];
  for (let i = 0; i < n; i++) {
    const s = (i / n) * L, p = ponto(s);
    const tipo: TipoPortao = i === 0 ? "largada" : d.boosts.some((b) => Math.round(b * n) === i) ? "boost" : "portao";
    portoes.push({ ...p, i, s, tipo, r: i === 0 ? 22 : 18 });   // anéis GRANDES: a 500 km/h a moto anda 14 m por quadro
  }
  const g = ponto(30);
  return { id: d.id, nome: d.nome, desc: d.desc, voltas: d.voltas, cor: d.cor, portoes, comprimento: L, ponto, grid: g };
}

export const PISTAS: readonly Pista[] = DEFS.map(montar);
export const pistaPorId = (id: string): Pista | undefined => PISTAS.find((p) => p.id === id);

/** o raio de curva (m) em `s` (pelos pontos vizinhos, a ±`h` m) — pra garantir que dá pra fazer a curva rápido */
export function raioDeCurva(p: Pista, s: number, h = 25): number {
  const a = p.ponto(s - h), b = p.ponto(s), c = p.ponto(s + h);
  const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z), ca = Math.hypot(a.x - c.x, a.z - c.z);
  const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
}
/** fora da praça (onde ficam as bases): pista nenhuma passa por cima dela */
export const RAIO_LIVRE_PRACA = PRACA.r + 40;
