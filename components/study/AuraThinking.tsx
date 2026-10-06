"use client";

/**
 * AuraThinking — o indicador de "pensando" entre o envio e o 1º token.
 *
 * REGRA: por padrão, SÓ três pontinhos animados ("pensando"). Texto descritivo apenas pra ação externa
 * real e verificável — pesquisando na internet, analisando trabalhos, lendo o PDF, gerando áudio/imagem
 * (lib/ui/pensando.ts: lista fechada). Raciocinar/planejar/redigir/revisar = pontinhos, sem frase. Antes
 * isto digitava listas de palavras genéricas ("Planejando", "Elaborando", "Verificando"…) por tempo.
 *
 * `phases` ficou na assinatura só por compatibilidade com quem ainda passa — é ignorado.
 */
import { rotuloExterno } from "@/lib/ui/pensando";

export default function AuraThinking({
  active = true,
  fase,
}: {
  active?: boolean;
  /** Compat: ignorado. */
  phases?: string[];
  /** Fase REAL vinda do harness. Só vira texto se for uma ação externa conhecida. */
  fase?: string | null;
}) {
  if (!active) return null;
  const texto = rotuloExterno(fase);
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2.5 font-tech text-[19px] leading-none">
      <style>{`
        @keyframes auraShimmer { to { background-position: -200% 0; } }
        @keyframes auraDot { 0%,80%,100% { transform: translateY(0); opacity:.45; } 40% { transform: translateY(-4px); opacity:1; } }
        .aura-shimmer {
          background-image: linear-gradient(90deg,#64748b 0%,#0891b2 25%,#67e8f9 45%,#64748b 70%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent;
          animation: auraShimmer 2.4s linear infinite;
        }
        .dark .aura-shimmer { background-image: linear-gradient(90deg,#94a3b8 0%,#22d3ee 25%,#cffafe 45%,#94a3b8 70%); }
        .aura-dot { width:6px; height:6px; border-radius:9999px; background:#22d3ee; animation: auraDot 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .aura-dot, .aura-shimmer { animation: none; } }
      `}</style>
      {texto && <span className="aura-shimmer whitespace-pre text-[16px]">{texto}</span>}
      <span aria-hidden className="inline-flex items-center gap-[5px] mb-[1px]">
        <span className="aura-dot" />
        <span className="aura-dot" style={{ animationDelay: "160ms" }} />
        <span className="aura-dot" style={{ animationDelay: "320ms" }} />
      </span>
      <span className="sr-only">{texto ?? "pensando"}</span>
    </span>
  );
}
