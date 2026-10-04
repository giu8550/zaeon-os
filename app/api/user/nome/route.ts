/**
 * /api/user/nome — nome de usuário (como a pessoa aparece no cyberespaço).
 *   GET  → { name, done }   done = já escolheu o nome (User.onboardingComplete)
 *   POST { name } → valida, grava User.name e marca done. Não é único: é nome de exibição.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { validarNome } from "@/lib/ui/nomeUsuario";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { name: true, onboardingComplete: true },
  });
  return NextResponse.json({ name: u?.name ?? "", done: !!u?.onboardingComplete });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = validarNome((body as { name?: unknown })?.name);
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
  try {
    await prisma.user.update({
      where: { email: session.user.email },
      data: { name: r.nome, onboardingComplete: true },
    });
    return NextResponse.json({ ok: true, name: r.nome });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar agora." }, { status: 500 });
  }
}
