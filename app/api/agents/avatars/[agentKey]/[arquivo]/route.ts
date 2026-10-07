/**
 * GET /api/agents/avatars/<agentKey>/<estado>(.sm).webp?v=… — bytes de um quadro gerado no admin.
 * A URL carrega a versão → cache imutável de 1 ano (set novo = versão nova = URL nova).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { lerQuadroBanco } from "@/lib/avatars/banco";

export async function GET(_req: Request, { params }: { params: { agentKey: string; arquivo: string } }) {
  const agentKey = String(params.agentKey || "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,40}$/.test(agentKey)) return new Response("not found", { status: 404 });
  const q = await lerQuadroBanco(agentKey, String(params.arquivo || "")).catch(() => null);
  if (!q) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(q.dados), {
    headers: { "Content-Type": q.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
