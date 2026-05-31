// components/research/ContextualSuggestionDock.tsx
"use client";
import { useEffect, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, SparklesIcon } from "@heroicons/react/24/outline";
import ResearchSuggestionPanel from "./ResearchSuggestionPanel";
import { isAcademicTerm } from "@/lib/scholar/academic-term-classifier";

const LS_KEY = "zaeon:dock:collapsed";
const COOLDOWN_MS = 8000;

interface Props {
  topic: string;
  onSelectTitle?: (title: string) => void;
}

export default function ContextualSuggestionDock({ topic, onSelectTitle }: Props) {
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      setCollapsed(localStorage.getItem(LS_KEY) === "1");
    } catch {
      /* localStorage indisponível — segue não-colapsado */
    }
  }, []);

  const term = (topic ?? "").trim();
  const academic = term.length >= 3 && isAcademicTerm(term).isAcademic;
  const onCooldown = Date.now() < dismissedUntil;

  if (!mounted || !academic || onCooldown) return null;

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(LS_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  const dismiss = () => setDismissedUntil(Date.now() + COOLDOWN_MS);

  return (
    <div
      className="sticky top-0 z-30 px-6 pt-3"
      role="region"
      aria-label="Sugestão de pesquisa contextual"
    >
      <div className="rounded-[2rem] bg-[#030014]/95 backdrop-blur-xl border border-cyan-400/15 shadow-[0_8px_30px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-black uppercase tracking-[.15em] text-cyan-400">
              Sugestão contextual
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              aria-label={collapsed ? "Expandir sugestão" : "Recolher sugestão"}
              className="p-1 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-cyan-400 transition-colors"
            >
              {collapsed ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
            </button>
            <button
              onClick={dismiss}
              aria-label="Dispensar sugestão"
              className="px-2 py-1 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 text-[11px] transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
        {!collapsed && (
          <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
            <ResearchSuggestionPanel docTitle={term} onSelectTitle={onSelectTitle} />
          </div>
        )}
      </div>
    </div>
  );
}
