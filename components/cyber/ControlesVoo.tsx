"use client";
/**
 * Botões de MOVIMENTO da nave (desktop e celular): ⬆ Subir / ⬇ Descer (segurar), direcional de 4 setas no desktop
 * (no celular é o joystick), e "Pousar" (desce sozinho até encostar). São controles de voo — é com eles que a nave
 * vai a qualquer lugar do mapa. Segurar usa captura de ponteiro, então o botão não "gruda" se o dedo escorregar.
 */
import { useEffect, useRef, useState } from "react";
import type { CyberEngine } from "./engine";

const BTN = "flex touch-none select-none items-center justify-center rounded-full border border-sky-300/45 bg-sky-950/60 font-extrabold text-sky-50 backdrop-blur active:bg-sky-400/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

function Segurar(p: { rotulo: string; aria: string; on: (v: boolean) => void; className?: string; style?: React.CSSProperties }) {
  const ativo = useRef(false), on = useRef(p.on); on.current = p.on;
  const set = (v: boolean) => { if (ativo.current === v) return; ativo.current = v; on.current(v); };
  useEffect(() => () => { if (ativo.current) on.current(false); }, []);
  return (
    <button type="button" aria-label={p.aria} className={`${BTN} ${p.className ?? ""}`} style={p.style}
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ponteiro sintético/sem captura: segue sem */ } set(true); }}
      onPointerUp={() => set(false)} onPointerCancel={() => set(false)} onLostPointerCapture={() => set(false)}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); e.stopPropagation(); set(true); } }}
      onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); set(false); } }}
      onBlur={() => set(false)} onContextMenu={(e) => e.preventDefault()}>{p.rotulo}</button>
  );
}

/** MOTO: ⚡ BOOST (segurar; Shift no teclado) com o tanque — a barra lê o engine a cada quadro (sem re-render) */
function Boost({ engine, style }: { engine: React.MutableRefObject<CyberEngine | null>; style: React.CSSProperties }) {
  const barra = useRef<HTMLDivElement>(null), caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id = 0;
    const f = () => { const b = engine.current?.tanqueMoto; if (b && barra.current && caixa.current) { barra.current.style.width = `${Math.round(b.tanque * 100)}%`; caixa.current.dataset.aceso = b.aceso ? "1" : "0"; } id = requestAnimationFrame(f); };
    id = requestAnimationFrame(f);
    return () => { cancelAnimationFrame(id); engine.current?.boostMoto(false); };
  }, [engine]);
  return (
    <div ref={caixa} className="group absolute z-[25] flex flex-col items-center gap-1" style={style}>
      <Segurar aria="Boost (segurar; Shift no teclado)" rotulo="⚡ Boost" on={(v) => engine.current?.boostMoto(v)} className="h-[62px] w-[78px] text-[13px] group-data-[aceso=1]:bg-amber-300/45 group-data-[aceso=1]:border-amber-200" />
      <div className="h-[5px] w-[70px] overflow-hidden rounded-full bg-white/15"><div ref={barra} className="h-full rounded-full bg-gradient-to-r from-amber-300 to-fuchsia-400" style={{ width: "100%" }} /></div>
    </div>
  );
}

export default function ControlesVoo({ engine, touch, pousado, moto = false }: { engine: React.MutableRefObject<CyberEngine | null>; touch: boolean; pousado: boolean; moto?: boolean }) {
  const dir = useRef({ x: 0, z: 0 });
  // janela estreita: o direcional sobe pra cima dos botões verticais (não cobre o chat, que fica embaixo à esquerda)
  const [estreita, setEstreita] = useState(false);
  useEffect(() => { const mq = matchMedia("(max-width: 720px)"); const f = () => setEstreita(mq.matches); f(); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  const eixo = (k: "x" | "z", v: number) => (on: boolean) => {
    if (on) dir.current[k] = v; else if (dir.current[k] === v) dir.current[k] = 0;
    engine.current?.direcaoVoo(dir.current.x, dir.current.z);
  };
  // ao sair do voo, solta tudo
  useEffect(() => () => { engine.current?.comandoVoo({ subir: false, descer: false }); engine.current?.direcaoVoo(0, 0); }, [engine]);
  const base = { bottom: "max(30px, env(safe-area-inset-bottom))" } as const;
  return (
    <>
      {/* vertical: à direita, grandes */}
      <Segurar aria="Subir (segurar)" rotulo="⬆ Subir" on={(v) => engine.current?.comandoVoo({ subir: v })}
        className="absolute z-[25] h-[62px] w-[78px] text-[13px]" style={{ ...base, right: "max(22px, env(safe-area-inset-right))", bottom: "calc(max(30px, env(safe-area-inset-bottom)) + 72px)" }} />
      <Segurar aria="Descer (segurar)" rotulo="⬇ Descer" on={(v) => engine.current?.comandoVoo({ descer: v })}
        className="absolute z-[25] h-[62px] w-[78px] text-[13px]" style={{ ...base, right: "max(22px, env(safe-area-inset-right))" }} />
      {!pousado && (
        <button type="button" onClick={() => engine.current?.pousar()} className={`${BTN} absolute z-[25] h-[44px] px-4 text-[12px]`}
          style={{ right: "max(22px, env(safe-area-inset-right))", bottom: "calc(max(30px, env(safe-area-inset-bottom)) + 144px)" }}>Pousar</button>
      )}
      {/* ⚡ ao lado do Subir (celular / janela estreita, onde o direcional não fica ali) ou à esquerda do direcional */}
      {moto && <Boost engine={engine} style={touch || estreita ? { right: "calc(max(22px, env(safe-area-inset-right)) + 88px)", bottom: "calc(max(30px, env(safe-area-inset-bottom)) + 72px)" } : { ...base, right: "calc(max(22px, env(safe-area-inset-right)) + 254px)" }} />}
      {/* direção: no desktop um direcional de 4 setas (relativo à câmera, como WASD; na moto, ▲▼ acelera/freia e ◀▶
          esterça); no celular é o joystick */}
      {!touch && (
        <div role="group" aria-label={moto ? "Acelerador e guidão da moto" : "Direção da nave"} className="absolute z-[25] grid grid-cols-3 grid-rows-3 gap-1" style={estreita ? { right: "max(14px, env(safe-area-inset-right))", bottom: "calc(max(30px, env(safe-area-inset-bottom)) + 196px)" } : { ...base, right: "calc(max(22px, env(safe-area-inset-right)) + 92px)" }}>
          <span />
          <Segurar aria={moto ? "Acelerar" : "Frente"} rotulo="▲" on={eixo("z", -1)} className="h-[46px] w-[46px] text-[15px]" />
          <span />
          <Segurar aria="Esquerda" rotulo="◀" on={eixo("x", -1)} className="h-[46px] w-[46px] text-[15px]" />
          <span />
          <Segurar aria="Direita" rotulo="▶" on={eixo("x", 1)} className="h-[46px] w-[46px] text-[15px]" />
          <span />
          <Segurar aria={moto ? "Frear" : "Trás"} rotulo="▼" on={eixo("z", 1)} className="h-[46px] w-[46px] text-[15px]" />
          <span />
        </div>
      )}
    </>
  );
}
