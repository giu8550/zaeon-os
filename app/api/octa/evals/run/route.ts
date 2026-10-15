/**
 * POST /api/octa/evals/run — a rotina diária anti-alucinação (Pack Octa §5). Chamada por cron em
 * janela segura (fora de pico), com `Authorization: Bearer $OCTA_CRON_SECRET`. Sem segredo = 401 sempre.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { OCTA_CODE_LIGADO } from "@/lib/octa/flag";
import { PrismaEvalStore, rotinaDiaria, agentesRegistrados } from "@/lib/octa/evals/server";
import { octaGatewayConfigurado } from "@/lib/octa/litellm";

export const runtime = "nodejs";
export const maxDuration = 300;

function autorizado(req: Request): boolean {
  const segredo = process.env.OCTA_CRON_SECRET ?? "";
  const veio = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!segredo || veio.length !== segredo.length) return false;
  return timingSafeEqual(Buffer.from(veio), Buffer.from(segredo));
}

export async function POST(req: Request) {
  if (!OCTA_CODE_LIGADO) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!autorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!agentesRegistrados().length && !octaGatewayConfigurado()) {
    return NextResponse.json({ ok: false, motivo: "nenhum agente registrado e LiteLLM não configurado" }, { status: 503 });
  }
  const rels = await rotinaDiaria(new PrismaEvalStore(), {
    alertar: async (msg) => console.warn(`[octa-evals] ${msg}`),
  });
  return NextResponse.json({ ok: true, resumo: rels.map((r) => ({ agente: r.agente, status: r.status, taxaPass: r.taxaPass, drift: r.drift })) });
}
