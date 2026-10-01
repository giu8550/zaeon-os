"use client";

/**
 * Lounge — "cartolina virtual" (protótipo, tema Caderno).
 *
 * Fluxo: globo ao fundo → uma aba inferior (a cartolina) que você PUXA pra cima →
 * ao subir, entra o MODO COWORKING: um quadro com notas/perguntas/exercícios/pranchas/
 * vídeos no estilo manuscrito Da Vinci.
 *   • Desktop: cartolina INFINITA (pan arrastando o fundo + zoom na roda), cards arrastáveis.
 *   • Mobile: quadro FIXO, rolável na vertical, cards empilhados (sem pan/zoom).
 *
 * Protótipo: tudo client-only e MOCK (sem IA/backend). É o "viz-lab" da Lounge pra aprovar
 * layout e interação antes de plugar a geração pela Aura.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

const INK = "#3a2f1e";
const INK_SOFT = "#6b5a3e";
const ACCENT = "#0e7490";

type Card = {
  id: string;
  tipo: "titulo" | "nota" | "pergunta" | "exercicio" | "prancha" | "video";
  x: number; y: number; w: number;
  rot?: number;
  titulo?: string;
  corpo?: string;
  resposta?: string;
};

// Cartolina inicial mock (um "estudo" sobre o ciclo da água).
const CARDS0: Card[] = [
  { id: "t", tipo: "titulo", x: 120, y: 60, w: 360, rot: -1.5, titulo: "O Ciclo da Água", corpo: "caderno de estudos · rascunho" },
  { id: "n1", tipo: "nota", x: 560, y: 90, w: 300, rot: 1.2, titulo: "Evaporação", corpo: "O calor do sol transforma a água líquida dos mares e rios em vapor, que sobe na atmosfera." },
  { id: "p1", tipo: "prancha", x: 150, y: 230, w: 340, rot: -0.6 },
  { id: "q1", tipo: "pergunta", x: 580, y: 300, w: 320, rot: -1, corpo: "Por que as nuvens se formam em altitudes mais frias?" },
  { id: "e1", tipo: "exercicio", x: 250, y: 560, w: 360, rot: 0.8, corpo: "Liste as 4 fases do ciclo e dê um exemplo de cada no seu dia a dia.", resposta: "Evaporação, condensação, precipitação, escoamento — ex.: roupa secando, orvalho, chuva, rio." },
  { id: "v1", tipo: "video", x: 680, y: 560, w: 300, rot: -1.4, titulo: "Vídeo: o ciclo em 3 min", corpo: "aula sugerida pela Aura" },
];

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const s = () => setM(mq.matches);
    s(); mq.addEventListener("change", s);
    return () => mq.removeEventListener("change", s);
  }, []);
  return m;
}

/** Prancha Caderno (reusa o ciclo da água do viz-lab, versão compacta). */
function Prancha() {
  return (
    <svg viewBox="0 0 320 210" width="100%" aria-hidden="true">
      <circle cx="52" cy="44" r="18" fill="none" stroke={INK} strokeWidth="1.5" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <line key={i} x1={52 + Math.cos(a) * 22} y1={44 + Math.sin(a) * 22} x2={52 + Math.cos(a) * 29} y2={44 + Math.sin(a) * 29} stroke={INK_SOFT} strokeWidth="1" />;
      })}
      <path d="M12 178 Q80 166 160 178 T308 178 L308 200 L12 200 Z" fill="none" stroke={INK} strokeWidth="1.6" />
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={i} x1={24 + i * 30} y1={184} x2={17 + i * 30} y2={198} stroke={INK_SOFT} strokeWidth="0.7" />
      ))}
      <path d="M70 66 C104 120 104 150 130 172" fill="none" stroke={ACCENT} strokeWidth="1.5" />
      <path d="M210 172 C236 136 240 92 210 70" fill="none" stroke={INK} strokeWidth="1.5" />
      <path d="M198 74 q-16 -22 -40 -10 q-20 -15 -38 5 q-18 3 -10 22 l96 0 q14 -12 -8 -22 Z" fill="none" stroke={INK} strokeWidth="1.6" />
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={i} x1={132 + i * 11} y1={104} x2={128 + i * 11} y2={120} stroke={ACCENT} strokeWidth="1" />
      ))}
      <text x="150" y="98" className="cal" fontSize="12" fill={INK_SOFT}>nuvola</text>
    </svg>
  );
}

