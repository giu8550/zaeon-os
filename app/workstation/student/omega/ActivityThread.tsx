"use client";
import { useOmegaScholar } from "./OmegaScholarContext";
import AgentSwarmLoader from "@/components/research/AgentSwarmLoader";
import useTTS from "@/lib/voice/useTTS";
import { Volume2, Square, RefreshCw } from "lucide-react";

export default function ActivityThread() {
  const { phases, answer, status, query, runQuery } = useOmegaScholar();
  const { speak, stop, activeText } = useTTS();
  if (status === "idle") return null;
  const loading = status === "running";

  return (
    <div className="pt-1 pb-2">
      {/* Dentro do MODAL DA PESQUISA (violeta). Título glitch vive ao lado do ⟁; aqui só andamento + resposta. */}

      {/* cena de loading: enxame de agentes liberados na rede */}
      {loading && <AgentSwarmLoader phases={phases} status={status} />}

      {answer && (
        <div className="mt-4 pt-4 border-t border-dashed border-black/10 dark:border-white/10">
          {/* ouvir a resposta — Zaeon lê em voz alta (engine neural → fallback navegador) */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => (activeText === answer ? stop() : speak(answer))}
              title={activeText === answer ? "Parar leitura" : "Ouvir a resposta"}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors border ${activeText === answer
                ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-400/40"
                : "text-slate-500 dark:text-white/55 border-black/10 dark:border-white/10 hover:text-cyan-600 hover:border-cyan-400/40"}`}
            >
              {activeText === answer ? <Square size={12} /> : <Volume2 size={13} />}
              {activeText === answer ? "Parar" : "Ouvir"}
            </button>
          </div>
          <div className="text-sm leading-relaxed text-slate-700 dark:text-white/80 whitespace-pre-wrap">
            {answer}
          </div>
        </div>
      )}

      {/* Só no ERRO: refazer. No sucesso, quem aparece é o "Gerar pesquisa" (abaixo). */}
      {!loading && status === "error" && query && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => runQuery(query)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-300 border border-violet-400/40 hover:bg-violet-500/10 transition-colors"
          >
            <RefreshCw size={13} /> Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
