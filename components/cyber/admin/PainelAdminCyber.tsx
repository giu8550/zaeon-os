"use client";

/**
 * PainelAdminCyber — o MODO ADMIN dentro do cyberespaço (só super admin): o contador BOTS × USUÁRIOS REAIS (no total e em
 * cada área do mapa, ao vivo) e os controles por área da frota (components/cyber/admin/ControlesAreasFrota). "Aplicar"
 * grava a config (PUT /api/cyber/frota — o mesmo do Modo CEO) e replaneja na hora aqui; os outros clientes pegam a nova
 * versão em até 1 minuto (components/cyber/engine `recarregarFrota`).
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { isSuperAdmin } from "@/lib/auth/roles";
import { sanitizarConfig, type ConfigSalva } from "@/lib/cyber/frota/config";
import type { AreasFrota } from "@/lib/cyber/frota/agenda";
import type { AreaId } from "@/lib/cyber/frota/areas";
import ControlesAreasFrota, { TabelaAreas } from "./ControlesAreasFrota";

export type ContagemAdmin = { bots: number; usuarios: number; areas: Record<AreaId, { bots: number; usuarios: number }> };

type Props = { contagem: () => ContagemAdmin | null; aplicada: () => void };
/** o botão + o painel — só aparece pra super admin (a sessão decide; o PUT confere de novo no servidor) */
export default function PainelAdminCyber(props: Props) {
  const { data } = useSession();
  return isSuperAdmin({ email: data?.user?.email, role: (data?.user as { role?: string } | undefined)?.role }) ? <PainelAdmin {...props} /> : null;
}

export function PainelAdmin({ contagem, aplicada }: Props) {
  const [aberto, setAberto] = useState(false);
  const [c, setC] = useState<ContagemAdmin | null>(null);
  const [cfg, setCfg] = useState<ConfigSalva | null>(null), [rascunho, setRascunho] = useState<AreasFrota | null>(null);
  const [estado, setEstado] = useState<"" | "gravando" | "ok" | "erro">("");

  // o contador: a cada segundo (sempre que o painel está aberto)
  useEffect(() => {
    setC(contagem());
    const t = setInterval(() => setC(contagem()), 1000);
    return () => clearInterval(t);
  }, [contagem]);
  // a config atual (pra editar só as áreas e gravar o resto como está)
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    fetch("/api/cyber/frota", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j?.config) { const s = sanitizarConfig(j.config); setCfg(s); setRascunho(s.areas); } }).catch(() => undefined);
    return () => { vivo = false; };
  }, [aberto]);
  const mudou = !!cfg && !!rascunho && JSON.stringify(cfg.areas) !== JSON.stringify(rascunho);
  async function aplicar() {
    if (!cfg || !rascunho) return;
    setEstado("gravando");
    try {
      const r = await fetch("/api/cyber/frota", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cfg, areas: rascunho }) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.config) throw new Error();
      const s = sanitizarConfig(j.config); setCfg(s); setRascunho(s.areas); setEstado("ok"); aplicada();
    } catch { setEstado("erro"); }
  }

  return (
    <div className="relative">
      <button type="button" aria-expanded={aberto} aria-label="Modo admin: bots e usuários" onClick={() => setAberto((v) => !v)} className="flex h-[44px] items-center gap-2 rounded-full border border-amber-300/40 bg-black/55 px-3 text-xs font-semibold text-amber-100 backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
        <span aria-hidden>🛠</span>
        <span className="tabular-nums">🤖 {c?.bots ?? "…"} · 👤 {c?.usuarios ?? "…"}</span>
      </button>
      {aberto && (
        <div className="absolute right-0 top-[52px] z-30 max-h-[calc(100vh-90px)] w-[min(92vw,420px)] overflow-y-auto rounded-2xl border border-white/15 bg-[#070c22]/92 p-4 text-white/90 backdrop-blur">
          <h3 className="text-sm font-black tracking-tight">Modo admin · frota de IAs</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 p-2"><div className="text-[10px] font-black uppercase tracking-widest text-white/50">Bots online</div><div className="text-2xl font-black tabular-nums">{c?.bots ?? "…"}</div></div>
            <div className="rounded-xl border border-white/10 p-2"><div className="text-[10px] font-black uppercase tracking-widest text-white/50">Usuários reais</div><div className="text-2xl font-black tabular-nums">{c?.usuarios ?? "…"}</div></div>
          </div>
          <p className="mt-2 text-[11px] text-white/45">Usuários = você + quem a sala te mostra agora. Bots = a frota inteira (todo cliente vê a mesma).</p>
          {c && <div className="mt-3"><TabelaAreas linhas={c.areas} /></div>}
          <hr className="my-4 border-white/10" />
          {rascunho ? <ControlesAreasFrota areas={rascunho} onChange={(a) => { setRascunho(a); setEstado(""); }} /> : <p className="text-xs text-white/50">Carregando a config…</p>}
          <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-2 bg-[#070c22]/95 py-2">
            <span role="status" className="text-[11px] text-white/55">{estado === "gravando" ? "Gravando…" : estado === "ok" ? "Aplicado — os outros veem em até 1 min." : estado === "erro" ? "Não gravou (só o dono pode)." : mudou ? "Alterações não aplicadas" : ""}</span>
            <button type="button" onClick={aplicar} disabled={!mudou || estado === "gravando"} className="min-h-[40px] rounded-full bg-amber-300 px-4 text-xs font-black uppercase tracking-wider text-slate-950 disabled:opacity-40">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}
