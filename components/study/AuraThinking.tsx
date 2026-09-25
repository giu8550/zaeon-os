"use client";

/**
 * AuraThinking — o "loading agêntico" entre input→output, no capricho dos sistemas
 * SOTA. Em vez de três pontinhos ou um card estático, mostra a TRAJETÓRIA do harness
 * como UM rótulo vivo que troca de fase de forma orgânica:
 *   - ícone ⟁ com uma partícula orbitando + pulso;
 *   - a palavra da fase surge LETRA POR LETRA (typewriter) com cursor;
 *   - um shimmer varre o texto continuamente;
 *   - ao trocar de fase: digita → segura → apaga → digita a próxima.
 *
 * DUAS FONTES DE FASE. Sem `fase`, o rótulo avança POR TEMPO com uma sequência
 * plausível — é o que existia, e continua valendo para quem não tem harness narrando.
 * Com `fase`, manda o harness: o rótulo é o que a trajetória acabou de anunciar, e a
 * tela para de inventar. Era o que este arquivo já prometia fazer um dia.
 */

import { useEffect, useReducer, useRef } from "react";

const DEFAULT_PHASES = ["Planejando", "Buscando fontes", "Raciocinando", "Elaborando", "Verificando"];

type Mode = "type" | "hold" | "delete";

export default function AuraThinking({
  active = true,
  phases = DEFAULT_PHASES,
  fase,
}: {
  active?: boolean;
  phases?: string[];
  /** Fase REAL vinda do harness. Quando presente, manda nela e o relógio não opina. */
  fase?: string | null;
}) {
  const roteiro = fase ? [fase] : phases;
  // A dependência do efeito é uma STRING, de propósito: `phases` é um array literal no
  // chamador, com identidade nova a cada render — usá-lo como dependência reiniciaria a
  // animação para sempre, num laço que só apareceria como CPU queimando.
  const chave = fase ? `f:${fase}` : `p:${phases.join("|")}`;
  const pi = useRef(0);     // índice da fase
  const ci = useRef(0);     // letras reveladas
  const mode = useRef<Mode>("type");
  const hold = useRef(0);
  const [, force] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (!active) return;
    pi.current = 0; ci.current = 0; mode.current = "type"; hold.current = 0; force();

    const TICK = 55;                        // velocidade base do "digitar"
    const HOLD_TICKS = Math.round(1000 / TICK);
    const id = setInterval(() => {
      const word = roteiro[pi.current] ?? "";
      const last = pi.current >= roteiro.length - 1;

      if (mode.current === "type") {
        if (ci.current < word.length) ci.current++;
        else { mode.current = "hold"; hold.current = 0; }
      } else if (mode.current === "hold") {
        if (hold.current < HOLD_TICKS) hold.current++;
        else if (!last) mode.current = "delete";     // última fase: segura (fica pulsando)
      } else {
        if (ci.current > 0) ci.current -= 2;          // apaga um tico mais rápido
        else { ci.current = 0; pi.current++; mode.current = "type"; }
      }
      force();
    }, TICK);

    return () => clearInterval(id);
    // `roteiro` é derivado de `chave` — reentra junto, sem entrar na lista por identidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, chave]);

  const word = roteiro[pi.current] ?? "";
  const shown = word.slice(0, Math.max(0, ci.current));

  return (
    <span className="inline-flex items-center gap-2.5 font-tech text-[19px] leading-none">
      <style>{`
        @keyframes auraShimmer { to { background-position: -200% 0; } }
        @keyframes auraCore { 0%,100% { transform: scale(1); opacity:.9; } 50% { transform: scale(1.12); opacity:1; } }
        .aura-shimmer {
          background-image: linear-gradient(90deg,#64748b 0%,#0891b2 25%,#67e8f9 45%,#64748b 70%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent;
          animation: auraShimmer 2.4s linear infinite;
        }
        .dark .aura-shimmer {
          background-image: linear-gradient(90deg,#94a3b8 0%,#22d3ee 25%,#cffafe 45%,#94a3b8 70%);
        }
      `}</style>

      {/* Ícone vivo: ⟁ pulsando + partícula orbitando */}
      <span className="relative inline-flex items-center justify-center w-[20px] h-[20px] shrink-0">
        <span
          className="text-cyan-500 dark:text-cyan-300 text-[15px] leading-none motion-reduce:!animate-none"
          style={{ animation: "auraCore 1.8s ease-in-out infinite", filter: "drop-shadow(0 0 7px rgba(34,211,238,0.85))" }}
        >
          ⟁
        </span>
        <span className="absolute inset-0 motion-safe:animate-[spin_1.9s_linear_infinite] motion-reduce:hidden">
          <span className="absolute left-1/2 -top-[1px] -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.95)]" />
        </span>
      </span>

      {/* Palavra da fase (letra a letra + shimmer) + 3 pontinhos CONSTANTES */}
      <span className="inline-flex items-center gap-1.5">
        <span className="aura-shimmer whitespace-pre">{shown}</span>
        <span className="inline-flex items-center gap-[3px] mb-[2px]">
          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" />
          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
        </span>
      </span>
    </span>
  );
}
