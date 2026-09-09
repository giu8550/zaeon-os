/**
 * POST /api/credentials/refresh { id? } — polling das credenciais `minting` do usuário
 * (ou de uma específica, se for dele). Devolve o que mudou.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { resolveUserId } from "@/lib/agent/transcript";
import { refreshCredential, refreshPending } from "@/lib/solana/credentials";
import { prisma } from "@/src/lib/prisma";

export async function POST(req: Request) {
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  try {
    if (typeof body?.id === "string" && body.id) {
      const owned = await prisma.credential.findFirst({ where: { id: body.id, userId }, select: { id: true } });
      if (!owned) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
      const credential = await refreshCredential(owned.id);
      return NextResponse.json({ credentials: credential ? [credential] : [] });
    }
    const credentials = await refreshPending(userId);
    return NextResponse.json({ credentials });
  } catch (e: any) {
    console.error("CREDENTIALS REFRESH:", e);
    return NextResponse.json({ error: e?.message ?? "refresh failed" }, { status: 500 });
  }
}
