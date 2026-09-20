/**
 * /api/skilltree/progress — progresso do usuário na árvore de um tópico.
 *
 *   GET  ?topic=<tópico|slug>            → { topicSlug, topicLabel, degraded, nodes: SkillNodeState[] }
 *   POST { topic, nodeId, delta? | mastered? } → sobe a maestria (marcação manual "entendi" = mastered:true).
 *        Nó `locked` não sobe (409). Ao dominar: desbloqueia filhos, espelha no RPG, dispara o gancho Solana.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { resolveUserId } from "@/lib/agent/transcript";
import { topicSlug } from "@/lib/skilltree/types";
import { getProgress, masteryUpdate } from "@/lib/skilltree/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const topic = new URL(req.url).searchParams.get("topic")?.trim() ?? "";
  if (!topic) return NextResponse.json({ error: "topic obrigatório" }, { status: 400 });
  const slug = topicSlug(topic);
  const userId = await resolveUserId().catch(() => null);
  const p = await getProgress(userId, slug);
  return NextResponse.json({ topicSlug: slug, topicLabel: p.topicLabel, degraded: p.degraded, nodes: p.states });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const nodeId = typeof body.nodeId === "string" ? body.nodeId.trim() : "";
  if (!topic || !nodeId) return NextResponse.json({ error: "topic e nodeId obrigatórios" }, { status: 400 });
  const delta = body.mastered === true ? 1 : Math.min(1, Math.max(0, Number(body.delta) || 0));
  if (delta <= 0) return NextResponse.json({ error: "delta inválido" }, { status: 400 });

  const r = await masteryUpdate(userId, topicSlug(topic), nodeId, delta);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: r.reason === "locked" ? 409 : 404 });
  return NextResponse.json({ nodes: r.states, node: r.node, unlocked: r.unlocked, newlyMastered: r.newlyMastered, degraded: r.degraded });
}
