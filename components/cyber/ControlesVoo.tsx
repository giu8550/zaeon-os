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

export default function ControlesVoo({ engine, touch, pousado }: { engine: React.MutableRefObject<CyberEngine | null>; touch: boolean; pousado: boolean }) {
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
      {/* direção: no desktop um direcional de 4 setas (relativo à câmera, como WASD); no celular é o joystick */}
      {!touch && (
        <div role="group" aria-label="Direção da nave" className="absolute z-[25] grid grid-cols-3 grid-rows-3 gap-1" style={estreita ? { right: "max(14px, env(safe-area-inset-right))", bottom: "calc(max(30px, env(safe-area-inset-bottom)) + 196px)" } : { ...base, right: "calc(max(22px, env(safe-area-inset-right)) + 92px)" }}>
          <span />
          <Segurar aria="Frente" rotulo="▲" on={eixo("z", -1)} className="h-[46px] w-[46px] text-[15px]" />
          <span />
          <Segurar aria="Esquerda" rotulo="◀" on={eixo("x", -1)} className="h-[46px] w-[46px] text-[15px]" />
          <span />
          <Segurar aria="Direita" rotulo="▶" on={eixo("x", 1)} className="h-[46px] w-[46px] text-[15px]" />
          <span />
          <Segurar aria="Trás" rotulo="▼" on={eixo("z", 1)} className="h-[46px] w-[46px] text-[15px]" />
          <span />
        </div>
      )}
    </>
  );
}
