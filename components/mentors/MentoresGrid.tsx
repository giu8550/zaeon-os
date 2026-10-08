"use client";

/**
 * MentoresGrid — a sala de ASSISTENTES em CRACHÁS (o mesmo crachá vivo da landing):
 *   NATIVOS (Aura, Nina, Caio…) — já vêm na conta: selo "✓ já incluso", sem botão;
 *   MENTORES — plugáveis de verdade: "Contratar mentor" (Contratando… → Contratado ✓), saldo
 *   "2/3 contratados"; no teto o botão desabilita e o servidor também barra (403 em
 *   POST /api/mentors/plug). Contratou → usa no chat (MentorPill) E no coworking (@mention).
 * O que o crachá mostra (área, linha, entrega, redes, ativo, ordem) vem do Modo CEO → Agents.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cracha, { useHolofote } from "@/components/agents/Cracha";
import { montarVitrine, nativosVitrine, type AgenteVitrine, type PerfilPublico } from "@/lib/agents/nativos";
import { agentAvatars } from "@/lib/canal/flags";
import { VIDRO_BOLHA, TXT, TXT_2, TXT_MUDO } from "@/lib/canal/vidro";

type Mentor = {
  id: string | null; slug: string; course: string; name: string; emoji: string;
  signatureArtifacts: string[]; tagline?: string; guardrail?: string | null; degradedSkills?: string[];
  avatarUrl?: string | null;
};
type PlugState = "idle" | "plugging" | "plugged" | "error" | "teto";

// Skills que o runtime ainda não tem → o card mostra "em breve" (nunca erro). Rótulo humano por skill.
const SOON_LABEL: Record<string, string> = { molecule: "molécula 3D", literature: "busca de literatura", code: "código" };

export default function MentoresGrid({ search = "", nativos: mostrarNativos = true, mentores: mostrarMentores = true }: { search?: string; nativos?: boolean; mentores?: boolean }) {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [perfis, setPerfis] = useState<PerfilPublico[]>([]);
  const [plugged, setPlugged] = useState<Set<string>>(new Set());
  const [state, setState] = useState<Record<string, PlugState>>({});
  const [loading, setLoading] = useState(true);
  const [limite, setLimite] = useState<{ limit: number; count: number }>({ limit: 3, count: 0 });
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, p, av] = await Promise.all([
          fetch("/api/mentors").then((r) => (r.ok ? r.json() : [])).catch(() => []),
          fetch("/api/mentors/plugged").then((r) => (r.ok ? r.json() : { mentors: [] })).catch(() => ({ mentors: [] })),
          agentAvatars() ? fetch("/api/agents/public").then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null),
        ]);
        setMentors(Array.isArray(c) ? c : []);
        setPerfis(Array.isArray(av?.agentes) ? av.agentes : []);
        const ids = new Set<string>((p?.mentors ?? []).map((m: any) => String(m.id)));
        setPlugged(ids);
        setLimite({ limit: Number(p?.limit) || 3, count: Number.isFinite(p?.count) ? Number(p.count) : ids.size });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const noTeto = limite.count >= limite.limit;

  const plug = useCallback(async (m: Mentor) => {
    if (!m.id) return;
    setState((s) => ({ ...s, [m.id!]: "plugging" }));
    try {
      // slug é a chave pública dos mentores (o servidor resolve slug → template)
      const r = await fetch("/api/mentors/plug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: m.slug }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 403) {
        setAviso(j?.error || "Você chegou ao teto de mentores.");
        setLimite((l) => ({ limit: Number(j?.limit) || l.limit, count: Number.isFinite(j?.count) ? Number(j.count) : l.count }));
        setState((s) => ({ ...s, [m.id!]: "teto" }));
        setTimeout(() => setState((s) => ({ ...s, [m.id!]: "idle" })), 2200);
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      setPlugged((p) => new Set(p).add(m.id!));
      setLimite((l) => ({ limit: Number(j?.limit) || l.limit, count: Number.isFinite(j?.count) ? Number(j.count) : l.count + 1 }));
      setState((s) => ({ ...s, [m.id!]: "plugged" }));
      setAviso(null);
      try { window.dispatchEvent(new CustomEvent("zaeon:mentors:changed")); } catch { /* ignore */ }
    } catch {
      setState((s) => ({ ...s, [m.id!]: "error" }));
      setTimeout(() => setState((s) => ({ ...s, [m.id!]: "idle" })), 1800);
    }
  }, []);

  const unplug = useCallback(async (m: Mentor) => {
    if (!m.id) return;
    try {
      await fetch("/api/mentors/unplug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: m.slug }) });
      setPlugged((p) => { const n = new Set(p); n.delete(m.id!); return n; });
      setLimite((l) => ({ ...l, count: Math.max(0, l.count - 1) }));
      setState((s) => ({ ...s, [m.id!]: "idle" }));
      setAviso(null);
      try { window.dispatchEvent(new CustomEvent("zaeon:mentors:changed")); } catch { /* ignore */ }
    } catch { /* ignore */ }
  }, []);

  // perfis do Modo CEO aplicados (crachá, ativo, ordem) nos dois grupos
  const grupos = useMemo(() => montarVitrine(
    nativosVitrine(),
    mentors.map((m): AgenteVitrine => ({ slug: m.slug, name: m.name, course: m.course, tagline: m.tagline, signatureArtifacts: m.signatureArtifacts, emoji: m.emoji, guardrail: m.guardrail, avatarUrl: m.avatarUrl, tipo: "mentor" })),
    perfis,
  ), [mentors, perfis]);
  const busca = useCallback((v: AgenteVitrine) => {
    const q = search.trim().toLowerCase();
    return !q || `${v.name} ${v.course} ${v.slug}`.toLowerCase().includes(q);
  }, [search]);
  const nativosVis = useMemo(() => (mostrarNativos ? grupos.nativos.filter(busca) : []), [grupos, busca, mostrarNativos]);
  const visible = useMemo(() => {
    if (!mostrarMentores) return [];
    const porSlug = new Map(mentors.map((m) => [m.slug, m]));
    return grupos.mentores.filter(busca).map((v) => ({ v, m: porSlug.get(v.slug)! })).filter((x) => x.m);
  }, [grupos, busca, mentors, mostrarMentores]);
  const gradeNativos = useRef<HTMLDivElement>(null);
  const gradeMentores = useRef<HTMLDivElement>(null);
  const cenaN = useHolofote(gradeNativos, nativosVis.length, 5200);
  const cenaM = useHolofote(gradeMentores, visible.length, 5600);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className={`text-[10px] font-black uppercase tracking-[0.5em] ${TXT_MUDO}`}>Chamando os assistentes…</p>
      </div>
    );
  }
  if (!visible.length && !nativosVis.length) {
    return <div className={`py-16 text-center text-[11px] font-bold uppercase tracking-[0.3em] ${TXT_MUDO}`}>Nenhum assistente encontrado</div>;
  }

  const grade = "grid gap-x-6 gap-y-8 justify-items-center grid-cols-[repeat(auto-fill,minmax(262px,1fr))]";
  const idDe = (v: AgenteVitrine, i: number) => (v.tipo === "nativo" ? `ZA-N${String(v.order ?? i + 1).padStart(2, "0")}` : `ZA-${String(i + 1).padStart(3, "0")}`);

  return (
    <div className="flex flex-col gap-14">
      {nativosVis.length > 0 && (
        <section>
          <div className="flex flex-wrap items-baseline gap-3 mb-2 pl-1">
            <h2 className={`text-2xl font-black tracking-tighter ${TXT}`}>Nativos</h2>
            <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-700 dark:text-cyan-300">já inclusos na sua conta · cada um na sua sala</span>
          </div>
          <div ref={gradeNativos} className={grade}>
            {nativosVis.map((v, i) => (
              <div key={v.slug} className="dark">
                <Cracha
                  emCena={i === cenaN}
                  d={{ agentId: v.slug, nome: v.name, curso: v.course, tagline: v.tagline, artefatos: v.signatureArtifacts, emoji: v.emoji, foto: v.avatarUrl, id: idDe(v, i), rotulo: "nativo", redes: v.redes }}
                  acao={
                    <span className="flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl border border-emerald-400/40 bg-emerald-400/10 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                      ✓ já incluso
                    </span>
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {visible.length > 0 && (
        <section>
          <div className="flex flex-wrap items-baseline gap-3 mb-2 pl-1">
            <h2 className={`text-2xl font-black tracking-tighter ${TXT}`}>Mentores</h2>
            <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-700 dark:text-cyan-300">contrate · use no chat e no escritório</span>
            <span
              className={`ml-auto px-3 py-1 rounded-full text-[11px] font-black tabular-nums border ${noTeto ? "border-amber-400/60 text-amber-700 dark:text-amber-300 bg-amber-400/10" : "border-slate-200 dark:border-white/15 text-slate-700 dark:text-white/80 bg-white/60 dark:bg-white/[0.05]"}`}
              aria-live="polite"
            >
              {limite.count}/{limite.limit} contratados
            </span>
          </div>
          {aviso && <p role="alert" className="mb-4 pl-1 text-[12.5px] text-amber-700 dark:text-amber-300">{aviso}</p>}
          <div ref={gradeMentores} className={grade}>
            {visible.map(({ v, m }, i) => {
              const isPlugged = !!m.id && plugged.has(m.id);
              const st: PlugState = isPlugged ? "plugged" : (m.id ? state[m.id] ?? "idle" : "idle");
              const bloqueado = !isPlugged && noTeto;
              return (
                <div key={v.slug} className="dark">
                  <Cracha
                    emCena={i === cenaM}
                    d={{ agentId: v.slug, nome: v.name, curso: v.course, tagline: v.tagline, artefatos: v.signatureArtifacts, emoji: v.emoji, foto: v.avatarUrl, id: idDe(v, i), rotulo: "mentor", educacional: !!m.guardrail, redes: v.redes }}
                    acao={
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!m.id || st === "plugging" || st === "plugged" || bloqueado}
                            onClick={() => plug(m)}
                            title={bloqueado ? `Você já contratou seus ${limite.limit} mentores — solte um para contratar outro.` : undefined}
                            className={`flex-1 min-h-[40px] px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all disabled:cursor-default hover:scale-[1.02] active:scale-95 border
                              ${st === "plugged"
                                ? "bg-cyan-400/15 border-cyan-300/50 text-cyan-100"
                                : st === "error" || st === "teto"
                                  ? "bg-rose-400/15 border-rose-300/50 text-rose-100"
                                  : bloqueado
                                    ? "bg-white/[0.06] border-white/15 text-white/40"
                                    : "border-transparent bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_10px_30px_-12px_rgba(34,211,238,0.7)]"}`}
                          >
                            {st === "plugging" ? "Contratando…" : st === "plugged" ? "Contratado ✓" : st === "teto" ? "Teto atingido" : st === "error" ? "Falhou — tente de novo" : bloqueado ? `${limite.limit}/${limite.limit} — solte um` : "Contratar mentor"}
                          </button>
                          {isPlugged && (
                            <button type="button" onClick={() => unplug(m)} className="min-h-[40px] px-2 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-rose-300 transition-colors" title="Soltar o mentor (libera uma vaga)">
                              soltar
                            </button>
                          )}
                        </div>
                        {/* degradação graciosa: o que o runtime ainda não faz aparece como "em breve", nunca como erro */}
                        {!!m.degradedSkills?.length && (
                          <p className="text-[10px] text-white/50">
                            <span className="font-bold uppercase tracking-widest">em breve</span>
                            {" · "}{m.degradedSkills.map((sk) => SOON_LABEL[sk] ?? sk).join(", ")}
                          </p>
                        )}
                      </div>
                    }
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
