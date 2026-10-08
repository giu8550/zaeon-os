/**
 * Cyberespaço — CAMINHOS a pé na Zaeon (PURO, sem three). Os personagens que vivem na cidadela (lib/cyber/vidaPersonagem)
 * andam por aqui: uma GRADE de 1 m sobre o chão andável da ilha (a plataforma central até o raio andável, a escada e
 * o disco do lounge), com os OBSTÁCULOS carimbados nela — todos os colisores da cidade (colunas da capela, desktops,
 * estações, telões, árvores, corrimão da escada, palco e torre do DJ), as pirâmides dos mirantes e o anel do buraco
 * negro, com uma folga de corpo. A rota sai de um A* (8 vizinhos) e é "puxada como barbante" (só os cantos onde a
 * linha reta bateria em algo) — o personagem não anda em zigue-zague de grade.
 * Tudo em coordenadas LOCAIS da ilha (o mundo é `mundo()` de lib/cyber/ceu). Determinístico: o mesmo pedido dá a
 * mesma rota em qualquer cliente.
 */
import { CIDADE, colisoresDaCidade, naEscadaOuLounge } from "./ceu";
import { MIRANTES } from "./terra";
import type { P2 } from "./colisao";

/** o tamanho da célula (m), a folga do corpo (m) e a caixa da grade (local) — a caixa cobre a central e o lounge */
export const GRADE = { passo: 1, folga: 0.7, x0: -440, x1: 236, z0: -236, z1: 236 } as const;
/** a base sólida das pirâmides dos mirantes (o cone de 9×1,6 m + 0,4) */
const PIRAMIDE_R = 9 * 1.6 + 0.4;

type Grade = { w: number; h: number; livre: Uint8Array };
let cache: Grade | null = null;

const celula = (x: number, z: number) => ({ i: Math.floor((x - GRADE.x0) / GRADE.passo), j: Math.floor((z - GRADE.z0) / GRADE.passo) });
const centroDa = (i: number, j: number): P2 => ({ x: GRADE.x0 + (i + 0.5) * GRADE.passo, z: GRADE.z0 + (j + 0.5) * GRADE.passo });

/** o chão existe aqui (local)? — a central até o raio andável, a escada e o disco do lounge */
export function chaoAndavel(l: P2): boolean {
  return Math.hypot(l.x, l.z) <= CIDADE.andavelR - 1 || naEscadaOuLounge(l);
}

/** a grade (calculada uma vez): 1 = livre */
export function grade(): Grade {
  if (cache) return cache;
  const w = Math.ceil((GRADE.x1 - GRADE.x0) / GRADE.passo), h = Math.ceil((GRADE.z1 - GRADE.z0) / GRADE.passo);
  const livre = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (chaoAndavel(centroDa(i, j))) livre[j * w + i] = 1;
  const c = CIDADE.centro;
  const obst: { x: number; z: number; r: number }[] = colisoresDaCidade().map((o) => ({ x: o.x - c.x, z: o.z - c.z, r: o.r }));
  for (const m of MIRANTES) obst.push({ x: m.x, z: m.z, r: PIRAMIDE_R });
  obst.push({ x: CIDADE.portalTunel.x, z: CIDADE.portalTunel.z, r: CIDADE.portalTunel.r });
  for (const o of obst) {
    const r = o.r + GRADE.folga, a = celula(o.x - r, o.z - r), b = celula(o.x + r, o.z + r);
    for (let j = Math.max(0, a.j); j <= Math.min(h - 1, b.j); j++) for (let i = Math.max(0, a.i); i <= Math.min(w - 1, b.i); i++) {
      const p = centroDa(i, j); if (Math.hypot(p.x - o.x, p.z - o.z) <= r) livre[j * w + i] = 0;
    }
  }
  return (cache = { w, h, livre });
}

/** o ponto (local) está livre (chão e fora dos obstáculos, com a folga)? */
export function livre(p: P2): boolean {
  const g = grade(), { i, j } = celula(p.x, p.z);
  return i >= 0 && j >= 0 && i < g.w && j < g.h && g.livre[j * g.w + i] === 1;
}