function CardView({ c, onReveal, revealed }: { c: Card; onReveal: (id: string) => void; revealed: boolean }) {
  const base: React.CSSProperties = { width: c.w, transform: `rotate(${c.rot ?? 0}deg)` };
  if (c.tipo === "titulo") {
    return (
      <div style={base}>
        <div className="cal" style={{ fontSize: 15, color: INK_SOFT }}>{c.corpo}</div>
        <div className="cal" style={{ fontSize: 46, lineHeight: 1.05, color: INK }}>{c.titulo}</div>
        <div style={{ height: 2, background: `linear-gradient(90deg, ${INK}, transparent)`, marginTop: 6 }} />
      </div>
    );
  }
  const corner: Record<string, string> = { nota: "Nota", pergunta: "Pergunta", exercicio: "Exercício", prancha: "Prancha", video: "Vídeo" };
  return (
    <div className="cad-card" style={base}>
      <div className="cad-tag cal">{corner[c.tipo]}</div>
      {c.titulo && <div style={{ fontWeight: 700, color: INK, marginBottom: 6 }}>{c.titulo}</div>}
      {c.tipo === "prancha" ? (
        <Prancha />
      ) : c.tipo === "video" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, border: `1.5px solid ${INK_SOFT}`, display: "grid", placeItems: "center", color: ACCENT, fontSize: 18 }}>▶</div>
          <span style={{ fontSize: 13, color: INK_SOFT }}>{c.corpo}</span>
        </div>
      ) : (
        <div style={{ fontSize: 15, lineHeight: 1.5, color: c.tipo === "pergunta" ? INK : INK_SOFT }}>
          {c.tipo === "pergunta" ? <em>“{c.corpo}”</em> : c.corpo}
        </div>
      )}
      {c.tipo === "exercicio" && (
        <button className="cal" onClick={() => onReveal(c.id)}
          style={{ marginTop: 10, fontSize: 14, color: ACCENT, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          {revealed ? "esconder resposta" : "revelar resposta"}
        </button>
      )}
      {c.tipo === "exercicio" && revealed && (
        <div style={{ marginTop: 6, fontSize: 13, color: INK_SOFT, borderTop: `1px dashed ${INK_SOFT}55`, paddingTop: 6 }}>{c.resposta}</div>
      )}
    </div>
  );
}

