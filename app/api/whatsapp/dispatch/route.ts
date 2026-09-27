/**
 * POST /api/whatsapp/dispatch (INTERNO) — roda os disparos devidos AGORA pra todos os vínculos
 * ativos: agenda do dia (≥7h), revisão espaçada (≥16h), prazos (48h). Idempotente por dedupeKey —
 * o tick do server.js chama a cada N minutos. Auth: `x-internal-token`.
 * Query: ?at=<ISO> simula "agora" (só pra teste).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { NextResponse } from "next/server";
import { internalAuthorized } from "@/lib/whatsapp/internal-auth";
import { runDispatch } from "@/lib/whatsapp/service";

export async function POST(req: Request) {
  if (!process.env.WHATSAPP_INTERNAL_TOKEN) return NextResponse.json({ error: "not configured (WHATSAPP_INTERNAL_TOKEN)" }, { status: 503 });
  if (!internalAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const at = new URL(req.url).searchParams.get("at");
  const now = at && !Number.isNaN(Date.parse(at)) ? new Date(at) : new Date();
  try {
    const s = await runDispatch(now);
    return NextResponse.json({ ok: true, at: now.toISOString(), ...s });
  } catch (e: any) {
    console.error("WHATSAPP DISPATCH:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "dispatch failed" }, { status: 500 });
  }
}
