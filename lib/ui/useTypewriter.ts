"use client";
import { useEffect, useRef, useState } from "react";
import { typeStep, safeCut } from "./typewriter";

/** Revela `text` progressivamente quando `enabled`; senão mostra tudo de imediato. */
export function useTypewriter(text: string, enabled: boolean) {
  const [shown, setShown] = useState(enabled ? 0 : text.length);
  const shownRef = useRef(shown);
  useEffect(() => {
    if (!enabled) { shownRef.current = text.length; setShown(text.length); return; }
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = text.length; setShown(text.length); return;
    }
    let raf = 0;
    const tick = () => {
      const rem = text.length - shownRef.current;
      if (rem <= 0) return;
      shownRef.current = safeCut(text, shownRef.current + typeStep(rem));
      setShown(shownRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, enabled]);
  const n = Math.min(shown, text.length);
  return { visible: text.slice(0, n), done: n >= text.length };
}
