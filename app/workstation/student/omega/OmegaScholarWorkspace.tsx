"use client";
import { useEffect, useRef, useState } from "react";
import { BookMarked, Lightbulb, BookOpen, Sparkles } from "lucide-react";
import { useOmegaScholar } from "./OmegaScholarContext";
import ActivityThread from "./ActivityThread";
import ReferencesModule from "./modules/ReferencesModule";
import InsightsModule from "./modules/InsightsModule";
import PrereqsModule from "./modules/PrereqsModule";
import OmegaRelatedResearch from "./OmegaRelatedResearch";
import PastResearchList from "./PastResearchList";
import ResearchSuggestionPanel from "@/components/research/ResearchSuggestionPanel";
import AuthGateNotice from "@/components/research/AuthGateNotice";

const TABS = [
  { id: "refs", label: "Referências", icon: BookMarked },
  { id: "insights", label: "Insights & Síntese", icon: Lightbulb },
  { id: "prereqs", label: "Base", icon: BookOpen },
  { id: "suggest", label: "Sugestões de pesquisa", icon: Sparkles },
];

export default function OmegaScholarWorkspace() {
  const { session, status, query, draft, setDraft } = useOmegaScholar();
  const [mod, setMod] = useState("refs");
  const [history, setHistory] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai/scholar/sessions").then((r) => r.json()).then((d) => setHistory(d.sessions ?? [])).catch(() => {});
  }, [status]);

  const s = session;
  const seed = (query || draft || "").trim();

  // Reabrir uma pesquisa anterior: vai pra aba Referências e sobe ao topo.
  const handleOpened = () => {
    setMod("refs");
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div ref={containerRef} className="h-full overflow-y-auto custom-scrollbar p-6">
      <ActivityThread />

      {status === "unauthorized" && (
        <AuthGateNotice className="my-10 max-w-md mx-auto" />
      )}

      {s && (
        <>
          {/* Trilho de abas — vidro fosco segmentado (Apple Glass), ativa = pílula clara com glow violeta */}
          <div className="mb-4 flex w-fit max-w-full overflow-x-auto no-scrollbar gap-1 p-1.5 rounded-2xl bg-white/40 dark:bg-white/[0.06] border border-white/50 dark:border-white/12 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
            {TABS.map((t) => {
              const Icon = t.icon; const on = mod === t.id;
              const count = t.id === "refs" ? s.references?.length : undefined;
              return (
                <button key={t.id} onClick={() => setMod(t.id)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap px-3.5 py-2 rounded-xl transition-colors motion-reduce:transition-none ${on
                    ? "bg-gradient-to-b from-white/90 to-white/50 dark:from-white/20 dark:to-white/[0.07] text-slate-900 dark:text-white border border-white/70 dark:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_18px_-8px_rgba(139,92,246,0.7)]"
                    : "text-slate-500 dark:text-white/50 border border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-white/70"}`}>
                  <Icon size={13} strokeWidth={on ? 2.2 : 1.8} /> {t.label}{count != null ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>
          {mod === "refs" && <ReferencesModule references={s.references ?? []} evidence={s.evidence ?? []} />}
          {mod === "insights" && <InsightsModule insights={s.insights} />}
          {mod === "prereqs" && <PrereqsModule />}
          {mod === "suggest" && (
            <ResearchSuggestionPanel docTitle={seed} onSelectTitle={(t) => setDraft(t)} />
          )}
        </>
      )}

      {/* Pesquisas relacionadas — no final, logo acima do histórico */}
      {status !== "unauthorized" && <OmegaRelatedResearch />}

      <PastResearchList items={history} activeId={s?.id} onOpened={handleOpened} />
    </div>
  );
}
