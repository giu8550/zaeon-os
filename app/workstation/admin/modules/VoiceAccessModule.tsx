import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SpeakerWaveIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

/**
 * VoiceAccessModule — controle HONESTO de consumo do modo voz na beta.
 *
 * Lista os perfis e deixa o admin LIBERAR/REVOGAR a voz neural por usuário
 * (User.advancedVoiceEnabled). A voz só liga pra quem está aqui marcado (+ super
 * admins). Fonte: GET /api/admin; toggle: PATCH /api/admin { userId, advancedVoiceEnabled }.
 */
interface Row {
  id: string;
  name: string;
  email: string;
  plan?: string;
  advancedVoiceEnabled?: boolean;
}

export default function VoiceAccessModule({ glassPanel }: { glassPanel: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) setRows(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchRows(); }, []);

  const enabledCount = useMemo(() => rows.filter((r) => r.advancedVoiceEnabled).length, [rows]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(t));
  }, [rows, q]);

  const toggleVoice = async (r: Row) => {
    const next = !r.advancedVoiceEnabled;
    setSavingId(r.id);
    // otimista
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, advancedVoiceEnabled: next } : x)));
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: r.id, advancedVoiceEnabled: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // reverte se falhar
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, advancedVoiceEnabled: !next } : x)));
      alert("Não consegui atualizar a voz deste usuário.");
    } finally { setSavingId(null); }
  };

  return (
    <div className={`flex-1 rounded-[45px] p-8 overflow-hidden flex flex-col ${glassPanel}`}>
      <div className="flex items-center gap-3 mb-1">
        <SpeakerWaveIcon className="w-6 h-6 text-cyan-500" />
        <h1 className="text-2xl font-black tracking-tighter text-slate-800 dark:text-white uppercase">Modo Voz</h1>
        <span className="ml-2 text-[10px] font-black uppercase tracking-widest bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 px-3 py-1 rounded-full">
          {enabledCount} liberado{enabledCount === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-[12px] text-slate-500 dark:text-white/40 mb-5 max-w-2xl leading-relaxed">
        Controle honesto de consumo: a voz neural (Kokoro) só funciona para os perfis liberados aqui
        (e super admins). Cada liberação custa processamento no servidor — libere com critério durante a beta.
      </p>

      <div className="relative mb-4 max-w-md">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="w-full pl-9 pr-3 py-2.5 rounded-2xl text-[12px] bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400/50"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
        {loading ? (
          <p className="text-center text-[12px] text-slate-400 py-10">Carregando perfis…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-[12px] text-slate-400 py-10">Nenhum perfil encontrado.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-800 dark:text-white truncate">{r.name || "Usuário"}</p>
                  <p className="text-[11px] text-slate-400 truncate font-mono">{r.email}</p>
                </div>
                {r.plan && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 border border-slate-200 dark:border-white/10 rounded-full px-2 py-0.5">
                    {r.plan}
                  </span>
                )}
                <button
                  onClick={() => toggleVoice(r)}
                  disabled={savingId === r.id}
                  role="switch"
                  aria-checked={!!r.advancedVoiceEnabled}
                  title={r.advancedVoiceEnabled ? "Revogar voz" : "Liberar voz"}
                  className={`relative shrink-0 w-14 h-8 rounded-full transition-colors disabled:opacity-50 ${r.advancedVoiceEnabled ? "bg-cyan-500" : "bg-slate-300 dark:bg-white/15"}`}
                >
                  <motion.span layout className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${r.advancedVoiceEnabled ? "translate-x-6" : ""}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
