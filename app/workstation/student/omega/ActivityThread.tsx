"use client";
import { useOmegaScholar } from "./OmegaScholarContext";
import GlitchTerm from "@/components/research/GlitchTerm";
import AgentSwarmLoader from "@/components/research/AgentSwarmLoader";

export default function ActivityThread() {
  const { phases, answer, status, query } = useOmegaScholar();
  if (status === "idle") return null;
  const loading = status === "running";

  return (
    <div className="rounded-3xl bg-black/[0.03] dark:bg-black/30 border border-black/5 dark:border-white/10 p-5 sm:p-6 mb-5">
      {/* termo destacado com glitch latim ↔ chinês (mantém a lupa) */}
      <div className="mb-4">
        <GlitchTerm term={query} done={!loading} />
      </div>

      {/* cena de loading: enxame de agentes liberados na rede */}
      {loading && <AgentSwarmLoader phases={phases} status={status} />}

      {answer && (
        <div className="mt-4 pt-4 border-t border-dashed border-black/10 dark:border-white/10 text-sm leading-relaxed text-slate-700 dark:text-white/80 whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </div>
  );
}
