/** POST /api/mentors/unplug { slug } — remove o mentor do usuário; se era o ativo, volta pra Aura base. */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { resolveUserId } from "@/lib/agent/transcript";
import { templateIdFrom } from "@/lib/agent/mentors-server";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const tpl = await templateIdFrom(prisma, body);
    if (!tpl) return NextResponse.json({ error: "Mentor não encontrado (use { slug })" }, { status: 404 });
    await prisma.pluggedMentor.deleteMany({ where: { userId, templateId: tpl.id } });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { activeMentorId: true } });
    if (user?.activeMentorId === tpl.id) {
      await prisma.user.update({ where: { id: userId }, data: { activeMentorId: null } });
    }
    return NextResponse.json({ ok: true, slug: tpl.slug });
  } catch (e: any) {
    console.error("MENTORS UNPLUG:", e);
    return NextResponse.json({ error: e?.message ?? "unplug failed" }, { status: 500 });
  }
}
