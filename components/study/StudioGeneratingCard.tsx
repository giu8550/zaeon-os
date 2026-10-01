"use client";

/**
 * StudioGeneratingCard — o estado "gerando" de um artefato do Studio (gap F da
 * §7 do handoff). Antes: podcast/vídeo faziam polling por 10-12min com o balão
 * mostrando texto ESTÁTICO "Gerando o artefato…" — parecia travado. Agora: um
 * cartão vivo com emoji do tipo, barra indeterminada, cronômetro (mm:ss) e um
 * aviso honesto de que pode demorar. Vira StudioBlock quando fica pronto.
 *
 * Honesto por design: sem ETA falsa (a geração varia) — mostramos o TEMPO
 * DECORRIDO + barra animada. `onCancel` opcional (integra com o AbortController).
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const KIND_META: Record<string, { emoji: string; label: string; hint: string }> = {
  guide: { emoji: "📘", label: "guia de estudo", hint: "montando o guia…" },
  faq: { emoji: "❓", label: "FAQ", hint: "levantando as perguntas…" },
  flashcards: { emoji: "🃏", label: "flashcards", hint: "criando os cartões…" },
  mindmap: { emoji: "🧠", label: "mapa mental", hint: "conectando os nós…" },
  timeline: { emoji: "🕒", label: "linha do tempo", hint: "ordenando os eventos…" },
  image: { emoji: "🖼️", label: "imagem", hint: "desenhando…" },
  podcast: { emoji: "🎙️", label: "podcast", hint: "gravando as vozes… pode levar alguns minutos" },
  video: { emoji: "🎬", label: "vídeo", hint: "renderizando o vídeo… pode levar vários minutos" },
};

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function StudioGeneratingCard({
  studioKind,
  title,
  startedAt,
  onCancel,
}: {
  studioKind: string;
  title?: string;
  startedAt: number;
  onCancel?: () => void;
}) {
  const meta = KIND_META[studioKind] ?? { emoji: "✨", label: "artefato", hint: "gerando…" };
  const [elapsed, setElapsed] = useState(0);
  const t0 = useRef(startedAt);
  useEffect(() => {
    t0.current = startedAt;
    const id = setInterval(() => setElapsed(Date.now() - t0.current), 500);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.05] dark:bg-white/[0.03] px-4 py-3 max-w-[420px]">
      <style>{`
        @keyframes studioBar { 0% { left:-40%; } 100% { left:100%; } }
        @keyframes studioPulse { 0%,100% { opacity:.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.08); } }
      `}</style>
      <div className="flex items-center gap-2.5">
        <span className="text-[20px] leading-none motion-reduce:!animate-none" style={{ animation: "studioPulse 1.8s ease-in-out infinite" }}>
          {meta.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-tech text-[15px] text-slate-800 dark:text-white/90 truncate">
            Gerando {meta.label}{title ? `: ${title}` : ""}
          </div>
          <div className="font-tech text-[12px] text-slate-500 dark:text-white/50">{meta.hint}</div>
        </div>
        <span className="font-tech text-[12px] tabular-nums text-cyan-700 dark:text-cyan-300 shrink-0">{fmt(elapsed)}</span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            title="Cancelar geração"
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>
      {/* Barra indeterminada (sem ETA falsa) */}
      <div className="mt-2.5 h-1 rounded-full bg-slate-500/15 overflow-hidden relative">
        <span
          className="absolute top-0 h-full w-[40%] rounded-full motion-reduce:hidden"
          style={{ background: "linear-gradient(90deg,transparent,#06b6d4,transparent)", animation: "studioBar 1.4s ease-in-out infinite" }}
        />
      </div>
    </div>
  );
}
