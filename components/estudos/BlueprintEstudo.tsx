"use client";
/**
 * BlueprintEstudo — a PRANCHA TÉCNICA de um estudo (lib/estudos/blueprint), aberta pelo card de estudo do board.
 * Desenho técnico: moldura dupla, o ESQUEMA das ramificações (da direita pra esquerda: estudo → caminho → componentes
 * confirmados; as especulações tracejadas), as seções numeradas (objetivo, produto final, componentes factíveis com
 * as fontes, caminho, em aberto, "patente" em construção, validação) e o CARIMBO no canto (projeto, autor, revisão,
 * profundidade, raridade). Ao lado, o ITEM que o estudo vira (o colecionável do inventário do game): a raridade acende
 * a moldura; com base pra entregar um produto, ganha o selo dourado de VENDÁVEL.
 */
import { useMemo, useState } from "react";
import { COR_RARIDADE, NOME_RARIDADE, montarBlueprint, type Blueprint, type SeloEstado } from "@/lib/estudos/blueprint";
import type { CardEstudo } from "@/lib/estudos/board";

const TINTA = "#e8f6ff", LINHA = "rgba(170,220,255,.85)";
const SELO: Record<SeloEstado, { t: string; cor: string }> = { ok: { t: "OK", cor: "#7dffb0" }, pendente: { t: "PENDENTE", cor: "#ffd36b" }, falhou: { t: "FALHOU", cor: "#ff8a8a" } };

