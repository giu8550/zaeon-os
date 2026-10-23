/**
 * GET /api/blueprints (público) ⇒ { blueprints } — só os PUBLICADOS da vitrine da landing, por `order`.
 * Só os campos do card (lib/landing/blueprints → paraPublico): rascunho e campo interno nunca saem daqui.
 * Banco fora do ar ⇒ lista vazia (a seção some da landing em vez de quebrar a página).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { paraPublico } from "@/lib/landing/blueprints";

const MAX = 24;

export async function GET() {
  try {
    const rows = await prisma.blueprint.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      take: MAX,
      select: { id: true, title: true, description: true, imageUrl: true, href: true, tags: true },
    });
    return NextResponse.json(
      { blueprints: rows.map(paraPublico) },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (e) {
    console.error("[blueprints] listar publicados:", (e as Error)?.message);
    return NextResponse.json({ blueprints: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
