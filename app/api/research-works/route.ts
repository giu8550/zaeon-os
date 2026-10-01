/**
 * /api/research-works — os TRABALHOS reais da Sala de Pesquisa ("Minhas coisas").
 *   GET            → lista do usuário (id, title, updatedAt) desc.
 *   GET ?id=<id>   → um trabalho completo (com content + workType).
 *   POST           → upsert: cria (sem id) ou atualiza (com id) title/content/workType.
 *   DELETE ?id=    → remove (só do dono).
 *
 * Substitui ScholarSession como fonte de "Minhas coisas" — aquelas eram histórico de
 * BUSCAS (criadas a cada pesquisa, inclusive da Sala de Estudos) = as "pesquisas fantasmas".
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

async function uid(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const me = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  return me?.id ?? null;
}

export async function GET(req: Request) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const work = await prisma.researchWork.findFirst({ where: { id, userId } });
    if (!work) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json(work);
  }

  const works = await prisma.researchWork.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
  const sessions = works.map((w) => ({ id: w.id, title: (w.title && w.title.trim()) || "Pesquisa sem título", updatedAt: w.updatedAt }));
  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const id = typeof body.id === "string" ? body.id : "";
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : undefined;
  const content = typeof body.content === "string" ? body.content.slice(0, 200000) : undefined;
  const workType = typeof body.workType === "string" ? body.workType.slice(0, 40) : undefined;

  if (id) {
    const owned = await prisma.researchWork.findFirst({ where: { id, userId }, select: { id: true, secoes: true } });
    if (!owned) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    // TCC cross-sala (tem seções): o autosave do editor manda o markdown INTEIRO — aqui ele vira
    // operações POR SEÇÃO (origem "aluno"), com histórico. Sem isso, salvar a folha atropelaria em
    // silêncio o que a Sala de Estudos escreveu noutra seção. Work comum segue o caminho de sempre.
    if (Array.isArray(owned.secoes) && content !== undefined) {
      const { aplicarConteudoManual } = await import("@/lib/tcc/store");
      // tccBase = a versão que o editor tinha → merge de 3 vias por seção (não reverte a outra sala)
      const base = typeof body.tccBase === "string" ? body.tccBase.slice(0, 200000) : undefined;
      const r = await aplicarConteudoManual(id, userId, content, title, base);
      if (!r.ok) return NextResponse.json({ error: r.reason === "conflict" ? "Edição simultânea — tente de novo" : "Não foi possível salvar" }, { status: r.reason === "conflict" ? 409 : 400 });
      const work = await prisma.researchWork.findUnique({ where: { id } });
      return NextResponse.json(work);
    }
    const updateData = {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(workType !== undefined ? { workType } : {}),
    };
    const work = await prisma.researchWork.update({ where: { id }, data: updateData });
    return NextResponse.json(work);
  }

  const createData = { userId, title: title ?? "", content: content ?? "", workType: workType ?? null };
  const work = await prisma.researchWork.create({ data: createData });
  return NextResponse.json(work);
}

export async function DELETE(req: Request) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const owned = await prisma.researchWork.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  await prisma.researchWork.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
