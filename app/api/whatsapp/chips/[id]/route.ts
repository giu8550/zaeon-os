/**
 * PATCH  /api/whatsapp/chips/[id] {nome?, papel?, agentKey?, ativo?, limiteDia?, perfilNome?, perfilRecado?, foto? (data-URI JPEG)}
 *        — o que é perfil vai pro WhatsApp na hora se o chip estiver conectado (senão, quando conectar).
 * DELETE /api/whatsapp/chips/[id] — apaga o chip e a sessão no adapter.
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { apagarChip, chipPublico, editarChip } from "@/lib/whatsapp/chips";

type Ctx = { params: Promise<{ id: string }> | { id: string } };
const idDe = async (c: Ctx) => String((await c.params).id ?? "");

export async function PATCH(req: Request, ctx: Ctx) {
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: "Proibido" }, { status: a.status });
  const r = await editarChip(await idDe(ctx), await req.json().catch(() => ({})));
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
  return NextResponse.json({ chip: chipPublico(r.chip), perfil: r.perfil });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: "Proibido" }, { status: a.status });
  return NextResponse.json(await apagarChip(await idDe(ctx)));
}
