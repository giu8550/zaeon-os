"use client";
/**
 * BalaoTour — o cartão dos TOURS DO LABORATÓRIO (o da sala, TourSala, e o do Escritório, TourEscritorio): vidro escuro
 * discreto, hairline no acento da Aura (ciano/roxo), um anel fino com brilho suave no alvo e um scrim leve — no lugar do
 * balão dourado do Droid (que segue só na 1ª missão do tablet, components/onboard/BalaoDroid).
 * Reusa o destaque (useDestaque) e a conta de posição (posicaoDoBalao) do Droid: o cartão nunca cobre o que a pessoa
 * precisa clicar. Esc = pular. O foco vai pro botão principal a cada passo; a fala é aria-live.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { posicaoDoBalao, type Caixa } from "@/lib/onboarding/tutorialLab";

export { useDestaque } from "@/components/onboard/BalaoDroid";

const CIANO = "34,211,238";
const ROXO = "167,139,250";
const LARGURA = 340;

const CSS = `
@keyframes bt-anel { 0%,100% { box-shadow: 0 0 0 1.5px rgba(${CIANO},.85), 0 0 14px 2px rgba(${CIANO},.28) } 50% { box-shadow: 0 0 0 1.5px rgba(${ROXO},.9), 0 0 22px 4px rgba(${ROXO},.32) } }
.bt-anel { animation: bt-anel 2.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .bt-anel { animation: none; } }
`;

export function OverlayTour({ alvo, evita, titulo, fala, passo, total, acao, onPular, chave }: {
  alvo: Caixa | null;
  evita: Caixa | null;
  /** a dica curta (1 linha, com emoji) */
  titulo: string;
  fala: string;
  /** 0-based */
  passo: number;
  total: number;
  /** o botão do passo (cta) — sem ele, o passo anda pela AÇÃO (o cartão só explica) */
  acao?: { rotulo: string; onClick: () => void };
  onPular?: () => void;
  /** muda a cada passo (reposiciona e devolve o foco) */
  chave: string;
}) {
  const card = useRef<HTMLDivElement>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const [alt, setAlt] = useState(180);
  const W = window.innerWidth, H = window.innerHeight, larg = Math.min(W - 24, LARGURA);
  const pos = posicaoDoBalao(evita ?? alvo, W, H, { w: larg, h: alt });
  useLayoutEffect(() => { const el = card.current; if (!el) return; const h = el.offsetHeight; if (h && Math.abs(h - alt) > 2) setAlt(h); }, [fala, titulo, pos.w, alt]);
  // o foco vai pro botão do passo (ou pro Pular), sem rolar a página
  useEffect(() => { (principal.current ?? card.current)?.focus({ preventScroll: true }); }, [chave]);
  useEffect(() => {
    if (!onPular) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onPular(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onPular]);
  const P = 6;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[1300]">
      <style>{CSS}</style>
      {alvo ? (
        <div data-tour-anel className="bt-anel absolute rounded-xl transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ left: alvo.x - P, top: alvo.y - P, width: alvo.w + P * 2, height: alvo.h + P * 2, outline: "9999px solid rgba(2,6,23,.38)" }} />
      ) : <div className="absolute inset-0 bg-[rgba(2,6,23,.22)]" />}
      <div
        ref={card}
        role="dialog"
        data-tour-cartao
        aria-label={titulo}
        tabIndex={-1}
        // o cartão segura o próprio mousedown: clicar nele não conta como "clique fora" de um painel aberto (o mapa)
        onMouseDown={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute rounded-2xl border px-4 pb-3 pt-3.5 outline-none backdrop-blur-xl transition-[left,top] duration-300 ease-out motion-reduce:transition-none"
        style={{
          width: pos.w, left: pos.left, top: pos.top,
          background: "rgba(8,12,28,.86)",
          borderColor: `rgba(${CIANO},.22)`,
          boxShadow: `0 16px 40px -18px rgba(0,0,0,.75), 0 0 0 1px rgba(${ROXO},.06) inset`,
        }}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `linear-gradient(135deg, rgb(${CIANO}), rgb(${ROXO}))` }} />
          <p className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-cyan-200/90">{titulo}</p>
          <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/35" aria-label={`Passo ${passo + 1} de ${total}`}>{passo + 1} / {total}</span>
        </div>
        <p aria-live="polite" className="mt-1.5 text-[13px] leading-relaxed text-white/85">{fala}</p>
        <div className="mt-3 flex items-center gap-2">
          <span aria-hidden className="mr-auto flex items-center gap-1">
            {Array.from({ length: total }, (_, k) => (
              <span key={k} className={`h-1 rounded-full transition-all ${k === passo ? "w-3.5 bg-cyan-300/80" : k < passo ? "w-1 bg-white/35" : "w-1 bg-white/15"}`} />
            ))}
          </span>
          {onPular && (
            <button type="button" onClick={onPular} ref={acao ? undefined : principal}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white/50 transition-colors hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan-300/60">
              Pular
            </button>
          )}
          {acao && (
            <button type="button" ref={principal} onClick={acao.onClick}
              className="rounded-full border px-3.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan-300/70"
              style={{ borderColor: `rgba(${CIANO},.45)`, background: `linear-gradient(135deg, rgba(${CIANO},.16), rgba(${ROXO},.16))` }}>
              {acao.rotulo}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
