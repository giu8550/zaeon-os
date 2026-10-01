/** GET /api/canal/agentes?canal=<id> — agentes que EU posso convocar (Aura + contratados + presentes no canal). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag, isObjectId, agentesDoCanal, agentesPublicos } from "@/lib/canal/server";

export async function GET(req: Request) {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canalId = new URL(req.url).searchParams.get("canal");
  let presentes: string[] = [];
  if (isObjectId(canalId)) {
    const c = await prisma.canal.findUnique({ where: { id: canalId }, select: { agentes: true } });
    presentes = c?.agentes ?? [];
  }
  return NextResponse.json({ agentes: agentesPublicos(await agentesDoCanal(u.id, presentes)) });
}
