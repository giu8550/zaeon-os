/** GET /api/user/skills — as skills do RPG acadêmico do usuário logado (array `[{id,rank,current,next,metricName}]`). */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { skillsParaLista } from "@/lib/user/skills";

export async function GET() {
  const session = await getServerSession(authOptions).catch(() => null);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = await prisma.user.findUnique({ where: { email }, select: { skills: true } });
  return NextResponse.json(skillsParaLista(u?.skills));
}
