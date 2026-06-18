"use client";

/**
 * VoiceWaveIndicator — barrinha de ondas sonoras que acende quando a Zaeon fala.
 * Assina o controlador global de voz (useTTS). Clicar = parar a fala.
 *
 * - horizontal (default): barras lado a lado (cabe no slot da navbar).
 * - vertical: barras empilhadas (modo foco, encaixa na sidebar acima do "Layout").
 *
 * Quando não há fala, fica num estado discreto (⟁) — não ocupa/atrapalha.
 */
import useTTS from "@/lib/voice/useTTS";

export default function VoiceWaveIndicator({
  vertical = false,
  size = 18,
  className = "",
}: {
  vertical?: boolean;
  size?: number;
  className?: string;
}) {
  const { speaking, loading, stop } = useTTS();
  const active = speaking || loading;
  const bars = [0, 1, 2, 3, 4];

  if (!active) {
    // estado de repouso: ⟁ discreto (a voz toca por si quando há resposta)
    return (
      <div
        className={`flex items-center justify-center text-cyan-500/70 dark:text-cyan-300/70 ${className}`}
        style={{ width: vertical ? size + 8 : undefined, height: vertical ? undefined : size + 8 }}
        title="Voz da Zaeon"
        aria-hidden
      >
        <span className="text-[13px] leading-none">&#10177;</span>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); stop(); }}
      title="Zaeon falando — toque para parar"
      aria-label="Parar a voz"
      className={`flex items-center justify-center gap-[3px] ${vertical ? "flex-col" : "flex-row"} ${className}`}
      style={{ width: vertical ? size + 10 : undefined, height: vertical ? undefined : size + 8 }}
    >
      {bars.map((i) => (
        <span
          key={i}
          className="rounded-full bg-gradient-to-t from-violet-500 to-cyan-400 zaeon-wavebar"
          style={{
            width: vertical ? "100%" : 3,
            height: vertical ? 3 : "100%",
            // @ts-expect-error CSS custom prop p/ o keyframe
            "--d": `${0.7 + (i % 3) * 0.18}s`,
            animationDelay: `${i * 0.09}s`,
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes zaeonWaveH { 0%,100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
        @keyframes zaeonWaveV { 0%,100% { transform: scaleX(0.35); } 50% { transform: scaleX(1); } }
        .zaeon-wavebar { transform-origin: center; animation: zaeonWaveH var(--d, .8s) ease-in-out infinite; }
        .flex-col > .zaeon-wavebar { animation-name: zaeonWaveV; }
        @media (prefers-reduced-motion: reduce) { .zaeon-wavebar { animation: none; } }
      `}</style>
    </button>
  );
}
