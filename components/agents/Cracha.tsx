"use client";

/**
 * Cracha — o agente num CRACHÁ pendurado (fita + presilha + furo), com a FOTO = avatar vivo.
 * O mesmo crachá na landing (vitrine) e na sala de Assistentes (com `acao` = contratar).
 *
 * Vida:
 *   - hover → explosão de alegria (^ ^) e depois sorri enquanto o mouse está em cima;
 *   - `emCena` (o holofote do carrossel passou por ele) → pula, "dá um oi" (fala um instante) e
 *     sorri de alegria; enquanto segue em cena, solta uma expressão de vez em quando (sorriso,
 *     alegria, pensando);
 *   - fora de cena: pisca/respira só se tiver vaga no orçamento de vida (máx. 2 na tela).
 * prefers-reduced-motion: sem pulo/balanço/expressões automáticas (o hover ainda troca a cara).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import AgentAvatar from "@/components/agents/AgentAvatar";
import { useAmbienteAvatar } from "@/components/agents/avatar/hooks";
import type { SinalAvatar } from "@/lib/avatars/estados";

export type DadosCracha = {
  agentId: string;
  nome: string;
  curso: string;
  tagline?: string | null;
  artefatos?: string[];
  emoji?: string | null;
  foto?: string | null;
  /** número do crachá (ZA-001…) */
  id: string;
  rotulo?: string;
  educacional?: boolean;
};

/** Sequência do holofote: "oi" falado → alegria; depois expressões soltas. */
const EXPRESSOES: { sinal: SinalAvatar; ms: number }[] = [
  { sinal: "feliz", ms: 1500 },
  { sinal: "pensando", ms: 1300 },
  { sinal: "falando", ms: 1100 },
];

