/** POST /api/mentors/plug { slug } — pluga um mentor do catálogo pro usuário (idempotente). `templateId` aceito como fallback. */
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
    await prisma.pluggedMentor.upsert({
      where: { userId_templateId: { userId, templateId: tpl.id } },
      update: { enabled: true },
      create: { userId, templateId: tpl.id, enabled: true },
    });
    return NextResponse.json({ ok: true, plugged: { slug: tpl.slug, templateId: tpl.id } });
  } catch (e: any) {
    console.error("MENTORS PLUG:", e);
    return NextResponse.json({ error: e?.message ?? "plug failed" }, { status: 500 });
  }
}
