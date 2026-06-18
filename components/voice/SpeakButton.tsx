"use client";

/**
 * SpeakButton — botão de play (🔊) drop-in para QUALQUER texto gerado
 * (respostas, blocos do caderno, citações, resumos…). Usa useTTS: tenta o
 * engine neural (/api/ai/voice) e cai na voz do navegador. Cada botão controla
 * sua própria leitura (toca / para).
 */
import { Volume2, Square } from "lucide-react";
import useTTS from "@/lib/voice/useTTS";

export default function SpeakButton({
  text,
  size = 13,
  className,
  title = "Ouvir",
}: {
  text: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const { speak, stop, speaking } = useTTS();
  if (!text?.trim()) return null;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); speaking ? stop() : speak(text); }}
      title={speaking ? "Parar" : title}
      aria-label={speaking ? "Parar leitura" : title}
      className={className ||
        `shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-lg transition-colors ${speaking
          ? "text-cyan-600 dark:text-cyan-300 bg-cyan-500/10"
          : "text-slate-400 dark:text-white/40 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-cyan-500/10"}`}
    >
      {speaking ? <Square size={size - 1} /> : <Volume2 size={size} />}
    </button>
  );
}
