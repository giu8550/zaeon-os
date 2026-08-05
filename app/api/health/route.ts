/**
 * GET /api/health — liveness simples para o healthcheck do container/compose e
 * para checagens externas (uptime). Não toca no banco de propósito: responde 200
 * sempre que o processo Node está de pé. (Readiness de DB pode virar /api/ready.)
 *
 * `commit` = SHA do build (env GIT_SHA, injetado no deploy). Mata a dessincronia
 * "o que está em prod?": `curl .../api/health` → qual commit está rodando.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "zaeon-web",
    commit: process.env.GIT_SHA ?? "unknown",
    harness: process.env.AURA_HARNESS === "0" ? "off" : "on",
    time: new Date().toISOString(),
  });
}
