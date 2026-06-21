/**
 * /api/onboard/tour — registra que o usuário fez o TOUR guiado da Zaeon (onboarding).
 *   GET  → { tourDone: boolean }
 *   POST → marca tourDone=true (idempotente). Visível no dashboard admin.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { tourDone: true } });
  return NextResponse.json({ tourDone: !!u?.tourDone });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await prisma.user.update({ where: { email: session.user.email }, data: { tourDone: true } });
    return NextResponse.json({ ok: true, tourDone: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro" }, { status: 500 });
  }
}
