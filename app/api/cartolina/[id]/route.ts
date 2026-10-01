/**
 * GET   /api/cartolina/:id  → { board }  (dono ou membro)
 * PATCH /api/cartolina/:id { upsert?, remove?, titulo? } → { board }  (dono/editor)
 * Operações POR CARD (não o array inteiro): dois colaboradores em cards diferentes não se apagam.
 */
import { NextResponse } from "next/server";
import { entrar } from "@/lib/cartolina/route-auth";
import { getBoardForUser, patchBoard } from "@/lib/cartolina/store";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await entrar(req, "cartolina-get");
  if ("response" in a) return a.response;
  const board = await getBoardForUser(params.id, a.userId);
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ board });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const a = await entrar(req, "cartolina-patch");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  const r = await patchBoard(params.id, a.userId, {
    upsert: Array.isArray(body.upsert) ? body.upsert.slice(0, 50) : undefined,
    remove: Array.isArray(body.remove) ? body.remove.slice(0, 50) : undefined,
    titulo: body.titulo,
  });
  if (r.ok) return NextResponse.json({ board: r.board });
  // not_found cobre "não existe" E "sem acesso" (não vaza quais ids existem)
  if (r.reason === "forbidden") return NextResponse.json({ error: "Somente leitura" }, { status: 403 });
  if (r.reason === "conflict") return NextResponse.json({ error: "Edição simultânea — tente de novo" }, { status: 409 });
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
