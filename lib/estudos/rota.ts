/**
 * Porta comum das rotas do board de Meus Estudos: rate-limit + SESSÃO (o userId vem sempre da sessão, nunca do corpo).
 */
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { resolveUserId } from "@/lib/agent/transcript";

export async function entrarNoBoard(req: Request, balde: string, limite: "ai-heavy" | "ai-light" = "ai-light"): Promise<{ userId: string } | { response: Response }> {
  const rl = await guard(req, balde, limite);
  if (!rl.ok) return { response: rl.response };
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}
export function falhaBoard(motivo: "not_found" | "forbidden" | "invalid" | "conflict"): Response {
  const m = { not_found: [404, "Not found"], forbidden: [403, "Sem permissão"], invalid: [400, "Inválido"], conflict: [409, "Conflito"] } as const;
  return NextResponse.json({ error: m[motivo][1] }, { status: m[motivo][0] });
}
