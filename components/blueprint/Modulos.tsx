"use client";
/**
 * Os MÓDULOS da prancha do blueprint (lib/blueprint/layout): cada um é um card no estilo do BoardEstudos — cantos de
 * registro, o carimbo "TIPO · X-NN" com a régua (arrasta por ali), título mono. O conhecimento (passos) à esquerda, o
 * estudo/figura/críticos no centro, a prática à direita.
 */
import type { ReactNode } from "react";
import { NOME_FASE, type Critico, type DocBlueprint, type Fase } from "@/lib/blueprint/tipos";

export const COR = {
  estudo: "#7fe0ff", passo: "#ffd36b", critico: "#ff4d5e", provado: "#7dffb0", figura: "#7fe0ff", repos: "#7fe0ff",
  conversas: "#ff9ec7", demo: "#ffd36b", produto: "#c9b6ff", proximos: "#e8f6ff", nota: "#e8f6ff", avaliacao: "#ffd36b",
} as const;
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const dois = (n: number) => String(n).padStart(2, "0");

export function CardPrancha({ cor, carimbo, direita, children, fundo, brilho, onArrastar, apagado }: {
  cor: string; carimbo: string; direita?: ReactNode; children: ReactNode; fundo?: string; brilho?: boolean; apagado?: boolean;
  onArrastar?: (e: React.PointerEvent) => void;
}) {
  return (
    <div className="relative rounded-[3px] text-[13px] leading-snug text-sky-50" style={{
      background: fundo ?? "rgba(12,45,82,.92)", border: `1.6px solid ${cor}`, padding: "10px 12px", opacity: apagado ? 0.62 : 1,
      boxShadow: `8px 10px 0 rgba(0,10,25,.35), inset 0 0 0 1px rgba(255,255,255,.04)${brilho ? `, 0 0 0 3px ${cor}22, 0 0 26px ${cor}40` : ""}`,
    }}>
      {["left-1 top-1 border-l border-t", "right-1 top-1 border-r border-t", "left-1 bottom-1 border-l border-b", "right-1 bottom-1 border-r border-b"].map((k) => <span key={k} className={`pointer-events-none absolute h-2 w-2 ${k}`} style={{ borderColor: cor }} />)}
      <div className={`mb-1.5 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] ${onArrastar ? "cursor-grab active:cursor-grabbing" : ""}`} style={{ color: cor }} onPointerDown={onArrastar}>
        <span className="whitespace-nowrap">{carimbo}</span>
        <span className="h-px flex-1" style={{ background: `${cor}55` }} />
        {direita}
      </div>
      {children}
    </div>
  );
}

const Titulo = ({ children, grande }: { children: ReactNode; grande?: boolean }) => <div className={`font-semibold ${grande ? "text-[17px]" : ""}`} style={{ fontFamily: MONO, letterSpacing: "0.01em" }}>{children}</div>;
const Texto = ({ children }: { children: ReactNode }) => <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-sky-50/85">{children}</p>;
const Falta = ({ children }: { children: ReactNode }) => <span className="italic text-sky-200/45">{children}</span>;
export function TagFase({ fase, doc }: { fase: Fase; doc: DocBlueprint }) {
  const cor = fase < doc.fase ? COR.provado : fase === doc.fase ? COR.critico : "rgba(186,230,253,.55)";
  return <span className="rounded-sm border px-1.5 font-mono text-[9.5px] tracking-[0.12em]" style={{ borderColor: cor, color: cor }}>FASE {fase}{fase < doc.fase ? " ✓" : fase > doc.fase ? " 🔒" : ""}</span>;
}
const codigoCritico = (doc: DocBlueprint, c: Critico) => `R-${dois(doc.criticos.indexOf(c) + 1)}`;

