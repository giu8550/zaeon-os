"use client";

/**
 * CarteiraInventario — a CARTEIRA dentro do inventário (lib/cyber/carteira; saldos em app/api/cyber/carteira): cada
 * moeda é um ITEM (a moeda cunhada na cor do token, a quantidade embaixo), a AURA da Zaeon primeiro. Conecta a Phantom
 * ou a Solflare (só o endereço — nada é assinado aqui) e mostra também a carteira que a Zaeon criou no login. O
 * inspetor da moeda: a quantidade, o valor em dólar, a variação, e os botões de TROCAR (na Jupiter, com a carteira da
 * pessoa) e de conferir no Solscan. A AURA se GANHA estudando (ainda não se troca).
 */
import { useCallback, useEffect, useState } from "react";
import { fmtPreco } from "@/lib/cyber/mercado";
import { encurtar, fmtDolar, fmtQuantidade, linkDeTroca, linkDoSolscan, totalEmDolar, type MoedaCarteira } from "@/lib/cyber/carteira";

export type CarteiraLida = { tipo: "conectada" | "zaeon"; endereco: string; rede: "mainnet" | "devnet"; moedas: MoedaCarteira[]; total: number; /** tokens desconhecidos escondidos (spam de airdrop) */ ocultos?: number };
export type EstadoCarteira = { aura: MoedaCarteira | null; carteiras: CarteiraLida[]; carregando: boolean; erro: string | null; conectado: string | null };

// ── a carteira do NAVEGADOR (Phantom / Solflare): só pedimos o endereço ──
type Provedor = { connect(o?: { onlyIfTrusted?: boolean }): Promise<{ publicKey?: { toString(): string } } | void>; disconnect?(): Promise<void>; publicKey?: { toString(): string } | null; isPhantom?: boolean; isSolflare?: boolean };
type JanelaComCarteira = Window & { phantom?: { solana?: Provedor }; solana?: Provedor; solflare?: Provedor };
const CHAVE = "zaeon:carteira-conectada";
export function provedores(): { nome: "Phantom" | "Solflare"; p: Provedor }[] {
  if (typeof window === "undefined") return [];
  const w = window as JanelaComCarteira, out: { nome: "Phantom" | "Solflare"; p: Provedor }[] = [];
  const ph = w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : undefined); if (ph) out.push({ nome: "Phantom", p: ph });
  if (w.solflare) out.push({ nome: "Solflare", p: w.solflare });
  return out;
}
const lerSalvo = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
const salvar = (v: string | null) => { try { if (v) localStorage.setItem(CHAVE, v); else localStorage.removeItem(CHAVE); } catch { /* sem storage */ } };

/** lê a carteira quando o inventário abre (e quando conecta/desconecta) */
export function useCarteira(aberto: boolean) {
  const [st, setSt] = useState<EstadoCarteira>({ aura: null, carteiras: [], carregando: false, erro: null, conectado: null });
  const ler = useCallback((endereco: string | null) => {
    setSt((s) => ({ ...s, carregando: true, erro: null, conectado: endereco }));
    fetch(`/api/cyber/carteira${endereco ? `?endereco=${encodeURIComponent(endereco)}` : ""}`, { cache: "no-store" })
      .then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }))
      .then(({ ok, status, j }) => setSt((s) => ok ? { ...s, carregando: false, aura: j.aura ?? null, carteiras: j.carteiras ?? [] } : { ...s, carregando: false, erro: status === 401 ? "Entre na sua conta pra ver a carteira." : (j.error ?? "Não deu pra ler a carteira agora.") }))
      .catch(() => setSt((s) => ({ ...s, carregando: false, erro: "Sem conexão com a rede agora." })));
  }, []);
  useEffect(() => { if (aberto) ler(lerSalvo()); }, [aberto, ler]);
  const conectar = useCallback(async (p: Provedor) => {
    try { const r = await p.connect(); const pk = (r && "publicKey" in r ? r.publicKey : null) ?? p.publicKey; const end = pk?.toString() ?? null; if (end) { salvar(end); ler(end); } }
    catch { setSt((s) => ({ ...s, erro: "A conexão foi recusada na carteira." })); }
  }, [ler]);
  const desconectar = useCallback(() => { for (const { p } of provedores()) p.disconnect?.().catch(() => {}); salvar(null); ler(null); }, [ler]);
  return { ...st, conectar, desconectar, recarregar: () => ler(st.conectado) };
}

