/**
 * lib/chat/grafico.ts — o bloco ```grafico do chat: valida o JSON que o modelo escreveu e amostra
 * as curvas. PURO (o SVG mora em components/chat/GraficoFuncao.tsx).
 *
 *   {"funcoes": ["x^2-4", {"expr":"2x+1","rotulo":"reta"}], "x": [-5, 5], "y"?: [-6, 10],
 *    "pontos"?: [{"x":2,"y":0,"rotulo":"raiz"}], "titulo"?: "…",
 *    "formas"?: [{"tipo":"poligono","pontos":[[0,0],[4,0],[0,3]],"rotulo":"triângulo"},
 *               {"tipo":"circulo","centro":[0,0],"raio":2}, {"tipo":"segmento","de":[0,0],"ate":[4,3]},
 *               {"tipo":"vetor","de":[0,0],"ate":[2,1],"rotulo":"v"}],
 *    "proporcional"?: true}   ← geometria: 1 unidade em x = 1 unidade em y (círculo é círculo)
 *
 * Teto: 4 funções, 12 pontos, 8 formas, domínio finito. Descontinuidade (tan, 1/x) quebra a curva em vez de
 * riscar uma reta vertical falsa.
 */
import { compilarExpr, type Fn } from "@/lib/chat/expr";

export type FuncaoSpec = { expr: string; rotulo: string; f: Fn };
export type PontoSpec = { x: number; y: number; rotulo?: string };
export type Pt = [number, number];
export type FormaSpec =
  | { tipo: "poligono"; pontos: Pt[]; rotulo?: string }
  | { tipo: "circulo"; centro: Pt; raio: number; rotulo?: string }
  | { tipo: "segmento" | "vetor"; de: Pt; ate: Pt; rotulo?: string };
export type GraficoSpec = { funcoes: FuncaoSpec[]; x: [number, number]; y: [number, number] | null; pontos: PontoSpec[]; formas: FormaSpec[]; proporcional: boolean; titulo: string | null };
export type Curva = { rotulo: string; expr: string; trechos: [number, number][][] };

const finito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const par = (v: unknown): [number, number] | null =>
  Array.isArray(v) && v.length === 2 && finito(v[0]) && finito(v[1]) && v[0] < v[1] ? [v[0], v[1]] : null;

export function parseGrafico(json: string): { ok: true; spec: GraficoSpec } | { ok: false; erro: string } {
  let o: any;
  try { o = JSON.parse(json); } catch { return { ok: false, erro: "JSON do gráfico inválido" }; }
  if (!o || typeof o !== "object") return { ok: false, erro: "gráfico vazio" };
  const brutas = Array.isArray(o.funcoes) ? o.funcoes : typeof o.funcao === "string" ? [o.funcao] : [];
  const funcoes: FuncaoSpec[] = [];
  for (const b of brutas.slice(0, 4)) {
    const expr = typeof b === "string" ? b : typeof b?.expr === "string" ? b.expr : null;
    if (!expr) continue;
    try { funcoes.push({ expr, rotulo: typeof b?.rotulo === "string" ? b.rotulo.slice(0, 40) : expr.slice(0, 40), f: compilarExpr(expr) }); }
    catch (e) { return { ok: false, erro: `não entendi "${expr.slice(0, 40)}": ${(e as Error).message}` }; }
  }
  const pontos: PontoSpec[] = (Array.isArray(o.pontos) ? o.pontos : []).filter((p: any) => finito(p?.x) && finito(p?.y)).slice(0, 12)
    .map((p: any) => ({ x: p.x, y: p.y, ...(typeof p.rotulo === "string" ? { rotulo: p.rotulo.slice(0, 30) } : {}) }));
  const formas = (Array.isArray(o.formas) ? o.formas : []).map(parseForma).filter((f: FormaSpec | null): f is FormaSpec => !!f).slice(0, 8);
  if (!funcoes.length && !pontos.length && !formas.length) return { ok: false, erro: "gráfico sem funções" };
  let x = par(o.x) ?? (formas.length || (!funcoes.length && pontos.length) ? faixaDosObjetos(formas, pontos, "x") : [-10, 10]);
  if (x[1] - x[0] > 1e6) x = [-10, 10];
  const y = par(o.y) ?? (formas.length && !funcoes.length ? faixaDosObjetos(formas, pontos, "y") : null);
  return { ok: true, spec: { funcoes, x, y, pontos, formas, proporcional: o.proporcional === true || (formas.length > 0 && o.proporcional !== false), titulo: typeof o.titulo === "string" ? o.titulo.slice(0, 80) : null } };
}

const pt = (v: unknown): Pt | null => (Array.isArray(v) && v.length === 2 && finito(v[0]) && finito(v[1]) ? [v[0], v[1]] : null);
function parseForma(f: any): FormaSpec | null {
  const rotulo = typeof f?.rotulo === "string" ? { rotulo: f.rotulo.slice(0, 30) } : {};
  if (f?.tipo === "poligono") { const ps = (Array.isArray(f.pontos) ? f.pontos : []).map(pt).filter(Boolean).slice(0, 24) as Pt[]; return ps.length >= 2 ? { tipo: "poligono", pontos: ps, ...rotulo } : null; }
  if (f?.tipo === "circulo") { const c = pt(f.centro); return c && finito(f.raio) && f.raio > 0 ? { tipo: "circulo", centro: c, raio: f.raio, ...rotulo } : null; }
  if (f?.tipo === "segmento" || f?.tipo === "vetor") { const de = pt(f.de), ate = pt(f.ate); return de && ate ? { tipo: f.tipo, de, ate, ...rotulo } : null; }
  return null;
}

