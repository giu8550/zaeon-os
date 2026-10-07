"use client";

/**
 * MentoresGrid — a estrela da Plugin Store: os MENTORES (agentes de IA). Cards de vidro Apple
 * (claro === escuro) com o AVATAR do AgentProfile (fallback ⟁), nome, curso, artefatos e o
 * botão "Contratar mentor" (Contratando… → Contratado ✓). Saldo "2/3 contratados"; no teto o
 * botão desabilita e o servidor também barra (403 em POST /api/mentors/plug).
 * Contratou → usa no chat individual (MentorPill) E no coworking (lista de @mention do canal).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import AgentAvatar from "@/components/agents/AgentAvatar";
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

export default function MentoresGrid({ search = "" }: { search?: string }) {
  const [mentors, setMentors] = useState<Mentor[]>([]);
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
        const fotos = new Map<string, { avatarUrl: string | null; nome: string }>((av?.agentes ?? []).map((a: any) => [a.agentKey, { avatarUrl: a.avatarUrl ?? null, nome: a.nome }]));
        const lista: Mentor[] = (Array.isArray(c) ? c : []).map((m: Mentor) => { const f = fotos.get(m.slug); return f ? { ...m, avatarUrl: f.avatarUrl, name: f.nome || m.name } : m; });
        setMentors(lista);
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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? mentors.filter((m) => `${m.name} ${m.course} ${m.slug}`.toLowerCase().includes(q)) : mentors;
  }, [mentors, search]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className={`text-[10px] font-black uppercase tracking-[0.5em] ${TXT_MUDO}`}>Chamando os mentores…</p>
      </div>
    );
  }
  if (!visible.length) {
    return <div className={`py-16 text-center text-[11px] font-bold uppercase tracking-[0.3em] ${TXT_MUDO}`}>Nenhum mentor encontrado</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3 mb-5 pl-1">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((m) => {
          const isPlugged = !!m.id && plugged.has(m.id);
          const st: PlugState = isPlugged ? "plugged" : (m.id ? state[m.id] ?? "idle" : "idle");
          const bloqueado = !isPlugged && noTeto;
          return (
            // MESMAS CORES dos cards da landing (MentoresCarrossel): vidro PRETO nos dois temas
            // (`dark` força as variantes escuras), borda fina, acentos ciano e brilho ciano no hover.
            <motion.div
              key={m.slug}
              layout
              whileHover={{ y: -6 }}
              className="dark relative rounded-2xl"
            >
              <div className="relative h-full p-6 flex flex-col rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl transition-all duration-300 shadow-[0_16px_44px_-20px_rgba(0,0,0,0.75)] hover:border-cyan-500/50 hover:shadow-[0_18px_50px_-20px_rgba(34,211,238,0.45)]">
                <div className="flex items-start justify-between mb-5">
                  {/* avatar vivo do mentor (estúdio) → foto → o tile de emoji */}
                  <AgentAvatar
                    src={m.avatarUrl}
                    nome={m.name}
                    size={60}
                    emoji={m.emoji}
                    agentId={m.slug}
                    className="ring-2 ring-cyan-500/30"
                    fallback={
                      <div className="w-14 h-14 rounded-xl grid place-items-center text-2xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-300">
                        {m.emoji || "⟁"}
                      </div>
                    }
                  />
                  {m.guardrail && (
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/15 bg-white/60 dark:bg-white/10 ${TXT_MUDO}`} title={m.guardrail}>
                      educacional
                    </span>
                  )}
                </div>
                <h3 className={`text-2xl font-black tracking-tight leading-none ${TXT}`}>{m.name}</h3>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-200/90">{m.course}</p>
                {m.tagline && <p className={`mt-4 text-[13.5px] leading-relaxed line-clamp-3 ${TXT_2}`}>{m.tagline}</p>}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {m.signatureArtifacts?.slice(0, 3).map((a) => (
                    <span key={a} className={`px-2.5 py-1 rounded-full text-[11px] border border-slate-200 dark:border-white/15 bg-white/60 dark:bg-white/[0.07] ${TXT_2}`}>{a}</span>
                  ))}
                </div>
                {/* degradação graciosa: o que o runtime ainda não faz aparece como "em breve", nunca como erro */}
                {!!m.degradedSkills?.length && (
                  <p className={`mt-2.5 text-[10.5px] ${TXT_MUDO}`}>
                    <span className="font-bold uppercase tracking-widest">em breve</span>
                    {" · "}{m.degradedSkills.map((s) => SOON_LABEL[s] ?? s).join(", ")}
                  </p>
                )}
                <div className="mt-auto pt-6 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={!m.id || st === "plugging" || st === "plugged" || bloqueado}
                    onClick={() => plug(m)}
                    title={bloqueado ? `Você já contratou seus ${limite.limit} mentores — solte um para contratar outro.` : undefined}
                    className={`flex-1 min-h-[44px] px-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all disabled:cursor-default hover:scale-[1.02] active:scale-95 border
                      ${st === "plugged"
                        ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-700 dark:bg-cyan-400/15 dark:border-cyan-300/50 dark:text-cyan-100"
                        : st === "error" || st === "teto"
                          ? "bg-rose-500/15 border-rose-500/50 text-rose-700 dark:bg-rose-400/15 dark:border-rose-300/50 dark:text-rose-100"
                          : bloqueado
                            ? "bg-slate-200/60 border-slate-300 text-slate-500 dark:bg-white/[0.06] dark:border-white/15 dark:text-white/40"
                            : "border-transparent bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_10px_30px_-12px_rgba(34,211,238,0.7)]"}`}
                  >
                    {st === "plugging" ? "Contratando…" : st === "plugged" ? "Contratado ✓" : st === "teto" ? "Teto atingido" : st === "error" ? "Falhou — tente de novo" : bloqueado ? `${limite.limit}/${limite.limit} — solte um` : "Contratar mentor"}
                  </button>
                  {isPlugged && (
                    <button type="button" onClick={() => unplug(m)} className={`min-h-[44px] px-2 text-[10px] font-bold uppercase tracking-widest ${TXT_MUDO} hover:text-rose-600 dark:hover:text-rose-300 transition-colors`} title="Soltar o mentor (libera uma vaga)">
                      soltar
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
