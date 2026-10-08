/**
 * lib/metrics/tokens.ts — agregações PURAS do TokenLedger para o admin (PR-A1/A3). Sem Prisma.
 * Regra do vazio: agente SEM linha no período NÃO aparece no grupo (a UI mostra "—", não 0).
 */
export type Range = "7d" | "30d" | "all";
export type LedgerRow = {
  at: Date | string; userId?: string | null; agentKey: string; mentorSlug?: string | null; surface: string;
  programId?: string | null; model: string; provedor: string; rota: string;
  promptTokens: number; completionTokens: number; cachedTokens: number; totalTokens: number;
  estimatedCostUsd: number; ok: boolean; erro?: string | null; ms?: number;
};
export type Grupo = {
  chave: string; chamadas: number; ok: number; erros: number;
  promptTokens: number; completionTokens: number; cachedTokens: number; totalTokens: number;
  custoEstimadoUsd: number; tokensPorChamada: number; ultimo: string | null;
};

const DIA = 86_400_000;
export function desde(range: Range, agora: Date = new Date()): Date | null {
  if (range === "all") return null;
  return new Date(agora.getTime() - (range === "7d" ? 7 : 30) * DIA);
}
export const RANGES: readonly Range[] = ["7d", "30d", "all"];
export const rangeValido = (r: unknown): r is Range => (RANGES as readonly string[]).includes(String(r));

const iso = (d: Date | string) => new Date(d).toISOString();
const r2 = (n: number) => Math.round(n * 1e6) / 1e6;

function agrupar(rows: LedgerRow[], chaveDe: (r: LedgerRow) => string | null): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const r of rows) {
    const k = chaveDe(r); if (!k) continue;
    const g = map.get(k) ?? { chave: k, chamadas: 0, ok: 0, erros: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, totalTokens: 0, custoEstimadoUsd: 0, tokensPorChamada: 0, ultimo: null };
    g.chamadas++; if (r.ok) g.ok++; else g.erros++;
    g.promptTokens += r.promptTokens; g.completionTokens += r.completionTokens; g.cachedTokens += r.cachedTokens; g.totalTokens += r.totalTokens;
    g.custoEstimadoUsd += r.estimatedCostUsd;
    const t = iso(r.at); if (!g.ultimo || t > g.ultimo) g.ultimo = t;
    map.set(k, g);
  }
  const out = [...map.values()].map((g) => ({ ...g, custoEstimadoUsd: r2(g.custoEstimadoUsd), tokensPorChamada: g.ok ? Math.round(g.totalTokens / g.ok) : 0 }));
  return out.sort((a, b) => b.totalTokens - a.totalTokens || a.chave.localeCompare(b.chave));
}

/** Filtra por range (linhas fora do período somem — por isso agente sem linha não aparece). */
export function noPeriodo(rows: LedgerRow[], range: Range, agora: Date = new Date()): LedgerRow[] {
  const d = desde(range, agora); if (!d) return rows;
  return rows.filter((r) => new Date(r.at).getTime() >= d.getTime());
}
export const porAgente = (rows: LedgerRow[], range: Range = "all", agora?: Date) => agrupar(noPeriodo(rows, range, agora), (r) => r.agentKey);
export const porUsuario = (rows: LedgerRow[], range: Range = "all", agora?: Date) => agrupar(noPeriodo(rows, range, agora), (r) => r.userId ?? null);
export const porPrograma = (rows: LedgerRow[], range: Range = "all", agora?: Date) => agrupar(noPeriodo(rows, range, agora), (r) => r.programId ?? null);
export const porSurface = (rows: LedgerRow[], range: Range = "all", agora?: Date) => agrupar(noPeriodo(rows, range, agora), (r) => r.surface);
export const porProvedor = (rows: LedgerRow[], range: Range = "all", agora?: Date) => agrupar(noPeriodo(rows, range, agora), (r) => r.provedor);

export type Dia = { dia: string; totalTokens: number; chamadas: number; custoEstimadoUsd: number };
/** Série dos últimos `dias` dias (UTC), SEMPRE com `dias` entradas (zeros onde não houve) — é série, não grupo. */
export function porDia(rows: LedgerRow[], dias = 14, agora: Date = new Date()): Dia[] {
  const out: Dia[] = []; const idx = new Map<string, Dia>();
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(agora.getTime() - i * DIA).toISOString().slice(0, 10);
    const e = { dia: d, totalTokens: 0, chamadas: 0, custoEstimadoUsd: 0 }; out.push(e); idx.set(d, e);
  }
  for (const r of rows) {
    const e = idx.get(iso(r.at).slice(0, 10)); if (!e) continue;
    e.totalTokens += r.totalTokens; e.chamadas++; e.custoEstimadoUsd = r2(e.custoEstimadoUsd + r.estimatedCostUsd);
  }
  return out;
}

export function topN<T extends Grupo>(grupos: T[], by: keyof Grupo = "totalTokens", n = 5): T[] {
  return [...grupos].sort((a, b) => (Number(b[by]) || 0) - (Number(a[by]) || 0)).slice(0, n);
}

export type Totais = { hoje: { totalTokens: number; chamadas: number; custoEstimadoUsd: number }; mes: { totalTokens: number; chamadas: number; custoEstimadoUsd: number } };
/** hoje = dia UTC corrente; mes = últimos 30 dias. */
export function totalizador(rows: LedgerRow[], agora: Date = new Date()): Totais {
  const hoje = agora.toISOString().slice(0, 10); const d30 = agora.getTime() - 30 * DIA;
  const t: Totais = { hoje: { totalTokens: 0, chamadas: 0, custoEstimadoUsd: 0 }, mes: { totalTokens: 0, chamadas: 0, custoEstimadoUsd: 0 } };
  for (const r of rows) {
    const at = new Date(r.at);
    if (at.getTime() >= d30) { t.mes.totalTokens += r.totalTokens; t.mes.chamadas++; t.mes.custoEstimadoUsd = r2(t.mes.custoEstimadoUsd + r.estimatedCostUsd); }
    if (iso(at).slice(0, 10) === hoje) { t.hoje.totalTokens += r.totalTokens; t.hoje.chamadas++; t.hoje.custoEstimadoUsd = r2(t.hoje.custoEstimadoUsd + r.estimatedCostUsd); }
  }
  return t;
}

/** `at` da PRIMEIRA linha (qualquer agente) ou null — o "medindo desde" do admin. */
export function medindoDesde(rows: LedgerRow[]): string | null {
  let min: string | null = null;
  for (const r of rows) { const t = iso(r.at); if (!min || t < min) min = t; }
  return min;
}
