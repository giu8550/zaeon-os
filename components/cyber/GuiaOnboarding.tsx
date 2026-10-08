"use client";
/**
 * GuiaOnboarding — a FALA da anfitriã (a Zaeon, lib/cyber/agentes) durante o tour de quem acabou de nascer no
 * hiperespaço (lib/cyber/onboarding): o retrato dela, o passo, o título e a fala, com "Próximo" e "Pular". O mesmo
 * cartão serve de conversa quando alguém fala com ela (F) fora do tour.
 */
export type CartaoAgente = { agente: string; cor: string; titulo: string; fala: string; passo?: number; total?: number };

export default function GuiaOnboarding(p: {
  cartao: CartaoAgente;
  touch: boolean;
  acoes: { rotulo: string; principal?: boolean; fazer(): void }[];
}) {
  const c = p.cartao;
  return (
    <div role="status" aria-live="polite" className="absolute z-[26] w-[min(92vw,360px)] rounded-2xl border bg-[#0d0a1c]/88 p-3.5 text-sm text-amber-50 shadow-[0_0_40px_-12px_rgba(255,207,110,.55)] backdrop-blur"
      style={{ borderColor: `${c.cor}55`, ...(p.touch ? { right: 12, top: 64 } : { right: 16, bottom: 16 }) }}>
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2" style={{ borderColor: c.cor, boxShadow: `0 0 18px ${c.cor}88` }}>
          <img src="/agents/bento.png" alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-extrabold" style={{ color: c.cor }}>{c.agente} <span className="text-[11px] font-semibold text-amber-100/55">· anfitriã</span></p>
            {c.total ? <span className="text-[11px] tabular-nums text-amber-100/50">{(c.passo ?? 0) + 1}/{c.total}</span> : null}
          </div>
          <p className="mt-0.5 text-[13px] font-bold text-white">{c.titulo}</p>
          <p className="mt-1 text-[12.5px] leading-snug text-amber-50/80">{c.fala}</p>
        </div>
      </div>
      {p.acoes.length > 0 && (
        <div className="mt-3 flex justify-end gap-2">
          {p.acoes.map((a) => (
            <button key={a.rotulo} type="button" onClick={a.fazer} className={a.principal ? "min-h-[36px] rounded-full px-4 text-xs font-extrabold text-slate-950" : "min-h-[36px] rounded-full border border-white/15 px-3 text-xs text-amber-50/75 hover:text-white"} style={a.principal ? { background: `linear-gradient(to bottom, #fff1c9, ${c.cor})` } : undefined}>{a.rotulo}</button>
          ))}
        </div>
      )}
    </div>
  );
}
