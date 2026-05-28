"use client";
import { useState } from "react";
import { GraduationCap, ArrowUp, Loader2 } from "lucide-react";
import { useOmegaScholar } from "./OmegaScholarContext";

export default function OmegaScholarBar() {
  const { runQuery, status } = useOmegaScholar();
  const [value, setValue] = useState("");
  const busy = status === "running";

  const submit = () => { if (value.trim() && !busy) { runQuery(value); setValue(""); } };

  return (
    <div className="mx-6 mt-6 p-5 rounded-[2rem] bg-gradient-to-r from-violet-500/15 to-purple-500/5 border border-white/30 dark:border-white/10 relative overflow-hidden">
      <div className="absolute -top-8 -right-8 w-40 h-40 bg-violet-400/10 rounded-full blur-[50px] pointer-events-none" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/30 dark:bg-white/5 flex items-center justify-center border border-white/40 dark:border-white/10 shrink-0">
          <GraduationCap className="text-violet-600 dark:text-violet-400" size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-violet-500 dark:text-violet-400">
            Omega Scholar · Pesquisa acadêmica
          </p>
          <div className="flex items-center gap-2 mt-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={busy}
              placeholder="Pesquise, revise a literatura, peça citações…"
              className="flex-1 bg-black/10 dark:bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-violet-400/50 disabled:opacity-60"
            />
            <button onClick={submit} disabled={busy}
              className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 disabled:opacity-60">
              {busy ? <Loader2 className="animate-spin" size={18} /> : <ArrowUp size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
