"use client";
/**
 * TelaCarregando — a tela de loading do cyberespaço: o ícone da Zaeon pulsando, a barra com a porcentagem, a etapa
 * que está carregando agora (lib/cyber/carregamento) com o detalhe ("23/41"), as etapas já feitas e uma dica. Fica
 * por cima de TUDO até o mundo inteiro estar pronto (o engine só resolve depois do 1º quadro) e sai com um fade.
 */
import { useEffect, useRef, useState } from "react";
import { DICAS, ETAPAS, type Carregando } from "@/lib/cyber/carregamento";

export default function TelaCarregando({ carga, saindo = false }: { carga: Carregando | null; saindo?: boolean }) {
  const [dica, setDica] = useState(0), feitas = useRef<string[]>([]), ultima = useRef<string | null>(null);
  useEffect(() => { const id = setInterval(() => setDica((d) => (d + 1) % DICAS.length), 4200); return () => clearInterval(id); }, []);
  // as etapas que já passaram (a lista cresce conforme a etapa muda)
  if (carga && carga.etapa !== ultima.current) {
    if (ultima.current) { const r = ETAPAS.find((e) => e.id === ultima.current)?.rotulo; if (r && !feitas.current.includes(r)) feitas.current = [...feitas.current, r]; }
    ultima.current = carga.etapa;
  }
  const pct = Math.round((carga?.progresso ?? 0) * 100);
  return (
    <div role="status" aria-live="polite" aria-label={`Carregando o cyberespaço: ${pct}%`}
      className={`absolute inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-[#020617] px-6 text-center text-sky-100 transition-opacity duration-500 ${saindo ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(29,78,216,.28),transparent_60%)]" />
      <div className="relative flex flex-col items-center">
        <div className="relative mb-5">
          <div aria-hidden="true" className="absolute -inset-6 animate-pulse rounded-full bg-cyan-400/15 blur-2xl motion-reduce:animate-none" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/zaeon.svg" alt="Zaeon" width={104} height={104} className="relative h-[104px] w-[104px] rounded-[28px] shadow-[0_0_48px_-6px_rgba(0,229,255,.55)] ring-1 ring-cyan-300/30" />
        </div>
        <p className="text-2xl font-black tracking-[0.32em] text-white">ZAEON</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/60">cyberespaço</p>

        <div className="mt-8 w-[min(84vw,380px)]">
          <div className="mb-2 flex items-baseline justify-between gap-3 text-left">
            <p className="truncate text-sm font-semibold text-cyan-50">{carga?.rotulo ?? "Preparando…"}{carga?.detalhe ? <span className="ml-1.5 text-xs font-medium text-cyan-200/55">{carga.detalhe}</span> : null}</p>
            <p className="shrink-0 font-mono text-sm font-bold tabular-nums text-cyan-200">{pct}%</p>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/5">
            <div className="relative h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-600 transition-[width] duration-300 ease-out" style={{ width: `${Math.max(2, pct)}%` }}>
              <div aria-hidden="true" className="absolute inset-0 animate-[brilho_1.6s_linear_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)] bg-[length:40%_100%] bg-no-repeat motion-reduce:animate-none" />
            </div>
          </div>
          <ul className="mt-3 h-[66px] space-y-0.5 overflow-hidden text-left text-xs text-cyan-100/45">
            {feitas.current.slice(-3).map((f) => <li key={f}><span className="mr-1.5 text-emerald-300/80">✓</span>{f}</li>)}
          </ul>
        </div>
        <p className="mt-6 max-w-[380px] text-xs leading-relaxed text-sky-100/55">{DICAS[dica]}</p>
      </div>
      <style>{`@keyframes brilho{0%{background-position:-40% 0}100%{background-position:140% 0}}`}</style>
    </div>
  );
}
