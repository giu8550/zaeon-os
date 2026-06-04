"use client";
import { useEffect, useState } from "react";
import { useOmegaScholar } from "./OmegaScholarContext";

interface ResearchProject {
  id: number | string;
  title: string;
  participants: { grads: number; masters: number; phds: number };
  progress: number;
  status: string;
  details: { agents: string[]; rank: string };
}

// "Projetos relacionados" — pesquisas da plataforma filtradas pelo input do agente Omega.
// Fonte pública /api/research?query= (sem auth), sempre visível abaixo do painel de sugestão.
export default function OmegaRelatedProjects() {
  const { query, draft } = useOmegaScholar();
  const seed = (query || draft || "").trim();
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seed.length < 2) {
      setProjects([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/research?query=${encodeURIComponent(seed)}`);
        if (!res.ok) {
          if (active) setProjects([]);
          return;
        }
        const data = (await res.json()) as ResearchProject[];
        if (active) setProjects(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch {
        if (active) setProjects([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [seed]);

  if (seed.length < 2 || (!loading && projects.length === 0)) return null;

  return (
    <div className="mt-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-2 px-1">
        Projetos relacionados{projects.length > 0 ? ` (${projects.length})` : ""}
      </p>

      {loading && projects.length === 0 ? (
        <div className="text-[11px] text-slate-400 dark:text-white/30 px-1 py-2">Buscando projetos relacionados…</div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="rounded-xl bg-white/70 dark:bg-white/[0.03] border border-black/8 dark:border-white/10 p-3"
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-400/20">
                  {p.details?.rank ?? "?"}
                </span>
                <p className="text-[12px] font-semibold text-slate-800 dark:text-white/80 leading-snug flex-1">{p.title}</p>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-black/5 dark:bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-violet-500"
                  style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-500 dark:text-white/40">
                <span>{p.progress}% · {p.status}</span>
                <span>🎓 {p.participants?.grads ?? 0} · 🔬 {p.participants?.masters ?? 0} · ⚗️ {p.participants?.phds ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
