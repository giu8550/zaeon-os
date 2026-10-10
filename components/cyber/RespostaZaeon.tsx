"use client";
/**
 * RespostaZaeon — o painel onde a pessoa RESPONDE a pergunta da Zaeon (o holograma da capela, lib/cyber/conversaZaeon).
 * Botões pras escolhas e/ou um campo de texto (Enter envia). Não é o chat da sala: a resposta vai só pra Zaeon (e pro
 * perfil da pessoa no servidor), nada é difundido.
 */
import { useEffect, useRef, useState } from "react";
import { MAX_RESPOSTA, type PerguntaZaeon } from "@/lib/cyber/conversaZaeon";

export default function RespostaZaeon(p: { pergunta: PerguntaZaeon & { n: number; total: number }; touch: boolean; onResponder(r: string): void }) {
  const q = p.pergunta, [txt, setTxt] = useState(""), campo = useRef<HTMLInputElement>(null);
  const comTexto = q.tipo === "texto" || q.outro;
  useEffect(() => { setTxt(""); if (q.tipo === "texto") campo.current?.focus(); }, [q.id, q.tipo]);
  const enviar = (r: string) => { const v = r.trim(); if (v) p.onResponder(v); };
  return (
    <div role="dialog" aria-label={`Zaeon pergunta: ${q.fala}`} className="absolute left-1/2 z-[27] w-[min(94vw,520px)] -translate-x-1/2 rounded-2xl border border-cyan-300/40 bg-[#041322]/88 p-3.5 text-sm text-cyan-50 shadow-[0_0_40px_-10px_rgba(127,232,255,.7)] backdrop-blur" style={{ bottom: p.touch ? 150 : 96 }}>
      {/* a pergunta já está no balão da Zaeon (e na voz dela): aqui, só as respostas — nada de repetir a fala */}
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-200/80">Responda à Zaeon</p>
      {q.opcoes && (
        <div className="mt-2 flex flex-wrap gap-2">
          {q.opcoes.map((o) => <button key={o} type="button" onClick={() => enviar(o)} className="min-h-[38px] rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3.5 text-[13px] font-semibold text-cyan-50 hover:bg-cyan-400/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">{o}</button>)}
        </div>
      )}
      {comTexto && (
        <form className="mt-2.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); enviar(txt); }}>
          <input ref={campo} value={txt} onChange={(e) => setTxt(e.target.value)} maxLength={MAX_RESPOSTA} placeholder={q.placeholder ?? (q.outro ? "Ou escreva…" : "Sua resposta")} aria-label="Sua resposta pra Zaeon"
            className="min-h-[40px] flex-1 rounded-xl border border-cyan-300/30 bg-[#020b16]/80 px-3 text-[13px] text-white outline-none focus:border-cyan-200" />
          <button type="submit" disabled={!txt.trim()} className="min-h-[40px] rounded-full bg-gradient-to-b from-cyan-100 to-cyan-400 px-4 text-xs font-extrabold text-slate-950 disabled:opacity-40">Responder</button>
        </form>
      )}
    </div>
  );
}
