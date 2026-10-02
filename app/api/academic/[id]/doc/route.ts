/** GET /api/academic/[id]/doc — o DOCUMENTO (dado sensível): só o dono ou um verificador elegível. */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, eu, exigirFlag, elegivel, OID } from "@/lib/aura/academico-server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const me = await eu();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OID.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const c = await prisma.academicCredential.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.userId !== me.id) {
    const g = await elegivel(me, c.userId, c.instituicao);
    if (!g.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!c.docRef) return NextResponse.json({ error: "Sem documento" }, { status: 404 });
  return NextResponse.json({ id: c.id, doc: c.docRef }, { headers: { "Cache-Control": "private, no-store" } });
}
