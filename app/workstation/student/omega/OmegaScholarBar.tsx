"use client";
import { useState, useEffect, useRef } from "react";
import { GraduationCap, ArrowUp, Loader2, Flame, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOmegaScholar } from "./OmegaScholarContext";

interface OmegaScholarBarProps {
  flushTop?: boolean;
  onOpenResults?: () => void;
}

export default function OmegaScholarBar({ flushTop = false, onOpenResults }: OmegaScholarBarProps) {
  const { runQuery, status, phases, error, draft, setDraft } = useOmegaScholar();
  const busy = status === "running";

  // ── Elapsed timer ──────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "running") {
      startRef.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000));
      }, 1000);
      return () => clearInterval(id);
    } else {
      startRef.current = null;
    }
  }, [status]);

  const submit = () => {
    if (draft.trim() && !busy) {
      runQuery(draft);
      setDraft("");
    }
  };

  const latestPhase = phases[phases.length - 1]?.message ?? null;

  return (
    <div
      className={`mx-6 ${flushTop ? "mt-0" : "mt-6"} p-5 rounded-[2rem] bg-gradient-to-r from-violet-500/15 to-purple-500/5 border border-white/30 dark:border-white/10 relative overflow-hidden`}
    >
      {/* ambient glow */}
      <div className="absolute -top-8 -right-8 w-40 h-40 bg-violet-400/10 rounded-full blur-[50px] pointer-events-none" />

      <div className="relative z-10 flex items-center gap-3">
        {/* beca icon */}
        <div className="w-12 h-12 rounded-2xl bg-white/30 dark:bg-white/5 flex items-center justify-center border border-white/40 dark:border-white/10 shrink-0">
          <GraduationCap className="text-violet-600 dark:text-violet-400" size={22} />
        </div>

        {/* right side */}
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-violet-500 dark:text-violet-400">
            Omega Scholar · Pesquisa acadêmica
          </p>

          {/* input row */}
          <div className="flex items-center gap-2 mt-2">
            <input
              data-academic-input="true"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={busy}
              placeholder="Pesquise, revise a literatura, peça citações…"
              className="flex-1 bg-black/10 dark:bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-violet-400/50 disabled:opacity-60"
            />
            <button
              onClick={submit}
              disabled={busy}
              className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 disabled:opacity-60"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <ArrowUp size={18} />}
            </button>
          </div>

          {/* ── status strip ─────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {status === "running" && (
              <motion.div
                key="running"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 overflow-hidden"
              >
                {/* burning-tokens row */}
                <motion.div
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  className="flex items-center gap-2"
                >
                  <Flame size={14} className="text-orange-400 shrink-0" />
                  <span className="text-xs font-semibold text-orange-400">
                    queimando tokens
                  </span>
                  <span className="text-xs text-slate-400 dark:text-white/40 tabular-nums">
                    · {elapsed}s
                  </span>
                </motion.div>

                {/* latest phase message */}
                {latestPhase && (
                  <motion.p
                    key={latestPhase}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                    className="mt-1 text-[11px] text-slate-400 dark:text-white/35 truncate"
                  >
                    {latestPhase}
                  </motion.p>
                )}
              </motion.div>
            )}

            {status === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-xs text-emerald-400 font-semibold">
                    Pronto! Resultados em Estudos
                  </span>
                  <button
                    onClick={() => onOpenResults?.()}
                    className="ml-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                  >
                    Ver
                  </button>
                </div>
              </motion.div>
            )}

            {status === "error" && error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <span className="text-xs text-red-400 truncate">{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
