/**
 * POST /api/lounge/cartolina { topic } → { cards }
 * A Aura gera o caderno de estudos (cards tema Caderno) do tópico. Geração pura (sem
 * persistência) — a camada de MEMÓRIA é PR à parte (docs/HANDOFF_CARTOLINA_MEMORIA.md).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { guard } from "@/src/lib/ratelimit";
import { gerarCartolina } from "@/lib/caderno/cartolina";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await guard(req, "lounge-cartolina", "ai-heavy");
  if (!rl.ok) return rl.response;

  const { topic } = await req.json().catch(() => ({ topic: "" }));
  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return NextResponse.json({ error: "Informe um tópico." }, { status: 400 });
  }

  try {
    const cards = await gerarCartolina(topic);
    return NextResponse.json({ cards });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Falha ao gerar a cartolina." }, { status: 500 });
  }
}
