"use client";

/**
 * VoicePlayButton — botão de "ouvir" com estética Apple liquid-glass.
 *  - parado: disco de vidro + triângulo de play;
 *  - carregando: spinner suave;
 *  - tocando: AURA pulsante + anel cônico girando + as ONDAS do chat widget
 *    (mesmas barras violeta→ciano + núcleo do VoiceWaveIndicator) → consistência visual.
 * Controlado por props (playing/loading) — casa com o estado global do ttsController.
 */
import { Play, Loader2 } from "lucide-react";

interface Props {
  playing: boolean;
  loading?: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** diâmetro em px (default 52) */
  size?: number;
  label?: string;
}

export default function VoicePlayButton({ playing, loading = false, onClick, disabled, size = 52, label }: Props) {
  const title = label || (playing ? "Parar a leitura" : "Ouvir em voz");
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={playing}
      className="relative inline-flex items-center justify-center rounded-full transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ width: size, height: size }}
    >
      <style jsx global>{`
        @keyframes zpbAura { 0%,100%{opacity:.38;transform:scale(1)} 50%{opacity:.82;transform:scale(1.16)} }
        @keyframes zpbRing { to { transform: rotate(360deg) } }
        @keyframes zpbWave { 0%,100%{transform:scaleY(.32)} 50%{transform:scaleY(1)} }
        @keyframes zpbCore { 0%,100%{transform:scale(.7);opacity:.6} 50%{transform:scale(1.25);opacity:1} }
        @media (prefers-reduced-motion: reduce){ .zpb-bar,.zpb-core,.zpb-aura,.zpb-ring{animation:none!important} }
      `}</style>

      {playing && (
        <span aria-hidden className="zpb-aura absolute rounded-full" style={{ inset: -4, background: "radial-gradient(circle, rgba(34,211,238,.5), rgba(124,58,237,.16) 60%, transparent 72%)", filter: "blur(9px)", animation: "zpbAura 2.2s ease-in-out infinite" }} />
      )}
      {playing && (
        <span aria-hidden className="zpb-ring absolute rounded-full" style={{ inset: -2, background: "conic-gradient(from 0deg, transparent, rgba(34,211,238,.92), transparent 55%)", WebkitMaskImage: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))", maskImage: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))", animation: "zpbRing 3s linear infinite" }} />
      )}

      {/* disco de vidro (claro = tom suave que se destaca; dark herda do fundo) */}
      <span
        className="absolute inset-0 rounded-full backdrop-blur-xl border shadow-[0_8px_24px_-8px_rgba(37,99,235,.5)]"
        style={{
          background: playing
            ? "linear-gradient(135deg, rgba(224,242,254,.92), rgba(237,233,254,.85))"
            : "linear-gradient(135deg, rgba(255,255,255,.92), rgba(224,240,255,.78))",
          borderColor: playing ? "rgba(34,211,238,.5)" : "rgba(255,255,255,.9)",
        }}
      />
      <span aria-hidden className="absolute rounded-full bg-white" style={{ top: 4, left: "50%", transform: "translateX(-50%)", width: size * 0.48, height: size * 0.15, opacity: 0.6, filter: "blur(2px)" }} />

      <span className="relative z-10 flex items-center justify-center text-cyan-600 dark:text-cyan-300">
        {loading ? (
          <Loader2 size={Math.round(size * 0.38)} className="animate-spin" />
        ) : playing ? (
          <Waves size={size} />
        ) : (
          <Play size={Math.round(size * 0.4)} className="ml-[2px]" fill="currentColor" />
        )}
      </span>
    </button>
  );
}

// Ondas do chat widget: núcleo (gradiente) + 9 barras com perfil de onda.
function Waves({ size }: { size: number }) {
  const profile = [0.5, 0.85, 0.6, 1, 0.7, 0.9, 0.55, 0.8, 0.45];
  const maxH = Math.round(size * 0.42);
  return (
    <span className="flex items-center" style={{ gap: 3, height: maxH }}>
      <span className="zpb-core rounded-full" style={{ width: 6, height: 6, marginRight: 2, background: "linear-gradient(135deg,#7c3aed,#22d3ee)", boxShadow: "0 0 6px rgba(34,211,238,.55)", animation: "zpbCore 1.1s ease-in-out infinite" }} />
      {profile.map((p, i) => (
        <span
          key={i}
          className="zpb-bar rounded-full"
          style={{
            width: 2.6,
            height: Math.round(8 + p * (maxH - 8)),
            transformOrigin: "center",
            background: "linear-gradient(180deg,#22d3ee,#7c3aed)",
            animation: `zpbWave ${0.6 + (i % 4) * 0.16}s ease-in-out ${i * 0.07}s infinite`,
          }}
        />
      ))}
    </span>
  );
}
