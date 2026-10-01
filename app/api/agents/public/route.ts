/**
 * GET /api/agents/public — identidade PÚBLICA dos agentes (nome/avatar/bio), cacheada, pra
 * landing e loja. Flag NEXT_PUBLIC_AGENT_AVATARS (desligada → lista vazia = fallback atual).
 * Nunca expõe prompt/persona.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { agentAvatars } from "@/lib/canal/flags";
import { rosterComMentores, mergeProfiles, publicView } from "@/lib/agents/roster";

export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
  if (!agentAvatars()) return NextResponse.json({ agentes: [] }, { headers });
  try {
    const [mentores, profiles] = await Promise.all([
      prisma.mentorTemplate.findMany({ select: { slug: true, name: true, course: true, emoji: true, personaText: true, order: true } }),
      prisma.agentProfile.findMany(),
    ]);
    const agentes = mergeProfiles(rosterComMentores(mentores), profiles).filter((a) => a.ativo).map(publicView);
    return NextResponse.json({ agentes }, { headers });
  } catch (e) {
    console.error("AGENTS PUBLIC:", e);
    return NextResponse.json({ agentes: [] }, { headers });
  }
}
