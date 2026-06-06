"use client";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { mulberry32, randomCjk, scramble } from "@/lib/scholar/glitch";

// Cadência equilibrada: latim legível → morph → face chinesa → morph → repete.
const DWELL_LATIN = 2400;
const MORPH = 450;
const DWELL_ZH = 1600;
const CYCLE = DWELL_LATIN + MORPH + DWELL_ZH + MORPH;
const FRAME_MS = 45; // ~22fps — choppy de propósito (vibe glitch), barato em renders

function reducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function GlitchTerm({ term, done = false }: { term: string; done?: boolean }) {
  const [display, setDisplay] = useState(term);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const t = term.trim();
    if (!t || done || reducedMotion()) {
      setDisplay(t);
      return;
    }

    const rng = mulberry32(([...t].reduce((a, c) => a + c.charCodeAt(0), 0) % 100000) + 1);
    const len = [...t].length;
    let face = randomCjk(len, rng);
    let start: number | null = null;
    let lastPaint = 0;

    const loop = (ts: number) => {
      if (start == null) start = ts;
      const phase = (ts - start) % CYCLE;

      if (ts - lastPaint >= FRAME_MS) {
        lastPaint = ts;
        let out: string;
        if (phase < DWELL_LATIN) {
          out = t;
          if (rng() < 0.06) {
            const chars = [...t];
            const i = Math.floor(rng() * chars.length);
            if (chars[i] && chars[i] !== " ") chars[i] = randomCjk(1, rng);
            out = chars.join("");
          }
        } else if (phase < DWELL_LATIN + MORPH) {
          out = scramble(t, face, (phase - DWELL_LATIN) / MORPH, rng);
        } else if (phase < DWELL_LATIN + MORPH + DWELL_ZH) {
          out = face;
        } else {
          const p = (phase - DWELL_LATIN - MORPH - DWELL_ZH) / MORPH;
          out = scramble(face, t, p, rng);
          if (p > 0.97) face = randomCjk(len, rng); // nova face p/ o próximo ciclo
        }
        setDisplay(out);
      }
      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [term, done]);

  return (
    <div className="flex items-center gap-2 sm:gap-3 min-w-0" aria-label={`Pesquisando: ${term}`}>
      <Search className="text-violet-500 dark:text-cyan-400 shrink-0 w-5 h-5 sm:w-6 sm:h-6" aria-hidden />
      <span
        style={{ fontFamily: `"Noto Sans SC","Microsoft YaHei",sans-serif` }}
        className="font-black tracking-tight break-words leading-tight text-xl sm:text-2xl md:text-3xl lg:text-4xl bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent"
      >
        {display || " "}
      </span>
    </div>
  );
}