export function TrilhoFases({ doc }: { doc: DocBlueprint }) {
  return (
    <div className="mt-2.5 flex">
      {([1, 2, 3, 4] as Fase[]).map((f, i) => {
        const ok = f < doc.fase || (f === 4 && doc.aguardandoMentor), at = f === doc.fase && !doc.aguardandoMentor;
        const cor = ok ? COR.provado : at ? "#fff" : "rgba(186,230,253,.55)";
        return (
          <div key={f} className="flex-1 border px-1 py-1 text-center font-mono text-[9.5px] tracking-wide" style={{ borderColor: ok ? "rgba(125,255,176,.45)" : at ? COR.critico : "rgba(150,205,255,.2)", borderLeftWidth: i ? 0 : 1, color: cor, background: at ? "rgba(255,77,94,.18)" : undefined }}>
            {ok ? "✓" : at ? "●" : "🔒"} {f} {NOME_FASE[f].toUpperCase()}
            {f === 4 && <span style={{ color: "#ffd36b" }}>{doc.aguardandoMentor ? " · aguardando mentor" : " · mentor"}</span>}
          </div>
        );
      })}
    </div>
  );
}

function Botao({ children, cor, onClick, titulo, desabilitado }: { children: ReactNode; cor: string; onClick?: () => void; titulo?: string; desabilitado?: boolean }) {
  return <button type="button" title={titulo} disabled={desabilitado} onPointerDown={(e) => e.stopPropagation()} onClick={onClick} className="rounded-sm border px-2 py-1 font-mono text-[10.5px] tracking-wide transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: `${cor}88`, color: cor }}>{children}</button>;
}

export type AcoesModulo = { avaliar?: () => void; avaliando?: boolean; recompor?: () => void; recompondo?: boolean; reorganizar?: () => void; temFixos?: boolean; podeEditar: boolean; extra?: (id: string) => ReactNode };

