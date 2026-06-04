"use client";
import { useMemo, useState } from "react";

import { parseAbntMarkers } from "@/lib/abntTemplate";
import { splitParagraphs } from "@/lib/quality/segment";
import { useQualityScore } from "@/lib/quality/useQualityScore";
import { BAND_LABELS, type AcademicLevel, type Band, type ParagraphScore, type WorkType } from "@/lib/quality/types";

// Cor + rótulo (nunca só cor) por banda. Classes literais para o JIT do Tailwind.
const BAND_UI: Record<Band, { dot: string; text: string; border: string; chip: string }> = {
  ruim: {
    dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400",
    border: "border-l-rose-400", chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  },
  aceitavel: {
    dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400",
    border: "border-l-amber-400", chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  },
  bom: {
    dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-400",
    border: "border-l-sky-400", chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
  },
  muito_bom: {
    dot: "bg-teal-500", text: "text-teal-600 dark:text-teal-400",
    border: "border-l-teal-400", chip: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20",
  },
  excepcional: {
    dot: "bg-cyan-400", text: "text-cyan-500 dark:text-cyan-300",
    border: "border-l-cyan-400", chip: "bg-cyan-400/15 text-cyan-600 dark:text-cyan-300 border border-cyan-400/30 shadow-[0_0_8px_rgba(34,211,238,0.25)]",
  },
};

function BandPill({ band, score }: { band: Band; score?: number }) {
  const ui = BAND_UI[band];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${ui.chip}`}>
      <span className={`w-2 h-2 rounded-full ${ui.dot}`} />
      {BAND_LABELS[band]}
      {typeof score === "number" && <span className="opacity-70">{Math.round(score)}</span>}
    </span>
  );
}

function paragraphTooltip(p: ParagraphScore): string {
  const parts = [`${BAND_LABELS[p.band]} · ${Math.round(p.score)}/100`, p.rationale];
  if (p.strengths.length) parts.push(`Fortes: ${p.strengths.join(", ")}`);
  if (p.gaps.length) parts.push(`Lacunas: ${p.gaps.join(", ")}`);
  if (p.flags.length) parts.push(`⚠ Revisar: ${p.flags.join(", ")}`);
  return parts.join(" — ");
}

interface Props {
  docContent: string;
  title: string;
  workType: WorkType;
  academicLevel: AcademicLevel;
  reviewMode: boolean;
  onToggleReview: () => void;
}

export default function AcademicThermometer({
  docContent, title, workType, academicLevel, reviewMode, onToggleReview,
}: Props) {
  const [open, setOpen] = useState(true);
  const { score, loading, offline } = useQualityScore({ docContent, title, workType, academicLevel });
  const parsed = useMemo(() => parseAbntMarkers(docContent) ?? [], [docContent]);

  // Motor indisponível ou nada para medir → some discretamente.
  if (offline) return null;
  if (!score && !loading) return null;

  const flagCount = score
    ? score.sections.reduce((n, s) => n + s.paragraphs.reduce((m, p) => m + p.flags.length, 0), 0)
    : 0;

  return (
    <>
      {/* ── BARRA TERMÔMETRO ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] overflow-hidden text-left shrink-0">
        <div className="w-full flex items-center justify-between gap-2 px-5 py-3">
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
            <span>🌡️ Termômetro Acadêmico</span>
            {loading && <span className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />}
          </button>
          <div className="flex items-center gap-2">
            {score && <BandPill band={score.overall.band} score={score.overall.score} />}
            <button
              onClick={onToggleReview}
              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${
                reviewMode
                  ? "bg-cyan-500 text-white border-cyan-500"
                  : "border-slate-300 dark:border-white/20 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
              }`}
              title="Alterna entre editar e revisar a trilha por parágrafo"
            >
              {reviewMode ? "Editar" : "Revisar"}
            </button>
            <button onClick={() => setOpen((o) => !o)} className="text-slate-400 text-xs w-5">{open ? "▲" : "▼"}</button>
          </div>
        </div>

        {open && score && (
          <div className="px-5 pb-4 flex flex-col gap-3 border-t border-slate-100 dark:border-white/5 pt-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Nível estimado: <span className="font-black text-slate-700 dark:text-slate-200">{score.overall.level_read}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Título: <BandPill band={score.title.band} />
              </div>
            </div>

            {/* chips por seção */}
            {score.sections.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {score.sections.map((s, i) => (
                  <span key={i} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${BAND_UI[s.band].chip}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${BAND_UI[s.band].dot}`} />
                    {(s.title || s.type).slice(0, 22)}
                  </span>
                ))}
              </div>
            )}

            {/* forças / lacunas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
              {score.overall.strengths.length > 0 && (
                <div className="text-emerald-600 dark:text-emerald-400">
                  <span className="font-black uppercase tracking-wide">✓ Fortes</span>
                  <ul className="mt-0.5 space-y-0.5">{score.overall.strengths.map((s, i) => <li key={i}>• {s}</li>)}</ul>
                </div>
              )}
              {score.overall.gaps.length > 0 && (
                <div className="text-amber-600 dark:text-amber-400">
                  <span className="font-black uppercase tracking-wide">△ A melhorar</span>
                  <ul className="mt-0.5 space-y-0.5">{score.overall.gaps.map((s, i) => <li key={i}>• {s}</li>)}</ul>
                </div>
              )}
            </div>

            {flagCount > 0 && (
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                ⚠ {flagCount} parágrafo(s) com sinais para revisar (ex.: nominalização excessiva, léxico de IA, frases uniformes). Sinais não afetam a nota.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TRILHA POR PARÁGRAFO (MODO REVISÃO) ── */}
      {reviewMode && (
        <div className="flex-1 min-h-[400px] overflow-y-auto custom-scrollbar flex flex-col gap-5 font-serif text-[16px] leading-relaxed">
          {!score && loading && (
            <p className="text-slate-400 text-sm font-sans">Analisando parágrafos…</p>
          )}
          {score && score.sections.map((sec, i) => {
            const ps = parsed[i];
            const texts = ps
              ? [...splitParagraphs(ps.content), ...(ps.subsections ?? []).flatMap((ss) => splitParagraphs(ss.content))]
              : [];
            return (
              <div key={i} className="flex flex-col gap-2">
                {sec.title && (
                  <div className="flex items-center gap-2 font-sans">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{sec.title}</span>
                    <BandPill band={sec.band} score={sec.score} />
                  </div>
                )}
                {sec.paragraphs.map((p) => (
                  <div
                    key={p.idx}
                    className={`group relative border-l-4 ${BAND_UI[p.band].border} pl-3 pr-2 py-1`}
                    title={paragraphTooltip(p)}
                    aria-label={paragraphTooltip(p)}
                  >
                    <span className={`absolute -left-[7px] top-2 w-2.5 h-2.5 rounded-full ${BAND_UI[p.band].dot}`} />
                    <span className="text-black dark:text-white">{texts[p.idx] ?? ""}</span>
                    <span className={`ml-2 align-middle text-[9px] font-sans font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity ${BAND_UI[p.band].text}`}>
                      {BAND_LABELS[p.band]} {Math.round(p.score)}
                      {p.flags.length > 0 && " · ⚠"}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
