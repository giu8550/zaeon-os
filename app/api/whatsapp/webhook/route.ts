/**
 * POST /api/whatsapp/webhook — INBOUND do WhatsApp. Chamado pelo bridge do agent-gateway
 * (`/webhook/wa` → aqui), pelo Evolution direto (webhook da instância) ou pelo disparos (ChipFlow).
 * Aceita os três formatos (lib/whatsapp/inbound.ts).
 *
 * Auth: segredo compartilhado `WHATSAPP_WEBHOOK_SECRET` no header `x-whatsapp-secret` OU em
 * `?token=` (o Evolution v1 não manda header custom). Sem env → 503 (nunca aberto por engano).
 *
 * CONECTAR-<code> liga o número · PARE/VOLTAR · resto = turno do mentor (harness + memória).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { normalizeInbound } from "@/lib/whatsapp/inbound";
import { handleInbound } from "@/lib/whatsapp/service";

function authorized(req: Request): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-whatsapp-secret") ?? req.headers.get("apikey");
  const token = new URL(req.url).searchParams.get("token");
  return header === secret || token === secret;
}

export async function POST(req: Request) {
  if (!process.env.WHATSAPP_WEBHOOK_SECRET) return NextResponse.json({ error: "webhook not configured (WHATSAPP_WEBHOOK_SECRET)" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await req.json().catch(() => null);
  const msg = normalizeInbound(payload);
  if (!msg) return NextResponse.json({ ignored: true });
  try {
    const r = await handleInbound(msg);
    return NextResponse.json({ ok: true, action: r.action, sent: r.sent ?? false });
  } catch (e: any) {
    console.error("WHATSAPP WEBHOOK:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "inbound failed" }, { status: 500 });
  }
}

export async function GET() {
  // ping do Evolution/uptime — não expõe nada
  return NextResponse.json({ ok: true, service: "zaeon-whatsapp-webhook" });
}