/** a MOEDA cunhada (o ícone): o disco na cor do token, o aro serrilhado, o brilho e o símbolo — o SOL com as três
 *  faixas, a AURA com o olho da Zaeon */
export function IconeMoeda({ m, tam = 44 }: { m: Pick<MoedaCarteira, "simbolo" | "cor" | "rede">; tam?: number }) {
  const id = `g-${m.simbolo.replace(/[^A-Za-z0-9]/g, "")}-${tam}`, cor = m.cor;
  return (
    <svg width={tam} height={tam} viewBox="0 0 48 48" aria-hidden style={{ filter: `drop-shadow(0 0 5px ${cor}66)` }}>
      <defs>
        <radialGradient id={id} cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#ffffff" stopOpacity=".55" /><stop offset=".35" stopColor={cor} /><stop offset="1" stopColor="#05070d" /></radialGradient>
      </defs>
      {Array.from({ length: 28 }, (_, k) => { const a = (k / 28) * Math.PI * 2; return <line key={k} x1={24 + Math.cos(a) * 21} y1={24 + Math.sin(a) * 21} x2={24 + Math.cos(a) * 23} y2={24 + Math.sin(a) * 23} stroke={cor} strokeOpacity=".7" strokeWidth="1.1" />; })}
      <circle cx="24" cy="24" r="20.5" fill={`url(#${id})`} stroke={cor} strokeWidth="1.2" />
      <circle cx="24" cy="24" r="16.5" fill="none" stroke="#ffffff" strokeOpacity=".22" strokeWidth=".8" />
      {m.simbolo === "SOL" ? (
        <g transform="translate(13.5 15.5)">{[0, 6.5, 13].map((y, k) => <path key={y} d={k === 1 ? `M3 ${y} H21 L18 ${y + 4} H0 Z` : `M0 ${y} H18 L21 ${y + 4} H3 Z`} fill="#fff" fillOpacity=".92" />)}</g>
      ) : m.rede === "zaeon" ? (
        <g><path d="M10 24 Q24 12 38 24 Q24 36 10 24 Z" fill="none" stroke="#fff" strokeWidth="1.6" /><circle cx="24" cy="24" r="4.2" fill="#fff" /><circle cx="24" cy="24" r="1.8" fill={cor} /></g>
      ) : (
        <text x="24" y={m.simbolo.length > 4 ? 27 : 28.5} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontWeight="900" fontSize={m.simbolo.length > 4 ? 8.5 : m.simbolo.length > 3 ? 10 : 12} fill="#fff">{m.simbolo.slice(0, 6)}</text>
      )}
    </svg>
  );
}

/** a BOLSA no cabeçalho do inventário: a AURA e o total em dólar das carteiras */
export function BolsaCabecalho({ aura, carteiras }: Pick<EstadoCarteira, "aura" | "carteiras">) {
  const total = totalEmDolar(carteiras.flatMap((c) => c.moedas));
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <div className="flex items-center gap-1.5 rounded-full border border-cyan-200/25 bg-black/40 py-0.5 pl-0.5 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
        <IconeMoeda m={{ simbolo: "AURA", cor: "#7fe8ff", rede: "zaeon" }} tam={24} />
        <span className="text-[12px] font-black tabular-nums text-cyan-50">{aura ? fmtQuantidade(aura.quantidade) : "—"}</span>
      </div>
      {carteiras.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-full border border-violet-300/25 bg-black/40 py-0.5 pl-0.5 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
          <IconeMoeda m={{ simbolo: "SOL", cor: "#9945ff", rede: "solana" }} tam={24} />
          <span className="text-[12px] font-black tabular-nums text-violet-50">{fmtDolar(total)}</span>
        </div>
      )}
    </div>
  );
}

