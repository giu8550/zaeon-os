/**
 * POST /api/lounge3d/[id]/topo — mantida por compatibilidade: é o mesmo que `POST /acesso { alvo: "topo" }`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { POST as acesso } from "../acesso/route";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const body = JSON.stringify({ alvo: "topo" });
  return acesso(new Request(req.url, { method: "POST", headers: { ...Object.fromEntries(req.headers), "content-type": "application/json" }, body }), ctx);
}
