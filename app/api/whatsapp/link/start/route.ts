/**
 * POST /api/whatsapp/link/start — gera o código one-time e o QR `wa.me` (data URL) do NÚMERO DA
 * PLATAFORMA com o texto `CONECTAR-<code>`. O aluno escaneia → envia → o inbound liga o número
 * ao userId (verified + optIn). Não pareia a conta do aluno. Gate: Plus (ou WHATSAPP_OPEN_TO_ALL=1).
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { resolveUserId } from "@/lib/agent/transcript";
import { startLink } from "@/lib/whatsapp/service";

export async function POST() {
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const r = await startLink(userId);
    if (!r.ok) {
      const status = r.error === "plan_required" ? 403 : r.error === "not_configured" ? 503 : 404;
      const msg = r.error === "plan_required"
        ? "O mentor no WhatsApp faz parte do plano Plus."
        : r.error === "not_configured" ? "WhatsApp da plataforma ainda não configurado (WHATSAPP_PLATFORM_PHONE)." : "Usuário não encontrado.";
      return NextResponse.json({ error: msg, code: r.error }, { status });
    }
    return NextResponse.json(r);
  } catch (e: any) {
    console.error("WHATSAPP LINK START:", e);
    return NextResponse.json({ error: e?.message ?? "link start failed" }, { status: 500 });
  }
}
