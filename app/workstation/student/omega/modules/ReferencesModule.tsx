"use client";
import { useState } from "react";
import { CheckCircle2, Download, FileText } from "lucide-react";
import PdfViewerModal from "../PdfViewerModal";
import type { EvidenceRecord, Paper } from "@/lib/scholar/types";

function locatorLabel(l?: EvidenceRecord["locator"]) {
  if (!l) return "";
  if (l.kind === "pdf") return `Página ${l.page}`;
  if (l.kind === "fulltext") return l.section ? `Seção ${l.section}` : `Parágrafo ${l.paragraph}`;
  return "Resumo";
}

export default function ReferencesModule({ references, evidence }:
  { references: Paper[]; evidence: EvidenceRecord[] }) {
  const [viewer, setViewer] = useState<{ url: string; page: number; quote: string } | null>(null);
  const byPaper = (id: string) => evidence.filter((e) => e.paperId === id && e.verified);

  return (
    <div className="space-y-3">
      {references.map((p) => (
        <div key={p.id} className="rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-slate-800 dark:text-white">{p.title}</p>
              <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">
                {p.authors.slice(0, 4).join(", ")}{p.authors.length > 4 ? " et al." : ""} · {p.venue ?? "—"} {p.year ?? ""} {p.doi ? `· doi:${p.doi}` : p.arxivId ? `· arXiv:${p.arxivId}` : ""}
              </p>
            </div>
            {p.pdfUrl && (
              <a href={`/api/ai/scholar/pdf?url=${encodeURIComponent(p.pdfUrl)}`} target="_blank" rel="noreferrer"
                 className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 dark:text-violet-400 border border-violet-300/40 rounded-full px-3 py-1.5 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                <Download size={12} /> PDF
              </a>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {byPaper(p.id).map((e, i) => (
              <div key={i} className="rounded-xl bg-black/[0.03] dark:bg-black/30 border-l-2 border-violet-500 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                    <CheckCircle2 size={10} /> VERIFICADO
                  </span>
                  <span className="text-[9px] text-slate-400">{locatorLabel(e.locator)} · confiança {e.confidence}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-white/70 mt-1.5">{e.claim}</p>
                <p className="text-[11px] italic text-slate-500 dark:text-white/50 mt-1 bg-violet-500/5 rounded-lg px-2 py-1.5">"{e.quote}"</p>
                {p.pdfUrl && e.locator?.kind === "pdf" && (
                  <button onClick={() => setViewer({ url: p.pdfUrl!, page: (e.locator as any).page, quote: e.quote })}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:underline">
                    <FileText size={11} /> ver no paper (pág. {(e.locator as any).page})
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {viewer && <PdfViewerModal pdfUrl={viewer.url} page={viewer.page} quote={viewer.quote} onClose={() => setViewer(null)} />}
    </div>
  );
}
