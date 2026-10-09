"use client";

/**
 * FrotaModule — "Deploy agents": a FROTA DE IAs do cyberespaço (lib/cyber/frota) no Modo CEO. O catálogo (700 de início,
 * nomes de gente de verdade, 60% mulheres / 40% homens), as chaves ON/OFF de cada comportamento (estudar nas
 * plataformas, no lounge, moto, andar, festa, corridas, conversas, cloak, mochila, responder usuários), a CRIAÇÃO EM
 * MASSA (um lote novo de N agentes — os que já existem não mudam) e o que cada uma está fazendo agora. Grava em
 * PUT /api/cyber/frota (só o dono); os clientes do cyberespaço leem a mesma config e calculam a frota pelo relógio.
 */
import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Plus, Rocket, Search, Trash2 } from "lucide-react";
import { gerarFrota } from "@/lib/cyber/frota/frota";
import { planejarDia } from "@/lib/cyber/frota/plano";
import { diaDe, fullNoDia, minutoDoDia, type FlagsFrota } from "@/lib/cyber/frota/agenda";
import { estadoDaIA } from "@/lib/cyber/frota/corpo";
import { CONFIG_PADRAO, LIMITES, novoLote, sanitizarConfig, totalDaFrota, type ConfigSalva } from "@/lib/cyber/frota/config";

const CHAVES: { k: keyof FlagsFrota; nome: string; desc: string }[] = [
  { k: "ativa", nome: "Frota ativa", desc: "Liga/desliga todas as IAs no cyberespaço." },
  { k: "estudoPlataforma", nome: "Estudar nas plataformas", desc: "Tablet na biblioteca, no jardim e nas universidades (~40% do dia)." },
  { k: "estudoLounge", nome: "Estudar no lounge", desc: "Tablet nos sofás do lounge, onde rola som (~20%)." },
  { k: "moto", nome: "Passear de moto", desc: "Visitar outros lugares do mapa (~30%)." },
  { k: "andar", nome: "Andar pela Zaeon", desc: "Passear pela cidadela (~10%)." },
  { k: "festa", nome: "Festa no lounge", desc: "O grupo vai junto à noite — só quando está rolando som." },
  { k: "corridas", nome: "Corridas de moto", desc: "Em dupla ou em bando, quando os intervalos dos amigos se cruzam." },
  { k: "conversas", nome: "Conversas", desc: "Entre amigos do mesmo grupo (4), quando estão juntos — até 8 falas." },
  { k: "cloak", nome: "Modo cloak", desc: "70% conversam só com \"...\" nos balões (o teor fica oculto)." },
  { k: "mochila", nome: "Mochila a jato", desc: "Ir de um lugar pro outro voando dentro da Zaeon." },
  { k: "responderUsuarios", nome: "Responder usuários", desc: "As sem cloak respondem seco e cortam se insistirem." },
];
const ATIVIDADE: Record<string, string> = { "estudo-plataforma": "📖 estudando", "estudo-lounge": "🎧 estudando no lounge", moto: "🏍️ de moto", andar: "🚶 andando", festa: "🪩 na festa" };
const POR_PAGINA = 40;

