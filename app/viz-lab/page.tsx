"use client";

/**
 * /viz-lab — playground ESTÁTICO do tema "Caderno" (harness artístico da Zaeon).
 *
 * Objetivo: ver a ASSINATURA VISUAL em dev, sem LLM/backend/Prisma. É a semente da PR0
 * (prancha Caderno) e da PR1 (canvas da conversa estilo Obsidian). Tudo mock, client-only.
 *
 * Como rodar: `npm run dev` → abrir /viz-lab. Em produção só aparece se
 * NEXT_PUBLIC_VIZ_LAB=1 (evita expor o laboratório sem querer).
 *
 * Regra do tema: rebuscado no ESTILO (tinta, hachura, marginalia), limpo na LEITURA.
 * A "tinta surgindo" é CSS (stroke-dashoffset) — barato e rápido, nada de rasterização.
 */

const INK = "#3a2f1e";       // tinta ferrogálica
const INK_SOFT = "#6b5a3e";
const PAPER = "#efe7d3";     // papel envelhecido
const ACCENT = "#0e7490";    // cyan da casa, usado com parcimônia

// Conversa mock (nós = mensagens/tópicos; arestas = ordem/relação) — estilo Obsidian.
const NODES = [
  { id: "q", label: "Pergunta: ciclo da água", x: 90, y: 60, kind: "user" },
  { id: "a", label: "Evaporação", x: 300, y: 40, kind: "conceito" },
  { id: "b", label: "Condensação", x: 470, y: 120, kind: "conceito" },
  { id: "c", label: "Precipitação", x: 330, y: 210, kind: "conceito" },
  { id: "d", label: "Prancha: diagrama", x: 120, y: 210, kind: "artefato" },
];
const EDGES: [string, string][] = [["q", "a"], ["a", "b"], ["b", "c"], ["c", "d"], ["q", "d"]];
const byId = (id: string) => NODES.find((n) => n.id === id)!;

function isProdHidden() {
  return process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_VIZ_LAB !== "1";
}

