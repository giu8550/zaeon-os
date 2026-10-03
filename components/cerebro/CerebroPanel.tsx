"use client";
/**
 * CerebroPanel — o painel PERSISTENTE do cérebro na aba Chat da Sala de Pesquisa (HANDOFF §3).
 * Amarrado ao scopeId da conversa ativa; sempre mostra algo (5 estados). Desktop = nuvem de
 * partículas (lazy); mobile = lista de regiões + 2 barras + "você está aqui". Tap numa região com
 * msgIds → `onAbrirMensagem` (reabre a conversa que a originou).
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, RefreshCw, Sparkles, MessageSquare } from "lucide-react";
import { ARQUETIPOS } from "@/lib/map/arquetipo";
import { proximoDoBackbone } from "@/lib/map/backbone";
import { ROTULO } from "@/lib/map/bolinha";
import { useIsMobile } from "@/lib/ui/useIsMobile";
import type { MapaNo } from "@/lib/map/tipos";
import { regioesDoMapa, type RegiaoVisual } from "./CerebroCanvas";
import { recencia } from "@/lib/map/memoria";
import type { CerebroState } from "./useCerebro";

const CerebroCanvas = dynamic(() => import("./CerebroCanvas"), { ssr: false, loading: () => <div className="h-full w-full bg-[#060a1a]" /> });

const COR: Record<string, string> = { a_conquistar: "#e88a2e", aprendido: "#78beff", aplicado: "#aadcff", validado: "#e0f4ff" };

export default function CerebroPanel({ st, onFechar, onGerar, onAbrirMensagem }: {
  st: CerebroState & { gerar: (t?: string) => Promise<void>; refetch: (r?: string[]) => Promise<void> };
  onFechar: () => void;
  onGerar?: () => void;
  onAbrirMensagem?: (msgId: string, no: MapaNo) => void;
}) {
  const mobile = useIsMobile();
  const mapa = st.mapa;
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // "Apliquei": o aluno marca o próximo nó do percurso como aplicado (com evidência). Modo humana →
  // vai pra fila do professor; outros modos → o gate é automático.
  const aplicar = async (no: MapaNo) => {
    if (!mapa) return;
    const evidencia = window.prompt(`Como você aplicou "${no.label}"? Descreva a evidência (dados, resultado, link):`) ?? null;
    if (evidencia === null) return;
    setAplicando(no.id); setAviso(null);
    try {
      const r = await fetch(`/api/map/${mapa.id}/node/${encodeURIComponent(no.id)}/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evidencia }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setAviso(d.validacao ? "Enviado pra validação do seu professor." : "Aplicado! O percurso avançou.");
      await st.refetch([no.id]);
    } catch (e: any) { setAviso(e?.message ?? "Não deu."); } finally { setAplicando(null); }
  };
  const proximo = useMemo(() => (mapa ? proximoDoBackbone({ nos: mapa.nos, backbone: mapa.backbone, modoValidacao: mapa.modoValidacao }) : null), [mapa]);
  const { regioes, sinapses } = useMemo(() => (mapa ? regioesDoMapa(mapa.nos, mapa.backbone, proximo?.id ?? null, ARQUETIPOS[mapa.tipoTopico].gateHumano, st.recentes, mapa.arestas) : { regioes: [], sinapses: [] }), [mapa, proximo, st.recentes]);
  // Tocar um nó abre a FICHA: closet + gavetas verbatim (memória) + "abrir a conversa".
  const [fichaId, setFichaId] = useState<string | null>(null);
  const ficha = useMemo(() => (mapa && fichaId ? mapa.nos.find((n) => n.id === fichaId) ?? null : null), [mapa, fichaId]);
  const membros = useMemo(() => (mapa && ficha ? mapa.nos.filter((n) => n.id !== ficha.id && n.regiao === ficha.id && (n.drawers?.length ?? 0) > 0) : []), [mapa, ficha]);
  const aoRegiao = (r: RegiaoVisual) => setFichaId((cur) => (cur === r.id ? null : r.id));
  // Esc fecha (o X, o clique fora e a bolinha são tratados por quem monta o painel).
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") { if (fichaId) setFichaId(null); else onFechar(); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [fichaId, onFechar]);
  const gerar = onGerar ?? (() => void st.gerar());

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
      className="absolute inset-0 z-50 flex flex-col bg-[#060a1a] text-[#dbe8ff]" role="dialog" aria-modal="true" aria-label="Cérebro do estudo"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* cabeçalho */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="text-lg" aria-hidden>🧠</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold">{mapa?.titulo || st.tituloSugerido || "Cérebro do estudo"}</p>
          <p className="truncate text-[11px] text-[#9fb6e0]">
            {mapa ? `${ARQUETIPOS[mapa.tipoTopico].rotulo} · ${mapa.objetivo || "objetivo a definir"}` : "arraste pra girar"}
            <span className="ml-2 text-[#ffd56b]">— amarelo: pra onde ir</span><span className="ml-2 text-[#49b6ff]">· azul: o que já vive aqui</span>
          </p>
        </div>
        {st.estado !== "gerando" && mapa && (
          <button onClick={() => void st.gerar()} title={mapa.backbone.length ? "Retraçar o percurso" : ROTULO.vazia} className="rounded-lg border border-white/15 p-1.5 text-[#9fb6e0] hover:text-white"><RefreshCw size={14} /></button>
        )}
        <button onClick={onFechar} aria-label="Fechar o cérebro" className="rounded-lg border border-white/15 p-1.5 text-[#9fb6e0] hover:text-white"><X size={16} /></button>
      </div>

      {/* corpo por estado */}
      <div className="relative min-h-0 flex-1">
        {st.estado === "ativa" && mapa && (mobile ? <Lista regioes={regioes} nos={mapa.nos} aoRegiao={aoRegiao} /> : <CerebroCanvas regioes={regioes} sinapses={sinapses} onRegiao={aoRegiao} />)}
        {/* FICHA do nó: closet + gavetas (verbatim) + abrir a conversa */}
        {ficha && (
          <motion.aside initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="absolute bottom-3 right-3 top-3 z-10 flex w-[min(360px,88vw)] flex-col rounded-2xl border border-[rgba(120,170,255,.25)] bg-[rgba(10,21,38,.92)] backdrop-blur">
            <div className="flex items-start gap-2 border-b border-white/10 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">{ficha.label}</p>
                <p className="text-[11px] text-[#9fb6e0]">{ficha.estado.replace("_", " ")}{ficha.closet && ficha.closet !== ficha.label ? ` · ${ficha.closet}` : ""}</p>
              </div>
              <button onClick={() => setFichaId(null)} aria-label="Fechar ficha" className="rounded-lg border border-white/15 p-1 text-[#9fb6e0] hover:text-white"><X size={14} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {(ficha.drawers?.length ?? 0) === 0 && membros.length === 0 && <p className="text-[12px] text-[#9fb6e0]">Ainda sem memória aqui — o que você conversar sobre isto vira gaveta.</p>}
              {[ficha, ...membros].map((n) => (n.drawers?.length ? (
                <div key={n.id} className="mb-3">
                  {n.id !== ficha.id && <p className="mb-1 text-[11px] font-bold text-[#78beff]">◦ {n.label}</p>}
                  {[...n.drawers].reverse().map((d, i) => (
                    <div key={i} className="mb-2 rounded-xl border border-[rgba(73,182,255,.25)] bg-[rgba(73,182,255,.06)] p-2.5">
                      <p className="whitespace-pre-wrap text-[12px] leading-snug text-[#dbe8ff]">{d.texto}</p>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#9fb6e0]">
                        <span>{d.ts ? new Date(d.ts).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}{d.ts && recencia(d.ts, Date.now()) > 0.7 ? " · recente" : ""}</span>
                        {d.msgIds[0] && onAbrirMensagem && <button onClick={() => onAbrirMensagem(d.msgIds[0]!, n)} className="inline-flex items-center gap-1 text-[#9fe0ff] hover:underline"><MessageSquare size={11} /> abrir a conversa</button>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null))}
            </div>
          </motion.aside>
        )}
        {st.estado === "gerando" && <Centro><Sparkles className="animate-pulse text-cyan-300" /><p className="text-sm font-semibold">Gerando o cérebro…</p><p className="text-[12px] text-[#9fb6e0]">classificando o tema e traçando o percurso</p></Centro>}
        {(st.estado === "sugerida" || st.estado === "vazia" || st.estado === "oculta") && (
          <Centro>
            <p className="text-sm font-semibold">{st.estado === "vazia" ? "Este estudo ainda não tem percurso." : st.estado === "sugerida" ? "Esta conversa parece um estudo." : "Esta conversa ainda não virou um estudo."}</p>
            <p className="max-w-sm text-[12px] text-[#9fb6e0]">{st.erro ? `Última tentativa falhou: ${st.erro}` : "O cérebro nasce quando você pede: a Aura classifica o tema, traça o percurso e, a cada resposta, acende o que você aprendeu."}</p>
            {st.estado !== "oculta" && <button onClick={gerar} className="mt-2 rounded-xl border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-[13px] font-bold text-cyan-100 hover:bg-cyan-500/25">{st.erro ? "Tentar de novo" : ROTULO[st.estado]}</button>}
          </Centro>
        )}
        {/* ação do aluno: aplicar o próximo nó do percurso */}
        {mapa && st.estado === "ativa" && proximo && (
          <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
            <button
              onClick={() => void aplicar(proximo)}
              disabled={aplicando === proximo.id || proximo.estado === "aplicado"}
              className="rounded-xl border border-amber-300/50 bg-amber-500/15 px-3 py-1.5 text-[12px] font-bold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
              title={proximo.estado === "aplicado" ? "Aguardando validação" : `Marcar "${proximo.label}" como aplicado`}
            >
              {proximo.estado === "aplicado" ? "⏳ aguardando validação" : `✓ Apliquei: ${proximo.label}`}
            </button>
            {aviso && <span className="rounded-lg bg-black/50 px-2 py-1 text-[11px] text-[#cfe0ff]">{aviso}</span>}
          </div>
        )}
        {/* barras (sempre que há mapa) */}
        {mapa && st.estado === "ativa" && !mobile && (
          <div className="absolute bottom-3 left-3 w-[min(320px,72vw)] rounded-xl border border-[rgba(120,170,255,.22)] bg-[rgba(14,26,54,.6)] p-3 backdrop-blur">
            <Barra rotulo="Progresso" pct={mapa.completudeAprendizado} cor="linear-gradient(90deg,#2f6fd6,#49b6ff)" />
            <Barra rotulo={`Conclusão (${mapa.modoValidacao === "humana" ? "prof" : mapa.modoValidacao})`} pct={mapa.completudeConclusao} cor="linear-gradient(90deg,#b5851f,#ffd56b)" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">{children}</div>;
}
function Barra({ rotulo, pct, cor }: { rotulo: string; pct: number; cor: string }) {
  const p = Math.round(Math.max(0, Math.min(1, pct)) * 100);
  return (
    <div className="my-1.5">
      <div className="mb-1 flex justify-between text-[12px] text-[#b9cdf2]"><span>{rotulo}</span><b>{p}%</b></div>
      <div className="h-2 overflow-hidden rounded-md border border-[rgba(130,170,255,.18)] bg-[rgba(120,160,230,.16)]"><div className="h-full rounded-md transition-[width] duration-1000" style={{ width: `${p}%`, background: cor }} /></div>
    </div>
  );
}

/** Versão mobile: sem canvas. Regiões por estado + barras + "você está aqui". */
function Lista({ regioes, nos, aoRegiao }: { regioes: RegiaoVisual[]; nos: MapaNo[]; aoRegiao: (r: RegiaoVisual) => void }) {
  const acesos = nos.filter((n) => n.estado !== "a_conquistar").length;
  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      <ol className="flex flex-col gap-1.5">
        {regioes.map((r, i) => (
          <li key={r.id}>
            <button onClick={() => aoRegiao(r)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COR[r.estado], boxShadow: `0 0 8px ${COR[r.estado]}` }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{i + 1}. {r.label}</span>
                <span className="block text-[11px] text-[#9fb6e0]">{r.estado.replace("_", " ")}{r.gavetas ? ` · ${r.gavetas} gaveta${r.gavetas > 1 ? "s" : ""}` : ""}{r.gate ? " · chancela" : ""}{r.aqui ? " · você está aqui" : ""}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-[#9fb6e0]">{acesos} de {nos.length} nós acesos.</p>
    </div>
  );
}
