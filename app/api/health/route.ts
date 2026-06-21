/**
 * GET /api/health — liveness simples para o healthcheck do container/compose e
 * para checagens externas (uptime). Não toca no banco de propósito: responde 200
 * sempre que o processo Node está de pé. (Readiness de DB pode virar /api/ready.)
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "zaeon-web",
    time: new Date().toISOString(),
  });
}
