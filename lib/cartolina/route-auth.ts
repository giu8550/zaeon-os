/**
 * Porta de entrada comum das rotas da cartolina: flag, rate-limit e SESSÃO.
 * O userId vem sempre da sessão (e-mail → usuário) — nunca do corpo/query.
 */
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { resolveUserId } from "@/lib/agent/transcript";
import { cartolinaMemoriaOn } from "@/lib/cartolina/store";

export async function entrar(req: Request, bucket: string, limite: "ai-heavy" | "ai-light" = "ai-light"):
  Promise<{ userId: string } | { response: Response }> {
  // Flag desligada = a rota não existe (merge não muda nada até ligar).
  if (!cartolinaMemoriaOn()) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const rl = await guard(req, bucket, limite);
  if (!rl.ok) return { response: rl.response };
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

/** scopeId vem do cliente: só id curto e sem espaço. */
export function sanitizeScopeId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^[\w:.-]{1,128}$/.test(s) ? s : null;
}
