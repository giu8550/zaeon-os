"use client";
import { useEffect, useRef, useState } from "react";

/**
 * GlitchReveal — revela o texto da esquerda pra direita: o trecho já revelado aparece
 * com a cor normal, e a "ponta" que está nascendo pisca em caracteres chineses ROXOS
 * (glitch característico da Zaeon). Mesmo tamanho do texto final (não encolhe).
 * Respeita prefers-reduced-motion (mostra tudo de uma vez).
 */
function reduced() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
const cjk = () => String.fromCharCode(0x4e00 + Math.floor(Math.random() * 0x3000));

export default function GlitchReveal({
  text,
  className,
  speed = 24,
}: { text: string; className?: string; speed?: number }) {
  const [n, setN] = useState(0);
  const [glitch, setGlitch] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // revela char a char
  useEffect(() => {
    if (!text) { setN(0); return; }
    if (reduced()) { setN(text.length); return; }
    setN(0);
    let i = 0;
    const step = () => {
      i++;
      setN(i);
      if (i < text.length) timer.current = setTimeout(step, speed + Math.random() * 45);
    };
    timer.current = setTimeout(step, speed);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, speed]);

  // pisca a "ponta" chinesa roxa enquanto não terminou
  useEffect(() => {
    if (n >= text.length) { setGlitch(""); return; }
    const make = () => setGlitch(Array.from({ length: Math.min(text.length - n, 5) || 1 }, cjk).join(""));
    make();
    const id = setInterval(make, 70);
    return () => clearInterval(id);
  }, [n, text.length]);

  const done = n >= text.length;
  return (
    <span className={className}>
      {text.slice(0, n)}
      {!done && <span className="text-violet-500 dark:text-violet-400 animate-pulse motion-reduce:animate-none">{glitch}</span>}
    </span>
  );
}