export default function LoungeCartolina() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<Card[]>(CARDS0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [view, setView] = useState({ x: 40, y: 20, scale: 1 });

  const reveal = useCallback((id: string) => setRevealed((r) => ({ ...r, [id]: !r[id] })), []);

  // sinaliza modo-foco pra navbar global sumir quando a cartolina sobe
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("zaeon-focus-mode", { detail: open }));
    return () => window.dispatchEvent(new CustomEvent("zaeon-focus-mode", { detail: false }));
  }, [open]);

  // ── puxar a aba pra cima ────────────────────────────────────────────────────
  const pull = useRef<{ y0: number } | null>(null);
  const onHandleDown = (e: React.PointerEvent) => { pull.current = { y0: e.clientY }; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const onHandleMove = (e: React.PointerEvent) => { if (pull.current && pull.current.y0 - e.clientY > 70) { setOpen(true); pull.current = null; } };
  const onHandleUp = () => { pull.current = null; };

  // ── pan do fundo (desktop) ──────────────────────────────────────────────────
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const onBoardDown = (e: React.PointerEvent) => {
    if (isMobile) return;
    if ((e.target as HTMLElement).closest("[data-card]")) return; // arrastar card tem prioridade
    pan.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onBoardMove = (e: React.PointerEvent) => {
    if (!pan.current) return;
    setView((v) => ({ ...v, x: pan.current!.vx + (e.clientX - pan.current!.x), y: pan.current!.vy + (e.clientY - pan.current!.y) }));
  };
  const onBoardUp = () => { pan.current = null; };
  const onWheel = (e: React.WheelEvent) => {
    if (isMobile) return;
    const d = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setView((v) => ({ ...v, scale: Math.min(2, Math.max(0.4, v.scale * d)) }));
  };

  // ── arrastar um card ────────────────────────────────────────────────────────
  const drag = useRef<{ id: string; x: number; y: number; cx: number; cy: number } | null>(null);
  const onCardDown = (e: React.PointerEvent, c: Card) => {
    if (isMobile) return;
    e.stopPropagation();
    drag.current = { id: c.id, x: e.clientX, y: e.clientY, cx: c.x, cy: c.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onCardMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.x) / view.scale;
    const dy = (e.clientY - drag.current.y) / view.scale;
    setCards((cs) => cs.map((c) => (c.id === drag.current!.id ? { ...c, x: drag.current!.cx + dx, y: drag.current!.cy + dy } : c)));
  };
  const onCardUp = () => { drag.current = null; };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#030712" }}>
      <style>{`
        .cal { font-family: 'Snell Roundhand','Segoe Script','Brush Script MT',cursive; }
        .cad-card { position: relative; background: rgba(243,231,206,.96); border: 1px solid ${INK_SOFT}66;
          border-radius: 10px; padding: 16px 16px 14px; box-shadow: 0 22px 44px -22px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.6); }
        .cad-tag { position:absolute; top:-10px; left:14px; background:${ACCENT}; color:#fff; font-size:12px;
          padding:1px 10px; border-radius:999px; box-shadow:0 4px 10px -4px ${ACCENT}; }
        .globe-grid { animation: spin 90s linear infinite; transform-origin:center; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .star { position:absolute; width:2px; height:2px; background:#fff; border-radius:50%; opacity:.5; }
      `}</style>

      {/* ── GLOBO AO FUNDO ─────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "radial-gradient(130% 100% at 50% 20%, #0b1b3a 0%, #030712 70%)" }}>
        {[...Array(40)].map((_, i) => (
          <span key={i} className="star" style={{ left: `${(i * 97) % 100}%`, top: `${(i * 53) % 100}%`, opacity: 0.2 + ((i * 7) % 6) / 10 }} />
        ))}
        <svg viewBox="0 0 400 400" width="min(70vmin,620px)" height="min(70vmin,620px)" style={{ filter: "drop-shadow(0 0 60px rgba(14,116,144,.35))" }}>
          <defs>
            <radialGradient id="g" cx="40%" cy="35%" r="75%">
              <stop offset="0%" stopColor="#164e63" /><stop offset="70%" stopColor="#0a2540" /><stop offset="100%" stopColor="#030712" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="150" fill="url(#g)" stroke={`${ACCENT}`} strokeWidth="1" opacity="0.9" />
          <g className="globe-grid" stroke={`${ACCENT}`} strokeOpacity="0.35" fill="none" strokeWidth="0.7" opacity="0.5">
            {[-120, -75, -35, 0, 35, 75, 120].map((o) => <ellipse key={o} cx="200" cy="200" rx={Math.max(8, 150 - Math.abs(o))} ry="150" />)}
            {[-120, -60, 0, 60, 120].map((o) => <ellipse key={o} cx="200" cy="200" rx="150" ry={Math.max(8, 150 - Math.abs(o))} />)}
          </g>
        </svg>
      </div>

      {/* ── CARTOLINA (sobe por cima do globo) ─────────────────────────────── */}
      <div
        onPointerMove={(e) => { onHandleMove(e); onBoardMove(e); onCardMove(e); }}
        onPointerUp={() => { onHandleUp(); onBoardUp(); onCardUp(); }}
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          height: open ? "100%" : (isMobile ? 120 : 96),
          transition: "height .55s cubic-bezier(.22,1,.36,1)",
          background: open ? "linear-gradient(180deg,#efe7d3 0%, #e6dcc2 100%)" : "transparent",
          boxShadow: open ? "0 -30px 80px -20px rgba(0,0,0,.6)" : "none",
          borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden",
        }}
      >
        {/* alça de puxar / fechar */}
        <div
          onPointerDown={open ? undefined : onHandleDown}
          onClick={() => setOpen((o) => !o)}
          style={{
            height: open ? 44 : (isMobile ? 120 : 96), cursor: open ? "pointer" : "grab",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            background: open ? "rgba(58,47,30,.06)" : "rgba(239,231,211,.85)",
            backdropFilter: "blur(8px)", color: INK, userSelect: "none",
            borderTop: open ? `1px solid ${INK_SOFT}44` : "none", position: "relative", zIndex: 5,
          }}
        >
          <div style={{ width: 54, height: 5, borderRadius: 999, background: `${INK_SOFT}` }} />
          <span className="cal" style={{ fontSize: open ? 15 : 20, color: INK }}>
            {open ? "↓ recolher a cartolina" : "↑ puxe a cartolina — entre no coworking"}
          </span>
        </div>

        {/* o quadro */}
        {open && (
          <div
            onPointerDown={onBoardDown}
            onWheel={onWheel}
            style={{
              position: "absolute", inset: 0, top: 44,
              overflow: isMobile ? "auto" : "hidden",
              cursor: isMobile ? "auto" : "grab",
              backgroundImage: `radial-gradient(${INK_SOFT}22 1px, transparent 1px)`,
              backgroundSize: "26px 26px",
            }}
          >
            {isMobile ? (
              // MOBILE: quadro fixo, coluna rolável
              <div style={{ display: "flex", flexDirection: "column", gap: 26, padding: "28px 18px 60px", maxWidth: 520, margin: "0 auto" }}>
                {cards.map((c) => (
                  <div key={c.id} style={{ transform: "none" }}>
                    <CardView c={{ ...c, rot: 0, w: Math.min(c.w, 480) }} onReveal={reveal} revealed={!!revealed[c.id]} />
                  </div>
                ))}
              </div>
            ) : (
              // DESKTOP: cartolina infinita (pan + zoom), cards arrastáveis
              <div style={{ position: "absolute", inset: 0, transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}>
                {cards.map((c) => (
                  <div
                    key={c.id} data-card
                    onPointerDown={(e) => onCardDown(e, c)}
                    style={{ position: "absolute", left: c.x, top: c.y, cursor: "grab", touchAction: "none" }}
                  >
                    <CardView c={c} onReveal={reveal} revealed={!!revealed[c.id]} />
                  </div>
                ))}
              </div>
            )}

            {/* dica de interação (desktop) */}
            {!isMobile && (
              <div className="cal" style={{ position: "absolute", right: 16, bottom: 12, fontSize: 14, color: `${INK_SOFT}`, pointerEvents: "none" }}>
                arraste o fundo pra navegar · roda do mouse pra zoom · arraste os cards
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