/** Pontos que uma forma ocupa (pra faixa automática). */
export function pontosDaForma(f: FormaSpec): Pt[] {
  if (f.tipo === "poligono") return f.pontos;
  if (f.tipo === "circulo") return [[f.centro[0] - f.raio, f.centro[1] - f.raio], [f.centro[0] + f.raio, f.centro[1] + f.raio]];
  return [f.de, f.ate];
}

/** Faixa de um eixo que cabe as formas e pontos, com folga de 15% e a origem se estiver perto. */
function faixaDosObjetos(formas: FormaSpec[], pontos: PontoSpec[], eixo: "x" | "y"): [number, number] {
  const i = eixo === "x" ? 0 : 1;
  const vs = [...formas.flatMap(pontosDaForma).map((p) => p[i]), ...pontos.map((p) => (eixo === "x" ? p.x : p.y))];
  if (!vs.length) return [-10, 10];
  let lo = Math.min(...vs, 0), hi = Math.max(...vs, 0);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const folga = (hi - lo) * 0.15;
  return [lo - folga, hi + folga];
}

/** Escala igual nos dois eixos (geometria): alarga o eixo "apertado" em torno do centro. */
export function proporcionalizar(x: [number, number], y: [number, number], larguraPx: number, alturaPx: number): { x: [number, number]; y: [number, number] } {
  const ux = (x[1] - x[0]) / larguraPx, uy = (y[1] - y[0]) / alturaPx;
  if (ux > uy) { const c = (y[0] + y[1]) / 2, m = (ux * alturaPx) / 2; return { x, y: [c - m, c + m] }; }
  const c = (x[0] + x[1]) / 2, m = (uy * larguraPx) / 2;
  return { x: [c - m, c + m], y };
}

/** Amostra cada função em `n` pontos; quebra o traço em NaN/∞ ou salto absurdo (assíntota). */
export function amostrar(spec: GraficoSpec, n = 400): { curvas: Curva[]; y: [number, number] } {
  const [a, b] = spec.x;
  const passo = (b - a) / n;
  const curvas: Curva[] = spec.funcoes.map((fn) => {
    const trechos: [number, number][][] = [];
    let atual: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const x = a + i * passo;
      let y: number;
      try { y = fn.f(x); } catch { y = NaN; }
      if (!Number.isFinite(y)) { if (atual.length) trechos.push(atual); atual = []; continue; }
      atual.push([x, y]);
    }
    if (atual.length) trechos.push(atual);
    return { rotulo: fn.rotulo, expr: fn.expr, trechos };
  });
  const y = spec.y ?? faixaY(curvas, [...spec.pontos, ...spec.formas.flatMap(pontosDaForma).map(([x, yy]) => ({ x, y: yy }))]);
  // corta trechos nas assíntotas: salto maior que 3× a faixa visível entre amostras vizinhas
  const alto = (y[1] - y[0]) * 3;
  for (const c of curvas) {
    c.trechos = c.trechos.flatMap((t) => {
      const partes: [number, number][][] = [[]];
      for (let i = 0; i < t.length; i++) {
        if (i && Math.abs(t[i][1] - t[i - 1][1]) > alto) partes.push([]);
        partes[partes.length - 1].push(t[i]);
      }
      return partes.filter((p) => p.length > 1);
    });
  }
  return { curvas, y };
}

/** Faixa y automática: percentis 2–98 (uma assíntota não achata o resto), com folga e o 0 se perto. */
export function faixaY(curvas: Curva[], pontos: PontoSpec[] = []): [number, number] {
  const ys = [...curvas.flatMap((c) => c.trechos.flat().map((p) => p[1])), ...pontos.map((p) => p.y)].sort((p, q) => p - q);
  if (!ys.length) return [-10, 10];
  const q = (f: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.floor(f * (ys.length - 1))))];
  let lo = ys.length > 20 ? q(0.02) : ys[0], hi = ys.length > 20 ? q(0.98) : ys[ys.length - 1];
  for (const p of pontos) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const folga = (hi - lo) * 0.08;
  lo -= folga; hi += folga;
  if (lo > 0 && lo < (hi - lo) * 0.5) lo = 0;          // mostra o eixo x se ele está "logo ali"
  if (hi < 0 && -hi < (hi - lo) * 0.5) hi = 0;
  return [lo, hi];
}

/** Marcas "bonitas" (1, 2, 5 × 10^k) entre lo e hi, ~`alvo` marcas. */
export function marcas(lo: number, hi: number, alvo = 6): number[] {
  const bruto = (hi - lo) / alvo;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= bruto) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / passo) * passo; v <= hi + passo * 1e-9; v += passo) out.push(Math.abs(v) < passo * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return out;
}