/** o cabeçalho de UMA carteira na grade (qual é, o endereço, o total e o desconectar) */
function CabecaCarteira({ c, onDesconectar }: { c: CarteiraLida; onDesconectar?: () => void }) {
  return (
    <div className="col-span-full mb-0.5 mt-2 flex items-center gap-2 border-b border-white/10 pb-1.5 first:mt-0">
      <span className="rounded-sm px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-[0.18em]" style={{ background: c.tipo === "conectada" ? "#9945ff33" : "#7fe8ff22", color: c.tipo === "conectada" ? "#d6c2ff" : "#bff4ff" }}>{c.tipo === "conectada" ? "Sua carteira" : "Carteira Zaeon"}</span>
      <a href={linkDoSolscan(c.endereco, c.rede)} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-sky-100/60 hover:text-white">{encurtar(c.endereco)}</a>
      {c.rede === "devnet" && <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-200/70">devnet</span>}
      <span className="ml-auto text-[12px] font-black tabular-nums">{fmtDolar(c.total)}</span>
      {onDesconectar && <button type="button" onClick={onDesconectar} className="text-[10.5px] text-white/40 hover:text-rose-200">desconectar</button>}
    </div>
  );
}

/** a GRADE da carteira: a AURA, as moedas de cada carteira e — sem carteira conectada — os botões de conectar */
export function GradeCarteira({ est, sel, onSel, conectar, desconectar }: { est: EstadoCarteira; sel: string | null; onSel: (id: string) => void; conectar: (p: Provedor) => void; desconectar: () => void }) {
  const provs = provedores(), conectada = est.carteiras.find((c) => c.tipo === "conectada");
  // (o id de cada moeda no inventário leva a carteira na frente — a mesma moeda pode estar nas duas)
  const tile = (m: MoedaCarteira, dono?: CarteiraLida["tipo"]) => {
    const id = dono ? `${dono}:${m.id}` : m.id, on = sel === id;
    return (
      <button key={id} type="button" onClick={() => onSel(id)} aria-pressed={on} aria-label={`${m.simbolo}: ${fmtQuantidade(m.quantidade)}`} title={m.nome}
        className={`tile-inv relative grid aspect-square w-full place-items-center rounded-lg transition-transform ${on ? "scale-[1.04]" : "hover:scale-[1.03]"}`}
        style={{ ["--c" as string]: m.cor, borderColor: `${m.cor}${on ? "ee" : "66"}`, boxShadow: on ? `0 0 18px -2px ${m.cor}, inset 0 0 14px -4px ${m.cor}` : undefined }}>
        <IconeMoeda m={m} tam={40} />
        <span className="absolute inset-x-1 bottom-0.5 truncate text-center text-[9.5px] font-black tabular-nums text-white/85">{fmtQuantidade(m.quantidade)}</span>
        {m.var24h !== null && <span className={`absolute right-1 top-0.5 text-[8.5px] font-black ${m.var24h >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{m.var24h >= 0 ? "▲" : "▼"}</span>}
      </button>
    );
  };
  return (
    <div className="grid grid-cols-5 gap-2">
      {est.aura && <><div className="col-span-full mb-0.5 flex items-center gap-2 border-b border-white/10 pb-1.5"><span className="rounded-sm bg-cyan-300/15 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-[0.18em] text-cyan-100">Moeda da Zaeon</span><span className="text-[11px] text-sky-100/50">ganha estudando</span></div>{tile(est.aura)}</>}
      {est.carteiras.map((c) => [<CabecaCarteira key={`h:${c.endereco}`} c={c} onDesconectar={c.tipo === "conectada" ? desconectar : undefined} />, ...(c.moedas.length ? c.moedas.map((m) => tile(m, c.tipo)) : [<p key={`v:${c.endereco}`} className="col-span-full text-[11.5px] text-sky-100/45">Nenhuma moeda nessa carteira ainda.</p>]),
        ...(c.ocultos ? [<p key={`o:${c.endereco}`} className="col-span-full text-[11px] text-sky-100/40">+{c.ocultos.toLocaleString("pt-BR")} tokens desconhecidos escondidos (geralmente spam de airdrop — não interaja com eles).</p>] : [])])}
      {!conectada && (
        <div className="col-span-full mt-2 rounded-xl border border-dashed border-violet-300/30 bg-violet-400/[0.05] p-3">
          <p className="text-[12px] font-bold text-violet-100">Conecte sua carteira da Solana</p>
          <p className="mt-0.5 text-[11px] leading-snug text-violet-100/55">Só lemos o endereço e os saldos — nada é assinado sem você aprovar na carteira.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {provs.length ? provs.map(({ nome, p }) => (
              <button key={nome} type="button" onClick={() => conectar(p)} className="rounded-full bg-gradient-to-b from-violet-300 to-violet-500 px-4 py-1.5 text-[11.5px] font-black uppercase tracking-wider text-slate-950">{nome}</button>
            )) : <span className="text-[11px] text-violet-100/45">Nenhuma carteira no navegador. Instale a <a className="underline" href="https://phantom.com/" target="_blank" rel="noreferrer">Phantom</a> ou a <a className="underline" href="https://solflare.com/" target="_blank" rel="noreferrer">Solflare</a>.</span>}
          </div>
        </div>
      )}
      {est.carregando && <p className="col-span-full text-[11px] text-sky-100/40">lendo a rede…</p>}
      {est.erro && <p role="alert" className="col-span-full text-[11.5px] text-rose-300">{est.erro}</p>}
    </div>
  );
}

/** o INSPETOR de uma moeda */
export function InspetorMoeda({ m, endereco }: { m: MoedaCarteira; endereco: string | null }) {
  const sobe = (m.var24h ?? 0) >= 0;
  return (
    <>
      <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: m.cor }}>{m.rede === "zaeon" ? "Moeda da Zaeon" : "Moeda · Solana"}</div>
      <h3 className="mt-0.5 text-[16px] font-black leading-snug">{m.nome}</h3>
      <div className="relative my-3 grid place-items-center overflow-hidden rounded-lg border py-5" style={{ borderColor: `${m.cor}33`, background: `radial-gradient(circle at 50% 45%, ${m.cor}30, transparent 65%), repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 4px)` }}>
        <div className="moeda-gira"><IconeMoeda m={m} tam={112} /></div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-center text-[11px]">
        <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Quantidade</dt><dd className="text-sm font-black tabular-nums">{fmtQuantidade(m.quantidade)} <span className="text-[10px] text-white/50">{m.simbolo}</span></dd></div>
        <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Valor</dt><dd className="text-sm font-black tabular-nums">{m.valor !== null ? fmtDolar(m.valor) : "—"}</dd></div>
        <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Preço</dt><dd className="text-sm font-black tabular-nums">{m.usd !== null ? fmtPreco(m.usd) : "—"}</dd></div>
        <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">24h</dt><dd className={`text-sm font-black tabular-nums ${m.var24h === null ? "" : sobe ? "text-emerald-300" : "text-rose-300"}`}>{m.var24h === null ? "—" : `${sobe ? "+" : ""}${m.var24h.toFixed(2)}%`}</dd></div>
      </dl>
      {m.rede === "zaeon" ? (
        <p className="mt-3 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-2.5 py-2 text-[11.5px] leading-snug text-cyan-50/85">A AURA se ganha estudando: aprender, aplicar e ter o estudo validado. Ainda não dá pra trocar — fica guardada aqui.</p>
      ) : (
        <>
          {m.mint && <a href={linkDeTroca(m.mint)} target="_blank" rel="noreferrer" className="mt-3 flex min-h-[40px] w-full items-center justify-center rounded-full text-xs font-black uppercase tracking-widest text-slate-950" style={{ background: `linear-gradient(180deg,#e9ffd0,#c7f284)` }}>Trocar na Jupiter ↗</a>}
          {endereco && <a href={linkDoSolscan(endereco)} target="_blank" rel="noreferrer" className="mt-2 flex min-h-[36px] w-full items-center justify-center rounded-full border border-white/15 text-[11px] font-bold uppercase tracking-widest text-white/75 hover:text-white">Ver no Solscan ↗</a>}
          {!m.conhecido && <p className="mt-2 text-[11px] text-amber-100/70">Token que a Zaeon ainda não conhece — sem preço. Confira o mint antes de trocar: <span className="break-all font-mono">{m.mint}</span></p>}
          <p className="mt-2 text-[10.5px] leading-snug text-white/35">A troca acontece na sua carteira, com a sua assinatura. Não é recomendação de investimento.</p>
        </>
      )}
    </>
  );
}

/** a COLD WALLET (out/2026, o dono: "a carteira em destaque, do lado direito do personagem, em formato cold wallet"):
 *  o aparelho — corpo de metal escovado, a tela OLED com o total e as moedas rolando, os dois botões, o conector e a
 *  gravação ZAEON VAULT. Clicar abre a aba Carteira */
export function ColdWallet({ est, onAbrir, ativo }: { est: EstadoCarteira; onAbrir: () => void; ativo: boolean }) {
  const moedas = [...(est.aura ? [est.aura] : []), ...est.carteiras.flatMap((c) => c.moedas)];
  const total = totalEmDolar(est.carteiras.flatMap((c) => c.moedas)), conectada = est.carteiras.some((c) => c.tipo === "conectada");
  return (
    <button type="button" onClick={onAbrir} aria-label="Abrir a carteira" className="group pointer-events-auto relative block w-[188px] text-left transition-transform hover:-translate-y-0.5" style={{ filter: ativo ? "drop-shadow(0 0 18px rgba(153,69,255,.55))" : "drop-shadow(0 14px 22px rgba(0,0,0,.7))" }}>
      {/* o CONECTOR em cima */}
      <span aria-hidden className="mx-auto block h-2.5 w-12 rounded-t-md border border-b-0 border-zinc-500/70 bg-gradient-to-b from-zinc-300 to-zinc-500" />
      <div className="relative overflow-hidden rounded-[18px] border border-zinc-400/50 p-3" style={{ background: "linear-gradient(145deg,#3a3d46 0%,#1a1c22 38%,#0c0d11 62%,#2a2c33 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.25), inset 0 -2px 6px rgba(0,0,0,.6), 0 0 0 1px #000" }}>
        {/* o metal escovado */}
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px)" }} />
        <div className="relative mb-2 flex items-center justify-between">
          <span className="text-[9px] font-black tracking-[0.34em] text-zinc-300/80">ZAEON VAULT</span>
          <span className={`h-1.5 w-1.5 rounded-full ${conectada ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-zinc-500"}`} title={conectada ? "carteira conectada" : "sem carteira conectada"} />
        </div>
        {/* a TELA OLED */}
        <div className="relative rounded-md border border-black bg-black px-2.5 py-2 font-mono text-[10.5px] leading-tight text-[#d9f7ff] shadow-[inset_0_0_12px_rgba(0,0,0,1)]">
          <span aria-hidden className="pointer-events-none absolute inset-0 opacity-20" style={{ background: "repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 1px,transparent 1px 2px)" }} />
          <div className="text-[8.5px] uppercase tracking-[0.2em] text-[#7fe8ff]/70">saldo</div>
          <div className="text-[17px] font-black tabular-nums text-white" style={{ textShadow: "0 0 8px rgba(127,232,255,.6)" }}>{est.carteiras.length ? fmtDolar(total) : "—"}</div>
          <div className="mt-1.5 grid gap-0.5">
            {moedas.slice(0, 4).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2"><span className="font-bold" style={{ color: m.cor }}>{m.simbolo}</span><span className="tabular-nums text-white/85">{fmtQuantidade(m.quantidade)}</span></div>
            ))}
            {!moedas.length && <div className="text-white/45">{est.carregando ? "lendo…" : "vazia"}</div>}
            {moedas.length > 4 && <div className="text-white/40">+{moedas.length - 4} moedas</div>}
          </div>
        </div>
        {/* os BOTÕES físicos */}
        <div className="relative mt-2.5 flex items-center justify-between px-3">
          {[0, 1].map((k) => <span key={k} aria-hidden className="h-5 w-5 rounded-full border border-zinc-400/60 bg-gradient-to-b from-zinc-300 to-zinc-600 shadow-[inset_0_-2px_3px_rgba(0,0,0,.5),0_1px_0_rgba(255,255,255,.2)]" />)}
        </div>
        <div className="relative mt-2 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-300/60 group-hover:text-white">{conectada ? "abrir carteira" : "conectar carteira"}</div>
      </div>
    </button>
  );
}
