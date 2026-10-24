/**
 * POST /api/whatsapp/dispatch (INTERNO) — roda os disparos devidos AGORA pra todos os vínculos
 * ativos: agenda do dia (≥7h), revisão espaçada (≥16h), prazos (48h). Idempotente por dedupeKey —
 * o tick do server.js chama a cada N minutos. Auth: `x-internal-token`.
 * Com ZAEON_PROATIVA=1 roda a Zaeon proativa (lib/whatsapp/zaeon/worker) no lugar de agenda/revisão.
 * Query: ?at=<ISO> simula "agora" (só pra teste).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { NextResponse } from "next/server";
import { internalAuthorized } from "@/lib/whatsapp/internal-auth";
import { runDispatch } from "@/lib/whatsapp/service";
import { runZaeon, zaeonLigada } from "@/lib/whatsapp/zaeon/worker";

export async function POST(req: Request) {
  if (!process.env.WHATSAPP_INTERNAL_TOKEN) return NextResponse.json({ error: "not configured (WHATSAPP_INTERNAL_TOKEN)" }, { status: 503 });
  if (!internalAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const at = new URL(req.url).searchParams.get("at");
  const now = at && !Number.isNaN(Date.parse(at)) ? new Date(at) : new Date();
  try {
    // ZAEON_PROATIVA=1: a Zaeon (3× ao dia + lembretes, ou a cada 45 min sem rotina) substitui agenda/revisão
    // ?dry=1&userId=…[&forcar=manha|tarde|noite|descoberta]: compõe a mensagem real da Zaeon SEM mandar (feedback)
    const q = new URL(req.url).searchParams;
    if (q.get("dry") === "1") {
      const userId = q.get("userId");
      if (!userId) return NextResponse.json({ error: "dry=1 exige userId" }, { status: 400 });
      const forcar = q.get("forcar") as "manha" | "tarde" | "noite" | "descoberta" | null;
      const z = await runZaeon(now, { seco: true, userId, ...(forcar ? { forcar } : {}) });
      return NextResponse.json({ ok: true, dry: true, at: now.toISOString(), ...z });
    }
    if (zaeonLigada()) {
      const z = await runZaeon(now);
      return NextResponse.json({ ok: true, at: now.toISOString(), zaeon: true, users: z.pessoas, sent: z.enviadas, skipped: z.puladas, errors: z.erros, details: z.detalhes });
    }
    const s = await runDispatch(now);
    return NextResponse.json({ ok: true, at: now.toISOString(), ...s });
  } catch (e: any) {
    console.error("WHATSAPP DISPATCH:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "dispatch failed" }, { status: 500 });
  }
}
