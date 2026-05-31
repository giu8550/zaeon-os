"use client";
import { motion } from "framer-motion";
import { useOmegaScholar } from "./OmegaScholarContext";

export default function ActivityThread() {
  const { phases, answer, status, query } = useOmegaScholar();
  if (status === "idle") return null;
  return (
    <div className="rounded-3xl bg-black/[0.03] dark:bg-black/30 border border-black/5 dark:border-white/10 p-5 mb-5">
      <p className="text-sm font-bold text-slate-700 dark:text-white/80 mb-3">🔎 &quot;{query}&quot;</p>
      <div className="space-y-1.5">
        {phases.map((p, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            className="text-xs text-slate-500 dark:text-white/50 font-medium">{p.message}</motion.div>
        ))}
        {status === "running" && (
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity }}
            className="text-xs text-violet-500 font-semibold">processando…</motion.div>
        )}
      </div>
      {answer && (
        <div className="mt-4 pt-4 border-t border-dashed border-black/10 dark:border-white/10 text-sm leading-relaxed text-slate-700 dark:text-white/80 whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </div>
  );
}
