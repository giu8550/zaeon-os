/**
 * POST /api/collab/[id]/ping — presença em tempo real ("fulano está digitando/gerando").
 *   body: { state: "typing" | "generating" | "idle" }
 * Dispara Pusher `collab-<id>` evento `presence` {userId,name,state} pros outros membros.
 * Best-effort, throttle no cliente (~1.2s).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { triggerSafe } from "@/lib/collab/realtime";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });
  const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, name: true } });
  if (!u) return NextResponse.json({ ok: false }, { status: 404 });

  const { state } = await req.json().catch(() => ({} as any));
  const s = ["typing", "generating", "idle"].includes(state) ? state : "idle";

  await triggerSafe(`collab-${params.id}`, "presence", { userId: u.id, name: u.name || "Alguém", state: s, ts: Date.now() });
  return NextResponse.json({ ok: true });
}
