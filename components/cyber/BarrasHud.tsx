"use client";
/**
 * BarrasHud — as três barras do HUD do cyberespaço (no lugar dos botões de ação — pedido do dono, out/2026):
 *  - VIDA: a vida (lib/cyber/combate, `engine.combate()`) — com sede ela cai, hidratado ela volta;
 *  - ÁGUA: o recurso mais vital (lib/cyber/agua, `engine.aguaAgora()`) — no lugar do vigor;
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

type Leitura = { vida: number; vidaMax: number; caido: boolean; agua: number; seco: boolean; fonte: string | null; sede: boolean };

export default function BarrasHud({ ler, ia, touch }: { ler: () => Leitura | null; ia: EstadoIALab | null; touch: boolean }) {
  const [l, setL] = useState<Leitura | null>(null), [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => { setL(ler()); setAgora(Date.now()); }, 120); return () => clearInterval(id); }, [ler]);
  if (!l) return null;
  const b = barraIA(ia, agora), vida = l.vidaMax > 0 ? l.vida / l.vidaMax : 0;
  const Barra = ({ rotulo, f, cor, brilho, extra, titulo, icone, larg = "w-[150px] sm:w-[170px]", alto = "h-[7px]", rotuloCor = "text-white/55" }: { rotulo: string; f: number; cor: string; brilho: string; extra?: string; titulo: string; icone?: string; larg?: string; alto?: string; rotuloCor?: string }) => (
    <div className={`flex flex-col gap-1 ${larg}`} role="meter" aria-label={titulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f * 100)}>
      <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-white/75"><span>{icone && <span aria-hidden className="mr-1">{icone}</span>}{titulo}</span><span className={`normal-case tracking-normal ${rotuloCor}`}>{rotulo}</span></span>
      <span className={`relative ${alto} overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10`}>
        <span className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-150 ${cor} ${extra ?? ""}`} style={{ width: `${Math.max(0, Math.min(1, f)) * 100}%`, boxShadow: brilho }} />
      </span>
    </div>
  );
  const ia100 = b.modo === "pronto", iaViva = b.modo === "trabalhando";
  return (
    <div className="pointer-events-none absolute left-1/2 z-[21] flex -translate-x-1/2 items-end gap-4 rounded-2xl border border-white/10 bg-[#05081a]/60 px-4 py-2.5 backdrop-blur" style={touch ? { top: 64 } : { bottom: 18 }}>
      <Barra titulo="Vida" icone="♥" rotulo={l.caido ? "caído" : `${Math.round(l.vida)}`} f={vida} cor="bg-gradient-to-r from-rose-500 to-pink-400" brilho="0 0 10px rgba(255,80,140,.55)" />
      {/* a ÁGUA — o recurso mais vital (lib/cyber/agua): correr e o turbo gastam; nas fontes enche; com sede, a vida cai */}
      <Barra titulo="Água" icone="💧" f={l.agua}
        rotulo={l.sede ? "sede!" : l.fonte ? `bebendo · ${l.fonte}` : l.seco ? "seco" : `${Math.round(l.agua * 100)}%`}
        rotuloCor={l.sede ? "text-rose-300 motion-safe:animate-pulse" : l.fonte ? "text-sky-200" : "text-white/55"}
        cor={l.seco ? "bg-sky-900" : "barra-agua"} brilho={l.seco ? "none" : "0 0 10px rgba(56,189,248,.6)"} />
      {/* a IA — mais PODEROSA: maior, segmentada, em ciano; quando a IA ENTREGA o output, fica NEON */}
      <div className={`flex flex-col gap-1 w-[190px] sm:w-[240px] ${ia100 ? "ia-neon" : ""}`} role="meter" aria-label="IA" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(b.f * 100)}>
        <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: ia100 ? "#a5f3fc" : "rgba(165,243,252,.8)", textShadow: ia100 ? "0 0 8px #22d3ee" : undefined }}>
          <span><span aria-hidden className="mr-1">◆</span>IA</span>
          <span className="normal-case tracking-normal" style={{ color: ia100 ? "#ecfeff" : "rgba(255,255,255,.6)" }}>{ia100 ? `✦ output entregue · ${b.rotulo.replace(/^Resposta pronta · /, "")}` : b.rotulo}</span>
        </span>
        <span className="relative h-[11px] overflow-hidden rounded-[4px] bg-cyan-950/70 ring-1" style={{ boxShadow: ia100 ? "0 0 0 1px #22d3ee" : undefined, borderColor: "#155e75" }}>
          <span className={`absolute inset-y-0 left-0 rounded-[3px] transition-[width] duration-150 ${ia100 ? "bg-cyan-200" : iaViva ? "barra-ia-viva" : "bg-cyan-700/60"}`}
            style={{ width: `${Math.max(0, Math.min(1, b.f)) * 100}%`, boxShadow: ia100 ? "0 0 10px #67e8f9, 0 0 22px #22d3ee, 0 0 42px rgba(34,211,238,.75)" : iaViva ? "0 0 12px rgba(34,211,238,.7)" : "none" }} />
          {/* os SEGMENTOS (cara de medidor de energia) */}
          <span aria-hidden className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 calc(10% - 2px), rgba(2,6,23,.75) calc(10% - 2px) 10%)" }} />
        </span>
      </div>
      <style>{`.barra-agua { background-image: linear-gradient(90deg, #0284c7, #38bdf8, #7dd3fc, #38bdf8, #0284c7); background-size: 200% 100%; animation: barra-agua 3.2s linear infinite; }
        @keyframes barra-agua { to { background-position: -200% 0; } }
        .barra-ia-viva { background-size: 200% 100%; animation: barra-ia 1.4s linear infinite; background-image: linear-gradient(90deg, #0891b2, #22d3ee, #a5f3fc, #22d3ee, #0891b2); }
        @keyframes barra-ia { to { background-position: -200% 0; } }
        .ia-neon { animation: ia-neon 1.6s ease-in-out infinite; }
        @keyframes ia-neon { 0%,100% { filter: drop-shadow(0 0 4px #22d3ee); } 50% { filter: drop-shadow(0 0 12px #22d3ee) brightness(1.15); } }
        @media (prefers-reduced-motion: reduce) { .barra-ia-viva, .barra-agua, .ia-neon { animation: none; } }`}</style>
    </div>
  );
}
