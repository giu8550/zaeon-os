/** POST /api/whatsapp/chips/[id]/sair — desconecta o número (logout). O chip fica, e reconecta por QR. */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { desconectarChip } from "@/lib/whatsapp/chips";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: "Proibido" }, { status: a.status });
  const r = await desconectarChip(String((await ctx.params).id ?? ""));
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
