import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { cacheDel } from "@/src/lib/cache";
import { canDeepThink } from "@/lib/ai/deepThinkAccess";
import { runScholarPipeline } from "@/lib/scholar/pipeline";
import { enqueueScholarJob, isQueueEnabled } from "@/lib/queue/scholar";
import type { ScholarEvent } from "@/lib/scholar/types";

export const runtime = "nodejs";
// Modo inline (fallback): Vercel/Hobby limita a função a 60s. No modo BACKGROUND o
// trabalho sai daqui pro worker, então este limite não corta a pesquisa.
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  const rl = await guard(req, "ai-scholar", "ai-heavy");
  if (!rl.ok) return rl.response;

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });
  const userId = dbUser.id;
  await cacheDel(`sess:${userId}`); // nova pesquisa → invalida o cache da lista

  const { prompt, room, deep } = await req.json();
  const isDeep = deep === true && (await canDeepThink(session.user.email));

  // ── MODO BACKGROUND (robusto) ────────────────────────────────────────────────
  // SCHOLAR_BG=1 + Redis disponível: cria a sessão, ENFILEIRA o job e responde na hora.
  // O worker (instrumentation.ts) roda o pipeline até o fim mesmo que o usuário saia da
  // sala; o cliente reconecta pollando /scholar/sessions?id=. Se enfileirar falhar,
  // cai no inline abaixo — nada quebra.
  let created: { id: string } | null = null;
  if (process.env.SCHOLAR_BG === "1" && isQueueEnabled()) {
    created = await prisma.scholarSession.create({
      data: { userId, room: room ?? null, query: prompt, status: "queued", thread: { events: [] } as any },
    });
    const ok = await enqueueScholarJob({ sessionId: created.id, prompt, room: room ?? null, isDeep, userId });
    if (ok) return NextResponse.json({ sessionId: created.id, mode: "bg" }, { status: 202 });
    // enfileirar falhou → segue pro inline reaproveitando a sessão já criada
  }

  // ── MODO INLINE (legado / fallback) ──────────────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ScholarEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let sessionId = created?.id ?? "";
      try {
        if (!sessionId) {
          const c = await prisma.scholarSession.create({
            data: { userId, room: room ?? null, query: prompt, status: "running", thread: { events: [] } as any },
          });
          sessionId = c.id;
        } else {
          await prisma.scholarSession.update({ where: { id: sessionId }, data: { status: "running" } });
        }
        send({ type: "session", sessionId } as ScholarEvent);
        await runScholarPipeline(sessionId, { prompt, room: room ?? null, isDeep }, send);
      } catch (err: any) {
        console.error("[scholar] x ERRO:", err?.message);
        if (sessionId) {
          await prisma.scholarSession.update({
            where: { id: sessionId },
            data: { status: "error", thread: { error: err?.message ?? "Erro inesperado" } as any },
          }).catch(() => {});
        }
        send({ type: "error", message: err?.message ?? "Erro inesperado" } as ScholarEvent);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
