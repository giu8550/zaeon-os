import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { basesForDomain, searchAll } from "@/lib/scholar/sources";
import { dedupePapers } from "@/lib/scholar/dedup";
import { resolveFullText } from "@/lib/scholar/fulltext";
import { planQuery, synthesize } from "@/lib/scholar/synthesize";
import { assembleResults } from "@/lib/scholar/assemble";
import { planTone } from "@/lib/scholar/prompt";
import type { Paper, ScholarEvent } from "@/lib/scholar/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  // The session.user does NOT carry an id field — look it up from email.
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });
  const userId = dbUser.id;

  const { prompt, room } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ScholarEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const created = await prisma.scholarSession.create({
          data: { userId, room: room ?? null, query: prompt, status: "running" },
        });
        send({ type: "session", sessionId: created.id });

        // PLAN
        send({ type: "phase", phase: "planning", message: planTone(prompt) });
        const plan = await planQuery(prompt);

        // SEARCH (parallel)
        const bases = basesForDomain(plan.domain);
        const queries = plan.queries.length ? plan.queries : [prompt];
        const usedQueries = queries.slice(0, 3);
        const resultSets = await Promise.all(usedQueries.map((q) => searchAll(q, bases)));
        let pool: Paper[] = [];
        for (const results of resultSets) {
          for (const r of results) {
            send({
              type: "phase",
              phase: "searching",
              source: r.source,
              count: r.papers.length,
              message: `✓ ${r.source}: ${r.papers.length} papers`,
            });
            pool = pool.concat(r.papers);
          }
        }

        // DEDUP + FULL TEXT (top N)
        const unique = dedupePapers(pool);
        const top = unique.slice(0, 14);
        const withText = await Promise.all(top.map(resolveFullText));
        const ftCount = withText.filter(
          (p) => p.retrievedText && p.retrievedText.kind !== "abstract"
        ).length;
        send({
          type: "phase",
          phase: "dedup",
          unique: unique.length,
          fulltext: ftCount,
          message: `✓ ${unique.length} únicos · full-text aberto de ${ftCount}`,
        });

        // SYNTHESIZE
        send({
          type: "phase",
          phase: "synthesizing",
          message: "🧠 Indo mais fundo e conferindo cada citação…",
        });
        const grounded = withText.filter((p) => p.retrievedText);
        const raw = await synthesize(prompt, grounded);

        // VERIFY + ASSEMBLE (deterministic; unit-tested in lib/scholar/assemble.test.ts)
        const r = assembleResults(prompt, grounded, raw);
        send({
          type: "phase",
          phase: "verifying",
          checked: (raw.evidence ?? []).length,
          verified: r.verifiedCount,
          dropped: r.dropped,
          message: `✓ ${r.verifiedCount} citações confirmadas`,
        });

        send({ type: "answer", text: r.answer });

        const saved = await prisma.scholarSession.update({
          where: { id: created.id },
          data: {
            status: "done",
            domain: plan.domain || null,
            references: r.references as any,
            evidence: r.evidence as any,
            insights: r.insights as any,
            gaps: r.gaps as any,
            files: r.files as any,
            thread: { answer: r.answer } as any,
          },
        });
        send({ type: "done", session: saved });
      } catch (err: any) {
        send({ type: "error", message: err?.message ?? "Erro inesperado" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
