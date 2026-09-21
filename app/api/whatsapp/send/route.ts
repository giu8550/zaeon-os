/**
 * POST /api/whatsapp/send (INTERNO) — manda uma mensagem pro aluno respeitando opt-in + quiet hours.
 * Body: { userId, text?, facts?, kind?="test", dedupeKey?, ignoreQuiet? }.
 *   text  → envia literal · facts → reescreve na voz do mentor ativo (lib/whatsapp/voice.ts).
 * Auth: `x-internal-token: WHATSAPP_INTERNAL_TOKEN` (ou Bearer). Usado pelo DoD ("disparo de teste")
 * e por qualquer serviço interno (skill tree/Solana podem chamar aqui em vez do gancho TS).
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { internalAuthorized } from "@/lib/whatsapp/internal-auth";
import { notifyInVoice, notifyWhatsApp } from "@/lib/whatsapp/service";

export async function POST(req: Request) {
  if (!process.env.WHATSAPP_INTERNAL_TOKEN) return NextResponse.json({ error: "not configured (WHATSAPP_INTERNAL_TOKEN)" }, { status: 503 });
  if (!internalAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const kind = typeof body?.kind === "string" && body.kind ? body.kind : "test";
  if (!userId) return NextResponse.json({ error: "userId obrigatório" }, { status: 400 });
  try {
    const r = typeof body?.facts === "string" && body.facts
      ? await notifyInVoice(userId, kind, body.facts, body.dedupeKey ?? null, !!body.ignoreQuiet)
      : typeof body?.text === "string" && body.text
        ? await notifyWhatsApp({ userId, kind, text: body.text, dedupeKey: body.dedupeKey ?? null, ignoreQuiet: !!body.ignoreQuiet })
        : null;
    if (!r) return NextResponse.json({ error: "text ou facts obrigatório" }, { status: 400 });
    return NextResponse.json(r, { status: r.sent ? 200 : 202 });
  } catch (e: any) {
    console.error("WHATSAPP SEND:", e);
    return NextResponse.json({ error: e?.message ?? "send failed" }, { status: 500 });
  }
}
