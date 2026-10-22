"use client";
/**
 * PranchaBlueprint — o canvas de UM blueprint (lib/blueprint/layout): o mesmo papel azul com grade, pan/zoom e cards do
 * BoardEstudos, mas a posição é CALCULADA (simétrica, esquerda→direita) — arrastar um card pelo carimbo o fixa onde foi
 * solto (`onFixar`), e "reorganizar" no card do estudo solta tudo. As alturas são medidas do DOM e realimentam o layout.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { layoutBlueprint, type Caixa, type Fio } from "@/lib/blueprint/layout";
import type { DocBlueprint } from "@/lib/blueprint/tipos";
import { COR, Modulo, type AcoesModulo } from "./Modulos";

const AZUL = "#0b2c4d", LINHA_FRACA = "rgba(150,205,255,.14)", ALTURA_PADRAO = 150;
const COR_FIO: Record<Fio["tipo"], string> = { percurso: COR.passo, pratica: "rgba(170,220,255,.75)", critico: COR.critico, figura: COR.figura, avaliacao: COR.avaliacao };

export default function PranchaBlueprint({ id, doc, acoes, onFixar, sobre }: {
  id: string; doc: DocBlueprint; acoes: AcoesModulo; onFixar: (modulo: string, x: number, y: number) => void; sobre?: ReactNode;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState({ x: 0, y: 0, z: 0.8 });
  const mexeu = useRef(false);   // a pessoa mexeu na câmera (pan/zoom): para de reenquadrar sozinho
  const [alturas, setAlturas] = useState<Record<string, number>>({});
  const medir = useCallback((k: string, el: HTMLDivElement | null) => { if (!el) return; const h = el.offsetHeight; setAlturas((a) => (Math.abs((a[k] ?? 0) - h) > 1 ? { ...a, [k]: h } : a)); }, []);
  const { caixas, fios } = useMemo(() => layoutBlueprint(doc, (k) => alturas[k] ?? ALTURA_PADRAO), [doc, alturas]);

  // ── arrastar (fundo = pan; carimbo = mover e fixar o card) ──
  const arrasto = useRef<{ tipo: "pan" | "card"; id?: string; x0: number; y0: number; ox: number; oy: number } | null>(null);
  const [arrastando, setArrastando] = useState<{ id: string; x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { if (e.button !== 0) return; mexeu.current = true; arrasto.current = { tipo: "pan", x0: e.clientX, y0: e.clientY, ox: cam.x, oy: cam.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
  const comecarCard = (e: React.PointerEvent, c: Caixa) => {
    if (!acoes.podeEditar || e.button !== 0) return; e.stopPropagation();
    arrasto.current = { tipo: "card", id: c.id, x0: e.clientX, y0: e.clientY, ox: c.x, oy: c.y }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const a = arrasto.current; if (!a) return;
    const dx = e.clientX - a.x0, dy = e.clientY - a.y0;
    if (a.tipo === "pan") setCam((c) => ({ ...c, x: a.ox + dx, y: a.oy + dy }));
    else if (a.id) setArrastando({ id: a.id, x: a.ox + dx / cam.z, y: a.oy + dy / cam.z });
  };
  const onPointerUp = () => {
    const a = arrasto.current; arrasto.current = null;
    if (a?.tipo === "card" && arrastando && (Math.abs(arrastando.x - a.ox) > 2 || Math.abs(arrastando.y - a.oy) > 2)) onFixar(arrastando.id, arrastando.x, arrastando.y);
    setArrastando(null);
  };
  const onWheel = (e: React.WheelEvent) => {
    mexeu.current = true;
    const r = raiz.current!.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    setCam((c) => { const z = Math.max(0.25, Math.min(2, c.z * (e.deltaY > 0 ? 0.9 : 1.1))); return { z, x: mx - ((mx - c.x) / c.z) * z, y: my - ((my - c.y) / c.z) * z }; });
  };
  const pos = (c: Caixa) => (arrastando?.id === c.id ? { ...c, x: arrastando.x, y: arrastando.y } : c);

  // ── ENCAIXE: ao abrir um blueprint (e quando as alturas assentam), a prancha inteira cabe na tela ──
  const encaixar = useCallback(() => {
    if (!raiz.current || !caixas.length) return;
    const r = raiz.current.getBoundingClientRect();
    const x0 = Math.min(...caixas.map((c) => c.x)), x1 = Math.max(...caixas.map((c) => c.x + c.w)), y0 = Math.min(...caixas.map((c) => c.y)), y1 = Math.max(...caixas.map((c) => c.y + c.h));
    const z = Math.max(0.3, Math.min(1, (r.width - 80) / Math.max(1, x1 - x0), (r.height - 90) / Math.max(1, y1 - y0)));
    setCam({ z, x: r.width / 2 - ((x0 + x1) / 2) * z, y: 30 + (r.height - 60 - (y1 - y0) * z) / 2 - y0 * z });
  }, [caixas]);
  // segue reenquadrando enquanto o layout assenta (alturas medidas, a Zaeon recompondo) — até a pessoa mexer na câmera
  const mediu = Object.keys(alturas).length;
  useEffect(() => { mexeu.current = false; }, [id]);
  useEffect(() => {
    if (mexeu.current || !mediu) return;
    const t = setTimeout(encaixar, 80);
    return () => clearTimeout(t);
  }, [mediu, encaixar]);

  const porId = new Map(caixas.map((c) => [c.id, pos(c)] as const));
  const linha = (f: Fio) => {
    const a = porId.get(f.de), b = porId.get(f.para); if (!a || !b) return null;
    let x1: number, y1: number, x2: number, y2: number, vertical = false;
    if (f.tipo === "percurso") { x1 = a.x; y1 = a.y + a.h / 2; x2 = b.x + b.w; y2 = b.y + b.h / 2; }
    else if (f.tipo === "pratica") { x1 = a.x + a.w; y1 = a.y + a.h / 2; x2 = b.x; y2 = b.y + b.h / 2; }
    else if (f.de.startsWith("critico:")) { x1 = a.x; y1 = a.y + 30; x2 = b.x + b.w; y2 = b.y + b.h / 2; }
    else { x1 = a.x + a.w / 2; y1 = a.y + a.h; x2 = b.x + b.w / 2; y2 = b.y; vertical = true; }
    const d = vertical ? `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}` : `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
    const cor = COR_FIO[f.tipo], tracejado = f.tipo === "critico" && f.de.startsWith("critico:");
    return (
      <g key={`${f.de}>${f.para}`}>
        <path d={d} fill="none" stroke="rgba(0,10,25,.35)" strokeWidth={3} transform="translate(0 5)" />
        <path d={d} fill="none" stroke={cor} strokeWidth={1.6} strokeDasharray={tracejado ? "6 5" : undefined} opacity={0.85} />
        <circle cx={x2} cy={y2} r={3.5} fill={AZUL} stroke={cor} strokeWidth={1.5} />
        <circle cx={x1} cy={y1} r={2.5} fill={cor} />
      </g>
    );
  };

  return (
    <div ref={raiz} className="relative h-full w-full touch-none select-none overflow-hidden" style={{ background: AZUL }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
      <div className="pointer-events-none absolute inset-0" style={{
        backgroundImage: `linear-gradient(${LINHA_FRACA} 1px, transparent 1px), linear-gradient(90deg, ${LINHA_FRACA} 1px, transparent 1px), linear-gradient(rgba(150,205,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(150,205,255,.06) 1px, transparent 1px)`,
        backgroundSize: `${100 * cam.z}px ${100 * cam.z}px, ${100 * cam.z}px ${100 * cam.z}px, ${20 * cam.z}px ${20 * cam.z}px, ${20 * cam.z}px ${20 * cam.z}px`,
        backgroundPosition: `${cam.x}px ${cam.y}px`,
      }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(3,14,30,.5) 100%)" }} />

      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})` }}>
        <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1 }}>{fios.map(linha)}</svg>
        {caixas.map((c0) => {
          const c = pos(c0);
          return (
            <div key={c.id} ref={(el) => medir(c.id, el)} className="absolute" style={{ left: c.x, top: c.y, width: c.w, zIndex: arrastando?.id === c.id ? 50 : 1 }} onPointerDown={(e) => e.stopPropagation()}>
              <Modulo id={c.id} doc={doc} acoes={acoes} onArrastar={acoes.podeEditar ? (e) => comecarCard(e, c0) : undefined} />
            </div>
          );
        })}
      </div>

      {sobre}
      <div className="absolute bottom-3 right-3 z-[90] flex items-center gap-1 font-mono text-[11px] text-sky-100" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="rounded-sm border border-sky-300/40 px-2 py-1 hover:bg-white/10" onClick={() => { mexeu.current = true; setCam((c) => ({ ...c, z: Math.max(0.25, c.z * 0.85) })); }}>−</button>
        <span className="w-12 text-center">{Math.round(cam.z * 100)}%</span>
        <button type="button" className="rounded-sm border border-sky-300/40 px-2 py-1 hover:bg-white/10" onClick={() => { mexeu.current = true; setCam((c) => ({ ...c, z: Math.min(2, c.z * 1.15) })); }}>+</button>
        <button type="button" className="ml-1 rounded-sm border border-sky-300/40 px-2 py-1 hover:bg-white/10" title="Enquadrar a prancha inteira" onClick={encaixar}>⤢</button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[90] font-mono text-[10.5px] tracking-[0.16em] text-sky-200/55">
        <span style={{ color: COR.passo }}>━ PERCURSO</span> &nbsp; <span>━ PRÁTICA</span> &nbsp; <span style={{ color: COR.critico }}>━ CRÍTICO (TRAVA A FASE)</span> &nbsp; ⟶ DA ESQUERDA PRA DIREITA
      </div>
    </div>
  );
}
