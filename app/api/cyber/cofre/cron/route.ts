/**
 * POST /api/cyber/cofre/cron — a MESA roda sozinha nos cofres LIGADOS cujo intervalo (escolhido por cada pessoa) já
 * passou (lib/cyber/cofre `horaDaRodada`). Chamado de 15 em 15 min pelo workflow .github/workflows/cofres.yml com
 * `Authorization: Bearer $OCTA_CRON_SECRET` (o segredo de cron que já existe). Sem segredo = 401 sempre. No máximo 20
 * cofres por chamada (os mais atrasados primeiro).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { horaDaRodada, sanitizarConfig } from "@/lib/cyber/cofre";
import { rodada } from "@/lib/cyber/cofreServidor";

export async function POST(req: Request) {
  const segredo = process.env.OCTA_CRON_SECRET ?? "";
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const todos = await prisma.cofre.findMany({ orderBy: { ultimaRodada: "asc" }, take: 500 });
  const vez = todos.filter((c) => horaDaRodada(sanitizarConfig(c.config), c.ultimaRodada)).slice(0, 20);
  const feitos: { cofre: string; ordens: number; erro?: string }[] = [];
  for (const c of vez) {
    try { const r = await rodada(c, c.userId); feitos.push({ cofre: c.endereco, ordens: r.execucoes.length }); }
    catch (e) { feitos.push({ cofre: c.endereco, ordens: 0, erro: (e as Error).message.slice(0, 120) }); }
  }
  return NextResponse.json({ rodaram: feitos.length, feitos });
}
