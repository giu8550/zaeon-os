/**
 * Pipeline da Sala de Pesquisa, EXTRAÍDO da rota pra poder rodar em DOIS lugares:
 *  - inline no request (modo legado / fallback), com emit → stream do controller;
 *  - num WORKER de fundo (BullMQ), com emit → append em ScholarSession.thread.events.
 *
 * O ponto todo: no worker o pipeline roda até o FIM mesmo que o usuário saia da sala.
 * O DB (ScholarSession) é a fonte da verdade; o cliente reconecta pollando a sessão.
 *
 * A lógica aqui é a MESMA que vivia em app/api/ai/scholar/route.ts — só parametrizada
 * por um `emit(event)` e pela sessão já criada.
 */
import { prisma } from "@/src/lib/prisma";
import { retrievePapers, MIN_RESULTS } from "@/lib/scholar/retrieve";
import { resolveFullText } from "@/lib/scholar/fulltext";
import { planQuery, synthesize } from "@/lib/scholar/synthesize";
import { assembleResults } from "@/lib/scholar/assemble";
import { buildReferencesBib } from "@/lib/scholar/bibtex";
import { planTone } from "@/lib/scholar/prompt";
import { mapLimit } from "@/lib/scholar/http";
import type { ScholarEvent } from "@/lib/scholar/types";

export type ScholarRunParams = {
  prompt: string;
  room?: string | null;
  isDeep: boolean;
};

/**
 * Roda o pipeline numa sessão JÁ criada (status "running"/"queued"). Emite eventos
 * via `emit` e persiste o resultado final na própria sessão. Lança em erro (o chamador
 * decide: worker marca a sessão como "error"; inline manda type:"error").
 */
export async function runScholarPipeline(
  sessionId: string,
  params: ScholarRunParams,
  emit: (e: ScholarEvent) => void | Promise<void>,
): Promise<void> {
  const { prompt, isDeep } = params;
  const TOP_N = isDeep ? 10 : 4;
  const FT_CONCURRENCY = isDeep ? 3 : 4;

  // PLAN
  await emit({ type: "phase", phase: "planning", message: planTone(prompt) } as ScholarEvent);
  const plan = await planQuery(prompt);

  // SEARCH (garante ≥ MIN_RESULTS)
  const queries = plan.queries.length ? plan.queries : [prompt];
  const retrieved = await retrievePapers(queries, {
    domain: plan.domain,
    minResults: MIN_RESULTS,
    onSource: (r) =>
      emit({
        type: "phase",
        phase: "searching",
        source: r.source,
        count: r.papers.length,
        message:
          r.status === "ok"
            ? `✓ ${r.source}: ${r.papers.length} papers`
            : r.status === "rate_limited"
              ? `⏳ ${r.source}: limite de requisições atingido (tentei reenviar)`
              : `⚠ ${r.source}: indisponível agora`,
      } as ScholarEvent),
  });

  // RELEVÂNCIA
  const STOP = new Set(["sobre", "para", "como", "qual", "quais", "que", "com", "dos", "das", "uma", "the", "and", "for", "with", "what"]);
  const promptTerms = [...new Set((String(prompt).toLowerCase().match(/[a-zà-ú0-9]{4,}/gi) || []))].filter((t) => !STOP.has(t));
  const isRelevant = (p: any) => {
    if (!promptTerms.length) return true;
    const hay = `${p.title ?? ""} ${p.abstract ?? ""} ${(p.keywords ?? []).join(" ")}`.toLowerCase();
    return promptTerms.some((t) => hay.includes(t));
  };
  const filtered = retrieved.papers.filter(isRelevant);
  const unique = filtered.length ? filtered : retrieved.papers;

  // FULL TEXT (top N)
  const top = unique.slice(0, TOP_N);
  const withText = await mapLimit(top, FT_CONCURRENCY, (p) => resolveFullText(p));
  const ftCount = withText.filter((p) => p.retrievedText && p.retrievedText.kind !== "abstract").length;
  await emit({
    type: "phase",
    phase: "dedup",
    unique: unique.length,
    fulltext: ftCount,
    message: `✓ ${unique.length} pesquisas encontradas · full-text aberto de ${ftCount}`,
  } as ScholarEvent);

  // SYNTHESIZE
  await emit({ type: "phase", phase: "synthesizing", message: "🧠 Indo mais fundo e conferindo cada citação…" } as ScholarEvent);
  const grounded = withText.filter((p) => p.retrievedText);
  const raw = await synthesize(prompt, grounded);

  // VERIFY + ASSEMBLE
  const r = assembleResults(prompt, grounded, raw);
  await emit({
    type: "phase",
    phase: "verifying",
    checked: (raw.evidence ?? []).length,
    verified: r.verifiedCount,
    dropped: r.dropped,
    message: `✓ ${r.verifiedCount} citações confirmadas`,
  } as ScholarEvent);

  await emit({ type: "answer", text: r.answer } as ScholarEvent);

  const bib = await buildReferencesBib(r.references);
  if (bib.trim()) r.files.push({ name: "references.bib", kind: "bibtex", content: bib });

  const displayReferences = r.references;
  const displayResults = unique.slice(0, 80).map((p) => ({
    id: p.id, title: p.title, authors: p.authors, year: p.year, venue: p.venue,
    doi: p.doi, arxivId: p.arxivId, url: p.url, pdfUrl: p.pdfUrl,
    abstract: p.abstract, citationCount: p.citationCount, openAccess: p.openAccess, sources: p.sources,
  }));

  // Preserva os eventos já persistidos (progresso ao vivo) e fecha com a resposta.
  const current = await prisma.scholarSession.findUnique({ where: { id: sessionId }, select: { thread: true } });
  const prevEvents = (current?.thread as any)?.events ?? [];

  const updateData: any = {
    status: "done",
    domain: plan.domain || null,
    references: displayReferences as any,
    results: displayResults as any,
    evidence: r.evidence as any,
    insights: r.insights as any,
    gaps: r.gaps as any,
    files: r.files as any,
    thread: { events: prevEvents, answer: r.answer } as any,
  };
  const saved = await prisma.scholarSession.update({ where: { id: sessionId }, data: updateData });
  await emit({ type: "done", session: saved } as ScholarEvent);
}
