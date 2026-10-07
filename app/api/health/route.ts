/**
 * GET /api/health — liveness simples para o healthcheck do container/compose e
 * para checagens externas (uptime). Não toca no banco de propósito: responde 200
 * sempre que o processo Node está de pé. (Readiness de DB pode virar /api/ready.)
 *
 * `commit` = SHA do build (env GIT_SHA, injetado no deploy). Mata a dessincronia
 * "o que está em prod?": `curl .../api/health` → qual commit está rodando.
 * `gateway`/`provedor` (PR-G1): off (sem GATEWAY_URL) · on · degraded (configurado e caído →
 * a camada autônoma responde pelo Vertex direto). Cache de 60s; nunca derruba o health.
 */
import { NextResponse } from "next/server";
import { estadoGateway, provedorAtual } from "@/lib/llm/saude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gateway = await estadoGateway().catch(() => "degraded" as const);
  return NextResponse.json({
    status: "ok",
    service: "zaeon-web",
    commit: process.env.GIT_SHA ?? "unknown",
    harness: process.env.AURA_HARNESS === "0" ? "off" : "on",
    gateway,
    provedor: provedorAtual(gateway),
    time: new Date().toISOString(),
  });
}
