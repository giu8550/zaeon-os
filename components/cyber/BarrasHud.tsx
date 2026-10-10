"use client";
/**
 * BarrasHud — as três barras do HUD do cyberespaço (no lugar dos botões de ação — pedido do dono, out/2026):
 *  - SAÚDE: a vida do combate (lib/cyber/combate, `engine.combate()`);
 *  - VIGOR: o fôlego do sprint/dash (lib/cyber/vigor, `engine.vigorAgora()`);
 *  - IA: o uso CONCORRENTE de IA — o trabalho que está rodando no laboratório do TABLET (qualquer aba/sub-aba), mesmo com
 *    o tablet guardado (components/cyber/TabletLab + lib/ui/monitorIA). Enquanto a IA trabalha, a barra enche devagar com
 *    o tempo correndo; quando a resposta fica pronta, enche e acende. É o "enquanto a IA pensa, vai brincar".
 */
import { useEffect, useState } from "react";
import type { EstadoIALab } from "@/lib/ui/loungeHub";

/** só vira "IA trabalhando" depois desse tempo (um salvamento rápido não pisca a barra) */
export const IA_MIN_MS = 600;
/** quanto tempo o "pronto" fica aceso depois que a resposta chega */
export const IA_PRONTO_MS = 12_000;
/** o enchimento enquanto trabalha: rápido no começo, devagar depois (nunca chega a 100% antes de acabar) */
export const enchimentoIA = (ms: number) => 0.92 * (1 - Math.exp(-ms / 22_000));
const relogio = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/** junta o estado novo do laboratório com o anterior: um trabalho CURTO (um salvamento logo depois da resposta) não
 *  apaga o "pronto" de um trabalho longo */
export function juntarEstadoIA(antes: EstadoIALab | null, novo: EstadoIALab): EstadoIALab {
  const terminou = novo.terminou && novo.terminou.durMs >= IA_MIN_MS ? novo.terminou : antes?.terminou ?? null;
  return { ...novo, terminou };
}
/** o estado da barra de IA agora */
export function barraIA(e: EstadoIALab | null, agora: number): { modo: "livre" | "trabalhando" | "pronto"; f: number; rotulo: string } {
  if (e && e.ativos > 0 && e.desde !== null && agora - e.desde >= IA_MIN_MS) { const ms = agora - e.desde; return { modo: "trabalhando", f: enchimentoIA(ms), rotulo: `IA trabalhando · ${relogio(ms)}` }; }
  if (e?.terminou && agora - e.terminou.em < IA_PRONTO_MS && e.terminou.durMs >= IA_MIN_MS) return { modo: "pronto", f: 1, rotulo: `Resposta pronta · ${relogio(e.terminou.durMs)}` };
  return { modo: "livre", f: 0, rotulo: "IA livre" };
}

type Leitura = { vida: number; vidaMax: number; caido: boolean; vigor: number; exausto: boolean };

export default function BarrasHud({ ler, ia, touch }: { ler: () => Leitura | null; ia: EstadoIALab | null; touch: boolean }) {
  const [l, setL] = useState<Leitura | null>(null), [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => { setL(ler()); setAgora(Date.now()); }, 120); return () => clearInterval(id); }, [ler]);
  if (!l) return null;
  const b = barraIA(ia, agora), vida = l.vidaMax > 0 ? l.vida / l.vidaMax : 0;
  const Barra = ({ rotulo, f, cor, brilho, extra, titulo }: { rotulo: string; f: number; cor: string; brilho: string; extra?: string; titulo: string }) => (
    <div className="flex w-[150px] flex-col gap-1 sm:w-[180px]" role="meter" aria-label={titulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f * 100)}>
      <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-white/75"><span>{titulo}</span><span className="normal-case tracking-normal text-white/55">{rotulo}</span></span>
      <span className="relative h-[7px] overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
        <span className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-150 ${cor} ${extra ?? ""}`} style={{ width: `${Math.max(0, Math.min(1, f)) * 100}%`, boxShadow: brilho }} />
      </span>
    </div>
  );
  return (
    <div className="pointer-events-none absolute left-1/2 z-[21] flex -translate-x-1/2 items-end gap-4 rounded-2xl border border-white/10 bg-[#05081a]/55 px-4 py-2.5 backdrop-blur" style={touch ? { top: 64 } : { bottom: 18 }}>
      <Barra titulo="Saúde" rotulo={l.caido ? "caído" : `${Math.round(l.vida)}`} f={vida} cor="bg-gradient-to-r from-rose-500 to-pink-400" brilho="0 0 10px rgba(255,80,140,.55)" />
      <Barra titulo="Vigor" rotulo={l.exausto ? "exausto" : `${Math.round(l.vigor * 100)}%`} f={l.vigor} cor={l.exausto ? "bg-amber-700" : "bg-gradient-to-r from-amber-400 to-yellow-300"} brilho={l.exausto ? "none" : "0 0 10px rgba(255,200,80,.5)"} />
      <Barra titulo="IA" rotulo={b.rotulo} f={b.f} cor={b.modo === "pronto" ? "bg-gradient-to-r from-emerald-300 to-cyan-300" : "bg-gradient-to-r from-cyan-500 to-sky-300"} brilho={b.modo === "livre" ? "none" : b.modo === "pronto" ? "0 0 14px rgba(80,255,200,.75)" : "0 0 10px rgba(80,200,255,.6)"} extra={b.modo === "trabalhando" ? "barra-ia-viva" : ""} />
      <style>{`.barra-ia-viva { background-size: 200% 100%; animation: barra-ia 1.6s linear infinite; background-image: linear-gradient(90deg, #06b6d4, #7dd3fc, #06b6d4); } @keyframes barra-ia { to { background-position: -200% 0; } } @media (prefers-reduced-motion: reduce) { .barra-ia-viva { animation: none; } }`}</style>
    </div>
  );
}
