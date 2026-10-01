/**
 * POST /api/projects/save { project } — "Iniciar projeto" das salas de estudo. Grava a ideia como
 * ResearchWork (workType "Projeto") do usuário logado → aparece em "Minhas coisas" na Sala de
 * Pesquisa, que é pra onde a página manda o aluno ("discuta com o agente"). O `userId` que as
 * páginas ainda mandam (carteira ou "guest_user_123") é IGNORADO: o dono vem da sessão.
 * Idempotente: mesmo título do mesmo usuário atualiza em vez de duplicar.
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export const WORK_TYPE = "Projeto";
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Texto do trabalho a partir da ideia (PURO). */
export function conteudoDoProjeto(p: Record<string, unknown>): string {
  const linhas = [str(p.description, 4000)];
  const meta = [str(p.domain, 80) && `Domínio: ${str(p.domain, 80)}`, str(p.difficultyRank, 2) && `Nível: ${str(p.difficultyRank, 2)}`, str(p.agentName, 80) && `Sugerido por: ${str(p.agentName, 80)}`].filter(Boolean);
  if (meta.length) linhas.push("", meta.join(" · "));
  return linhas.join("\n").trim();
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions).catch(() => null);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const project = body?.project;
  if (!project || typeof project !== "object") return NextResponse.json({ error: "project obrigatório" }, { status: 400 });
  const title = str((project as Record<string, unknown>).title, 160);
  if (!title) return NextResponse.json({ error: "project.title obrigatório" }, { status: 400 });
  const content = conteudoDoProjeto(project as Record<string, unknown>);

  const existente = await prisma.researchWork.findFirst({ where: { userId: me.id, workType: WORK_TYPE, title }, select: { id: true } });
  const work = existente
    ? await prisma.researchWork.update({ where: { id: existente.id }, data: { content } })
    : await prisma.researchWork.create({ data: { userId: me.id, title, content, workType: WORK_TYPE } });
  return NextResponse.json({ ok: true, id: work.id }, { status: existente ? 200 : 201 });
}
