/** POST /api/cartolina/:id/join { token } → { papel }. Exige sessão: o convidado entra como ELE MESMO. */
import { NextResponse } from "next/server";
import { entrar, falha } from "@/lib/cartolina/route-auth";
import { entrarPorConvite } from "@/lib/cartolina/cowork-store";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await entrar(req, "cartolina-join", "ai-light", { cowork: true });
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const r = await entrarPorConvite(params.id, a.userId, body?.token);
  return r.ok ? NextResponse.json({ papel: r.papel }) : falha(r.reason);
}
