"use client";
import { useEffect, useRef, useState } from "react";

import { mulberry32, scramble } from "@/lib/scholar/glitch";

function reducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Faz um scramble único (estilo Matrix) que assenta no texto — para "revelar" um
 *  título assim que ele chega. Respeita prefers-reduced-motion. */
export default function GlitchOnce({ text, durationMs = 600, className }: { text: string; durationMs?: number; className?: string }) {
  const [shown, setShown] = useState(text);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!text || reducedMotion()) {
      setShown(text);
      return;
    }
    const rng = mulberry32([...text].reduce((a, c) => a + c.charCodeAt(0), 0) + 1);
    let start: number | null = null;
    let last = 0;
    const loop = (ts: number) => {
      if (start == null) start = ts;
      const p = Math.min(1, (ts - start) / durationMs);
      if (ts - last >= 45) {
        last = ts;
        setShown(scramble(text, text, p, rng)); // from ignorado; revela `text` conforme p→1
      }
      if (p < 1) raf.current = requestAnimationFrame(loop);
      else setShown(text);
    };
    setShown(scramble(text, text, 0, rng));
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [text, durationMs]);

  return <span className={className}>{shown}</span>;
}
