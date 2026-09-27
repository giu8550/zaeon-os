/**
 * POST /api/mentors/activate { slug | null } — define o mentor ATIVO do chat (null = Aura base).
 * Só aceita mentor que o usuário plugou (nunca ativa o de outra conta). `templateId` = fallback.
 */
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
    const wantsNull = body?.slug === null || (body?.slug === undefined && body?.templateId === null) || (body?.slug === undefined && body?.templateId === undefined);
    if (wantsNull) {
      await prisma.user.update({ where: { id: userId }, data: { activeMentorId: null } });
      return NextResponse.json({ ok: true, activeMentor: null, activeMentorId: null });
    }
    const tpl = await templateIdFrom(prisma, body);
    if (!tpl) return NextResponse.json({ error: "Mentor não encontrado (use { slug })" }, { status: 404 });
    const plugged = await prisma.pluggedMentor.findUnique({ where: { userId_templateId: { userId, templateId: tpl.id } } });
    if (!plugged || !plugged.enabled) return NextResponse.json({ error: "Mentor não está plugado" }, { status: 403 });
    await prisma.user.update({ where: { id: userId }, data: { activeMentorId: tpl.id } });
    return NextResponse.json({ ok: true, activeMentor: tpl.slug, activeMentorId: tpl.id });
  } catch (e: any) {
    console.error("MENTORS ACTIVATE:", e);
    return NextResponse.json({ error: e?.message ?? "activate failed" }, { status: 500 });
  }
}
