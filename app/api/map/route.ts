/**
 * GET /api/map?scopeId=  → o cérebro da conversa do DONO + o estado da bolinha (§3):
 *   { mapa: MapaView|null, estudavel, tituloSugerido, gerando }
 * GET /api/map?lista=1    → os mapas do DONO (as gavetas de "mapas anteriores" do painel), mais recentes primeiro:
 *   { mapas: [{ id, scopeId, surface, titulo, tipoTopico, objetivo, modoValidacao, passos, aprendizado, conclusao, updatedAt }] }
 * Atrás de MAP_HARNESS=1. Docs: docs/HANDOFF_CEREBRO_AURA.md.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { entrar, sanitizeScopeId } from "@/lib/map/route-auth";
import { findOwnMapa } from "@/lib/map/store";
import { estadoDaBolinha } from "@/lib/map/bolinha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await entrar(req, "map-get");
  if ("response" in a) return a.response;
  const url = new URL(req.url);
  if (url.searchParams.get("lista") === "1") {
    const rows = await prisma.mapaProbabilistico.findMany({
      where: { ownerId: a.userId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, scopeId: true, surface: true, titulo: true, tipoTopico: true, objetivo: true, modoValidacao: true, backbone: true, completudeAprendizado: true, completudeConclusao: true, updatedAt: true },
    });
    return NextResponse.json({
      mapas: rows.map((m) => ({ id: m.id, scopeId: m.scopeId, surface: m.surface, titulo: m.titulo, tipoTopico: m.tipoTopico, objetivo: m.objetivo, modoValidacao: m.modoValidacao, passos: m.backbone.length, aprendizado: m.completudeAprendizado, conclusao: m.completudeConclusao, updatedAt: m.updatedAt.toISOString() })),
    });
  }
  const scopeId = sanitizeScopeId(url.searchParams.get("scopeId"));
  if (!scopeId) return NextResponse.json({ error: "scopeId inválido" }, { status: 400 });
  const [mapa, conv] = await Promise.all([
    findOwnMapa(a.userId, "estudos", scopeId),
    prisma.conversation.findFirst({ where: { userId: a.userId, surface: "estudos", scopeId }, select: { estudavel: true, tituloSugerido: true, mapaId: true } }),
  ]);
  const estado = estadoDaBolinha({ estudavel: !!conv?.estudavel, mapaId: conv?.mapaId ?? mapa?.id ?? null, temMapa: !!mapa, backbone: mapa?.backbone.length ?? 0 });
  return NextResponse.json({ mapa, estudavel: !!conv?.estudavel, tituloSugerido: conv?.tituloSugerido ?? null, estado });
}
