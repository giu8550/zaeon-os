/**
 * POST /api/lounge3d/mundo — entrar no MUNDO (a sala única do cyberespaço — lib/lounge3d/mundo): vira membro e
 * devolve { id }. 404 = ainda não há mundo (o cliente cai na sala própria, como antes).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { eu, exigirFlag } from "@/lib/lounge3d/server";
import { entrarNoMundo } from "@/lib/lounge3d/mundo";

export async function POST(req: Request) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-mundo"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await entrarNoMundo(me.id).catch(() => null);
  if (!id) return NextResponse.json({ error: "sem mundo" }, { status: 404 });
  return NextResponse.json({ id });
}
