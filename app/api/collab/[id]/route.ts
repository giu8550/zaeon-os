/**
 * /api/collab/[id] — um documento colaborativo (só membros acessam).
 *   GET   → { id, title, kind, content, ownerId, isOwner, members:[{id,name,image}], updatedAt }
 *   PATCH → salva content/title; dispara Pusher `collab-<id>` (doc-update) pros outros membros.
 *           body: { content?, title?, clientId? }  (clientId evita o autor reaplicar o próprio update)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { triggerSafe } from "@/lib/collab/realtime";

async function me(): Promise<{ id: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.collabDoc.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.members.includes(u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await prisma.user.findMany({
    where: { id: { in: doc.members } },
    select: { id: true, name: true, image: true },
  });

  return NextResponse.json({
    id: doc.id,
    title: doc.title,
    kind: doc.kind,
    sourceType: doc.sourceType,
    sourceId: doc.sourceId,
    content: doc.content,
    ownerId: doc.ownerId,
    isOwner: doc.ownerId === u.id,
    token: doc.token,
    members,
    updatedAt: doc.updatedAt,
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.collabDoc.findUnique({ where: { id: params.id }, select: { members: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.members.includes(u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const data: Record<string, unknown> = {};
  if (typeof body.content === "string") data.content = body.content;
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 120);
  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true });

  const updated = await prisma.collabDoc.update({
    where: { id: params.id },
    data,
    select: { content: true, title: true, updatedAt: true },
  });

  // Edição em grupo ao vivo: avisa os outros membros (o autor ignora pelo clientId).
  await triggerSafe(`collab-${params.id}`, "doc-update", {
    content: updated.content,
    title: updated.title,
    fromUserId: u.id,
    clientId: typeof body.clientId === "string" ? body.clientId : null,
    ts: Date.now(),
  });

  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.collabDoc.findUnique({ where: { id: params.id }, select: { ownerId: true, members: true } });
  if (!doc) return NextResponse.json({ ok: true }); // já não existe
  if (!doc.members.includes(u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    if (doc.ownerId === u.id) {
      // Dono apaga a colaboração inteira (some pra todo mundo).
      await prisma.collabDoc.delete({ where: { id: params.id } });
      await triggerSafe(`collab-${params.id}`, "doc-deleted", { ts: Date.now() });
    } else {
      // Membro só sai da colaboração (some da lista DELE).
      await prisma.collabDoc.update({
        where: { id: params.id },
        data: { members: { set: doc.members.filter((m) => m !== u.id) } },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[collab] DELETE falhou:", e);
    return NextResponse.json({ error: e?.message || "Erro ao apagar" }, { status: 500 });
  }
}