export default function Cracha({ d, emCena = false, acao, tamanhoFoto = 140 }: { d: DadosCracha; emCena?: boolean; acao?: ReactNode; tamanhoFoto?: number }) {
  const { reduzido } = useAmbienteAvatar();
  const [hover, setHover] = useState(false);
  const [reacao, setReacao] = useState<SinalAvatar | null>(null);
  const [pulo, setPulo] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const limpar = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const depois = (ms: number, f: () => void) => { timers.current.push(setTimeout(f, ms)); };

  // holofote: pula, dá um oi (fala) → o AgentAvatar sorri sozinho ao terminar (falando → idle)
  useEffect(() => {
    limpar();
    if (!emCena || reduzido) { setReacao(null); return; }
    setPulo((n) => n + 1);
    setReacao("falando");
    depois(1300, () => setReacao(null));
    // em cena por mais tempo: uma expressão solta a cada 2,5–4 s
    const solta = (t: number) => depois(t, () => {
      const e = EXPRESSOES[Math.floor(Math.random() * EXPRESSOES.length)];
      setReacao(e.sinal);
      depois(e.ms, () => { setReacao(null); solta(2500 + Math.random() * 1500); });
    });
    solta(3600);
    return limpar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emCena, reduzido]);

  // hover: alegria rápida e depois sorriso (o próprio hover do avatar)
  const entrar = () => {
    setHover(true);
    if (reacao === null) { setReacao("feliz"); depois(1200, () => setReacao((r) => (r === "feliz" ? null : r))); }
  };
  useEffect(() => limpar, []);

  const estado: SinalAvatar = reacao ?? "idle";
  const artefatos = (d.artefatos ?? []).slice(0, 3);
  const balanco = hover && !reduzido ? "rotate(-1.6deg) translateY(2px)" : undefined;

  return (
    <div className="shrink-0 w-[250px] sm:w-[262px] pt-7" onPointerEnter={entrar} onPointerLeave={() => setHover(false)}>
      <style>{`@keyframes zcPulo { 0%,100% { transform: translateY(0); } 30% { transform: translateY(-10px); } 55% { transform: translateY(0); } 72% { transform: translateY(-4px); } }
.zc-pulo { animation: zcPulo .7s cubic-bezier(.3,.7,.4,1) 1; }
@media (prefers-reduced-motion: reduce) { .zc-pulo { animation: none; } }`}</style>
      <div key={pulo} className={pulo > 0 ? "zc-pulo" : undefined}>
        {/* balanço de crachá pendurado: gira em torno da fita */}
        <div className="relative origin-top transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: balanco }}>
          <span aria-hidden className="absolute left-1/2 -translate-x-1/2 -top-7 h-8 w-5 rounded-t-sm bg-gradient-to-b from-cyan-400/0 via-cyan-500/70 to-cyan-500" />
          <span aria-hidden className="absolute left-1/2 -translate-x-1/2 -top-1.5 h-4 w-9 rounded-md bg-gradient-to-b from-slate-200 to-slate-400 shadow-[0_2px_6px_rgba(0,0,0,0.5)] border border-white/60" />
          <article className={`relative rounded-[22px] border bg-black/80 backdrop-blur-xl px-5 pt-6 pb-4 flex flex-col items-center text-center transition-[border-color,box-shadow] duration-500 ${emCena ? "border-cyan-400/60 shadow-[0_18px_50px_-18px_rgba(34,211,238,0.55)]" : "border-white/10 shadow-[0_16px_44px_-20px_rgba(0,0,0,0.75)] hover:border-cyan-500/50 hover:shadow-[0_18px_50px_-20px_rgba(34,211,238,0.45)]"}`}>
            <span aria-hidden className="absolute top-2.5 left-1/2 -translate-x-1/2 h-1.5 w-10 rounded-full bg-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]" />
            <div className="w-full flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.22em]">
              <span className="text-white/70">Zaeon</span>
              <span className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300">{d.rotulo ?? "mentor"}</span>
            </div>

            {/* FOTO = avatar vivo */}
            <div className="mt-4 rounded-[18px] p-[3px] bg-gradient-to-b from-cyan-400/50 to-cyan-500/10">
              <AgentAvatar
                src={d.foto}
                nome={d.nome}
                size={tamanhoFoto}
                agentId={d.agentId}
                hover={hover}
                estado={estado}
                destaque={emCena}
                className="!rounded-[15px] !border-0"
                fallback={
                  <span aria-hidden className="grid place-items-center rounded-[15px] bg-gradient-to-br from-cyan-500/25 to-blue-600/20 text-5xl font-semibold text-cyan-200" style={{ width: tamanhoFoto, height: tamanhoFoto }}>
                    {d.emoji && d.emoji !== "⟁" ? d.emoji : d.nome.slice(0, 1)}
                  </span>
                }
              />
            </div>

            <h3 className="mt-4 text-[22px] font-semibold tracking-tight leading-none text-white">{d.nome}</h3>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/90">{d.curso}</p>
            {d.tagline ? <p className="mt-3 text-[12.5px] leading-snug text-white/80 line-clamp-2 min-h-[2.5em]">{d.tagline}</p> : null}

            {artefatos.length > 0 ? (
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                {artefatos.map((a) => (
                  <span key={a} className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10.5px] text-white/85">{a}</span>
                ))}
              </div>
            ) : null}

            {acao ? <div className="mt-4 w-full">{acao}</div> : null}

            <div className="mt-4 pt-3 w-full border-t border-dashed border-white/15 flex items-end justify-between gap-3">
              <span className="flex flex-col items-start">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-white/45">id</span>
                <span className="font-mono text-[11px] text-white/85">{d.id}</span>
              </span>
              <span aria-hidden className="h-6 flex-1 max-w-[96px] opacity-70" style={{ background: "repeating-linear-gradient(90deg,rgba(255,255,255,.85) 0 2px,transparent 2px 4px,rgba(255,255,255,.85) 4px 5px,transparent 5px 8px,rgba(255,255,255,.85) 8px 11px,transparent 11px 12px)" }} />
              {d.educacional ? <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/60 border border-white/15 rounded px-1 py-0.5">edu</span> : null}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

/**
 * Holofote do carrossel: a cada `ms`, escolhe o próximo crachá VISÍVEL no trilho (por posição na
 * tela) pra ficar `emCena`. Devolve o índice em cena (ou -1). Reduced-motion → ninguém em cena.
 */
export function useHolofote(trilho: React.RefObject<HTMLElement | null>, total: number, ms = 4800): number {
  const [cena, setCena] = useState(-1);
  const { reduzido } = useAmbienteAvatar();
  useEffect(() => {
    if (reduzido || total === 0) { setCena(-1); return; }
    const escolher = () => {
      const el = trilho.current;
      if (!el) return;
      const caixa = el.getBoundingClientRect();
      if (caixa.bottom < 0 || caixa.top > window.innerHeight) return; // fora da tela: ninguém
      const visiveis: number[] = [];
      [...el.children].forEach((c, i) => {
        const r = c.getBoundingClientRect();
        if (r.left >= caixa.left - 10 && r.right <= caixa.right + 10) visiveis.push(i);
      });
      if (!visiveis.length) return;
      setCena((atual) => {
        const pos = visiveis.indexOf(atual);
        return visiveis[(pos + 1) % visiveis.length];
      });
    };
    const t0 = setTimeout(escolher, 1200);
    const t = setInterval(escolher, ms);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [trilho, total, ms, reduzido]);
  return cena;
}
