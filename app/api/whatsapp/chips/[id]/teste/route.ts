/** POST /api/whatsapp/chips/[id]/teste {numero, texto?} — manda uma mensagem de teste POR ESTE chip. */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { toE164 } from "@/lib/whatsapp/phone";
import { enviarPorChip } from "@/lib/whatsapp/envio-chip";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: "Proibido" }, { status: a.status });
  const b = await req.json().catch(() => ({}));
  const numero = toE164(String(b?.numero ?? ""));
  if (!numero) return NextResponse.json({ error: "número inválido (use DDD + número)" }, { status: 400 });
  const texto = String(b?.texto ?? "").trim() || "Oi! Aqui é a Zaeon — este chip está funcionando. ✨";
  const r = await enviarPorChip({ phone: numero, text: texto.slice(0, 1000), chipId: String((await ctx.params).id ?? "") });
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
