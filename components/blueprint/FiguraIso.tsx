"use client";
/**
 * FiguraIso — a máquina isométrica do estudo (lib/blueprint/figura). Padrão do anatomy (wheresryan22/anatomy, MIT):
 * o objeto é a explicação. Três faces por bloco; verde = peça provada, vermelha pulsando = travada por um crítico,
 * tracejada = ainda não construída. A ligação entre duas peças provadas "flui".
 */
import { iso, montarFigura, type EstadoPeca, type PecaPosta } from "@/lib/blueprint/figura";
import type { DocBlueprint } from "@/lib/blueprint/tipos";

const CORES: Record<EstadoPeca, { traco: string; topo: string; lado: string }> = {
  ok: { traco: "#7dffb0", topo: "rgba(125,255,176,.22)", lado: "rgba(125,255,176,.10)" },
  trava: { traco: "#ff4d5e", topo: "rgba(255,77,94,.25)", lado: "rgba(255,77,94,.12)" },
  futuro: { traco: "rgba(170,220,255,.55)", topo: "rgba(170,220,255,.05)", lado: "rgba(170,220,255,.02)" },
};
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const pts = (...ps: [number, number][]) => ps.map((p) => p.join(",")).join(" ");

function Bloco({ p }: { p: PecaPosta }) {
  const { traco, topo, lado } = CORES[p.estado], tr = p.estado === "futuro" ? "4 3" : undefined;
  const P = (x: number, y: number, z: number) => iso(p.gx + x, p.gy + y, z);
  const { w, d, h } = p, [lx, ly] = P(w / 2, d / 2, h);
  return (
    <g>
      <polygon points={pts(P(0, d, 0), P(w, d, 0), P(w, d, h), P(0, d, h))} fill={lado} stroke={traco} strokeDasharray={tr} strokeWidth={1.2} />
      <polygon points={pts(P(w, 0, 0), P(w, d, 0), P(w, d, h), P(w, 0, h))} fill={lado} stroke={traco} strokeDasharray={tr} strokeWidth={1.2} />
      <polygon points={pts(P(0, 0, h), P(w, 0, h), P(w, d, h), P(0, d, h))} fill={topo} stroke={traco} strokeDasharray={tr} strokeWidth={1.4} />
      {/* o "mecanismo": as camadas internas na face da frente */}
      {[1, 2].map((k) => <polyline key={k} points={pts(P(8, d, (h * k) / 3), P(w - 8, d, (h * k) / 3))} stroke={traco} strokeWidth={0.7} fill="none" opacity={0.55} />)}
      <text x={lx} y={ly - 26} textAnchor="middle" fill={traco} fontSize={17} fontWeight={700} fontFamily={MONO}>{p.codigo} {p.nome}{p.estado === "ok" ? " ✓" : p.estado === "trava" ? " ✕" : ""}</text>
      {p.sub && <text x={lx} y={ly - 10} textAnchor="middle" fill="rgba(186,230,253,.7)" fontSize={13} fontFamily={MONO}>{p.sub}</text>}
      {p.estado === "trava" && <circle cx={lx} cy={ly + 6} r={4} fill="#ff4d5e"><animate attributeName="opacity" values="1;.3;1" dur="1.6s" repeatCount="indefinite" /></circle>}
    </g>
  );
}

export default function FiguraIso({ doc }: { doc: DocBlueprint }) {
  const f = montarFigura(doc), porId = new Map(f.pecas.map((p) => [p.id, p] as const));
  return (
    <svg viewBox={`${f.caixa.x} ${f.caixa.y} ${f.caixa.w} ${f.caixa.h}`} className="block w-full" style={{ maxHeight: 340 }} role="img" aria-label={`Figura: ${f.pecas.map((p) => `${p.codigo} ${p.nome} (${p.estado === "ok" ? "provada" : p.estado === "trava" ? "travada" : "a construir"})`).join(", ")}`}>
      {/* as ligações (no chão, por baixo dos blocos) */}
      {f.ligacoes.map(([a, b]) => {
        const A = porId.get(a)!, B = porId.get(b)!, vivo = A.estado === "ok" && B.estado === "ok";
        const [x1, y1] = iso(A.gx + A.w / 2, A.gy + A.d / 2, 6), [x2, y2] = iso(B.gx + B.w / 2, B.gy + B.d / 2, 6);
        return (
          <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={vivo ? "#7dffb0" : "rgba(170,220,255,.45)"} strokeWidth={vivo ? 2.2 : 1.3} strokeDasharray={vivo ? "8 6" : "3 5"}>
            {vivo && <animate attributeName="stroke-dashoffset" from="28" to="0" dur="1s" repeatCount="indefinite" />}
          </line>
        );
      })}
      {f.ordem.map((id) => <Bloco key={id} p={porId.get(id)!} />)}
    </svg>
  );
}
