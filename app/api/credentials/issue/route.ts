/**
 * POST /api/credentials/issue { type, refId } — emite a credencial de uma conquista do PRÓPRIO usuário.
 * O servidor prova a conquista (lib/solana/achievements) antes de cunhar; título/evidência vêm do
 * Mongo, nunca do body. Idempotente por (userId,type,refId). mentor-cert não é auto-serviço (403).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { resolveUserId } from "@/lib/agent/transcript";
import { issueCredential, isCredentialType } from "@/lib/solana/credentials";
import { verifyAchievement } from "@/lib/solana/achievements";

export async function POST(req: Request) {
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const type = body?.type;
  const refId = typeof body?.refId === "string" ? body.refId.trim().slice(0, 200) : "";
  if (!isCredentialType(type) || !refId) return NextResponse.json({ error: "type (skill|work|course) e refId obrigatórios" }, { status: 400 });
  try {
    const proof = await verifyAchievement(userId, type, refId);
    if (!proof.ok) return NextResponse.json({ error: proof.reason }, { status: proof.status });
    const credential = await issueCredential(userId, { type, refId, title: proof.achievement.title, metadata: proof.achievement.metadata });
    if (!credential) return NextResponse.json({ error: "não foi possível registrar a credencial" }, { status: 500 });
    return NextResponse.json({ credential });
  } catch (e: any) {
    console.error("CREDENTIALS ISSUE:", e);
    return NextResponse.json({ error: e?.message ?? "issue failed" }, { status: 500 });
  }
}