export default function BlueprintEstudo({ cards, estudoId, rev, autorNome, podeEditar, onSalvar, onChecar, onFechar }: {
  cards: CardEstudo[]; estudoId: string; rev: number; autorNome: string; podeEditar: boolean;
  onSalvar: (c: CardEstudo) => void; onChecar: () => Promise<string | null>; onFechar: () => void;
}) {
  const bp = useMemo(() => montarBlueprint(cards, estudoId), [cards, estudoId]);
  const [produto, setProduto] = useState(bp?.produto ?? ""), [repo, setRepo] = useState(bp?.estudo.repo ?? "");
  const [checando, setChecando] = useState(false), [msg, setMsg] = useState<string | null>(null);
  if (!bp) return null;
  const salvar = () => { if (produto !== (bp.estudo.produto ?? "") || repo !== (bp.estudo.repo ?? "")) onSalvar({ ...bp.estudo, produto: produto.trim() || undefined, repo: repo.trim() || undefined }); };
  const checar = async () => { salvar(); setChecando(true); setMsg(null); const m = await onChecar(); setChecando(false); setMsg(m); };
  const corR = COR_RARIDADE[bp.raridade];

  return (
    <div role="dialog" aria-modal="true" aria-label={`Blueprint: ${bp.titulo}`} className="absolute inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-[#020b18]/80 p-3 md:p-6 backdrop-blur-sm" onPointerDown={(e) => e.stopPropagation()} onClick={onFechar}>
      <div className="relative w-full max-w-[1180px] rounded-sm p-[10px]" style={{ background: "#0b2c4d", border: `2px solid ${LINHA}`, color: TINTA }} onClick={(e) => e.stopPropagation()}>
        <div className="relative rounded-sm p-4 md:p-6" style={{ border: `1px solid ${LINHA}`, backgroundImage: "linear-gradient(rgba(150,205,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(150,205,255,.08) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
          <button type="button" onClick={onFechar} className="absolute right-3 top-3 font-mono text-[12px] text-sky-200/70 hover:text-white">✕ fechar</button>
          <div className="font-mono text-[10px] tracking-[0.3em] text-sky-300/80">BLUEPRINT · ZAEON · FOLHA 1/1</div>
          <h2 className="mt-1 font-mono text-[22px] font-bold md:text-[28px]">{bp.titulo}</h2>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-5">
              <Esquema bp={bp} />
              <Secao n="01" t="OBJETIVO">{bp.objetivo || <i className="text-sky-200/50">escreva o tema no card do estudo</i>}</Secao>
              <Secao n="02" t="PRODUTO FINAL — O QUE SE ENTREGA">
                {podeEditar ? <textarea value={produto} onChange={(e) => setProduto(e.target.value)} onBlur={salvar} rows={3} maxLength={2000} placeholder="ex.: um curso de 8 aulas + o dump comentado; um protótipo; um artigo; uma planta; um negócio…" className="w-full rounded-sm border bg-sky-950/40 p-2 font-mono text-[12.5px] outline-none" style={{ borderColor: "rgba(127,224,255,.3)" }} />
                  : (bp.produto || <i className="text-sky-200/50">ainda não definido</i>)}
              </Secao>
              <Secao n="03" t={`COMPONENTES — FACTÍVEL (${bp.componentes.length})`}>
                {bp.componentes.length ? <ol className="space-y-2">{bp.componentes.map((c) => (
                  <li key={c.id} className="rounded-sm border px-2.5 py-2" style={{ borderColor: "rgba(125,255,176,.35)" }}>
                    <div className="font-mono text-[12px]"><span className="text-emerald-300">{c.codigo}</span> · {c.titulo}</div>
                    <div className="mt-1 space-y-0.5 text-[11px] text-emerald-100/75">{c.fontes.map((f, k) => <div key={k}>✓ {f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted">{f.titulo}</a> : f.titulo}{f.ano ? ` (${f.ano})` : ""}</div>)}</div>
                  </li>))}</ol>
                  : <i className="text-sky-200/50">nenhuma confirmação na literatura ainda — use “Resposta certeira” no card</i>}
              </Secao>
              <div className="grid gap-5 md:grid-cols-2">
                <Secao n="04" t="CAMINHO">{bp.passos.length ? <ul className="space-y-1 font-mono text-[12px]">{bp.passos.map((p) => <li key={p.id}>▸ {p.titulo}</li>)}</ul> : <i className="text-sky-200/50">gere o percurso no card</i>}</Secao>
                <Secao n="05" t="EM ABERTO — ESPECULAÇÃO">{bp.abertos.length ? <ul className="space-y-1 font-mono text-[12px] text-violet-200/85">{bp.abertos.map((p) => <li key={p.id}>┅ {p.titulo}</li>)}</ul> : <i className="text-sky-200/50">nada em aberto</i>}</Secao>
              </div>
              <Secao n="06" t="PATENTE">
                <div className="flex items-center gap-2 font-mono text-[12px] text-amber-200/90"><span className="rounded-sm border border-amber-200/50 px-1.5 py-0.5 text-[10px] tracking-[0.2em]">EM CONSTRUÇÃO</span> o registro do que é novo neste blueprint — reivindicações, anterioridade e a prova de autoria — chega numa próxima etapa.</div>
              </Secao>
              <Secao n="07" t="VALIDAÇÃO">
                <div className="grid gap-2 md:grid-cols-3">
                  <Selo t="Links funcionando" e={bp.selos.links} d={bp.estudo.selos?.links ? `${bp.estudo.selos.links.ok}/${bp.estudo.selos.links.total} responderam` : "ainda não checados"} />
                  <Selo t="Entregável (código privado)" e={bp.selos.codigo} d={bp.estudo.repo ? "link do entregável registrado" : "registre o link abaixo"} />
                  <Selo t="Supervisão" e={bp.selos.supervisao} d="a validação por gente (professor vinculado)" />
                </div>
                {podeEditar && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input value={repo} onChange={(e) => setRepo(e.target.value)} onBlur={salvar} placeholder="https://github.com/… (pode ser privado)" className="min-w-[240px] flex-1 rounded-sm border bg-sky-950/40 px-2 py-1.5 font-mono text-[12px] outline-none" style={{ borderColor: "rgba(127,224,255,.3)" }} />
                    <button type="button" disabled={checando} onClick={checar} className="rounded-sm border px-3 py-1.5 font-mono text-[11px] tracking-wide text-sky-100 hover:bg-white/10 disabled:opacity-50" style={{ borderColor: "rgba(127,224,255,.5)" }}>{checando ? "checando…" : "checar os links"}</button>
                  </div>
                )}
                {msg && <div className="mt-2 font-mono text-[11px] text-sky-200/80">{msg}</div>}
              </Secao>
            </div>

            {/* o ITEM (o colecionável) e o CARIMBO */}
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-md p-4 text-center" style={{ border: `2px solid ${corR}`, background: `radial-gradient(circle at 50% 30%, ${corR}33, rgba(5,20,40,.95) 70%)`, boxShadow: `0 0 28px ${corR}55` }}>
                {bp.vendavel && <div className="absolute right-[-34px] top-[14px] rotate-45 bg-gradient-to-r from-amber-300 to-yellow-200 px-10 py-0.5 font-mono text-[10px] font-black tracking-[0.2em] text-slate-950 shadow">VENDÁVEL</div>}
                <div className="font-mono text-[10px] tracking-[0.3em]" style={{ color: corR }}>ITEM · {NOME_RARIDADE[bp.raridade].toUpperCase()}</div>
                <LivroItem cor={corR} />
                <div className="mt-2 font-mono text-[14px] font-bold">{bp.titulo}</div>
                <div className="mt-1 font-mono text-[11px] text-sky-200/70">nível {bp.pontos} · {bp.componentes.length} componentes · {bp.fontes.length} fontes</div>
                <div className="mt-2 text-[11px] leading-snug text-sky-100/70">{bp.vendavel ? "Tem base pra entregar um produto — pronto pra vitrine." : "Vira vendável com produto final, links ok, entregável e profundidade ≥ 50."}</div>
              </div>
              <table className="w-full border-collapse font-mono text-[11px]" style={{ border: `1px solid ${LINHA}` }}>
                <tbody>
                  {[["PROJETO", bp.titulo], ["AUTOR", autorNome], ["REVISÃO", `R${rev}`], ["DATA", new Date().toLocaleDateString("pt-BR")], ["PROFUNDIDADE", `${bp.profundidade.nota}/100`], ["RARIDADE", NOME_RARIDADE[bp.raridade]], ["ESCALA", "1 : conhecimento"]].map(([k, v]) => (
                    <tr key={k}><td className="w-[42%] px-2 py-1 text-sky-300/80" style={{ borderBottom: `1px solid ${LINHA}`, borderRight: `1px solid ${LINHA}` }}>{k}</td><td className="truncate px-2 py-1" style={{ borderBottom: `1px solid ${LINHA}`, color: k === "RARIDADE" ? corR : undefined }}>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Secao({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2 font-mono text-[10.5px] tracking-[0.2em] text-sky-300/90"><span className="rounded-sm border border-sky-300/50 px-1">{n}</span>{t}<span className="h-px flex-1 bg-sky-300/25" /></div>
      <div className="text-[13px] leading-relaxed text-sky-50/90">{children}</div>
    </section>
  );
}
function Selo({ t, e, d }: { t: string; e: SeloEstado; d: string }) {
  const s = SELO[e];
  return <div className="rounded-sm border px-2.5 py-2" style={{ borderColor: `${s.cor}66` }}><div className="flex items-center justify-between font-mono text-[11px]"><span>{t}</span><span style={{ color: s.cor }}>{s.t}</span></div><div className="mt-0.5 text-[10.5px] text-sky-200/60">{d}</div></div>;
}
/** o desenho do ITEM: um livro técnico aberto (o estudo vira um livro no cyberespaço) */
function LivroItem({ cor }: { cor: string }) {
  return (
    <svg viewBox="0 0 120 80" className="mx-auto mt-2 h-24 w-auto" aria-hidden="true">
      <path d="M10 18 L58 10 L58 66 L10 72 Z" fill="rgba(8,30,55,.9)" stroke={cor} strokeWidth="1.6" />
      <path d="M110 18 L62 10 L62 66 L110 72 Z" fill="rgba(8,30,55,.9)" stroke={cor} strokeWidth="1.6" />
      {[22, 30, 38, 46, 54].map((y) => <g key={y}><path d={`M16 ${y} L52 ${y - 6}`} stroke={cor} strokeOpacity=".45" /><path d={`M104 ${y} L68 ${y - 6}`} stroke={cor} strokeOpacity=".45" /></g>)}
      <circle cx="60" cy="38" r="14" fill="none" stroke={cor} strokeOpacity=".5" strokeDasharray="2 3"><animateTransform attributeName="transform" type="rotate" from="0 60 38" to="360 60 38" dur="12s" repeatCount="indefinite" /></circle>
    </svg>
  );
}
/** o ESQUEMA (da direita pra esquerda): o estudo à direita → os passos → os componentes confirmados; especulações tracejadas */
function Esquema({ bp }: { bp: Blueprint }) {
  const W = 760, colX = [W - 150, W - 360, 30], caixa = (x: number, y: number, w: number, t: string, cor: string, tracej = false, key?: string) => (
    <g key={key}><rect x={x} y={y} width={w} height={26} fill="rgba(12,45,82,.95)" stroke={cor} strokeWidth="1.3" strokeDasharray={tracej ? "4 4" : undefined} /><text x={x + 6} y={y + 17} fill={TINTA} fontSize="10.5" fontFamily="ui-monospace, monospace">{t.length > 34 ? `${t.slice(0, 33)}…` : t}</text></g>
  );
  const passos = bp.passos.slice(0, 6), comps = bp.componentes.slice(0, 8), abertos = bp.abertos.slice(0, 3);
  const H = Math.max(120, 40 + Math.max(passos.length, comps.length + abertos.length) * 34);
  const yE = H / 2 - 13, yP = (i: number) => 20 + i * 34, yC = (i: number) => 20 + i * 34;
  const fio = (x1: number, y1: number, x2: number, y2: number, tracej = false, k?: string) => <path key={k} d={`M ${x1} ${y1} H ${(x1 + x2) / 2} V ${y2} H ${x2}`} fill="none" stroke={tracej ? "rgba(201,182,255,.7)" : LINHA} strokeWidth="1.1" strokeDasharray={tracej ? "4 4" : undefined} />;
  return (
    <div className="overflow-x-auto rounded-sm border p-2" style={{ borderColor: "rgba(127,224,255,.25)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Esquema das ramificações do estudo">
        {passos.map((p, i) => fio(colX[0], yE + 13, colX[1] + 190, yP(i) + 13, false, `fp${i}`))}
        {comps.map((c, i) => fio(passos.length ? colX[1] : colX[0], passos.length ? yP(Math.min(i, passos.length - 1)) + 13 : yE + 13, colX[2] + 260, yC(i) + 13, false, `fc${i}`))}
        {abertos.map((a, i) => fio(colX[0], yE + 13, colX[2] + 260, yC(comps.length + i) + 13, true, `fa${i}`))}
        {caixa(colX[0], yE, 140, bp.titulo, "#7fe0ff")}
        {passos.map((p, i) => caixa(colX[1], yP(i), 190, p.titulo, "#ffd36b", false, `p${i}`))}
        {comps.map((c, i) => caixa(colX[2], yC(i), 260, `${c.codigo} ${c.titulo}`, "#7dffb0", false, `c${i}`))}
        {abertos.map((a, i) => caixa(colX[2], yC(comps.length + i), 260, `? ${a.titulo}`, "#c9b6ff", true, `a${i}`))}
      </svg>
    </div>
  );
}
