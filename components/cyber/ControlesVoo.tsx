"use client";
/**
 * Botões de MOVIMENTO da nave/moto — só no CELULAR (toque): ⬆ Subir / ⬇ Descer (segurar), ⚡ Boost (moto) e "Pousar"
 * (desce sozinho até encostar); a direção é o joystick. No DESKTOP o teclado faz tudo: no lugar dos botões fica só uma
 * DICA das teclas (e o tanque do boost, na moto). São controles de voo — é com eles que a nave
 * vai a qualquer lugar do mapa. Segurar usa captura de ponteiro, então o botão não "gruda" se o dedo escorregar.
 */
import { useEffect, useRef } from "react";
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

/** DESKTOP: a dica das teclas (sem botões) + o tanque do boost na moto */
function DicaTeclado({ engine, moto }: { engine: React.MutableRefObject<CyberEngine | null>; moto: boolean }) {
  const barra = useRef<HTMLDivElement>(null), caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moto) return;
    let id = 0;
    const f = () => { const b = engine.current?.tanqueMoto; if (b && barra.current && caixa.current) { barra.current.style.width = `${Math.round(b.tanque * 100)}%`; caixa.current.dataset.aceso = b.aceso ? "1" : "0"; } id = requestAnimationFrame(f); };
    id = requestAnimationFrame(f);
    return () => cancelAnimationFrame(id);
  }, [engine, moto]);
  const tecla = "rounded border border-white/25 bg-white/10 px-1.5 py-px font-mono text-[10px] text-white";
  const itens: [string, string][] = moto
    ? [["W S", "acelera · freia"], ["A D", "vira"], ["Shift", "boost"], ["Espaço Q", "sobe · desce"], ["P", "pousa"], ["F", "desce da moto"]]
    : [["W A S D", "voa"], ["Shift", "turbo"], ["Espaço Q", "sobe · desce"], ["P", "pousa"], ["K", "ritual da nave"], ["F", "sai"]];
  return (
    <div ref={caixa} aria-label="Teclas do veículo" className="group pointer-events-none absolute z-[25] flex flex-col items-end gap-1.5 rounded-xl border border-sky-300/20 bg-[#070b1c]/60 px-3 py-2 text-[11px] text-sky-50/85 backdrop-blur" style={{ right: "max(16px, env(safe-area-inset-right))", bottom: "max(16px, env(safe-area-inset-bottom))" }}>
      {itens.map(([k, o]) => <div key={k} className="flex items-center gap-2"><span>{o}</span><span className="flex gap-1">{k.split(" ").map((x) => <kbd key={x} className={tecla}>{x}</kbd>)}</span></div>)}
      {moto && <div className="mt-0.5 flex items-center gap-2"><span className="group-data-[aceso=1]:text-amber-200">⚡</span><div className="h-[5px] w-[80px] overflow-hidden rounded-full bg-white/15"><div ref={barra} className="h-full rounded-full bg-gradient-to-r from-amber-300 to-fuchsia-400" style={{ width: "100%" }} /></div></div>}
    </div>
  );
}

export default function ControlesVoo({ engine, touch, pousado, moto = false }: { engine: React.MutableRefObject<CyberEngine | null>; touch: boolean; pousado: boolean; moto?: boolean }) {
  // ao sair do voo, solta tudo (vale pro desktop também: o botão do boost/joystick pode ter ficado "apertado")
  useEffect(() => () => { engine.current?.comandoVoo({ subir: false, descer: false }); engine.current?.direcaoVoo(0, 0); engine.current?.boostMoto(false); }, [engine]);
  if (!touch) return <DicaTeclado engine={engine} moto={moto} />;
  return <BotoesToque engine={engine} pousado={pousado} moto={moto} />;
}

/** CELULAR: os botões (subir/descer, boost, pousar) — a direção é o joystick */
function BotoesToque({ engine, pousado, moto }: { engine: React.MutableRefObject<CyberEngine | null>; pousado: boolean; moto: boolean }) {
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
      {/* ⚡ ao lado do Subir (a moto: o boost com o tanque; a nave: o TURBO) */}
      {!moto && <Segurar aria="Turbo (segurar; Shift no teclado)" rotulo="⚡ Turbo" on={(v) => engine.current?.boostMoto(v)} className="absolute z-[25] h-[62px] w-[78px] text-[13px]" style={{ right: "calc(max(22px, env(safe-area-inset-right)) + 88px)", bottom: "calc(max(30px, env(safe-area-inset-bottom)) + 72px)" }} />}
      {moto && <Boost engine={engine} style={{ right: "calc(max(22px, env(safe-area-inset-right)) + 88px)", bottom: "calc(max(30px, env(safe-area-inset-bottom)) + 72px)" }} />}
    </>
  );
}
