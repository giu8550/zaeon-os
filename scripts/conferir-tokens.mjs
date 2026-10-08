#!/usr/bin/env node
/**
 * scripts/conferir-tokens.mjs — confere o painel do admin contra a soma CRUA do token_ledger (PR-A3).
 *   node scripts/conferir-tokens.mjs [--range 7d|30d|all] [--url https://zaeon.com.br --cookie "<cookie de sessão admin>"]
 * Sem --url: só imprime a soma crua por agente (in/out/cached/total/custo). Com --url+--cookie: baixa
 * GET /api/admin/agents/tokens e imprime a DIFERENÇA coluna a coluna (gate: 0 em todas).
 * Lê DATABASE_URL do .env. Node 18+, usa o Prisma do projeto (npx prisma generate antes).
 */
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
for (const f of [".env", ".env.secrets", ".env.local"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) { const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2"); }
}
const args = process.argv.slice(2); const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const range = flag("--range") ?? "7d"; const url = flag("--url"); const cookie = flag("--cookie");
const DIA = 86_400_000; const desde = range === "all" ? null : new Date(Date.now() - (range === "7d" ? 7 : 30) * DIA);

const { PrismaClient } = createRequire(import.meta.url)("@prisma/client");
const prisma = new PrismaClient();
const rows = await prisma.tokenLedger.findMany({ where: desde ? { at: { gte: desde } } : {}, select: { agentKey: true, promptTokens: true, completionTokens: true, cachedTokens: true, totalTokens: true, estimatedCostUsd: true, ok: true } });
await prisma.$disconnect();
const cru = {};
for (const r of rows) { const g = (cru[r.agentKey] ??= { chamadas: 0, ok: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, totalTokens: 0, custoEstimadoUsd: 0 }); g.chamadas++; if (r.ok) g.ok++; g.promptTokens += r.promptTokens; g.completionTokens += r.completionTokens; g.cachedTokens += r.cachedTokens; g.totalTokens += r.totalTokens; g.custoEstimadoUsd += r.estimatedCostUsd; }
for (const g of Object.values(cru)) g.custoEstimadoUsd = Math.round(g.custoEstimadoUsd * 1e6) / 1e6;
const COLS = ["chamadas", "promptTokens", "completionTokens", "cachedTokens", "totalTokens", "custoEstimadoUsd"];
console.log(`# soma crua token_ledger · range=${range} · ${rows.length} linhas`);
for (const [k, g] of Object.entries(cru).sort((a, b) => b[1].totalTokens - a[1].totalTokens)) console.log(k.padEnd(20) + COLS.map((c) => String(g[c]).padStart(14)).join(""));
if (!url) { console.log("\n(passe --url e --cookie pra conferir contra a rota do admin)"); process.exit(0); }
const r = await fetch(`${url.replace(/\/+$/, "")}/api/admin/agents/tokens?range=${range}&groupBy=agente`, { headers: cookie ? { cookie } : {} });
if (!r.ok) { console.error(`rota devolveu HTTP ${r.status}`); process.exit(1); }
const { grupos } = await r.json();
let diffs = 0;
for (const g of grupos) { const c = cru[g.chave] ?? {}; for (const col of COLS) { const d = Math.abs((g[col] ?? 0) - (c[col] ?? 0)); if (d > 1e-6) { diffs++; console.log(`DIFF ${g.chave}.${col}: rota=${g[col]} cru=${c[col]}`); } } }
for (const k of Object.keys(cru)) if (!grupos.find((g) => g.chave === k)) { diffs++; console.log(`DIFF ${k}: no cru, ausente na rota`); }
console.log(diffs ? `\n${diffs} diferença(s).` : "\nDiferença 0 em todas as colunas."); process.exit(diffs ? 1 : 0);
