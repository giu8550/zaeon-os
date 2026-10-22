"use client";
/**
 * SalaBlueprint — a Sala de Estudos como BLUEPRINT PRÁTICO (spec docs/superpowers/specs/2026-10-22-blueprint-pratico-
 * design.md). No TOPO, o seletor: um item por conversa do chat que virou estudo (fase, críticos abertos, a barrinha das
 * 4 fases). Embaixo, a prancha do estudo aberto, com todo o espaço da tela. Flag NEXT_PUBLIC_BLUEPRINT_PRATICO.
 */
import type { ResumoBlueprint } from "@/lib/blueprint/server";
import { podeEscrever } from "@/lib/cartolina/access";
import { COR } from "./Modulos";
import PranchaBlueprint from "./PranchaBlueprint";
import { useState } from "react";
import { NOME_FASE } from "@/lib/blueprint/tipos";
import { precisaAvaliar } from "@/lib/blueprint/fases";
import { useBlueprint } from "./useBlueprint";

const AZUL = "#0b2c4d";

function BarrinhaFases({ b }: { b: Pick<ResumoBlueprint, "fase" | "aguardandoMentor"> }) {
  return (
    <div className="mt-1.5 flex gap-[3px]">
      {[1, 2, 3, 4].map((f) => {
        const ok = f < b.fase || (f === 4 && b.aguardandoMentor), at = f === b.fase && !b.aguardandoMentor;
        return <i key={f} className="h-[3px] flex-1 rounded-sm" style={{ background: ok ? (f === 4 ? "#ffd36b" : COR.provado) : at ? COR.critico : "rgba(150,205,255,.14)" }} />;
      })}
    </div>
  );
}

/** o campo da PROVA dentro do crítico vermelho: cola o link do artefato; o servidor confere */
function ProvaForm({ criticoId, tipo, enviar }: { criticoId: string; tipo: string; enviar: (criticoId: string, url: string) => Promise<{ ok: boolean; motivo?: string }> }) {
  const [url, setUrl] = useState(""), [estado, setEstado] = useState<{ enviando?: boolean; erro?: string }>({});
  const mandar = async () => {
    if (!url.trim() || estado.enviando) return;
    setEstado({ enviando: true });
    const r = await enviar(criticoId, url.trim());
    setEstado(r.ok ? {} : { erro: r.motivo ?? "a prova não passou" });
    if (r.ok) setUrl("");
  };
  return (
    <div className="mt-2" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex gap-1.5">
        <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void mandar(); }} maxLength={500}
          placeholder={tipo === "repo" ? "https://github.com/você/repo" : "https://… (o link do artefato)"}
          className="min-w-0 flex-1 rounded-sm border bg-black/20 px-2 py-1 font-mono text-[11px] text-sky-50 outline-none placeholder:text-rose-100/35" style={{ borderColor: "rgba(255,77,94,.5)" }} />
        <button type="button" onClick={() => void mandar()} disabled={estado.enviando || !url.trim()} className="rounded-sm border px-2 py-1 font-mono text-[10.5px] text-white transition hover:bg-white/10 disabled:opacity-40" style={{ borderColor: COR.critico, background: "rgba(255,77,94,.25)" }}>
          {estado.enviando ? "conferindo…" : "enviar prova →"}
        </button>
      </div>
      {estado.erro && <div className="mt-1 font-mono text-[10.5px] text-rose-200">{estado.erro}</div>}
    </div>
  );
}

