/**
 * Porta de entrada comum das rotas /api/tcc*: flag, rate-limit e SESSÃO (mesmo desenho da
 * cartolina). O userId vem sempre da sessão — nunca do corpo/query.
 */
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { resolveUserId } from "@/lib/agent/transcript";
import { tccCrossOn } from "@/lib/tcc/store";

export async function entrarTcc(req: Request, bucket: string, limite: "ai-heavy" | "ai-light" = "ai-light"):
  Promise<{ userId: string } | { response: Response }> {
  // Flag desligada = a rota não existe (merge não muda nada até ligar).
  if (!tccCrossOn()) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const rl = await guard(req, bucket, limite);
  if (!rl.ok) return { response: rl.response };
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

/** Motivo de recusa do store → status HTTP. not_found cobre "não existe" E "sem acesso". */
export function respostaDeRecusa(reason: string, detalhe?: string): Response {
  if (reason === "forbidden") return NextResponse.json({ error: "Somente leitura" }, { status: 403 });
  if (reason === "conflict") return NextResponse.json({ error: "Edição simultânea — tente de novo" }, { status: 409 });
  if (reason === "invalid") return NextResponse.json({ error: "Operação inválida", detalhe }, { status: 400 });
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
