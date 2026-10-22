/**
 * GET /api/octa/projetos — lista os projetos do aluno logado; POST — cria um (só `nome`).
 * O dono vem SEMPRE da sessão. Nunca devolve token nem nada do GitHub além do repo/URL já salvos.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { criarProjeto, listarProjetos, type ProjetosDb } from "@/lib/octa/projetos";

export const runtime = "nodejs";

const db = prisma as unknown as ProjetosDb;

async function donoDaSessao(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  return String((session!.user as any).id ?? email);
}

export async function GET() {
  const userId = await donoDaSessao();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projetos = await listarProjetos(db, userId);
  return NextResponse.json({ projetos });
}

export async function POST(req: Request) {
  const userId = await donoDaSessao();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const nome = typeof body?.nome === "string" ? body.nome : "";
  const projeto = await criarProjeto(db, userId, nome);
  return NextResponse.json({ projeto }, { status: 201 });
}
