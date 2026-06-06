"use client";
import { useEffect, useRef, useState } from "react";

import { typedSlice } from "@/lib/scholar/typewriter";

function reducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Digita `text` caractere a caractere. Re-digita quando `text`/`replayKey` muda
 *  (ex.: ao montar o componente quando o usuário entra na aba). Respeita prefers-reduced-motion. */
export default function Typewriter({
  text,
  cps = 45,
  replayKey,
  className,
  caret = true,
}: {
  text: string;
  cps?: number;
  replayKey?: string | number;
  className?: string;
  caret?: boolean;
}) {
  const [shown, setShown] = useState(text);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!text || reducedMotion()) {
      setShown(text);
      return;
    }
    const total = [...text].length;
    let start: number | null = null;
    let lastPaint = 0;
    let stop = false;
    setShown("");
    const loop = (ts: number) => {
      if (start == null) start = ts;
      if (ts - lastPaint >= 40) {
        lastPaint = ts;
        const s = typedSlice(text, ts - start, cps);
        setShown(s);
        if ([...s].length >= total) stop = true;
      }
      if (!stop) raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [text, cps, replayKey]);

  const typing = [...shown].length < [...text].length;
  return (
    <span className={className}>
      {shown}
      {caret && typing && <span className="opacity-60 animate-pulse motion-reduce:animate-none">▍</span>}
    </span>
  );
}
