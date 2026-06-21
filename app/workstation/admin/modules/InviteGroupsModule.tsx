"use client";

/**
 * InviteGroupsModule — grupos de convite no dashboard admin.
 * Mostra cada CONVIDADOR e quem ele trouxe (gateway de novos usuários), pra a
 * estratégia de Plus em GRUPO mais barato. Dados: GET /api/admin/groups.
 */
import { useEffect, useMemo, useState } from "react";
import { Users, ChevronDown, Crown, Loader2, Search, Mail } from "lucide-react";

interface Member { id: string; name: string; email: string; plan: string; joinedAt?: string }
interface Group {
  ownerId: string; ownerName: string; ownerEmail: string; ownerPlan: string;
  code: string | null; usedCount: number; maxUses: number; members: Member[];
}

function PlanBadge({ plan }: { plan: string }) {
  const p = (plan || "free").toLowerCase();
  const c = p === "pro" ? "bg-violet-500/15 text-violet-300 border-violet-400/30"
    : p === "plus" ? "bg-cyan-500/15 text-cyan-300 border-cyan-400/30"
    : "bg-white/5 text-white/50 border-white/10";
  return <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${c}`}>{p}</span>;
}

export default function InviteGroupsModule({ glassPanel }: { glassPanel?: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState({ totalGroups: 0, totalInvited: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/groups")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) { setGroups(d.groups || []); setStats({ totalGroups: d.totalGroups || 0, totalInvited: d.totalInvited || 0 }); } })
      .catch(() => { /* offline */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;
    return groups.filter((g) =>
      g.ownerName.toLowerCase().includes(s) || g.ownerEmail.toLowerCase().includes(s) ||
      (g.code || "").toLowerCase().includes(s) ||
      g.members.some((m) => m.name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s)),
    );
  }, [groups, q]);

  const panel = glassPanel || "rounded-3xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl";

  return (
    <div className="w-full h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users size={22} className="text-cyan-500" /> Grupos de convite
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-white/45 mt-0.5">
            {stats.totalGroups} convidadores · {stats.totalInvited} convidados — base p/ o Plus em grupo.
          </p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, e-mail ou código…"
            className="rounded-xl pl-9 pr-3 py-2 text-[12px] w-64 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 dark:bg-white/5 dark:text-white dark:placeholder:text-white/25 dark:border-white/10" />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-white/40 gap-2"><Loader2 size={18} className="animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-white/30 text-[13px]">Nenhum grupo de convite ainda.</div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-3 pr-1">
          {filtered.map((g) => {
            const isOpen = !!open[g.ownerId];
            const full = g.usedCount >= g.maxUses;
            return (
              <div key={g.ownerId} className={`${panel} p-4`}>
                <button onClick={() => setOpen((o) => ({ ...o, [g.ownerId]: !o[g.ownerId] }))} className="w-full flex items-center gap-3 text-left">
                  <span className="w-10 h-10 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 flex items-center justify-center font-black shrink-0">
                    {g.ownerName.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{g.ownerName}</span>
                      <PlanBadge plan={g.ownerPlan} />
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-white/40 truncate">{g.ownerEmail}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className={`text-[12px] font-black ${full ? "text-amber-500" : "text-cyan-600 dark:text-cyan-300"}`}>{g.usedCount}/{g.maxUses}</span>
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400 dark:text-white/30">convidados</span>
                  </span>
                  <ChevronDown size={16} className={`text-slate-400 dark:text-white/30 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {g.code && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-white/30">código</span>
                    <span className="font-mono text-[11px] tracking-widest text-slate-700 dark:text-white/70 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">{g.code}</span>
                  </div>
                )}

                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10 flex flex-col gap-1.5">
                    {g.members.map((m) => (
                      <div key={m.id} className="flex items-center gap-2">
                        <Mail size={12} className="text-slate-400 dark:text-white/30 shrink-0" />
                        <span className="text-[12px] text-slate-700 dark:text-white/75 truncate flex-1">{m.name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-white/35 truncate hidden sm:block">{m.email}</span>
                        <PlanBadge plan={m.plan} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
