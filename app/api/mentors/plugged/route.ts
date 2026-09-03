/**
 * GET /api/mentors/plugged — os mentores que ESTE usuário plugou (+ activeMentorId).
 * Filtra por userId sempre: outra conta nunca vê o que você plugou.
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { resolveUserId } from "@/lib/agent/transcript";

const prisma = new PrismaClient();

export async function GET() {
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [plugs, user] = await Promise.all([
      prisma.pluggedMentor.findMany({ where: { userId, enabled: true }, orderBy: { pluggedAt: "asc" } }),
      prisma.user.findUnique({ where: { id: userId }, select: { activeMentorId: true } }),
    ]);
    const ids = plugs.map((p) => p.templateId);
    const templates = ids.length ? await prisma.mentorTemplate.findMany({ where: { id: { in: ids } } }) : [];
    const byId = new Map(templates.map((t) => [t.id, t]));
    const mentors = plugs
      .map((p) => byId.get(p.templateId))
      .filter(Boolean)
      .map((t: any) => ({ id: t.id, slug: t.slug, name: t.name, course: t.course, emoji: t.emoji, signatureArtifacts: t.signatureArtifacts }));
    // activeMentorId só vale se ainda está plugado (desplugar limpa, mas garante aqui também)
    const active = user?.activeMentorId && mentors.some((m) => m.id === user.activeMentorId) ? user.activeMentorId : null;
    const activeMentor = active ? mentors.find((m) => m.id === active)?.slug ?? null : null; // slug = chave pública
    return NextResponse.json({ mentors, activeMentor, activeMentorId: active });
  } catch (e) {
    console.error("MENTORS PLUGGED:", e);
    return NextResponse.json({ mentors: [], activeMentor: null, activeMentorId: null });
  }
}
