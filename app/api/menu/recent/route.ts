/**
 * GET /api/menu/recent — alimenta os módulos expansíveis do menu inicial.
 * Devolve as últimas interações do usuário em PESQUISAS (ScholarSession) e
 * ESTUDOS (StudySpace). Projetos vivem no localStorage (cliente), então não
 * entram aqui — o menu lê os projetos direto do navegador.
 *
 *   { research: Item[], studies: Item[] }
 *   Item = { id, title, when, href }
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function uid(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  return u?.id ?? null;
}

export async function GET() {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [sessions, spaces] = await Promise.all([
      prisma.scholarSession.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: { id: true, query: true, updatedAt: true },
      }),
      prisma.studySpace.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: { id: true, title: true, updatedAt: true },
      }),
    ]);

    const research = sessions.map((s) => ({
      id: s.id,
      title: (s.query || "Pesquisa sem título").slice(0, 80),
      when: s.updatedAt,
      href: `/research-lab?tab=pesquisa&session=${s.id}`,
    }));
    const studies = spaces.map((s) => ({
      id: s.id,
      title: (s.title || "Meus Estudos").slice(0, 80),
      when: s.updatedAt,
      href: `/research-lab?tab=sala-de-estudos&space=${s.id}`,
    }));

    return NextResponse.json({ research, studies });
  } catch {
    // nunca derruba o menu por causa de dados
    return NextResponse.json({ research: [], studies: [] });
  }
}
