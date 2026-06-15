/**
 * POST /api/projects/github/disconnect — desconecta a conta GitHub do usuário
 * (logout): apaga o token cifrado guardado no User.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { clearUserToken } from "@/lib/projects/github-user";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await clearUserToken(session.user.email);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Falha ao desconectar." }, { status: 500 });
  }
}
