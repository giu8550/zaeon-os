"use client";

/**
 * MentoresGrid — a categoria "Mentores" da Plugin Store. Cards liquid-glass (fundo
 * rgba(22,22,34,0.55), blur 40, raio 22, gradiente #8b5cf6→#22d3ee) com ⟁ + nome + curso +
 * artefatos assinatura e o botão "Plugar no chat" (Plugar → Plugando… → Plugado ✓).
 * Plugar = POST /api/mentors/plug; o mentor passa a aparecer no seletor ⟁ do chat.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type Mentor = {
  id: string | null; slug: string; course: string; name: string; emoji: string;
  signatureArtifacts: string[]; tagline?: string; guardrail?: string | null; degradedSkills?: string[];
};
type PlugState = "idle" | "plugging" | "plugged" | "error";

// Skills que o runtime ainda não tem → o card mostra "em breve" (nunca erro). Rótulo humano por skill.
const SOON_LABEL: Record<string, string> = { molecule: "molécula 3D", literature: "busca de literatura", code: "código" };

const GLASS: React.CSSProperties = {
  background: "rgba(22,22,34,0.55)",
  backdropFilter: "blur(40px)",
  WebkitBackdropFilter: "blur(40px)",
  borderRadius: 22,
};

export default function MentoresGrid({ search = "" }: { search?: string }) {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [plugged, setPlugged] = useState<Set<string>>(new Set());
  const [state, setState] = useState<Record<string, PlugState>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, p] = await Promise.all([
          fetch("/api/mentors").then((r) => (r.ok ? r.json() : [])).catch(() => []),
          fetch("/api/mentors/plugged").then((r) => (r.ok ? r.json() : { mentors: [] })).catch(() => ({ mentors: [] })),
        ]);
        setMentors(Array.isArray(c) ? c : []);
        setPlugged(new Set((p?.mentors ?? []).map((m: any) => String(m.id))));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const plug = useCallback(async (m: Mentor) => {
    if (!m.id) return;
    setState((s) => ({ ...s, [m.id!]: "plugging" }));
    try {
      // slug é a chave pública dos mentores (o servidor resolve slug → template)
      const r = await fetch("/api/mentors/plug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: m.slug }) });
      if (!r.ok) throw new Error(String(r.status));
      setPlugged((p) => new Set(p).add(m.id!));
      setState((s) => ({ ...s, [m.id!]: "plugged" }));
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
      setState((s) => ({ ...s, [m.id!]: "idle" }));
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
        <div className="inline-block w-8 h-8 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Chamando os mentores…</p>
      </div>
    );
  }
  if (!visible.length) {
    return <div className="py-16 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-white/30">Nenhum mentor encontrado</div>;
  }

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-5 pl-1">
        <h2 className="text-2xl font-black tracking-tighter text-slate-950 dark:text-white">Mentores</h2>
        <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-violet-500 dark:text-violet-300">plugue no chat · a Aura fala com a voz da sua área</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((m) => {
          const isPlugged = !!m.id && plugged.has(m.id);
          const st: PlugState = isPlugged ? "plugged" : (m.id ? state[m.id] ?? "idle" : "idle");
          return (
            <motion.div
              key={m.slug}
              layout
              whileHover={{ y: -6 }}
              className="relative p-[1.5px] overflow-hidden"
              style={{ borderRadius: 22, background: "linear-gradient(135deg,#8b5cf6,#22d3ee)" }}
            >
              <div className="relative h-full p-6 flex flex-col text-white" style={GLASS}>
                {/* brilho especular */}
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.35),rgba(34,211,238,0.35))", filter: "drop-shadow(0 0 6px rgba(34,211,238,0.5))" }}
                  >
                    {m.emoji || "⟁"}
                  </div>
                  {m.guardrail && (
                    <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-white/70" title={m.guardrail}>
                      educacional
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-black tracking-tight leading-none">{m.name}</h3>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-200/90">{m.course}</p>
                {m.tagline && <p className="mt-4 text-[13.5px] leading-relaxed text-white/75 line-clamp-3">{m.tagline}</p>}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {m.signatureArtifacts?.slice(0, 3).map((a) => (
                    <span key={a} className="px-2.5 py-1 rounded-full text-[11px] bg-white/[0.07] border border-white/15 text-white/80">{a}</span>
                  ))}
                </div>
                {/* degradação graciosa: o que o runtime ainda não faz aparece como "em breve", nunca como erro */}
                {!!m.degradedSkills?.length && (
                  <p className="mt-2.5 text-[10.5px] text-white/45">
                    <span className="font-bold uppercase tracking-widest text-white/35">em breve</span>
                    {" · "}{m.degradedSkills.map((s) => SOON_LABEL[s] ?? s).join(", ")}
                  </p>
                )}
                <div className="mt-auto pt-6 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={!m.id || st === "plugging" || st === "plugged"}
                    onClick={() => plug(m)}
                    className="flex-1 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all disabled:cursor-default hover:scale-[1.02] active:scale-95"
                    style={
                      st === "plugged"
                        ? { background: "rgba(34,211,238,0.18)", border: "1px solid rgba(34,211,238,0.5)", color: "#a5f3fc" }
                        : st === "error"
                          ? { background: "rgba(244,63,94,0.2)", border: "1px solid rgba(244,63,94,0.5)", color: "#fecdd3" }
                          : { background: "linear-gradient(135deg,#8b5cf6,#22d3ee)", color: "#fff", opacity: m.id ? 1 : 0.5 }
                    }
                  >
                    {st === "plugging" ? "Plugando…" : st === "plugged" ? "Plugado ✓" : st === "error" ? "Falhou — tente de novo" : "Plugar no chat"}
                  </button>
                  {isPlugged && (
                    <button type="button" onClick={() => unplug(m)} className="text-[10px] font-bold uppercase tracking-widest text-white/45 hover:text-rose-300 transition-colors" title="Remover do chat">
                      desplugar
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
