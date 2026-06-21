/**
 * GET /api/collab/sources — meus estudos e pesquisas (pra escolher o que compartilhar
 * no Lounge). Cada item vira um card com botão ▶ que cria o collab.
 *   { studies: Item[], research: Item[] }   Item = { id, title, kind }
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
  const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const [spaces, sessions] = await Promise.all([
      prisma.studySpace.findMany({ where: { userId: u.id }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, title: true } }),
      prisma.scholarSession.findMany({ where: { userId: u.id }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, query: true } }),
    ]);
    return NextResponse.json({
      studies: spaces.map((s) => ({ id: s.id, title: s.title || "Meus Estudos", kind: "study" })),
      research: sessions.map((s) => ({ id: s.id, title: (s.query || "Pesquisa sem título").slice(0, 90), kind: "research" })),
    });
  } catch {
    return NextResponse.json({ studies: [], research: [] });
  }
}
