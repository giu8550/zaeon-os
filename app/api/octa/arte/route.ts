/**
 * POST /api/octa/arte — o Octa Code plugado no chat: pedido de arte → peça generativa DETERMINÍSTICA (lib/octa/genart).
 * A seed é o próprio pedido (mesmo pedido = mesma peça); `seed` explícita sobrescreve. Só entrega peça que passou no
 * determinism-check. Sem LLM: é CPU, mas limitado por pessoa.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { guard } from "@/src/lib/ratelimit";
import { gerarPeca, verificarDeterminismo } from "@/lib/octa/genart";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await guard(req, "octa-arte", "ai-light");
  if (!rl.ok) return rl.response;
  const body = await req.json().catch(() => ({} as any));
  const pedido = typeof body.pedido === "string" ? body.pedido.trim().slice(0, 500) : "";
  const seed = (typeof body.seed === "string" && body.seed.trim() ? body.seed.trim() : pedido.toLowerCase()).slice(0, 200);
  if (!seed) return NextResponse.json({ error: "pedido vazio" }, { status: 400 });
  if (!verificarDeterminismo(seed).ok) return NextResponse.json({ error: "peça não determinística" }, { status: 500 });
  const p = gerarPeca(seed);
  return NextResponse.json({
    titulo: p.titulo, seed: p.seed, hash: p.hash, tracos: p.tracos,
    dataUrl: `data:image/svg+xml;base64,${Buffer.from(p.svg).toString("base64")}`,
  });
}
