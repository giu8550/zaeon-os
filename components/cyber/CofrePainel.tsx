"use client";

/**
 * CofrePainel — o COFRE da pessoa (lib/cyber/cofre; servidor em app/api/cyber/cofre), aberto no PORTAL do monumento, no
 * deck do topo da torre de TI: o fundo privado que os agentes de trading operam. O valor e a composição, o DEPÓSITO
 * (o endereço do cofre + o SOL de teste da devnet), as REGRAS que a pessoa decide (quanto por operação, as moedas, a
 * mesa, ligado/desligado, de quanto em quanto tempo), a rodada agora, as OPERAÇÕES (cada uma com o registro na rede) e
 * o SAQUE. Esc fecha.
 */
import { useCallback, useEffect, useState } from "react";
import { AGENTES_TRADING, agentePorId } from "@/lib/cyber/agentesTrading";
import { ATIVOS_COFRE, CAIXA, type ConfigCofre, type LinhaFundo } from "@/lib/cyber/cofre";
import { encurtar, fmtDolar, fmtQuantidade, linkExplorer } from "@/lib/cyber/carteira";

type Operacao = { id: string; tipo: string; ativo: string; quantidade: number; preco: number; valorUsd: number; agenteId: string | null; motivo: string | null; assinatura: string | null; em: string };
type Estado = { endereco: string; rede: "devnet" | "mainnet"; config: ConfigCofre; total: number; linhas: LinhaFundo[]; saldoRede: number; ultimaRodada: string | null; operacoes: Operacao[] };
const OURO = "#ffc46b", CORES = new Map(ATIVOS_COFRE.map((a) => [a.simbolo, a.cor]));
const NOME_OP: Record<string, string> = { compra: "Compra", venda: "Venda", deposito: "Depósito", saque: "Saque" };

