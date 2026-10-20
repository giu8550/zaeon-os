"use client";
/**
 * CaixaDialogo — a fala do tutorial como num RPG (lib/cyber/dialogo): no pé da tela, o RETRATO de quem fala (o Droid,
 * um ofanim de luz; a Zaeon, o rosto dela), a plaquinha com o NOME, o texto GRANDE em máquina de escrever e, na
 * INSTRUÇÃO, o objetivo e as TECLAS em destaque. Fica na tela até o engine trocar a fala ou a ação ser feita (null).
 * Clicar completa o texto de uma vez.
 */
import { useEffect, useRef, useState } from "react";
import { ESCRITA_CPS, escritaAcabou, textoEscrito, type Dialogo } from "@/lib/cyber/dialogo";
import RetratoDroid from "./RetratoDroid";

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
      style={{ bottom: d.alerta ? "32%" : touch ? 150 : 26 }}
    >
      {/* a plaquinha do NOME, presa na borda de cima */}
      <div className="relative z-[1] ml-[104px] inline-flex -mb-[13px] items-center gap-2 rounded-t-md border border-b-0 px-4 py-1 text-[12px] font-black uppercase tracking-[0.22em]"
        style={{ borderColor: `${cor}aa`, background: "linear-gradient(180deg,#1a1230,#0b0818)", color: cor, textShadow: `0 0 10px ${cor}88` }}>
        <span aria-hidden>{d.alerta ? "⚠" : "◆"}</span>{d.alerta ? `Aviso · ${d.nome}` : d.nome}
      </div>
      <div className={`relative flex gap-4 rounded-[14px] px-4 pb-4 pt-5 ${d.alerta ? "border-[3px] motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]" : "border-2"}`}
        style={{ borderColor: `${cor}cc`, background: d.alerta ? "linear-gradient(180deg,rgba(40,14,4,.96),rgba(14,5,2,.97))" : "linear-gradient(180deg,rgba(13,10,30,.94),rgba(5,4,14,.96))", boxShadow: `0 0 0 1px rgba(0,0,0,.6) inset, 0 0 0 4px rgba(255,255,255,.03) inset, 0 18px 50px -12px rgba(0,0,0,.8), 0 0 ${d.alerta ? 60 : 34}px -10px ${cor}` }}>
        {/* os cantos (ornamentos) */}
        {["left-1.5 top-1.5", "right-1.5 top-1.5", "left-1.5 bottom-1.5", "right-1.5 bottom-1.5"].map((k) => (
          <span key={k} aria-hidden className={`pointer-events-none absolute ${k} text-[9px] leading-none`} style={{ color: cor }}>◆</span>
        ))}
        {/* o RETRATO */}
        <div className="relative -mt-9 h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border-2" style={{ borderColor: cor, boxShadow: `0 0 22px -4px ${cor}` }}>
          {d.quem === "zaeon"
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/avatars/zaeon/idle.sm.webp" alt="" className="h-full w-full object-cover" />
            : d.quem === "examiner" ? <RetratoExaminer /> : <RetratoDroid cor={cor} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`min-h-[3.2em] font-semibold leading-[1.5] text-[#fff8ea] ${d.alerta ? "text-[20px] sm:text-[22px]" : "text-[18px] sm:text-[19.5px]"}`} style={{ textShadow: "0 1px 0 rgba(0,0,0,.8)" }}>
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

/** o retrato da EXAMINER (a guardiã do Templo Cósmico): o rosto na sombra, as asas negras e os OLHOS acesos em vermelho */
function RetratoExaminer() {
  return (
    <svg viewBox="0 0 88 88" className="h-full w-full" aria-hidden>
      <defs><radialGradient id="ex-fundo" cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#2a0810" /><stop offset="1" stopColor="#050206" /></radialGradient>
        <filter id="ex-brilho"><feGaussianBlur stdDeviation="2.2" /></filter></defs>
      <rect width="88" height="88" fill="url(#ex-fundo)" />
      <path d="M2 70 L22 34 L30 58 Z M86 70 L66 34 L58 58 Z" fill="#0a0a10" stroke="#3a1420" strokeWidth="1" />
      <ellipse cx="44" cy="46" rx="17" ry="21" fill="#140a10" />
      <path d="M27 40 Q44 14 61 40 L61 30 Q44 6 27 30 Z" fill="#06040a" />
      <g filter="url(#ex-brilho)"><ellipse cx="37" cy="46" rx="4.4" ry="2.4" fill="#ff1a2a" /><ellipse cx="51" cy="46" rx="4.4" ry="2.4" fill="#ff1a2a" /></g>
      <ellipse cx="37" cy="46" rx="2.4" ry="1.2" fill="#ffd0d4" /><ellipse cx="51" cy="46" rx="2.4" ry="1.2" fill="#ffd0d4" />
    </svg>
  );
}
