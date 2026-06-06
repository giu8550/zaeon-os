"use client";
import { useEffect, useRef, useState } from "react";

import { THINKING_STEPS, thinkingState } from "@/lib/scholar/thinking-phrases";

function reducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Loading "a IA está pensando": barra glow + logs de raciocínio simulados no tempo. */
export default function ThinkingStream({ running, label = "a IA está pensando" }: { running: boolean; label?: string }) {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      start.current = null;
      return;
    }
    if (reducedMotion()) {
      setElapsed(THINKING_STEPS.length * 1100);
      return;
    }
    let lastPaint = 0;
    const loop = (ts: number) => {
      if (start.current == null) start.current = ts;
      if (ts - lastPaint >= 60) {
        lastPaint = ts;
        setElapsed(ts - start.current);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  if (!running) return null;
  const { index, progress } = thinkingState(elapsed);
  const recent = THINKING_STEPS.slice(Math.max(0, index - 2), index + 1);
  const pct = Math.round(progress * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400/70 shrink-0 hidden sm:inline">⟁ {label}</span>
        <span className="flex-1 h-[3px] rounded-full bg-white/10 overflow-hidden">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400"
            style={{ width: `${Math.max(3, pct)}%`, transition: "width 160ms linear", boxShadow: "0 0 8px rgba(56,189,248,0.45)" }}
          />
        </span>
        <span className="text-[10px] font-mono text-slate-400 dark:text-white/40 tabular-nums shrink-0">{pct}%</span>
      </div>
      <div className="space-y-0.5" aria-live="polite" style={{ fontFamily: `"Ubuntu Mono","SF Mono","Menlo","Consolas",monospace` }}>
        {recent.map((s, i) => {
          const current = i === recent.length - 1;
          return (
            <p key={s.label} className={`text-[10px] sm:text-[11px] truncate ${current ? "text-cyan-600 dark:text-cyan-300/90" : "text-slate-400 dark:text-white/35"}`}>
              <span className="text-cyan-600 dark:text-cyan-400/80">{s.icon}</span> {s.label}
              {current ? <span className="animate-pulse motion-reduce:animate-none">…</span> : " ✓"}
            </p>
          );
        })}
      </div>
    </div>
  );
}
