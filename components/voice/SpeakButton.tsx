"use client";

// Botão drop-in pra ouvir um texto (a resposta do agente). Grátis na Vercel.
import { useVoice } from "@/lib/voice/useVoice";
import { SpeakerWaveIcon, StopCircleIcon } from "@heroicons/react/24/outline";

export default function SpeakButton({ text, className }: { text: string; className?: string }) {
    const { speak, stop, speaking, supported } = useVoice();
    if (!supported || !text?.trim()) return null;

    return (
        <button
            onClick={() => (speaking ? stop() : speak(text))}
            title={speaking ? "Parar" : "Ouvir"}
            className={className ||
                "p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10 transition-all shrink-0"}
        >
            {speaking
                ? <StopCircleIcon className="w-4 h-4 animate-pulse text-cyan-500" />
                : <SpeakerWaveIcon className="w-4 h-4" />}
        </button>
    );
}
