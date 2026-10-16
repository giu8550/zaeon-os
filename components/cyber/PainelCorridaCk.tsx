"use client";
/**
 * PainelCorridaCk — a CORRIDA DE CHECKPOINTS na tela (o engine faz a corrida: `entrarNaCorridaCk`, `corridaCkHud`,
 * `boxCk`). SEM estatística (pedido do dono): nada de tempo de volta, recorde ou ranking —
 *  - no BOX DE LARGADA (de moto): Correr solo (contra 3 bots) · Correr em dupla (com quem está no box) · os convites;
 *  - correndo: a contagem, quanto falta, quantos checkpoints eu peguei e a SETA pro próximo anel;
 *  - no fim: quem ganhou (mais checkpoints) — Correr de novo / Fechar.
 */
import { useEffect, useState } from "react";
import type { CyberEngine } from "./engine";
import { CONTAGEM_CK, DURACAO_CK } from "@/lib/cyber/corrida/checkpoints";

const CAIXA = "rounded-2xl border border-emerald-300/25 bg-[#04120c]/80 text-emerald-50 shadow-2xl backdrop-blur";
const relogio = (s: number) => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

type Hud = NonNullable<CyberEngine["corridaCkHud"]>;
type Box = NonNullable<CyberEngine["boxCk"]>;

export default function PainelCorridaCk({ engine }: { engine: React.MutableRefObject<CyberEngine | null> }) {
  const [hud, setHud] = useState<Hud | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    const id = setInterval(() => { const e = engine.current; setHud(e?.corridaCkHud ?? null); setBox(e?.boxCk ?? null); }, 100);
    return () => clearInterval(id);
  }, [engine]);
  const e = () => engine.current;

  // ── o resultado ──
  if (hud?.resultado) {
    const v = hud.resultado.vencedores, euGanhei = v.some((x) => x.eu);
    return (
      <div className={`absolute left-1/2 top-1/2 z-[40] w-[min(380px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 p-5 text-center ${CAIXA}`}>
        <div className="text-[44px] leading-none">{euGanhei ? "🏆" : "🏁"}</div>
        <div className="mt-2 text-[24px] font-extrabold">{euGanhei ? (v.length > 1 ? "Empate — você venceu junto!" : "Você venceu!") : `${v.map((x) => x.nome).join(" e ")} venceu`}</div>
        <ol className="mt-3 space-y-1 text-left text-[14px]">
          {hud.resultado.lista.map((x) => (
            <li key={x.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${x.eu ? "bg-emerald-400/15" : ""}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.cor }} /><span className="flex-1 truncate">{x.nome}</span><b>{x.ck}</b><span className="text-emerald-100/60">checkpoints</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex gap-2">
          {hud.modo === "solo" && <button type="button" onClick={() => e()?.entrarNaCorridaCk("solo")} className="flex-1 rounded-full bg-emerald-400 px-4 py-2 text-[14px] font-extrabold text-[#03140c]">Correr de novo</button>}
          <button type="button" onClick={() => e()?.sairCorridaCk()} className="flex-1 rounded-full border border-white/20 px-4 py-2 text-[14px] font-bold">Fechar</button>
        </div>
      </div>
    );
  }

  // ── correndo ──
  if (hud) {
    const setaVisivel = hud.fase === "correndo" && Math.abs(hud.seta) > 0.45, aguardando = hud.fase === "contagem" && hud.contagem > CONTAGEM_CK;
    return (
      <>
        <div className={`pointer-events-none absolute left-1/2 top-3 z-[30] -translate-x-1/2 px-4 py-2 text-center ${CAIXA}`}>
          <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-200/70">Corrida de checkpoints · {hud.modo === "solo" ? "solo" : "em dupla"}</div>
          <div className="text-[22px] font-extrabold leading-tight">{hud.meus} <span className="text-[13px] font-semibold text-emerald-100/70">checkpoints</span></div>
          <div className="text-[12px] text-emerald-100/75">{hud.fase === "contagem" ? "no grid" : `falta ${relogio(hud.resta)}`}</div>
        </div>
        {aguardando && <div className="pointer-events-none absolute left-1/2 top-[34%] z-[30] -translate-x-1/2 text-center text-[20px] font-bold text-emerald-50 drop-shadow">Esperando a dupla… largada em {hud.contagem}s</div>}
        {hud.fase === "contagem" && !aguardando && <div className="pointer-events-none absolute left-1/2 top-[34%] z-[30] -translate-x-1/2 font-mono text-[110px] font-black text-white drop-shadow-[0_0_30px_rgba(125,255,176,0.8)]">{hud.contagem}</div>}
        {hud.fase === "correndo" && hud.resta > DURACAO_CK - 1 && <div className="pointer-events-none absolute left-1/2 top-[34%] z-[30] -translate-x-1/2 text-[80px] font-black text-emerald-300 drop-shadow-[0_0_30px_rgba(110,255,180,0.8)]">VAI!</div>}
        {setaVisivel && (
          <div className="pointer-events-none absolute left-1/2 top-[28%] z-[30] -translate-x-1/2 text-center">
            <div className="text-[44px] leading-none text-emerald-300 drop-shadow-[0_0_12px_rgba(125,255,176,0.9)]" style={{ transform: `rotate(${hud.seta}rad)` }}>⬆</div>
            <div className="text-[12px] font-bold text-emerald-100">próximo checkpoint · {Math.round(hud.dist)} m</div>
          </div>
        )}
        <button type="button" onClick={() => e()?.sairCorridaCk()} className="absolute z-[31] rounded-full border border-white/20 bg-[#04120c]/70 px-3 py-1.5 text-[12px] font-bold text-emerald-50" style={{ right: "max(16px, env(safe-area-inset-right))", top: 68 }}>Sair da corrida</button>
      </>
    );
  }

  // ── no box de largada ──
  if (!box) return null;
  return (
    <div className={`absolute bottom-[96px] left-1/2 z-[31] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 p-4 ${CAIXA}`}>
      <div className="text-[12px] uppercase tracking-[0.18em] text-emerald-200/70">🏁 Box de largada</div>
      <div className="mt-1 text-[13px] text-emerald-50/85">Pegue o próximo checkpoint — por dentro do anel, na ordem. Em {Math.round(DURACAO_CK / 60)} minutos, quem pegar mais ganha.</div>
      {box.convites.map((c) => (
        <button key={c.id} type="button" onClick={() => e()?.entrarNaCorridaCk("dupla", { semente: c.semente, inicio: c.inicio })} className="mt-3 w-full rounded-full bg-amber-300 px-4 py-2 text-[14px] font-extrabold text-[#1a1205]">Entrar na dupla de {c.nome}</button>
      ))}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => e()?.entrarNaCorridaCk("solo")} className="flex-1 rounded-full bg-emerald-400 px-4 py-2 text-[14px] font-extrabold text-[#03140c]">Correr solo</button>
        <button type="button" disabled={!box.parceiros.length} onClick={() => e()?.entrarNaCorridaCk("dupla")} title={box.parceiros.length ? "" : "Chame alguém pro box de largada"}
          className="flex-1 rounded-full border border-emerald-300/50 px-4 py-2 text-[14px] font-extrabold text-emerald-50 disabled:opacity-40">{box.parceiros.length ? `Em dupla com ${box.parceiros[0]!.nome}` : "Em dupla"}</button>
      </div>
      <div className="mt-2 text-[11px] text-emerald-100/60">Solo: você contra 3 bots. Em dupla: você e quem está no box contra 2 bots.</div>
    </div>
  );
}