export default function CofrePainel({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [c, setC] = useState<Estado | null | undefined>(undefined), [ocupado, setOcupado] = useState<string | null>(null), [aviso, setAviso] = useState<string | null>(null), [erro, setErro] = useState<string | null>(null);
  const [destino, setDestino] = useState(""), [qtd, setQtd] = useState("");
  const chamar = useCallback(async (corpo: Record<string, unknown> | null, rotulo: string) => {
    setOcupado(rotulo); setErro(null);
    try {
      const r = await fetch("/api/cyber/cofre", corpo ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) } : { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(r.status === 401 ? "Entre na sua conta pra usar o cofre." : r.status === 429 ? "Devagar — tente em alguns segundos." : (j.error ?? "Não deu agora.")); return null; }
      if ("cofre" in j) setC(j.cofre);
      return j;
    } catch { setErro("Sem conexão agora."); return null; }
    finally { setOcupado(null); }
  }, []);
  useEffect(() => { if (aberto) { setAviso(null); void chamar(null, "lendo"); try { setDestino(localStorage.getItem("zaeon:carteira-conectada") ?? ""); } catch { /* sem storage */ } } }, [aberto, chamar]);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onFechar(); } };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  }, [aberto, onFechar]);
  if (!aberto) return null;

  const cfg = c?.config, mudar = (patch: Partial<ConfigCofre>) => cfg && void chamar({ acao: "config", config: { ...cfg, ...patch } }, "salvando");
  const permitida = (s: string) => cfg?.ativos === "todas" || (cfg?.ativos ?? []).includes(s);
  const alternarAtivo = (s: string) => { if (!cfg) return; const atual = cfg.ativos === "todas" ? ATIVOS_COFRE.map((a) => a.simbolo).filter((x) => x !== CAIXA) : cfg.ativos; const novo = atual.includes(s) ? atual.filter((x) => x !== s) : [...atual, s]; mudar({ ativos: novo.length ? novo : "todas" }); };
  const caixa = c?.linhas.find((l) => l.simbolo === CAIXA)?.quantidade ?? 0;

  return (
    <div role="dialog" aria-label="Cofre" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-1/2 z-40 flex h-[min(90vh,700px)] w-[min(96vw,980px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[18px] border-2 text-sky-50"
      style={{ borderColor: `${OURO}77`, background: "linear-gradient(180deg,rgba(16,11,4,.97),rgba(5,5,12,.98))", boxShadow: `0 0 70px -24px ${OURO}, 0 30px 90px -20px rgba(0,0,0,.9)` }}>
      {/* o cabeçalho */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3" style={{ background: `linear-gradient(90deg,${OURO}22,transparent 60%)` }}>
        <div>
          <h2 className="text-[15px] font-black uppercase tracking-[0.3em]" style={{ color: OURO, textShadow: `0 0 14px ${OURO}88` }}>Cofre</h2>
          <p className="text-[10.5px] uppercase tracking-[0.2em] text-white/50">o seu fundo privado · operado pela mesa de agentes</p>
        </div>
        {c && <span className="rounded-full border border-amber-300/50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-200">{c.rede}</span>}
        {c && <a href={linkExplorer(c.endereco, "address", c.rede)} target="_blank" rel="noreferrer" className="font-mono text-[11.5px] text-white/60 hover:text-white">{encurtar(c.endereco)} ↗</a>}
        <button type="button" onClick={onFechar} aria-label="Fechar o cofre" className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70 hover:text-white">✕</button>
      </div>

      {c === undefined ? <p className="p-6 text-sm text-white/50">abrindo…</p> : c === null ? (
        <div className="m-auto max-w-md p-6 text-center">
          <p className="text-[15px] font-black">Você ainda não tem um cofre.</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">O cofre é uma carteira da Solana só sua. Você deposita o quanto quiser e a mesa de agentes de trading opera dentro das regras que <b>você</b> definir. Cada operação fica registrada na rede. Por enquanto, na <b>devnet</b> (SOL de teste).</p>
          <button type="button" disabled={!!ocupado} onClick={() => void chamar({ acao: "criar" }, "criando")} className="mt-4 rounded-full px-6 py-2.5 text-xs font-black uppercase tracking-widest text-[#1a1004] disabled:opacity-50" style={{ background: OURO }}>{ocupado ? "Criando…" : "Criar meu cofre"}</button>
          {erro && <p role="alert" className="mt-3 text-[12px] text-rose-300">{erro}</p>}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[1fr,330px] md:overflow-hidden">
          {/* o FUNDO e as OPERAÇÕES */}
          <div className="flex min-h-0 flex-col gap-3 md:overflow-y-auto">
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-baseline justify-between"><span className="text-[10.5px] font-black uppercase tracking-[0.2em] text-white/50">Valor do fundo</span><span className="text-[10.5px] text-white/40">{c.ultimaRodada ? `mesa rodou ${new Date(c.ultimaRodada).toLocaleString("pt-BR")}` : "a mesa ainda não rodou"}</span></div>
              <div className="mt-1 text-[30px] font-black tabular-nums" style={{ color: OURO }}>{fmtDolar(c.total)}</div>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white/10">{c.linhas.map((l) => <span key={l.simbolo} title={`${l.simbolo} ${(l.peso * 100).toFixed(1)}%`} style={{ width: `${l.peso * 100}%`, background: CORES.get(l.simbolo) ?? "#888" }} />)}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {c.linhas.map((l) => <div key={l.simbolo} className="flex items-center justify-between rounded-md bg-black/30 px-2 py-1 text-[11.5px]"><span className="font-black" style={{ color: CORES.get(l.simbolo) }}>{l.simbolo}</span><span className="tabular-nums text-white/80">{fmtQuantidade(l.quantidade)}</span><span className="tabular-nums text-white/50">{l.valor !== null ? fmtDolar(l.valor) : "—"}</span></div>)}
                {!c.linhas.length && <p className="col-span-full text-[12px] text-white/50">Vazio. Deposite SOL no endereço do cofre (ao lado) pra a mesa começar.</p>}
              </div>
            </section>
            <section className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10.5px] font-black uppercase tracking-[0.2em] text-white/50">Operações</span>
                <button type="button" disabled={!!ocupado} onClick={async () => { const r = await chamar({ acao: "rodada" }, "rodando"); if (r) setAviso(`${r.resumo}${r.execucoes?.length ? ` (${r.execucoes.length} ${r.execucoes.length === 1 ? "operação" : "operações"})` : ""}`); }}
                  className="rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#1a1004] disabled:opacity-50" style={{ background: OURO }}>{ocupado === "rodando" ? "A mesa está decidindo…" : "Rodar a mesa agora"}</button>
              </div>
              {aviso && <p className="mb-2 rounded-lg border border-amber-300/30 bg-amber-300/[0.07] px-2.5 py-2 text-[12px] text-amber-50/90">{aviso}</p>}
              <div className="grid gap-1.5 md:overflow-y-auto">
                {c.operacoes.map((o) => { const a = o.agenteId ? agentePorId(o.agenteId) : null; return (
                  <div key={o.id} className="rounded-lg bg-black/30 px-2.5 py-1.5 text-[11.5px]">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 text-[10px] font-black uppercase ${o.tipo === "compra" || o.tipo === "deposito" ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-400/20 text-rose-300"}`}>{NOME_OP[o.tipo] ?? o.tipo}</span>
                      <span className="font-black" style={{ color: CORES.get(o.ativo) }}>{fmtQuantidade(o.quantidade)} {o.ativo}</span>
                      <span className="tabular-nums text-white/60">{fmtDolar(o.valorUsd)}</span>
                      {a && <span className="text-white/50">· {a.nome}</span>}
                      <span className="ml-auto text-white/35">{new Date(o.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                      {o.assinatura ? <a href={linkExplorer(o.assinatura, "tx", c.rede)} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">na rede ↗</a> : <span className="text-white/30" title="sem registro na rede (sem SOL pra taxa ou rede fora)">só no livro</span>}
                    </div>
                    {o.motivo && <p className="mt-0.5 text-white/55">{o.motivo}</p>}
                  </div>
                ); })}
                {!c.operacoes.length && <p className="text-[12px] text-white/45">Nenhuma operação ainda.</p>}
              </div>
            </section>
          </div>
          {/* o DEPÓSITO, as REGRAS e o SAQUE */}
          <aside className="flex min-h-0 flex-col gap-3 md:overflow-y-auto">
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12px]">
              <p className="text-[10.5px] font-black uppercase tracking-[0.2em] text-white/50">Depositar</p>
              <p className="mt-1 text-white/60">Envie SOL pra este endereço (na sua carteira, com a rede em <b>{c.rede}</b>):</p>
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(c.endereco); setAviso("Endereço do cofre copiado."); }} className="mt-1.5 w-full break-all rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-left font-mono text-[11px] hover:border-amber-300/60">{c.endereco}</button>
              <p className="mt-1.5 text-white/45">Saldo na rede: <b className="text-white/80">{fmtQuantidade(c.saldoRede)} SOL</b></p>
              {c.rede === "devnet" && <button type="button" disabled={!!ocupado} onClick={async () => { const r = await chamar({ acao: "airdrop" }, "airdrop"); if (r) { setAviso("Pedido de SOL de teste enviado — chega em alguns segundos."); setTimeout(() => void chamar(null, "lendo"), 6000); } }} className="mt-2 w-full rounded-full border border-amber-300/50 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-200 disabled:opacity-50">{ocupado === "airdrop" ? "Pedindo…" : "Pedir SOL de teste (faucet)"}</button>}
            </section>
            {cfg && (
              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12px]">
                <div className="flex items-center justify-between"><p className="text-[10.5px] font-black uppercase tracking-[0.2em] text-white/50">As suas regras</p>
                  <button type="button" role="switch" aria-checked={cfg.ligado} onClick={() => mudar({ ligado: !cfg.ligado })} className={`rounded-full px-3 py-1 text-[10.5px] font-black uppercase tracking-wider ${cfg.ligado ? "bg-emerald-400 text-slate-950" : "border border-white/20 text-white/60"}`}>{cfg.ligado ? "Mesa ligada" : "Mesa desligada"}</button></div>
                <label className="mt-2.5 block text-white/70">Por operação: <b className="text-white">{Math.round(cfg.fracaoPorOperacao * 100)}%</b> do fundo
                  <input type="range" min={1} max={100} value={Math.round(cfg.fracaoPorOperacao * 100)} onChange={(e) => setC({ ...c, config: { ...cfg, fracaoPorOperacao: Number(e.target.value) / 100 } })} onPointerUp={(e) => mudar({ fracaoPorOperacao: Number((e.target as HTMLInputElement).value) / 100 })} className="mt-1 w-full accent-amber-300" /></label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <label className="text-white/70">Ordens por rodada<input type="number" min={1} max={10} value={cfg.ordensPorRodada} onChange={(e) => mudar({ ordensPorRodada: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-1" /></label>
                  <label className="text-white/70">Roda a cada (min)<input type="number" min={0} max={1440} value={cfg.intervaloMin} onChange={(e) => mudar({ intervaloMin: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-1" /></label>
                </div>
                <p className="mt-2.5 text-white/60">Moedas que a mesa pode negociar {cfg.ativos === "todas" && <span className="text-white/40">(todas)</span>}</p>
                <div className="mt-1 flex flex-wrap gap-1">{ATIVOS_COFRE.filter((a) => a.simbolo !== CAIXA).map((a) => <button key={a.simbolo} type="button" onClick={() => alternarAtivo(a.simbolo)} className="rounded-full border px-2 py-0.5 text-[10.5px] font-bold" style={{ borderColor: permitida(a.simbolo) ? a.cor : "#ffffff22", color: permitida(a.simbolo) ? a.cor : "#ffffff55" }}>{a.simbolo}</button>)}</div>
                <p className="mt-2.5 text-white/60">Quem decide na mesa</p>
                <div className="mt-1 flex flex-wrap gap-1">{AGENTES_TRADING.map((a) => { const on = cfg.mesa.includes(a.id); return <button key={a.id} type="button" title={a.papel} onClick={() => { const nova = on ? cfg.mesa.filter((x) => x !== a.id) : [...cfg.mesa, a.id]; if (nova.length) mudar({ mesa: nova }); }} className="rounded-full border px-2 py-0.5 text-[10.5px] font-bold" style={{ borderColor: on ? a.cor : "#ffffff22", color: on ? a.cor : "#ffffff55" }}>{a.nome}</button>; })}</div>
              </section>
            )}
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12px]">
              <p className="text-[10.5px] font-black uppercase tracking-[0.2em] text-white/50">Sacar SOL</p>
              <p className="mt-1 text-white/45">Disponível no caixa: {fmtQuantidade(caixa)} SOL (venda as posições pra ter mais).</p>
              <input value={destino} onChange={(e) => setDestino(e.target.value.trim())} placeholder="Endereço de destino" className="mt-1.5 w-full rounded-md border border-white/15 bg-black/40 px-2 py-1 font-mono text-[11px]" />
              <div className="mt-1.5 flex gap-2">
                <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" placeholder="SOL" className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-2 py-1" />
                <button type="button" disabled={!!ocupado || !destino || !(Number(qtd) > 0)} onClick={async () => { const r = await chamar({ acao: "sacar", destino, sol: Number(qtd.replace(",", ".")) }, "sacando"); if (r?.assinatura) { setAviso("Saque enviado. Confira na rede."); setQtd(""); setTimeout(() => void chamar(null, "lendo"), 5000); } }} className="rounded-md border border-white/20 px-3 text-[11px] font-black uppercase tracking-wider disabled:opacity-40">Sacar</button>
              </div>
            </section>
            {erro && <p role="alert" className="text-[12px] text-rose-300">{erro}</p>}
            <p className="text-[10.5px] leading-snug text-white/35">As decisões são de agentes de IA com dados reais do mercado; não é recomendação de investimento. Na devnet, o SOL é de teste e as posições nas outras moedas ficam no livro do cofre, a preço de mercado — cada operação é registrada na rede.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
