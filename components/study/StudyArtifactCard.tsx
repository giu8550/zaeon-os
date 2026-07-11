"use client";

/**
 * StudyArtifactCard — o ESTUDO como ARTEFATO dentro da conversa do co-working.
 *
 * Classe própria (não é um StudioBlock): representa um StudySpace inteiro — o
 * "caderno" gerado. Aparece inline no chat quando um estudo é gerado ou arrastado
 * pra conversa. Mantém toda a lógica do estudo intacta (abre no editor real).
 * Ações: Abrir (editor completo) e Focar (a Aura passa a considerar só este estudo).
 */

import { Maximize2, Crosshair, X } from "lucide-react";

export type StudyArtifactCardProps = {
  studyId: string;
  title: string;
  /** Prévia curta (primeiras linhas do caderno), opcional. */
  snippet?: string;
  /** Está no foco atual da conversa? */
  focused?: boolean;
  onOpen?: (studyId: string) => void;
  onFocus?: (studyId: string) => void;
  onUnfocus?: (studyId: string) => void;
};

export default function StudyArtifactCard({
  studyId,
  title,
  snippet,
  focused = false,
  onOpen,
  onFocus,
  onUnfocus,
}: StudyArtifactCardProps) {
  return (
    <div
      className={`rounded-2xl p-[1.5px] bg-gradient-to-br from-violet-500/40 via-blue-500/30 to-cyan-400/40
        shadow-[0_16px_44px_-22px_rgba(124,58,237,0.55)] ${focused ? "ring-2 ring-cyan-400/50" : ""}`}
    >
      <div className="rounded-[15px] bg-white/85 dark:bg-[#0b1220]/90 backdrop-blur-2xl border border-white/70 dark:border-white/10 overflow-hidden">
        {/* Cabeçalho do artefato */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-200/70 dark:border-white/10">
          <span
            className="shrink-0 w-7 h-7 rounded-lg bg-violet-500/10 dark:bg-violet-400/15 flex items-center justify-center text-[13px] leading-none text-violet-600 dark:text-violet-300"
            style={{ filter: "drop-shadow(0 0 3px rgba(139,92,246,0.4))" }}
          >⟁</span>
          <div className="flex-1 min-w-0">
            <p className="text-[9.5px] font-tech font-light uppercase tracking-[0.22em] text-violet-500/80 dark:text-violet-300/70 leading-none">
              Estudo {focused && "· em foco"}
            </p>
            <p className="text-[14px] font-semibold text-slate-800 dark:text-white/90 truncate leading-tight mt-0.5">
              {title || "Estudo sem título"}
            </p>
          </div>
        </div>

        {/* Prévia */}
        {snippet && (
          <p className="px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300/85 line-clamp-3 whitespace-pre-wrap">
            {snippet}
          </p>
        )}

        {/* Ações */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50/70 dark:bg-white/[0.02] border-t border-slate-200/70 dark:border-white/10">
          <button
            type="button"
            onClick={() => onOpen?.(studyId)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-medium font-tech
              text-slate-700 dark:text-white/80 bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10
              hover:border-cyan-400/50 hover:text-cyan-700 dark:hover:text-cyan-200 transition-colors"
          >
            <Maximize2 size={12} /> Abrir
          </button>
          {focused ? (
            <button
              type="button"
              onClick={() => onUnfocus?.(studyId)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-medium font-tech
                text-cyan-700 dark:text-cyan-200 bg-cyan-500/10 border border-cyan-400/40 hover:bg-cyan-500/15 transition-colors"
            >
              <X size={12} /> Tirar do foco
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onFocus?.(studyId)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-medium font-tech
                text-slate-700 dark:text-white/80 bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10
                hover:border-cyan-400/50 hover:text-cyan-700 dark:hover:text-cyan-200 transition-colors"
            >
              <Crosshair size={12} /> Focar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
