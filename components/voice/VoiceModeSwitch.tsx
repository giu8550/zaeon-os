"use client";

/**
 * VoiceModeSwitch — o "switch de voz" próprio de cada janela de chat/input.
 *
 * Liga o ditado por voz daquela janela: enquanto ouvindo, o texto reconhecido é
 * entregue via onTranscript (ao vivo) e onFinal (quando a frase fecha). Visual na
 * identidade Zaeon (violeta→ciano), com pulso ao ouvir, claro e escuro.
 *
 * Hoje usa Web Speech API (useSTT). Quando o engine premium subir, o mesmo switch
 * passa a usar faster-whisper sem trocar quem o consome.
 */
import { Mic, MicOff } from "lucide-react";
import useSTT from "@/lib/voice/useSTT";

export default function VoiceModeSwitch({
  onTranscript,
  onFinal,
  title = "Ditar por voz",
  size = 16,
  lang = "pt-BR",
}: {
  onTranscript?: (text: string) => void;
  onFinal?: (text: string) => void;
  title?: string;
  size?: number;
  lang?: string;
}) {
  const { toggle, listening, supported } = useSTT({
    lang,
    onResult: (text, final) => {
      onTranscript?.(text);
      if (final) onFinal?.(text);
    },
  });

  if (!supported) return null; // sem reconhecimento no browser → não mostra o switch

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      aria-pressed={listening}
      title={listening ? "Ouvindo… toque para parar" : title}
      className={`relative shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full transition-all ${listening
        ? "text-white shadow-md"
        : "text-slate-500 dark:text-white/50 bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 hover:text-cyan-600 hover:border-cyan-400/40"}`}
      style={listening ? { background: "linear-gradient(135deg,#7c3aed,#06b6d4)" } : undefined}
    >
      {listening && <span className="absolute inset-0 rounded-full border border-cyan-400/50 animate-ping motion-reduce:animate-none" />}
      {listening ? <Mic size={size} /> : <MicOff size={size} />}
    </button>
  );
}
