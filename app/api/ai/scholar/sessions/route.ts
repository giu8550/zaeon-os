import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { NextResponse } from "next/server";
import { cacheJson, cacheDel } from "@/src/lib/cache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The session.user does NOT carry an id field — look it up from email.
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = dbUser.id;

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const one = await prisma.scholarSession.findFirst({ where: { id, userId } });
    return NextResponse.json({ session: one });
  }
  // lista cacheada por usuário (30s); invalidada quando uma nova pesquisa começa (scholar/route)
  const list = await cacheJson(`sess:${userId}`, 30, () => prisma.scholarSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, query: true, domain: true, status: true, createdAt: true },
  }));
  return NextResponse.json({ sessions: list });
}

// DELETE ?id= — apaga uma pesquisa do histórico (só do dono).
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  // só apaga se for do usuário
  await prisma.scholarSession.deleteMany({ where: { id, userId: dbUser.id } });
  try { await cacheDel(`sess:${dbUser.id}`); } catch { /* ignore */ }
  return NextResponse.json({ ok: true });
}
