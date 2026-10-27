/**
 * /api/onboard/vistos — #629: os tutoriais/dicas do laboratório que a pessoa JÁ VIU, na conta (User.toursVistos).
 *   GET    → { vistos: string[] }
 *   POST   { itens: string[] } → junta aos já vistos (só itens conhecidos: lib/onboarding/vistosConta) → { vistos }
 *   DELETE → esquece todos ("Rever tutorial") → { vistos: [] }
 * Só a própria conta (sessão). Não mexe no `tourDone` (missão do tablet / boas-vindas).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { limparItens } from "@/lib/onboarding/vistosConta";

async function email(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email ?? null;
}
const semLogin = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET() {
  const e = await email(); if (!e) return semLogin();
  const u = await prisma.user.findUnique({ where: { email: e }, select: { toursVistos: true } });
  return NextResponse.json({ vistos: limparItens(u?.toursVistos) });
}

export async function POST(req: Request) {
  const e = await email(); if (!e) return semLogin();
  const body = (await req.json().catch(() => null)) as { itens?: unknown } | null;
  const novos = limparItens(body?.itens);
  if (!novos.length) return NextResponse.json({ error: "itens inválidos" }, { status: 400 });
  try {
    const u = await prisma.user.findUnique({ where: { email: e }, select: { toursVistos: true } });
    const vistos = limparItens([...limparItens(u?.toursVistos), ...novos]);
    await prisma.user.update({ where: { email: e }, data: { toursVistos: vistos } });
    return NextResponse.json({ vistos });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro" }, { status: 500 });
  }
}

export async function DELETE() {
  const e = await email(); if (!e) return semLogin();
  try {
    await prisma.user.update({ where: { email: e }, data: { toursVistos: [] } });
    return NextResponse.json({ vistos: [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro" }, { status: 500 });
  }
}
