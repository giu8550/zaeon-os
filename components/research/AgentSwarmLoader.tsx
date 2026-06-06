"use client";
import { useEffect, useRef, useState } from "react";

import { agentNarrative, progressFor, type PhaseLike } from "@/lib/scholar/loading-phases";

function reducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

interface Props {
  phases: PhaseLike[];
  status: string;
  compact?: boolean;
  elapsed?: number;
}

export default function AgentSwarmLoader({ phases, status, compact = false, elapsed }: Props) {
  const [shown, setShown] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  const targetRef = useRef(0);
  targetRef.current = progressFor(phases, status);

  useEffect(() => {
    if (reducedMotion()) {
      setShown(targetRef.current);
      return;
    }
    let last: number | null = null;
    let lastPaint = 0;
    const loop = (ts: number) => {
      if (last == null) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      if (ts - lastPaint >= 40) {
        lastPaint = ts;
        setShown((cur) => {
          const tgt = targetRef.current;
          if (tgt >= 1) return Math.min(1, cur + dt * 1.6);
          // mira um pouco acima do marco atual → creep contínuo (nunca trava), sem ultrapassar o próximo
          const ceil = Math.min(0.97, tgt + 0.05);
          const next = cur + (ceil - cur) * Math.min(1, dt * 1.6);
          return Math.min(ceil, Math.max(cur, next));
        });
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const pct = Math.max(2, Math.round(shown * 100));
  const recent = phases.slice(compact ? -1 : -3);

  const Bar = (
    <span className="flex-1 h-[3px] rounded-full bg-white/10 overflow-hidden">
      <span
        className="block h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400"
        style={{ width: `${pct}%`, boxShadow: "0 0 8px rgba(56,189,248,0.45)", transition: "width 140ms linear" }}
      />
    </span>
  );

  if (compact) {
    const n = recent.length ? agentNarrative(recent[recent.length - 1]) : null;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {Bar}
          <span className="text-[10px] font-mono text-white/40 tabular-nums shrink-0">{pct}%</span>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-white/40 truncate font-mono">
          {n ? (
            <>
              <span className="text-cyan-500 dark:text-cyan-400/80">{n.icon}</span> {n.text}
            </>
          ) : (
            "liberando agentes…"
          )}
          {typeof elapsed === "number" ? <span className="text-slate-400/60 dark:text-white/25"> · {elapsed}s</span> : null}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400/70 shrink-0 hidden sm:inline">
          ⟁ liberando agentes na rede
        </span>
        {Bar}
        <span className="text-[10px] font-mono text-slate-400 dark:text-white/40 tabular-nums shrink-0">{pct}%</span>
      </div>
      <div
        className="space-y-0.5"
        aria-live="polite"
        style={{ fontFamily: `"Ubuntu Mono","SF Mono","Menlo","Consolas",monospace` }}
      >
        {recent.map((p, i) => {
          const n = agentNarrative(p);
          return (
            <p key={phases.length - recent.length + i} className="text-[10px] sm:text-[11px] text-slate-500 dark:text-white/55 truncate">
              <span className="text-cyan-600 dark:text-cyan-400/80">{n.icon}</span> {n.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
