/**
 * POST   /api/cartolina/:id/share { papel?: "editor"|"leitor" } → { url, token }   (só o dono)
 * DELETE /api/cartolina/:id/share → revoga TODOS os links enviados                  (só o dono)
 */
import { NextResponse } from "next/server";
import { entrar, falha } from "@/lib/cartolina/route-auth";
import { gerarLink, revogarLinks } from "@/lib/cartolina/cowork-store";
import { isPapelConvidavel } from "@/lib/cartolina/access";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await entrar(req, "cartolina-share", "ai-light", { cowork: true });
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const papel = body?.papel ?? "editor";
  if (!isPapelConvidavel(papel)) return falha("invalid");
  const r = await gerarLink(params.id, a.userId, papel);
  if (!r.ok) return falha(r.reason);
  // Caminho relativo: o cliente monta com o próprio origin (funciona atrás do Caddy e em preview).
  return NextResponse.json({ url: `/estudo/${params.id}?convite=${encodeURIComponent(r.token)}`, token: r.token });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const a = await entrar(req, "cartolina-share", "ai-light", { cowork: true });
  if ("response" in a) return a.response;
  const r = await revogarLinks(params.id, a.userId);
  return r.ok ? NextResponse.json({ ok: true }) : falha(r.reason);
}
