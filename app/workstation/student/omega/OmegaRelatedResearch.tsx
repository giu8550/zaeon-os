"use client";
import { useEffect, useState } from "react";
import { useOmegaScholar } from "./OmegaScholarContext";

interface RelatedPaper {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  venue: string;
  source: string;
  url: string | null;
  doi: string | null;
  citationCount: number | null;
}

const SOURCE_LABEL: Record<string, string> = {
  semanticscholar: "Semantic Scholar",
  openalex: "OpenAlex",
  arxiv: "arXiv",
  crossref: "Crossref",
  pubmed: "PubMed",
  europepmc: "Europe PMC",
};

// "Pesquisas relacionadas" — literatura que JÁ EXISTE, com base no input do agente Omega.
// Fonte pública /api/scholar/search?q= (busca real nas fontes científicas, sem auth/Gemini).
export default function OmegaRelatedResearch() {
  const { query, draft } = useOmegaScholar();
  const seed = (query || draft || "").trim();
  const [papers, setPapers] = useState<RelatedPaper[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seed.length < 3) {
      setPapers([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/scholar/search?q=${encodeURIComponent(seed)}`);
        const data = await res.json().catch(() => ({ papers: [] }));
        if (active) setPapers(Array.isArray(data.papers) ? data.papers.slice(0, 8) : []);
      } catch {
        if (active) setPapers([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [seed]);

  if (seed.length < 3 || (!loading && papers.length === 0)) return null;

  return (
    <div className="mt-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-2 px-1">
        Pesquisas relacionadas{papers.length > 0 ? ` (${papers.length})` : ""}
      </p>

      {loading && papers.length === 0 ? (
        <div className="text-[11px] text-slate-400 dark:text-white/30 px-1 py-2">Buscando pesquisas existentes…</div>
      ) : (
        <div className="space-y-2">
          {papers.map((p) => {
            const inner = (
              <>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 text-[8px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-400/20">
                    {SOURCE_LABEL[p.source] ?? p.source ?? "fonte"}
                  </span>
                  <p className="text-[12px] font-semibold text-slate-800 dark:text-white/80 leading-snug flex-1">{p.title}</p>
                </div>
                <p className="mt-1 text-[9px] text-slate-500 dark:text-white/40 truncate">
                  {[p.authors, p.year, p.venue].filter(Boolean).join(" · ")}
                  {p.citationCount != null ? ` · ${p.citationCount} citações` : ""}
                </p>
              </>
            );
            return p.url ? (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl bg-white/70 dark:bg-white/[0.03] border border-black/8 dark:border-white/10 p-3 hover:border-cyan-400/40 transition-colors"
              >
                {inner}
              </a>
            ) : (
              <div
                key={p.id}
                className="rounded-xl bg-white/70 dark:bg-white/[0.03] border border-black/8 dark:border-white/10 p-3"
              >
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
