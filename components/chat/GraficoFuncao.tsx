"use client";

/**
 * GraficoFuncao — o bloco ```grafico do chat desenhado em SVG (sem lib): eixos, grade, marcas,
 * até 4 curvas, pontos rotulados e formas de geometria (polígono, círculo, segmento, vetor) — com
 * escala 1:1 quando é geometria (círculo sai redondo). O JSON vem do modelo e passa por lib/chat/grafico (parser
 * fechado, sem eval). Claro e escuro: eixos/grade em currentColor; curvas em cores fixas legíveis.
 */
import { useId, useMemo } from "react";
import { amostrar, marcas, parseGrafico, pontosDaForma, proporcionalizar, type FormaSpec } from "@/lib/chat/grafico";

const W = 560, H = 320, M = { l: 44, r: 14, t: 14, b: 30 };
export const CORES = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981"];
const COR_FORMA = "#6366f1";

/** PURO: ponto onde vai o rótulo da forma (centróide do polígono, centro do círculo, meio do segmento). */
export function ancoraDaForma(f: FormaSpec): [number, number] {
  if (f.tipo === "circulo") return [f.centro[0], f.centro[1] + f.raio];
  if (f.tipo === "vetor" || f.tipo === "segmento") return f.ate;   // rótulo na ponta (o meio costuma cruzar outras figuras)
  const ps = pontosDaForma(f);
  return [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length];
}

/** PURO: número curto pros eixos (sem "0.30000000000000004"). */
export function fmtNum(v: number): string {
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e4 || a < 1e-3) return v.toExponential(1).replace("e+", "e");
  return String(Number(v.toPrecision(3))).replace(".", ",");
}

export default function GraficoFuncao({ json }: { json: string }) {
  const r = useMemo(() => parseGrafico(json), [json]);
  const clipId = `z-graf-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;   // vários gráficos na mesma página
  const dados = useMemo(() => (r.ok ? amostrar(r.spec) : null), [r]);

  if (!r.ok || !dados) {
    return (
      <div className="my-2 rounded-xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-400/[0.07] px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
        Não consegui desenhar este gráfico ({r.ok ? "sem dados" : r.erro}).
      </div>
    );
  }
  const { spec } = r;
  const area = { w: W - M.l - M.r, h: H - M.t - M.b };
  const faixa = spec.proporcional ? proporcionalizar(spec.x, dados.y, area.w, area.h) : { x: spec.x, y: dados.y };
  const [x0, x1] = faixa.x, [y0, y1] = faixa.y;
  const px = (x: number) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const py = (y: number) => H - M.b - ((y - y0) / (y1 - y0)) * (H - M.t - M.b);
  const clip = (y: number) => Math.max(y0 - (y1 - y0), Math.min(y1 + (y1 - y0), y));
  const mx = marcas(x0, x1, 8), my = marcas(y0, y1, 6);
  const eixoX = y0 <= 0 && y1 >= 0 ? py(0) : null, eixoY = x0 <= 0 && x1 >= 0 ? px(0) : null;
  const descricao = `${spec.formas.length ? "Figura" : "Gráfico"} de ${[...spec.funcoes.map((f) => f.expr), ...spec.formas.map((f) => f.rotulo ?? f.tipo)].join(", ") || "pontos"} para x de ${fmtNum(x0)} a ${fmtNum(x1)}`;

  return (
    <figure className="my-3 w-full max-w-[600px]">
      {spec.titulo && <figcaption className="mb-1 text-[12px] font-semibold text-slate-700 dark:text-white/80">{spec.titulo}</figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descricao} className="w-full h-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] text-slate-500 dark:text-white/45">
        <defs>
          <marker id={`${clipId}-seta`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={COR_FORMA} /></marker>
          <clipPath id={clipId}><rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} /></clipPath>
        </defs>
        {mx.map((v) => <line key={`gx${v}`} x1={px(v)} x2={px(v)} y1={M.t} y2={H - M.b} stroke="currentColor" strokeOpacity={0.15} />)}
        {my.map((v) => <line key={`gy${v}`} y1={py(v)} y2={py(v)} x1={M.l} x2={W - M.r} stroke="currentColor" strokeOpacity={0.15} />)}
        {eixoX != null && <line x1={M.l} x2={W - M.r} y1={eixoX} y2={eixoX} stroke="currentColor" strokeOpacity={0.7} />}
        {eixoY != null && <line y1={M.t} y2={H - M.b} x1={eixoY} x2={eixoY} stroke="currentColor" strokeOpacity={0.7} />}
        {mx.map((v) => <text key={`tx${v}`} x={px(v)} y={H - M.b + 16} textAnchor="middle" fontSize={11} fill="currentColor">{fmtNum(v)}</text>)}
        {my.map((v) => <text key={`ty${v}`} x={M.l - 6} y={py(v) + 4} textAnchor="end" fontSize={11} fill="currentColor">{fmtNum(v)}</text>)}
        <g clipPath={`url(#${clipId})`}>
          {dados.curvas.map((c, i) => c.trechos.map((t, j) => (
            <polyline key={`c${i}-${j}`} fill="none" stroke={CORES[i % CORES.length]} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round"
              points={t.map(([x, y]) => `${px(x).toFixed(1)},${py(clip(y)).toFixed(1)}`).join(" ")} />
          )))}
          {spec.formas.map((f, i) => {
            const [ax, ay] = ancoraDaForma(f);
            const rot = f.rotulo ? <text x={px(ax) + 6} y={py(ay) - 6} fontSize={11} className="fill-slate-800 dark:fill-white">{f.rotulo}</text> : null;
            if (f.tipo === "poligono") return <g key={`f${i}`}><polygon points={f.pontos.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(" ")} fill={COR_FORMA} fillOpacity={0.12} stroke={COR_FORMA} strokeWidth={2} strokeLinejoin="round" />{rot}</g>;
            if (f.tipo === "circulo") return <g key={`f${i}`}><ellipse cx={px(f.centro[0])} cy={py(f.centro[1])} rx={Math.abs(px(f.centro[0] + f.raio) - px(f.centro[0]))} ry={Math.abs(py(f.centro[1] + f.raio) - py(f.centro[1]))} fill={COR_FORMA} fillOpacity={0.1} stroke={COR_FORMA} strokeWidth={2} />{rot}</g>;
            return <g key={`f${i}`}><line x1={px(f.de[0])} y1={py(f.de[1])} x2={px(f.ate[0])} y2={py(f.ate[1])} stroke={COR_FORMA} strokeWidth={2.2} strokeLinecap="round" markerEnd={f.tipo === "vetor" ? `url(#${clipId}-seta)` : undefined} />{rot}</g>;
          })}
          {spec.pontos.map((p, i) => (
            <g key={`p${i}`}>
              <circle cx={px(p.x)} cy={py(p.y)} r={4} fill="#ef4444" stroke="white" strokeWidth={1.5} />
              {p.rotulo && <text x={px(p.x) + 7} y={py(p.y) - 7} fontSize={11} className="fill-slate-800 dark:fill-white">{p.rotulo} ({fmtNum(p.x)}; {fmtNum(p.y)})</text>}
            </g>
          ))}
        </g>
      </svg>
      {spec.funcoes.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-700 dark:text-white/75">
          {spec.funcoes.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: CORES[i % CORES.length] }} />
              <span className="font-mono">{f.rotulo === f.expr ? `y = ${f.expr}` : `${f.rotulo}: y = ${f.expr}`}</span>
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
