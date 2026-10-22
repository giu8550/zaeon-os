/**
 * GET /api/octa/github — o estado da conexão GitHub do aluno, pra IDE do Octa: `{ conectado, login, configurado }`.
 * Diferente de GET /api/projects/github, não passa pelo portão de elegibilidade da sala Projetos (o Octa não tem
 * esse portão: publicar já só usa o token do próprio aluno). Nunca devolve token.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { getUserConnection, isUserOAuthConfigured } from "@/lib/projects/github-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await getUserConnection(email);
  return NextResponse.json({ conectado: c.connected, login: c.login, configurado: isUserOAuthConfigured() });
}