/** o card de um módulo pelo id do layout */
export function Modulo({ id, doc, acoes, onArrastar }: { id: string; doc: DocBlueprint; acoes: AcoesModulo; onArrastar?: (e: React.PointerEvent) => void }) {
  const abertosDaFase = doc.criticos.filter((c) => c.status === "aberto" && c.fase === doc.fase);
  if (id === "estudo") {
    return (
      <CardPrancha cor={COR.estudo} carimbo="ESTUDO · E-01" direita={<span className="font-mono text-[9.5px] text-sky-200/60">{doc.area}</span>} onArrastar={onArrastar}>
        <Titulo grande>{doc.titulo.toUpperCase()}</Titulo>
        {doc.resumo ? <Texto>{doc.resumo}</Texto> : <Texto><Falta>a Zaeon está montando o blueprint desta conversa…</Falta></Texto>}
        <TrilhoFases doc={doc} />
        {abertosDaFase.length > 0 && <div className="mt-2 font-mono text-[10.5px]" style={{ color: COR.critico }}>● {abertosDaFase.length} crítico{abertosDaFase.length > 1 ? "s" : ""} travando a fase {doc.fase}</div>}
        {acoes.podeEditar && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {acoes.avaliar && <Botao cor={COR.avaliacao} titulo="A fase está toda provada: a Zaeon avalia pela rubrica" onClick={acoes.avaliar} desabilitado={acoes.avaliando}>{acoes.avaliando ? "▮ a Zaeon está avaliando…" : "✦ pedir avaliação da Zaeon"}</Botao>}
            {acoes.recompor && <Botao cor={COR.estudo} titulo="A Zaeon recompõe o blueprint agora (ela já faz isso sozinha a cada conversa)" onClick={acoes.recompor} desabilitado={acoes.recompondo}>{acoes.recompondo ? "▮ a Zaeon está recompondo…" : "⟳ Zaeon atualiza"}</Botao>}
            {acoes.reorganizar && acoes.temFixos && <Botao cor="#e8f6ff" titulo="Solta o que você arrastou e volta ao alinhamento simétrico" onClick={acoes.reorganizar}>⊞ reorganizar</Botao>}
          </div>
        )}
      </CardPrancha>
    );
  }
  if (id === "figura") {
    return (
      <CardPrancha cor={COR.figura} carimbo="FIGURA · F-01" direita={<span className="font-mono text-[9.5px] text-sky-200/60">o objeto é a explicação</span>} onArrastar={onArrastar}>
        {acoes.extra?.("figura") ?? (
          <ul className="space-y-1 font-mono text-[11.5px]">
            {doc.pecas.map((p, i) => <li key={p.id} className="flex items-center gap-2"><span style={{ color: p.fase < doc.fase ? COR.provado : COR.estudo }}>C-{dois(i + 1)}</span><span>{p.nome}</span>{p.sub && <span className="text-sky-200/50">— {p.sub}</span>}</li>)}
          </ul>
        )}
      </CardPrancha>
    );
  }
  if (id === "avaliacao") {
    const a = doc.avaliacoes[doc.avaliacoes.length - 1]!;
    return (
      <CardPrancha cor={COR.avaliacao} carimbo="AVALIAÇÃO · ZAEON" fundo="rgba(48,38,8,.85)" direita={<span className="font-mono text-[9.5px]" style={{ color: a.aprovada ? COR.provado : COR.critico }}>fase {a.fase} {a.aprovada ? "aprovada" : "ainda não"}</span>} onArrastar={onArrastar}>
        {(["rigor", "originalidade", "usabilidade", "viabilidade", "impacto"] as const).map((k) => (
          <div key={k} className="my-1 flex items-center gap-2 font-mono text-[10.5px]">
            <span className="w-28 text-sky-200/70">{k === "usabilidade" ? "usabilidade real" : k}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded bg-sky-950/60"><span className="block h-full" style={{ width: `${a.nota[k]}%`, background: COR.avaliacao }} /></span>
            <span className="w-7 text-right">{a.nota[k]}</span>
          </div>
        ))}
        <Texto>{a.parecer}</Texto>
      </CardPrancha>
    );
  }
  if (id.startsWith("critico:")) {
    const c = doc.criticos.find((k) => `critico:${k.id}` === id)!;
    const peca = c.pecaId ? doc.pecas.find((p) => p.id === c.pecaId) : undefined;
    return (
      <CardPrancha cor={COR.critico} carimbo={`CRÍTICO · ${codigoCritico(doc, c)}`} fundo="rgba(52,14,26,.85)" brilho direita={<span className="font-mono text-[9.5px]" style={{ color: COR.critico }}>trava fase {c.fase}</span>} onArrastar={onArrastar}>
        <Titulo>{c.titulo}</Titulo>
        <div className="mt-2 border border-dashed px-2 py-1.5 font-mono text-[10.5px]" style={{ borderColor: "rgba(255,77,94,.6)", color: "#ffc2c8" }}>PROVA: {c.prova}{peca ? ` · peça ${peca.nome}` : ""}</div>
        {acoes.extra?.(id)}
      </CardPrancha>
    );
  }
  if (id.startsWith("passo:")) {
    const i = doc.passos.findIndex((p) => `passo:${p.id}` === id), p = doc.passos[i]!;
    const trava = doc.criticos.filter((c) => c.passoId === p.id);
    return (
      <CardPrancha cor={COR.passo} carimbo={`PERCURSO · P-${dois(i + 1)}`} direita={<TagFase fase={p.fase} doc={doc} />} apagado={p.fase > doc.fase} onArrastar={onArrastar}>
        <Titulo>{i + 1}. {p.titulo}</Titulo>
        {p.corpo && <Texto>{p.corpo}</Texto>}
        {p.fontes.length > 0 && (
          <ul className="mt-2 space-y-0.5 border-t pt-2 text-[11px] text-emerald-100/85" style={{ borderColor: "rgba(125,255,176,.25)" }}>
            {p.fontes.map((f, k) => <li key={k}>✓ {f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted" onPointerDown={(e) => e.stopPropagation()}>{f.titulo}</a> : f.titulo}{f.ano ? ` (${f.ano})` : ""}</li>)}
          </ul>
        )}
        {trava.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{trava.map((c) => <span key={c.id} className="rounded-sm border px-1.5 py-0.5 font-mono text-[10px]" style={{ borderColor: c.status === "provado" ? COR.provado : COR.critico, color: c.status === "provado" ? COR.provado : COR.critico }}>{c.status === "provado" ? "✓" : "●"} {codigoCritico(doc, c)} {c.status === "provado" ? "provado" : "trava"}</span>)}</div>}
      </CardPrancha>
    );
  }
  if (id === "repos") {
    return (
      <CardPrancha cor={COR.repos} carimbo="REPOSITÓRIOS · G-01" direita={<span className="font-mono text-[9.5px] text-sky-200/60">GitHub</span>} onArrastar={onArrastar}>
        <ul className="font-mono text-[11.5px]">
          {doc.repos.map((r) => (
            <li key={r.nome} className="flex items-center gap-2 border-t py-1 first:border-t-0" style={{ borderColor: "rgba(150,205,255,.1)" }}>
              <span style={{ color: r.meu ? COR.provado : COR.repos }}>⌥</span>
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline" title={r.descricao} onPointerDown={(e) => e.stopPropagation()}>{r.nome}</a>
              {r.meu ? <span className="ml-auto text-[10px]" style={{ color: COR.provado }}>seu ✓</span> : r.estrelas ? <span className="ml-auto text-[10px] text-sky-200/50">★ {r.estrelas >= 1000 ? `${(r.estrelas / 1000).toFixed(1)}k` : r.estrelas}</span> : null}
            </li>
          ))}
        </ul>
      </CardPrancha>
    );
  }
  if (id === "conversas") {
    const ROSTO: Record<string, string> = { mentor: "#2a4f7a", agente: "#3b2a5c", dev: "#4a3a1a", voce: "#1f4d3a" };
    return (
      <CardPrancha cor={COR.conversas} carimbo="CONVERSAS · D-01" direita={<span className="font-mono text-[9.5px] text-sky-200/60">{doc.participantes.length}</span>} onArrastar={onArrastar}>
        <ul className="text-[12px]">
          {doc.participantes.map((p) => (
            <li key={p.id} className="flex items-center gap-2 border-t py-1 first:border-t-0" style={{ borderColor: "rgba(150,205,255,.1)" }}>
              <span className="grid h-5 w-5 place-items-center rounded-full text-[11px]" style={{ background: ROSTO[p.papel] }}>{p.emoji ?? p.nome.slice(0, 1)}</span>
              <span>{p.nome}</span><span className="ml-auto font-mono text-[9.5px]" style={{ color: COR.conversas }}>{p.papel === "voce" ? "você" : p.papel}</span>
            </li>
          ))}
        </ul>
      </CardPrancha>
    );
  }
  if (id === "demo") {
    const d = doc.demo, aberta = doc.fase >= 3;
    return (
      <CardPrancha cor={COR.demo} carimbo="DEMO · X-01" direita={<TagFase fase={3} doc={doc} />} apagado={!aberta} onArrastar={onArrastar}>
        <Titulo>{d?.titulo ?? "Demo / protótipo"}</Titulo>
        <Texto>{d?.corpo ?? (aberta ? "Coloque a demo no ar e prove no crítico da fase." : "Abre na fase 3 — a prova de conceito vem antes.")}</Texto>
        {d?.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-mono text-[11px] underline" style={{ color: COR.provado }} onPointerDown={(e) => e.stopPropagation()}>● demo no ar</a>}
      </CardPrancha>
    );
  }
  if (id === "produto") {
    return (
      <CardPrancha cor={COR.produto} carimbo="PRODUTO · M-01" direita={<span className="font-mono text-[9.5px] text-sky-200/60">o que vira</span>} onArrastar={onArrastar}>
        <Titulo>{doc.produto?.titulo}</Titulo>{doc.produto?.corpo && <Texto>{doc.produto.corpo}</Texto>}
      </CardPrancha>
    );
  }
  if (id === "proximos") {
    return (
      <CardPrancha cor={COR.proximos} carimbo="PRÓXIMOS · N-01" direita={<span className="font-mono text-[9.5px] text-sky-200/60">Zaeon</span>} onArrastar={onArrastar}>
        <ol className="space-y-1 text-[12px]">{doc.proximos.map((p, i) => <li key={i}><span className="font-mono text-sky-200/60">{i + 1}.</span> {p}</li>)}</ol>
      </CardPrancha>
    );
  }
  if (id.startsWith("nota:")) {
    const n = doc.notas.find((k) => `nota:${k.id}` === id)!;
    return (
      <CardPrancha cor={COR.nota} carimbo="NOTA" onArrastar={onArrastar}>
        {n.titulo && <Titulo>{n.titulo}</Titulo>}{n.corpo && <Texto>{n.corpo}</Texto>}
      </CardPrancha>
    );
  }
  return null;
}
