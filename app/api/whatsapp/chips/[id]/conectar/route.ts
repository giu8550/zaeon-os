/**
 * GET /api/whatsapp/chips/[id]/conectar — o painel pergunta a cada ~3 s: {estado:"qr", qr} (o QR da vez, PNG
 * data-URI; null = gerando) ou {estado:"conectado", numero}. É o ConnectStep da ChipFlow (POLL_MS=3000).
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { conectarChip } from "@/lib/whatsapp/chips";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: "Proibido" }, { status: a.status });
  const r = await conectarChip(String((await ctx.params).id ?? ""));
  return NextResponse.json(r, { status: r.estado === "erro" ? 502 : 200 });
}