export default function FrotaModule({ glassPanel }: { glassPanel?: string }) {
  const [salva, setSalva] = useState<ConfigSalva | null>(null);
  const [cfg, setCfg] = useState<ConfigSalva>(CONFIG_PADRAO);
  const [carregando, setCarregando] = useState(true), [gravando, setGravando] = useState(false), [erro, setErro] = useState<string | null>(null);
  const [qtd, setQtd] = useState(100), [q, setQ] = useState(""), [pagina, setPagina] = useState(0), [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    let vivo = true;
    fetch("/api/cyber/frota").then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j?.config) { const c = sanitizarConfig(j.config); setSalva(c); setCfg(c); } }).catch(() => undefined).finally(() => vivo && setCarregando(false));
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const frota = useMemo(() => gerarFrota(cfg.frota), [cfg.frota]);
  const plano = useMemo(() => planejarDia(frota, diaDe(agora), cfg.flags, fullNoDia(diaDe(agora), cfg.modoFullAte)), [frota, cfg.flags, cfg.modoFullAte, agora]);
  const estados = useMemo(() => { const m = minutoDoDia(agora); return new Map(frota.map((a) => [a.id, estadoDaIA(a.id, plano.agentes.get(a.id)?.blocos ?? [], m, cfg.flags, false, false)])); }, [frota, plano, cfg.flags, agora]);
  const resumo = useMemo(() => {
    const f = frota.filter((a) => a.genero === "f").length, c = frota.filter((a) => a.cloak).length, on = [...estados.values()].filter((e) => e.visivel);
    return { total: frota.length, f, m: frota.length - f, cloak: c, grupos: new Set(frota.map((a) => a.grupo)).size, online: on.length, estudando: on.filter((e) => e.atividade?.startsWith("estudo")).length };
  }, [frota, estados]);
  const lista = useMemo(() => { const s = q.trim().toLowerCase(); return s ? frota.filter((a) => a.nome.toLowerCase().includes(s) || a.curso.toLowerCase().includes(s)) : frota; }, [frota, q]);
  const mudou = JSON.stringify({ ...cfg, versao: 0 }) !== JSON.stringify({ ...(salva ?? cfg), versao: 0 });

  async function implantar() {
    setGravando(true); setErro(null);
    try {
      const r = await fetch("/api/cyber/frota", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.config) throw new Error(j?.error || `erro ${r.status}`);
      const c = sanitizarConfig(j.config); setSalva(c); setCfg(c);
    } catch (e) { setErro(e instanceof Error ? e.message : "não gravou"); } finally { setGravando(false); }
  }
  const pct = (n: number) => (resumo.total ? Math.round((100 * n) / resumo.total) : 0);
  const card = `${glassPanel ?? ""} rounded-3xl p-5`;

  if (carregando) return <div className="flex h-64 items-center justify-center text-white/50"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  return (
    <div className="space-y-6 text-slate-800 dark:text-white">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight"><Bot className="h-6 w-6 text-cyan-400" />Deploy agents</h2>
          <p className="text-sm text-slate-500 dark:text-white/50">A frota de IAs que vive no cyberespaço como jogadores: estudam no tablet, andam de moto, vão pra festa e conversam com os amigos.</p>
        </div>
        <button onClick={implantar} disabled={!mudou || gravando} className="flex min-h-[44px] items-center gap-2 rounded-full bg-cyan-400 px-5 text-sm font-black uppercase tracking-wider text-slate-950 disabled:opacity-40">
          {gravando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}{mudou ? "Implantar" : "Implantado"}
        </button>
      </header>
      {erro && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">{erro}</p>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {[["Agentes", resumo.total], ["Mulheres", `${pct(resumo.f)}%`], ["Homens", `${pct(resumo.m)}%`], ["Em cloak", `${pct(resumo.cloak)}%`], ["Grupos de amigos", resumo.grupos], ["Online agora", resumo.online], ["Estudando agora", resumo.estudando]].map(([k, v]) => (
          <div key={k as string} className={card}><div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">{k}</div><div className="mt-1 text-2xl font-black tabular-nums">{v}</div></div>
        ))}
      </section>

      <section className={card}>
        <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Comportamentos</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {CHAVES.map(({ k, nome, desc }) => (
            <label key={k} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
              <input type="checkbox" role="switch" checked={cfg.flags[k]} onChange={(e) => setCfg({ ...cfg, flags: { ...cfg.flags, [k]: e.target.checked } })} className="mt-1 h-4 w-4 accent-cyan-400" />
              <span><span className="block text-sm font-bold">{nome} <span className={`ml-1 text-[10px] font-black ${cfg.flags[k] ? "text-emerald-400" : "text-slate-400"}`}>{cfg.flags[k] ? "ON" : "OFF"}</span></span><span className="block text-xs text-slate-500 dark:text-white/45">{desc}</span></span>
            </label>
          ))}
        </div>
      </section>

      <section className={card}>
        <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Criação em massa</h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">Quantidade <input type="number" min={1} max={LIMITES.loteMax} value={qtd} onChange={(e) => setQtd(Math.max(1, Math.min(LIMITES.loteMax, Number(e.target.value) || 1)))} className="ml-2 w-28 rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-white/15" /></label>
          <button onClick={() => setCfg(novoLote(cfg, qtd, Math.floor(Math.random() * 2 ** 30) + 1))} disabled={totalDaFrota(cfg) + qtd > LIMITES.totalMax} className="flex min-h-[40px] items-center gap-2 rounded-full border border-cyan-400/50 px-4 text-sm font-bold text-cyan-300 disabled:opacity-40"><Plus className="h-4 w-4" />Criar {qtd} agentes</button>
          <span className="text-xs text-slate-500 dark:text-white/45">Nomes de gente de verdade · 60% mulheres / 40% homens · 70% em cloak · grupos de {cfg.frota.tamanhoGrupo}. Máx. {LIMITES.totalMax} na frota.</span>
        </div>
        <ul className="mt-4 space-y-2">
          {cfg.frota.lotes.map((l, i) => (
            <li key={l.semente} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2 text-sm dark:border-white/10">
              <span>Lote {i + 1} · <b>{l.total}</b> agentes · {Math.round(l.fracaoMulheres * 100)}% mulheres · {Math.round(l.fracaoCloak * 100)}% cloak <span className="text-xs text-slate-400">(semente {l.semente})</span></span>
              <button aria-label={`Remover o lote ${i + 1}`} onClick={() => setCfg({ ...cfg, frota: { ...cfg.frota, lotes: cfg.frota.lotes.filter((_, k) => k !== i) } })} className="rounded-full p-2 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Catálogo ({lista.length})</h3>
          <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => { setQ(e.target.value); setPagina(0); }} placeholder="Buscar nome ou curso" aria-label="Buscar no catálogo" className="rounded-full border border-slate-300 bg-transparent py-2 pl-9 pr-4 text-sm dark:border-white/15" /></label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/40"><tr><th className="py-2">Nome</th><th>Gênero</th><th>Curso</th><th>Grupo</th><th>Cloak</th><th>Agora</th></tr></thead>
            <tbody>
              {lista.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((a) => {
                const e = estados.get(a.id);
                return (
                  <tr key={a.id} className="border-t border-slate-200/60 dark:border-white/5">
                    <td className="py-2 font-semibold"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: a.cor }} />{a.nome}</td>
                    <td>{a.genero === "f" ? "F" : "M"}</td><td className="text-slate-500 dark:text-white/60">{a.curso}</td><td className="tabular-nums">#{a.grupo + 1}</td>
                    <td>{a.cloak ? "…" : "—"}</td>
                    <td className="text-slate-500 dark:text-white/60">{e?.visivel ? `${ATIVIDADE[e.atividade ?? ""] ?? e.atividade}${e.ambiente ? ` · ${e.ambiente}` : ""}` : "offline"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0} className="rounded-full border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-white/15">‹</button>
          <span className="tabular-nums text-slate-500">{pagina + 1}/{Math.max(1, Math.ceil(lista.length / POR_PAGINA))}</span>
          <button onClick={() => setPagina((p) => (p + 1) * POR_PAGINA < lista.length ? p + 1 : p)} disabled={(pagina + 1) * POR_PAGINA >= lista.length} className="rounded-full border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-white/15">›</button>
        </div>
      </section>
    </div>
  );
}
