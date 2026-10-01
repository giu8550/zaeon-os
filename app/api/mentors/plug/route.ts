/**
 * POST /api/mentors/plug { slug } — CONTRATA um mentor do catálogo pro usuário (idempotente).
 * `templateId` aceito como fallback. TETO por papel (lib/mentors/limite): aluno 3 / professor 10
 * → 403 com mensagem amigável + { limit, count }. Re-contratar um já ativo nunca conta de novo.
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { resolveUserId } from "@/lib/agent/transcript";
import { templateIdFrom } from "@/lib/agent/mentors-server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { limiteContratacao, podeContratar, mensagemTeto } from "@/lib/mentors/limite";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const tpl = await templateIdFrom(prisma, body);
    if (!tpl) return NextResponse.json({ error: "Mentor não encontrado (use { slug })" }, { status: 404 });
    const [session, ativos, jaAtivo] = await Promise.all([
      getServerSession(authOptions).catch(() => null),
      prisma.pluggedMentor.count({ where: { userId, enabled: true } }),
      prisma.pluggedMentor.findUnique({ where: { userId_templateId: { userId, templateId: tpl.id } }, select: { enabled: true } }),
    ]);
    const limit = limiteContratacao(session);
    if (!jaAtivo?.enabled && !podeContratar(ativos, limit)) {
      return NextResponse.json({ error: mensagemTeto(limit), limit, count: ativos }, { status: 403 });
    }
    await prisma.pluggedMentor.upsert({
      where: { userId_templateId: { userId, templateId: tpl.id } },
      update: { enabled: true },
      create: { userId, templateId: tpl.id, enabled: true },
    });
    // Recontagem DEPOIS de gravar: dois cliques quase simultâneos passam os dois pela checagem
    // acima (ambos viram `ativos = limit-1`). Se estourou, desfaz este e devolve 403 — o teto
    // vale mesmo sob corrida, e o `count` que volta pra UI é o real, não o estimado.
    const depois = await prisma.pluggedMentor.count({ where: { userId, enabled: true } });
    if (!jaAtivo?.enabled && depois > limit) {
      await prisma.pluggedMentor.deleteMany({ where: { userId, templateId: tpl.id } });
      return NextResponse.json({ error: mensagemTeto(limit), limit, count: depois - 1 }, { status: 403 });
    }
    return NextResponse.json({ ok: true, plugged: { slug: tpl.slug, templateId: tpl.id }, limit, count: depois });
  } catch (e: any) {
    console.error("MENTORS PLUG:", e);
    return NextResponse.json({ error: e?.message ?? "plug failed" }, { status: 500 });
  }
}
