/**
 * GET    /api/whatsapp/link/status — estado do vínculo do usuário logado (número mascarado).
 * PATCH  /api/whatsapp/link/status { quietHours: { start, end, tz } } — "não incomodar".
 * DELETE /api/whatsapp/link/status — desliga (opt-out + desverifica).
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { resolveUserId } from "@/lib/agent/transcript";
import { getLinkStatus, setQuietHours, unlink } from "@/lib/whatsapp/service";

export async function GET() {
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await getLinkStatus(userId)); }
  catch (e: any) { return NextResponse.json({ error: e?.message ?? "status failed" }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.quietHours) await setQuietHours(userId, body.quietHours);
    return NextResponse.json(await getLinkStatus(userId));
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "update failed" }, { status: 500 }); }
}

export async function DELETE() {
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await unlink(userId); return NextResponse.json({ ok: true }); }
  catch (e: any) { return NextResponse.json({ error: e?.message ?? "unlink failed" }, { status: 500 }); }
}
