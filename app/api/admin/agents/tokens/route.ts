/**
 * GET /api/admin/agents/tokens?range=7d|30d|all&groupBy=agente|usuario|programa (founder-only, PR-A3).
 * Lê o TokenLedger (C5) e devolve agregações PURAS (lib/metrics/tokens.ts). Painel = LEITURA: entra ligado,
 * sem toggle. `medindoDesde` = primeira linha do ledger (qualquer agente) ou null; ledger vazio → UI declara
 * o vazio em vez de 0. Agente sem linha no período NÃO aparece em `grupos` (UI mostra "—").
 * `hoje` (tokens de hoje por agente, dia local) + `tetos` (AgentProfile.tetoTokensDia) → aviso "estouraria o teto".
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { agentsAdmin } from "@/lib/canal/flags";
import { desde, rangeValido, porAgente, porUsuario, porPrograma, porDia, totalizador, medindoDesde, type LedgerRow, type Range } from "@/lib/metrics/tokens";
import { inicioDoDiaLocal, decidirTeto } from "@/lib/llm/teto";

const GROUPS = ["agente", "usuario", "programa"] as const;
type GroupBy = (typeof GROUPS)[number];
export const TAKE_MAX = 50_000;

async function gate(): Promise<NextResponse | null> {
  if (!agentsAdmin()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: a.status === 401 ? "Unauthorized" : "Forbidden" }, { status: a.status });
  return null;
}

export async function GET(req: Request) {
  const g = await gate(); if (g) return g;
  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "7d";
  const groupBy = url.searchParams.get("groupBy") ?? "agente";
  if (!rangeValido(range)) return NextResponse.json({ error: "range: 7d | 30d | all" }, { status: 400 });
  if (!(GROUPS as readonly string[]).includes(groupBy)) return NextResponse.json({ error: "groupBy: agente | usuario | programa" }, { status: 400 });
  const agora = new Date();
  const d = desde(range as Range, agora);

  const [rows, primeira, perfis] = await Promise.all([
    prisma.tokenLedger.findMany({ where: d ? { at: { gte: d } } : {}, orderBy: { at: "desc" }, take: TAKE_MAX }) as Promise<LedgerRow[]>,
    prisma.tokenLedger.findFirst({ orderBy: { at: "asc" }, select: { at: true } }),
    prisma.agentProfile.findMany({ select: { agentKey: true, tetoTokensDia: true } }),
  ]);

  const grupos = (groupBy as GroupBy) === "usuario" ? porUsuario(rows, "all") : (groupBy as GroupBy) === "programa" ? porPrograma(rows, "all") : porAgente(rows, "all");
  let nomes: Record<string, { nome: string | null; email: string | null }> = {};
  if (groupBy === "usuario" && grupos.length) {
    const users = await prisma.user.findMany({ where: { id: { in: grupos.map((x) => x.chave) } }, select: { id: true, name: true, email: true } }).catch(() => []);
    nomes = Object.fromEntries(users.map((u) => [u.id, { nome: u.name ?? null, email: u.email ?? null }]));
  }

  // hoje (dia local) por agente — pra o aviso de teto, independente do range pedido
  const ini = inicioDoDiaLocal(agora);
  const hoje: Record<string, number> = {};
  for (const r of rows) if (new Date(r.at).getTime() >= ini.getTime()) hoje[r.agentKey] = (hoje[r.agentKey] ?? 0) + r.totalTokens;
  const tetos = Object.fromEntries(perfis.map((p) => [p.agentKey, { ...decidirTeto(hoje[p.agentKey] ?? 0, p.tetoTokensDia) }]));

  return NextResponse.json({
    range, groupBy,
    grupos: grupos.map((x) => ({ ...x, ...(nomes[x.chave] ?? {}) })),
    serie14d: porDia(rows, 14, agora),
    totais: totalizador(rows, agora),
    medindoDesde: primeira?.at ? new Date(primeira.at).toISOString() : null,
    hoje, tetos,
    truncado: rows.length >= TAKE_MAX,
  });
}
