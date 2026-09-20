/**
 * POST /api/skilltree { topic } — árvore de habilidades GENERATIVA do tópico.
 *
 * Cache por slug (`skill_trees`): o mesmo tópico NÃO regenera. Se a geração falhar, responde a
 * trilha linear (degraded=true, não cacheada) — nunca 500. Os nós voltam já com o status/maestria
 * do usuário logado (locked|available|in_progress|mastered).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { guard } from "@/src/lib/ratelimit";
import { getOrCreateSkillTree } from "@/lib/skilltree/generate";
import { getProgress } from "@/lib/skilltree/progress";
import { resolveUserId } from "@/lib/agent/transcript";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await guard(req, "skilltree", "ai-heavy");
  if (!rl.ok) return rl.response;

  const body = await req.json().catch(() => ({} as any));
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (topic.length < 2) return NextResponse.json({ error: "Tópico muito curto." }, { status: 400 });

  const tree = await getOrCreateSkillTree(topic);
  const userId = await resolveUserId().catch(() => null);
  // status do usuário sobre os nós (árvore cacheada OU trilha linear — mesmos ids estáveis)
  const { states: nodes } = await getProgress(userId, tree.topicSlug);
  return NextResponse.json({ topicSlug: tree.topicSlug, topicLabel: tree.topicLabel, model: tree.model, degraded: tree.degraded, nodes });
}
