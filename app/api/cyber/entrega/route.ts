/**
 * POST /api/cyber/entrega { tipo: "pesquisa" | "livro", id, salaId? } — a ENTREGA no RELICÁRIO DO SABER
 * (lib/cyber/relicario). O item é DA PESSOA (IDOR → 404):
 *  - "pesquisa" (ResearchWork — artigos/TCCs inclusos): completa e totalmente estruturada em ABNT (lib/cyber/entregaAbnt);
 *  - "livro" (o estudo do board, `boardId:cardId`, de um board em que ela tem papel): VENDÁVEL no blueprint.
 * Aceita → grava em User.cyberPerfil `entregaAceitaEm`/`entregaItem` (preservando as outras chaves). Com `salaId` (a sala
 * do cyberespaço, de que ela é membro) a cena vai pra todo mundo (EV_RELICARIO — o item voando e a Zaeon lendo).
 * Responde o veredito, o que falta e o evento. (Compatível: `{ workId }` = uma pesquisa.)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { triggerSafe } from "@/lib/collab/realtime";
import { eu, salaDoMembro } from "@/lib/lounge3d/server";
import { EV_RELICARIO, canalSala } from "@/lib/lounge3d/tipos";
import { avaliarEntrega } from "@/lib/cyber/entregaAbnt";
import { avaliarEstudo, idDeEncaixeValido, type EventoRelicario, type TipoEncaixe } from "@/lib/cyber/relicario";
import { SURFACE_ESTUDOS, lerCards } from "@/lib/estudos/board";
import { itensDosBoards } from "@/lib/estudos/itens";

export async function POST(req: Request) {
  const rl = await guard(req, "lounge3d-acesso"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { tipo?: unknown; id?: unknown; workId?: unknown; salaId?: unknown } | null;
  const tipo: TipoEncaixe | null = body?.tipo === "livro" ? "livro" : body?.tipo === "pesquisa" || typeof body?.workId === "string" ? "pesquisa" : null;
  const id = typeof body?.id === "string" ? body.id : typeof body?.workId === "string" ? body.workId : "";
  if (!tipo || !idDeEncaixeValido({ tipo, id })) return NextResponse.json({ error: "Item inválido." }, { status: 400 });

  let titulo = "", aceito = false, faltando: string[] = [], paginas = 0;
  if (tipo === "pesquisa") {
    const w = await prisma.researchWork.findFirst({ where: { id, userId: me.id }, select: { id: true, title: true, content: true } });
    if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const a = avaliarEntrega({ titulo: w.title, conteudo: w.content });
    titulo = (w.title ?? "").replace(/\.(pdf|docx)$/i, "").trim() || "Pesquisa sem título"; aceito = a.aceito; faltando = a.faltando; paginas = a.paginas;
  } else {
    const [boardId, cardId] = id.split(":") as [string, string];
    const membro = await prisma.cartolinaMembro.findFirst({ where: { cartolinaId: boardId, userId: me.id }, select: { id: true } });
    const b = await prisma.cartolina.findFirst({ where: { id: boardId, surface: SURFACE_ESTUDOS, ...(membro ? {} : { ownerId: me.id }) }, select: { id: true, cards: true } });
    const it = b ? itensDosBoards([{ id: b.id, cards: lerCards(b.cards) }]).find((x) => x.cardId === cardId) : undefined;
    if (!it) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const a = avaliarEstudo(it);
    titulo = it.titulo; aceito = a.aceito; faltando = a.faltando;
  }
  if (aceito) {
    const u = await prisma.user.findUnique({ where: { id: me.id }, select: { cyberPerfil: true } });
    const antes = (u?.cyberPerfil && typeof u.cyberPerfil === "object" && !Array.isArray(u.cyberPerfil) ? u.cyberPerfil : {}) as Record<string, unknown>;
    await prisma.user.update({ where: { id: me.id }, data: { cyberPerfil: { ...antes, entregaAceitaEm: new Date().toISOString(), entregaItem: `${tipo}:${id}`, ...(tipo === "pesquisa" ? { entregaWorkId: id } : {}) } } });
  }
  const evento: EventoRelicario = { id: randomUUID(), userId: me.id, nome: me.name, cor: me.color, titulo: titulo.slice(0, 120), tipo, aceito, agora: Date.now() };
  // a CENA na sala (todo mundo vê): só se a pessoa é membro da sala dita
  const salaId = typeof body?.salaId === "string" ? body.salaId : "";
  if (salaId && (await salaDoMembro(salaId, me.id))) await triggerSafe(canalSala(salaId), EV_RELICARIO, evento);
  return NextResponse.json({ aceito, faltando, paginas, titulo, evento });
}
