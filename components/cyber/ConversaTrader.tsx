"use client";

/**
 * ConversaTrader — a conversa com um AGENTE DE TRADING da mesa de operações (lib/cyber/agentesTrading; a resposta vem de
 * app/api/cyber/agente-trading, com o mercado ao vivo). O crachá dourado de quem opera, as falas, o SINAL quando ele dá
 * uma opinião de operação (comprar/vender/aguardar, confiança, horizonte) e as perguntas prontas. Esc fecha.
 */
import { useEffect, useRef, useState } from "react";
import { agentePorId, type MensagemConversa, type Sinal } from "@/lib/cyber/agentesTrading";

const OURO = "#ffc46b";
const PRONTAS = ["Qual a sua leitura agora?", "Você compraria agora? Com qual stop?", "Qual o maior risco nesse momento?", "O que a sua mesa está vendo hoje?"];
const NOME_MESA = { solana: "Mesa Solana", blockchain: "Mesa de Métricas", moedas: "Mesa de Moedas" } as const;

type Msg = MensagemConversa & { sinal?: Sinal | null };

export default function ConversaTrader({ agenteId, onFechar }: { agenteId: string | null; onFechar: () => void }) {
  const a = agenteId ? agentePorId(agenteId) : null;
  const [msgs, setMsgs] = useState<Msg[]>([]), [texto, setTexto] = useState(""), [pensando, setPensando] = useState(false), [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement | null>(null), campo = useRef<HTMLInputElement | null>(null);
  useEffect(() => { setMsgs([]); setErro(null); setTexto(""); if (agenteId) setTimeout(() => campo.current?.focus(), 50); }, [agenteId]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [msgs, pensando]);
  useEffect(() => {
    if (!agenteId) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onFechar(); } };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  }, [agenteId, onFechar]);
  if (!a) return null;

  const perguntar = async (q: string) => {
    const pergunta = q.trim(); if (!pergunta || pensando) return;
    const historico = msgs.map(({ de, texto: t }) => ({ de, texto: t }));
    setMsgs((m) => [...m, { de: "eu", texto: pergunta }]); setTexto(""); setPensando(true); setErro(null);
    try {
      const r = await fetch("/api/cyber/agente-trading", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agente: a.id, texto: pergunta, historico }) });
      const j = (await r.json().catch(() => ({}))) as { fala?: string; sinal?: Sinal | null; error?: string };
      if (!r.ok || !j.fala) { setErro(r.status === 401 ? "Entre na sua conta pra falar com a mesa." : r.status === 429 ? "Calma — a mesa está ocupada. Tente em alguns segundos." : (j.error ?? "Sem resposta agora.")); return; }
      setMsgs((m) => [...m, { de: "agente", texto: j.fala!, sinal: j.sinal ?? null }]);
    } catch { setErro("Sem conexão agora."); }
    finally { setPensando(false); }
  };

  return (
    <div role="dialog" aria-label={`Conversa com ${a.nome}`} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
      className="absolute bottom-24 right-4 z-40 flex max-h-[min(70vh,560px)] w-[min(94vw,400px)] flex-col overflow-hidden rounded-2xl border text-sky-50"
      style={{ borderColor: `${OURO}88`, background: "linear-gradient(180deg,rgba(18,12,4,.96),rgba(6,6,12,.97))", boxShadow: `0 0 40px -12px ${OURO}, 0 24px 60px -20px rgba(0,0,0,.9)` }}>
      {/* o CRACHÁ de quem opera */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3" style={{ background: `linear-gradient(90deg,${OURO}22,transparent)` }}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-[15px] font-black" style={{ borderColor: a.cor, color: a.cor, boxShadow: `0 0 12px -2px ${a.cor}` }}>{a.nome[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><span className="rounded-full px-1.5 text-[9.5px] font-black tracking-wider" style={{ background: OURO, color: "#1a1004" }}>◆ TRADER IA</span><span className="truncate text-[14px] font-black">{a.nome}</span></div>
          <div className="truncate text-[11px] text-white/60">{a.papel} · {NOME_MESA[a.mesa]} · base {a.base}</div>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar a conversa" className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/70 hover:text-white">✕</button>
      </div>
      {/* as FALAS */}
      <div className="min-h-[120px] flex-1 space-y-2 overflow-y-auto px-4 py-3 text-[13px] leading-snug">
        {!msgs.length && <p className="text-white/50">Acompanho {a.foco.join(", ")} com o mercado ao vivo. Pergunte o que quiser — leitura, risco, cenário.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.de === "eu" ? "ml-8 rounded-xl rounded-br-sm bg-sky-400/15 px-3 py-2" : "mr-6"}>
            {m.de === "agente" && <div className="mb-0.5 text-[10px] font-black uppercase tracking-wider" style={{ color: a.cor }}>{a.nome}</div>}
            <p className={m.de === "agente" ? "rounded-xl rounded-tl-sm border border-white/10 bg-white/[0.04] px-3 py-2" : ""}>{m.texto}</p>
            {m.sinal && (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px]" style={{ borderColor: m.sinal.acao === "comprar" ? "#22c55e88" : m.sinal.acao === "vender" ? "#f8717188" : "#ffffff33" }}>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${m.sinal.acao === "comprar" ? "bg-emerald-400/20 text-emerald-300" : m.sinal.acao === "vender" ? "bg-rose-400/20 text-rose-300" : "bg-white/10 text-white/70"}`}>{m.sinal.acao}</span>
                <span className="font-black">{m.sinal.ativo}</span>
                <span className="text-white/60">· {m.sinal.horizonte}</span>
                <span className="ml-auto tabular-nums text-white/70">confiança {Math.round(m.sinal.confianca * 100)}%</span>
              </div>
            )}
          </div>
        ))}
        {pensando && <p className="text-white/50">{a.nome} está olhando os gráficos…</p>}
        {erro && <p role="alert" className="text-rose-300">{erro}</p>}
        <div ref={fim} />
      </div>
      {/* as PERGUNTAS prontas e o campo */}
      <div className="border-t border-white/10 px-3 pb-3 pt-2">
        <div className="mb-2 flex gap-1.5 overflow-x-auto">
          {PRONTAS.map((p) => <button key={p} type="button" disabled={pensando} onClick={() => void perguntar(p)} className="shrink-0 whitespace-nowrap rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/75 hover:border-[#ffc46b]/60 hover:text-white disabled:opacity-50">{p}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void perguntar(texto); }} className="flex gap-2">
          <input ref={campo} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={400} placeholder={`Pergunte pra ${a.nome}…`} className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/40 px-3.5 py-2 text-[13px] outline-none focus:border-[#ffc46b]/70" />
          <button type="submit" disabled={pensando || !texto.trim()} className="rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-[#1a1004] disabled:opacity-50" style={{ background: OURO }}>Enviar</button>
        </form>
        <p className="mt-1.5 text-[10px] text-white/35">Agente de IA com dados reais do mercado. Não é recomendação de investimento.</p>
      </div>
    </div>
  );
}