export default function VizLab() {
  if (isProdHidden()) {
    return <main style={{ padding: 40, fontFamily: "monospace" }}>viz-lab desativado (defina NEXT_PUBLIC_VIZ_LAB=1).</main>;
  }
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 24px",
        background: `radial-gradient(120% 120% at 30% 10%, ${PAPER} 0%, #e6dcc2 100%)`,
        color: INK,
        fontFamily: "'Iowan Old Style','Palatino Linotype','Book Antiqua',Georgia,serif",
      }}
    >
      {/* animação da tinta + textura de papel */}
      <style>{`
        @keyframes zTinta { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
        .tinta { stroke-dasharray: var(--len); stroke-dashoffset: var(--len); animation: zTinta 1.6s ease-out forwards; }
        .tinta.d1{animation-delay:.1s}.tinta.d2{animation-delay:.5s}.tinta.d3{animation-delay:.9s}.tinta.d4{animation-delay:1.2s}
        .cal { font-family: 'Snell Roundhand','Segoe Script','Brush Script MT',cursive; }
        .cad-card { background: rgba(255,252,244,.55); border:1px solid ${INK_SOFT}55; border-radius:14px;
          box-shadow: 0 18px 40px -22px ${INK}aa, inset 0 1px 0 rgba(255,255,255,.6); backdrop-filter: blur(2px); }
        @media (max-width: 767px){ .canvas-conversa{ display:none } } /* mobile: SEM canvas (base de layout) */
      `}</style>

      <header style={{ maxWidth: 1100, margin: "0 auto 28px" }}>
        <p className="cal" style={{ fontSize: 26, color: INK_SOFT, margin: 0 }}>Zaeon · tema Caderno</p>
        <h1 style={{ fontSize: 40, margin: "4px 0 0", letterSpacing: "-0.01em" }}>Laboratório visual</h1>
        <p style={{ maxWidth: 640, color: INK_SOFT }}>
          Prova estática da estética: prancha manuscrita (Da Vinci) + canvas da conversa
          (Obsidian). Tudo mock — a IA/harness entram nas PRs 0 e 2.
        </p>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 24, gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)" }}>
        {/* ── PRANCHA CADERNO (PR0) ─────────────────────────────────────────── */}
        <section className="cad-card" style={{ padding: 18 }}>
          <p className="cal" style={{ fontSize: 20, margin: "0 0 8px", color: INK_SOFT }}>Prancha — o ciclo da água</p>
          <svg viewBox="0 0 360 300" width="100%" role="img" aria-label="Diagrama manuscrito do ciclo da água">
            {/* sol */}
            <circle cx="60" cy="50" r="22" fill="none" stroke={INK} strokeWidth="1.6" className="tinta d1" style={{ ["--len" as any]: 140 }} />
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return <line key={i} x1={60 + Math.cos(a) * 26} y1={50 + Math.sin(a) * 26} x2={60 + Math.cos(a) * 34} y2={50 + Math.sin(a) * 34} stroke={INK_SOFT} strokeWidth="1.2" className="tinta d1" style={{ ["--len" as any]: 12 }} />;
            })}
            {/* mar (com hachura) */}
            <path d="M20 250 Q90 235 180 250 T340 250 L340 285 L20 285 Z" fill="none" stroke={INK} strokeWidth="1.8" className="tinta d2" style={{ ["--len" as any]: 480 }} />
            {Array.from({ length: 10 }).map((_, i) => (
              <line key={i} x1={30 + i * 30} y1={258} x2={22 + i * 30} y2={282} stroke={INK_SOFT} strokeWidth="0.8" className="tinta d3" style={{ ["--len" as any]: 30 }} />
            ))}
            {/* setas do ciclo */}
            <path d="M80 80 C120 150 120 200 150 235" fill="none" stroke={ACCENT} strokeWidth="1.6" className="tinta d2" style={{ ["--len" as any]: 220 }} />
            <path d="M250 235 C280 190 285 130 250 90" fill="none" stroke={INK} strokeWidth="1.6" className="tinta d3" style={{ ["--len" as any]: 220 }} />
            {/* nuvem */}
            <path d="M215 95 q-18 -26 -44 -12 q-24 -18 -44 6 q-22 4 -12 26 l112 0 q16 -14 -12 -26 Z" fill="none" stroke={INK} strokeWidth="1.8" className="tinta d3" style={{ ["--len" as any]: 360 }} />
            {/* chuva */}
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={i} x1={150 + i * 12} y1={130} x2={146 + i * 12} y2={150} stroke={ACCENT} strokeWidth="1.2" className="tinta d4" style={{ ["--len" as any]: 22 }} />
            ))}
            {/* marginalia caligráfica */}
            <text x="96" y="46" className="cal" fontSize="13" fill={INK_SOFT}>sole</text>
            <text x="150" y="120" className="cal" fontSize="13" fill={INK_SOFT}>nuvola</text>
            <text x="250" y="278" className="cal" fontSize="13" fill={INK_SOFT}>il mare</text>
          </svg>
          <p style={{ fontSize: 13, color: INK_SOFT, marginTop: 4 }}>
            No PR0, isto é gerado: LLM descreve primitivas → o tema Caderno compila em SVG.
          </p>
        </section>

        {/* ── CANVAS DA CONVERSA (PR1, desktop-only) ────────────────────────── */}
        <section className="cad-card canvas-conversa" style={{ padding: 18 }}>
          <p className="cal" style={{ fontSize: 20, margin: "0 0 8px", color: INK_SOFT }}>Canvas da conversa (estilo Obsidian)</p>
          <svg viewBox="0 0 560 280" width="100%" role="img" aria-label="Grafo da conversa em estilo manuscrito">
            {EDGES.map(([a, b], i) => {
              const p = byId(a), q = byId(b);
              return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={INK_SOFT} strokeWidth="1.3" className="tinta d2" style={{ ["--len" as any]: 300 }} />;
            })}
            {NODES.map((n, i) => (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={n.kind === "user" ? 15 : n.kind === "artefato" ? 13 : 11}
                  fill={n.kind === "user" ? `${ACCENT}22` : "rgba(255,252,244,.9)"}
                  stroke={n.kind === "artefato" ? ACCENT : INK} strokeWidth="1.6"
                  className={`tinta d${(i % 3) + 1}`} style={{ ["--len" as any]: 110 }} />
                <text x={n.x + 18} y={n.y + 4} fontSize="12" fill={INK}>{n.label}</text>
              </g>
            ))}
          </svg>
          <p style={{ fontSize: 13, color: INK_SOFT, marginTop: 4 }}>
            Cada nó guarda a mensagem/artefato daquela região (memória) — PR2. No mobile este
            canvas some (base de layout).
          </p>
        </section>
      </div>
    </main>
  );
}
