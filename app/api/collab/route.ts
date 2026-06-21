/**
 * /api/collab — documentos colaborativos do Lounge.
 *   GET  → lista os collab docs em que SOU membro (dono ou convidado).
 *   POST → cria um collab COPIANDO um estudo/pesquisa (o original fica intacto).
 *          body: { sourceType: "study"|"research", sourceId, kind?, title?, content? }
 *          devolve { id, token, link } pra montar o convite.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { randomBytes } from "crypto";

async function me(): Promise<{ id: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
}

function newToken(): string {
  return randomBytes(12).toString("base64url"); // ~16 chars, URL-safe
}

// Constrói o texto inicial do doc a partir do estudo/pesquisa de origem.
async function buildContent(userId: string, sourceType?: string, sourceId?: string): Promise<{ title: string; content: string }> {
  try {
    if (sourceType === "study" && sourceId) {
      const space = await prisma.studySpace.findFirst({ where: { id: sourceId, userId }, select: { title: true } });
      const items = await prisma.studyItem.findMany({
        where: { userId, spaceId: sourceId },
        orderBy: { order: "asc" },
        select: { title: true, summary: true, payload: true, type: true },
      });
      const title = space?.title || "Meu estudo";
      const blocks = items.map((it) => {
        const body = it.summary || (typeof (it.payload as any)?.text === "string" ? (it.payload as any).text : "");
        return `## ${it.title || it.type}\n${body}`.trim();
      });
      return { title, content: [`# ${title}`, ...blocks].filter(Boolean).join("\n\n") };
    }
    if (sourceType === "research" && sourceId) {
      const s = await prisma.scholarSession.findFirst({ where: { id: sourceId, userId }, select: { query: true, thread: true } });
      const title = (s?.query || "Minha pesquisa").slice(0, 120);
      const t: any = s?.thread || {};
      const answer = typeof t.answer === "string" ? t.answer
        : typeof t.synthesized === "string" ? t.synthesized
        : typeof t.summary === "string" ? t.summary : "";
      return { title, content: [`# ${title}`, answer].filter(Boolean).join("\n\n") };
    }
  } catch (e) {
    console.error("[collab] buildContent falhou:", e);
  }
  return { title: "Documento colaborativo", content: "" };
}

export async function GET() {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const docs = await prisma.collabDoc.findMany({
      where: { members: { has: u.id } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, kind: true, ownerId: true, members: true, updatedAt: true },
    });
    return NextResponse.json(
      docs.map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        updatedAt: d.updatedAt,
        isOwner: d.ownerId === u.id,
        memberCount: d.members.length,
      })),
    );
  } catch (e) {
    console.error("[collab] GET falhou:", e);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const sourceType = body.sourceType === "research" ? "research" : body.sourceType === "study" ? "study" : undefined;
  const kind = ["study", "research", "report"].includes(body.kind) ? body.kind : sourceType === "research" ? "research" : "study";

  try {
    const built = await buildContent(u.id, sourceType, body.sourceId);
    const title = (typeof body.title === "string" && body.title.trim()) ? body.title.trim().slice(0, 120) : built.title;
    const content = typeof body.content === "string" && body.content ? body.content : built.content;

    const token = newToken();
    const doc = await prisma.collabDoc.create({
      data: {
        ownerId: u.id,
        title,
        kind,
        content,
        members: [u.id],
        token,
        sourceType: sourceType ?? null,
        sourceId: typeof body.sourceId === "string" ? body.sourceId : null,
      },
      select: { id: true, token: true },
    });
    return NextResponse.json({ id: doc.id, token: doc.token, link: `/c/${doc.token}` });
  } catch (e: any) {
    console.error("[collab] POST falhou:", e);
    // Causa comum em dev: Prisma client desatualizado (model CollabDoc novo) → reinicie o dev.
    return NextResponse.json({ error: e?.message || "Erro ao criar colaboração" }, { status: 500 });
  }
}
