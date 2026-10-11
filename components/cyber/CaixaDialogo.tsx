"use client";
/**
 * CaixaDialogo — a fala do tutorial como num RPG (lib/cyber/dialogo): no pé da tela, o RETRATO de quem fala (o Droid,
 * um ofanim de luz; a Zaeon, o rosto dela), a plaquinha com o NOME, o texto GRANDE em máquina de escrever e, na
 * INSTRUÇÃO, o objetivo e as TECLAS em destaque. Fica na tela até o engine trocar a fala ou a ação ser feita (null).
 * Clicar completa o texto de uma vez.
 */
import { useEffect, useRef, useState } from "react";
import { ESCRITA_CPS, escritaAcabou, textoEscrito, type Dialogo } from "@/lib/cyber/dialogo";

function RetratoDroid({ cor }: { cor: string }) {
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="droid-luz" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6dc" />
          <stop offset="45%" stopColor={cor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill="#0b0716" />
      <g className="motion-safe:animate-[spin_9s_linear_infinite]" style={{ transformOrigin: "40px 40px" }}>
        <ellipse cx="40" cy="40" rx="30" ry="11" fill="none" stroke={cor} strokeWidth="2.4" opacity="0.9" />
        <ellipse cx="40" cy="40" rx="11" ry="30" fill="none" stroke={cor} strokeWidth="2.4" opacity="0.75" />
      </g>
      <circle cx="40" cy="40" r="22" fill="none" stroke={cor} strokeWidth="1.2" strokeDasharray="3 4" opacity="0.6" />
      <circle cx="40" cy="40" r="13" fill="url(#droid-luz)" />
      {[[40, 12], [68, 40], [40, 68], [12, 40]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill="#fff6dc" />)}
    </svg>
  );
}

export default function CaixaDialogo({ d, touch, onAvancar }: { d: Dialogo; touch: boolean; onAvancar?: () => void }) {
  const [t, setT] = useState(0);
  const inicio = useRef(0);
  const completo = useRef(false);
  // nova fala: a máquina de escrever recomeça
  useEffect(() => {
    inicio.current = performance.now(); completo.current = false; setT(0);
    let raf = 0;
    const passo = () => {
      const s = completo.current ? 1e6 : (performance.now() - inicio.current) / 1000;
      setT(s);
      if (!escritaAcabou(d.texto, s)) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [d.texto, d.quem]);
  const pronto = escritaAcabou(d.texto, t);
  const texto = textoEscrito(d.texto, t, ESCRITA_CPS);
  const cor = d.cor;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={`${d.nome}: ${d.texto}`}
      onClick={() => { if (!pronto) { completo.current = true; setT(1e6); } else onAvancar?.(); }}
      className="pointer-events-auto absolute left-1/2 z-[28] w-[min(94vw,800px)] -translate-x-1/2 cursor-default select-none"
      style={{ bottom: touch ? 150 : 26 }}
    >
      {/* a plaquinha do NOME, presa na borda de cima */}
      <div className="relative z-[1] ml-[104px] inline-flex -mb-[13px] items-center gap-2 rounded-t-md border border-b-0 px-4 py-1 text-[12px] font-black uppercase tracking-[0.22em]"
        style={{ borderColor: `${cor}aa`, background: "linear-gradient(180deg,#1a1230,#0b0818)", color: cor, textShadow: `0 0 10px ${cor}88` }}>
        <span aria-hidden>◆</span>{d.nome}
      </div>
      <div className="relative flex gap-4 rounded-[14px] border-2 px-4 pb-4 pt-5"
        style={{ borderColor: `${cor}cc`, background: "linear-gradient(180deg,rgba(13,10,30,.94),rgba(5,4,14,.96))", boxShadow: `0 0 0 1px rgba(0,0,0,.6) inset, 0 0 0 4px rgba(255,255,255,.03) inset, 0 18px 50px -12px rgba(0,0,0,.8), 0 0 34px -10px ${cor}` }}>
        {/* os cantos (ornamentos) */}
        {["left-1.5 top-1.5", "right-1.5 top-1.5", "left-1.5 bottom-1.5", "right-1.5 bottom-1.5"].map((k) => (
          <span key={k} aria-hidden className={`pointer-events-none absolute ${k} text-[9px] leading-none`} style={{ color: cor }}>◆</span>
        ))}
        {/* o RETRATO */}
        <div className="relative -mt-9 h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border-2" style={{ borderColor: cor, boxShadow: `0 0 22px -4px ${cor}` }}>
          {d.quem === "zaeon"
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/avatars/zaeon/idle.sm.webp" alt="" className="h-full w-full object-cover" />
            : <RetratoDroid cor={cor} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="min-h-[3.2em] text-[18px] font-semibold leading-[1.5] text-[#fff8ea] sm:text-[19.5px]" style={{ textShadow: "0 1px 0 rgba(0,0,0,.8)" }}>
            {texto}
            {!pronto && <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse" style={{ background: cor }} />}
          </p>
          {d.instrucao && pronto && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {d.objetivo && (
                <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.18em]" style={{ borderColor: `${cor}77`, color: cor }}>
                  Objetivo · {d.objetivo}
                </span>
              )}
              {d.teclas?.map((k) => (
                <kbd key={k} className="min-w-[34px] rounded-md border-2 border-b-4 px-2 py-0.5 text-center font-mono text-[14px] font-bold text-white motion-safe:animate-pulse"
                  style={{ borderColor: cor, background: "#160f28", boxShadow: `0 0 14px -2px ${cor}` }}>{k}</kbd>
              ))}
            </div>
          )}
        </div>
        {pronto && !d.instrucao && <span aria-hidden className="absolute bottom-2 right-4 text-[13px] motion-safe:animate-bounce" style={{ color: cor }}>▼</span>}
      </div>
    </div>
  );
}