export default function SalaBlueprint({ inicialId }: { inicialId?: string | null }) {
  const B = useBlueprint(inicialId);
  const { lista, atual } = B;
  const [aviso, setAviso] = useState<string | null>(null), [avaliando, setAvaliando] = useState(false);
  const enviar = async (criticoId: string | null, url: string) => {
    const r = await B.enviarProva(criticoId, url);
    if (r.avaliacao) {
      setAviso(r.avaliacao.aprovada ? `✓ A Zaeon aprovou a fase ${r.avaliacao.fase} (${NOME_FASE[r.avaliacao.fase]}). ${r.avaliacao.fase < 4 ? "A próxima fase abriu." : "Agora é com o mentor."}` : `A Zaeon ainda não aprovou a fase ${r.avaliacao.fase} — veja o parecer na prancha.`);
      setTimeout(() => setAviso(null), 7000);
    } else if (r.ok && r.motivo) { setAviso(r.motivo); setTimeout(() => setAviso(null), 7000); }
    return r;
  };
  return (
    <div className="flex h-full w-full flex-col" style={{ background: AZUL }}>
      <div className="flex flex-none items-stretch gap-2 overflow-x-auto border-b px-3 py-2" style={{ background: "rgba(5,22,42,.9)", borderColor: "rgba(127,224,255,.3)" }}>
        <span className="self-center whitespace-nowrap pr-1 font-mono text-[11px] tracking-[0.2em] text-sky-300">BLUEPRINTS</span>
        {lista === null && <span className="self-center font-mono text-[11px] text-sky-200/50">carregando…</span>}
        {lista?.map((b) => (
          <button key={b.id} type="button" onClick={() => void B.abrir(b.id)} className="min-w-[190px] flex-none rounded-[3px] border px-2.5 py-1.5 text-left font-mono transition hover:bg-white/5"
            style={{ borderColor: atual?.id === b.id ? COR.estudo : "rgba(127,224,255,.25)", background: atual?.id === b.id ? "rgba(127,224,255,.08)" : undefined }}>
            <b className="block max-w-[240px] truncate text-[12px] text-sky-50">{b.titulo}</b>
            <small className="text-[10px] text-sky-200/70">
              {b.area} · {b.aguardandoMentor ? <span style={{ color: "#ffd36b" }}>aguardando mentor</span> : <>fase {b.fase}{b.criticosAbertos ? <> · <span style={{ color: COR.critico }}>{b.criticosAbertos} crítico{b.criticosAbertos > 1 ? "s" : ""}</span></> : null}</>}
            </small>
            <BarrinhaFases b={b} />
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        {atual ? (
          <PranchaBlueprint id={atual.id} doc={atual.doc} onFixar={B.fixar}
            acoes={{ podeEditar: podeEscrever(atual.papel), avaliando,
              avaliar: podeEscrever(atual.papel) && precisaAvaliar(atual.doc) ? () => { setAvaliando(true); void enviar(null, "").finally(() => setAvaliando(false)); } : undefined, recompor: atual.papel === "dono" ? B.recompor : undefined, recompondo: B.recompondo, reorganizar: B.reorganizar, temFixos: Object.keys(atual.doc.fixos).length > 0,
              extra: podeEscrever(atual.papel) ? (id) => { const c = id.startsWith("critico:") ? atual.doc.criticos.find((k) => `critico:${k.id}` === id) : undefined; return c ? <ProvaForm criticoId={c.id} tipo={c.tipoProva} enviar={enviar} /> : undefined; } : undefined }}
            sobre={aviso ? <div className="absolute left-1/2 top-3 z-[95] -translate-x-1/2 rounded border px-3 py-1.5 font-mono text-[11.5px] text-sky-50" style={{ background: "rgba(5,22,42,.92)", borderColor: COR.avaliacao }}>{aviso}</div> : undefined} />
        ) : lista && !lista.length ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-md text-center font-mono text-[12.5px] leading-relaxed text-sky-100/75">
              <div className="mb-2 text-[11px] tracking-[0.2em] text-sky-300">NENHUM BLUEPRINT AINDA</div>
              Converse com a Aura sobre um tema que você quer dominar. Quando a conversa virar um estudo, o blueprint dele
              nasce aqui — com o percurso, os repositórios do tema, o que construir e os críticos que destravam cada fase.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