/** a linha reta de `a` a `b` passa só por chão livre? (amostra a cada 0,4 m) */
export function linhaLivre(a: P2, b: P2): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.4));
  for (let k = 0; k <= n; k++) { const t = k / n; if (!livre({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) return false; }
  return true;
}

/** a célula livre mais perto de `p` (busca em anéis; null se nada num raio de 12 m) */
function livreMaisPerto(p: P2): { i: number; j: number } | null {
  const g = grade(), c = celula(p.x, p.z);
  for (let r = 0; r <= 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const i = c.i + di, j = c.j + dj;
    if (i >= 0 && j >= 0 && i < g.w && j < g.h && g.livre[j * g.w + i]) return { i, j };
  }
  return null;
}

/** a ROTA a pé de `de` a `para` (locais): a lista de pontos (começa em `de`, termina em `para`), já sem zigue-zague;
 *  null = não tem caminho */
export function rotaAPe(de: P2, para: P2): P2[] | null {
  if (linhaLivre(de, para)) return [de, para];
  const g = grade(), a = livreMaisPerto(de), b = livreMaisPerto(para);
  if (!a || !b) return null;
  const N = g.w * g.h, custo = new Float32Array(N).fill(Infinity), veio = new Int32Array(N).fill(-1), fechado = new Uint8Array(N);
  const ini = a.j * g.w + a.i, fim = b.j * g.w + b.i;
  const h = (k: number) => { const i = k % g.w, j = (k / g.w) | 0, dx = Math.abs(i - b.i), dz = Math.abs(j - b.j); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
  // fila de prioridade (heap binário) de [f, k]
  const heapF: number[] = [], heapK: number[] = [];
  const empurra = (f: number, k: number) => {
    heapF.push(f); heapK.push(k); let n = heapF.length - 1;
    while (n > 0) { const p = (n - 1) >> 1; if (heapF[p]! <= heapF[n]!) break; [heapF[p], heapF[n]] = [heapF[n]!, heapF[p]!]; [heapK[p], heapK[n]] = [heapK[n]!, heapK[p]!]; n = p; }
  };
  const tira = (): number => {
    const k = heapK[0]!, uf = heapF.pop()!, uk = heapK.pop()!;
    if (heapF.length) {
      heapF[0] = uf; heapK[0] = uk; let n = 0;
      for (;;) { const l = 2 * n + 1, r = l + 1; let m = n; if (l < heapF.length && heapF[l]! < heapF[m]!) m = l; if (r < heapF.length && heapF[r]! < heapF[m]!) m = r; if (m === n) break; [heapF[m], heapF[n]] = [heapF[n]!, heapF[m]!]; [heapK[m], heapK[n]] = [heapK[n]!, heapK[m]!]; n = m; }
    }
    return k;
  };
  custo[ini] = 0; empurra(h(ini), ini);
  const VIZ = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]] as const;
  while (heapF.length) {
    const k = tira(); if (fechado[k]) continue; fechado[k] = 1;
    if (k === fim) break;
    const i = k % g.w, j = (k / g.w) | 0;
    for (const [di, dj, c] of VIZ) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= g.w || nj >= g.h) continue;
      const n = nj * g.w + ni; if (!g.livre[n] || fechado[n]) continue;
      if (di && dj && (!g.livre[j * g.w + ni] || !g.livre[nj * g.w + i])) continue;   // não corta quina
      const nc = custo[k]! + c; if (nc < custo[n]!) { custo[n] = nc; veio[n] = k; empurra(nc + h(n), n); }
    }
  }
  if (!fechado[fim]) return null;
  const celulas: P2[] = [];
  for (let k = fim; k !== -1; k = veio[k]!) celulas.push(centroDa(k % g.w, (k / g.w) | 0));
  celulas.reverse();
  // puxa o barbante: de cada ponto, pula pro mais longe que dá pra ver em linha reta
  const pts: P2[] = [de];
  let atual = de, idx = 0;
  const todos = [...celulas, para];
  while (idx < todos.length - 1) {
    let melhor = idx + 1;
    for (let k = idx + 2; k < todos.length; k++) { if (linhaLivre(atual, todos[k]!)) melhor = k; else if (k - melhor > 6) break; }   // anda pra frente enquanto enxerga
    atual = todos[melhor]!; pts.push(atual); idx = melhor;
  }
  return pts;
}

/** o comprimento de uma rota (m) */
export const comprimento = (r: readonly P2[]) => r.reduce((s, p, i) => (i ? s + Math.hypot(p.x - r[i - 1]!.x, p.z - r[i - 1]!.z) : 0), 0);

/** o ponto a `s` metros do começo da rota + o rumo (facing: atan2(dx, dz)) do trecho */
export function pontoNaRota(r: readonly P2[], s: number): P2 & { rumo: number } {
  let resto = Math.max(0, s);
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1]!, b = r[i]!, d = Math.hypot(b.x - a.x, b.z - a.z);
    if (resto <= d || i === r.length - 1) { const t = d > 0 ? Math.min(1, resto / d) : 1; return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, rumo: Math.atan2(b.x - a.x, b.z - a.z) }; }
    resto -= d;
  }
  const p = r[r.length - 1]!; return { ...p, rumo: 0 };
}
