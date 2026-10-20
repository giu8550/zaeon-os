"use client";
/**
 * DueloIngles — o QUIZ do duelo de linguagem da Examiner (lib/cyber/dueloIngles): as 7 perguntas, uma por vez, com as
 * 4 opções; no fim, o VEREDITO como no Relicário — venceu: o selo dourado e a porta da cúpula abre; perdeu: a tela fica
 * VERMELHA com o erro medido (cada pergunta errada: o que deu, o que era e por quê) e a espera pra tentar de novo.
 * Quem fala com o servidor é quem monta (CenaCyber → CosmicLounge); aqui só a tela.
 */
import { useEffect, useState } from "react";
import { NOTA_MINIMA, TOTAL_PERGUNTAS, type PerguntaPublica, type Resultado } from "@/lib/cyber/dueloIngles";

export type DueloApi = {
  iniciar(): Promise<{ perguntas?: PerguntaPublica[]; passou?: boolean; erro?: string }>;
  responder(respostas: (number | null)[]): Promise<Resultado | { erro: string }>;
};

export function DueloIngles({ api, onFim, onCancelar }: { api: DueloApi; onFim: (passou: boolean) => void; onCancelar: () => void }) {
  const [perguntas, setPerguntas] = useState<PerguntaPublica[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [respostas, setRespostas] = useState<(number | null)[]>(() => Array(TOTAL_PERGUNTAS).fill(null));
  const [res, setRes] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.iniciar().then((r) => { if (!vivo) return; if (r.passou) onFim(true); else if (r.perguntas) setPerguntas(r.perguntas); else setErro(r.erro ?? "A Examiner não respondeu."); })
      .catch(() => { if (vivo) setErro("Sem conexão com a Examiner."); });
    return () => { vivo = false; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = async (k: number) => {
    if (!perguntas || enviando) return;
    const nova = respostas.slice(); nova[i] = k; setRespostas(nova);
    if (i + 1 < perguntas.length) { setI(i + 1); return; }
    setEnviando(true);
    try { const r = await api.responder(nova); if ("erro" in r) setErro(r.erro); else setRes(r); } catch { setErro("Sem conexão com a Examiner."); }
    setEnviando(false);
  };

  const vermelho = res && !res.passou;
  return (
    <div role="dialog" aria-modal="true" aria-label="Duelo de linguagem" className="absolute inset-0 z-[40] flex items-center justify-center p-4"
      style={{ background: vermelho ? "radial-gradient(circle at 50% 40%, rgba(150,0,16,.88), rgba(40,0,6,.96))" : "radial-gradient(circle at 50% 40%, rgba(30,4,10,.82), rgba(4,2,6,.94))" }}>
      <div className="w-full max-w-[640px] rounded-2xl border-2 p-5 sm:p-7 text-[#fff4f4]" style={{ borderColor: res?.passou ? "#ffc46b" : "#ff3344", boxShadow: `0 0 60px -10px ${res?.passou ? "#ffc46b" : "#ff3344"}`, background: "linear-gradient(180deg,rgba(18,6,10,.96),rgba(6,2,4,.98))" }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[12px] font-black uppercase tracking-[0.28em] text-[#ff6b78]">◆ Duelo de linguagem · Examiner</p>
          {!res && perguntas && <p className="text-[12px] font-bold tabular-nums text-rose-100/70">{i + 1} / {perguntas.length}</p>}
        </div>

        {erro && (<>
          <p className="text-[17px] font-semibold">{erro}</p>
          <div className="mt-5 flex justify-end"><button type="button" onClick={onCancelar} className="rounded-lg border border-rose-300/50 px-4 py-2 text-[14px] font-bold hover:bg-rose-500/10">Voltar</button></div>
        </>)}

        {!erro && !perguntas && <p className="animate-pulse text-[16px] text-rose-100/80">Os olhos dela brilham… as perguntas estão vindo.</p>}

        {!erro && perguntas && !res && (() => { const p = perguntas[i]!; return (<>
          <div className="mb-3 flex gap-1.5" aria-hidden>{perguntas.map((_, k) => <span key={k} className="h-1.5 flex-1 rounded-full" style={{ background: k < i ? "#ff3344" : k === i ? "#ff8a96" : "rgba(255,255,255,.12)" }} />)}</div>
          <p className="min-h-[3em] text-[19px] font-bold leading-snug sm:text-[21px]">{p.enunciado}</p>
          <div className="mt-4 grid gap-2.5">
            {p.opcoes.map((op, k) => (
              <button key={k} type="button" disabled={enviando} onClick={() => void escolher(k)}
                className="flex items-center gap-3 rounded-xl border border-rose-300/25 bg-white/[0.03] px-4 py-3 text-left text-[16px] font-semibold transition hover:border-rose-300/70 hover:bg-rose-500/10 disabled:opacity-50">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-rose-300/50 text-[13px] font-black text-[#ff8a96]">{"ABCD"[k]}</span>{op}
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-between text-[12px] text-rose-100/55"><span>Passa quem acertar {NOTA_MINIMA} de {perguntas.length}.</span><button type="button" onClick={onCancelar} className="underline-offset-2 hover:underline">Desistir</button></div>
        </>); })()}

        {res && (<>
          <p className="text-center text-[clamp(24px,5vw,40px)] font-black uppercase tracking-[0.22em]" style={{ color: res.passou ? "#ffc46b" : "#ff6b6b", textShadow: `0 0 26px ${res.passou ? "rgba(255,196,107,.8)" : "rgba(255,40,60,.8)"}` }}>
            {res.passou ? "◆ Barreira quebrada ◆" : "Ainda não"}
          </p>
          <p className="mt-1 text-center text-[16px] font-bold tabular-nums">{res.acertos} de {res.total} certas</p>
          {res.erros.length > 0 && (
            <ul className="mt-4 max-h-[42vh] space-y-2.5 overflow-y-auto pr-1">
              {res.erros.map((e) => (
                <li key={e.i} className="rounded-lg border border-rose-300/25 bg-black/30 px-3.5 py-2.5 text-[14px]">
                  <p className="font-semibold">{e.enunciado}</p>
                  <p className="mt-1 text-rose-200/85">Você: <span className="font-bold">{e.deu ?? "—"}</span> · Certa: <span className="font-bold text-emerald-300">{e.certa}</span></p>
                  {e.explica && <p className="mt-0.5 text-rose-100/60">{e.explica}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-center text-[14px] text-rose-100/75">{res.passou ? "A porta da cúpula está aberta pra você — e o que vem acima também." : "Volte em 2 minutos e tente de novo."}</p>
          <div className="mt-5 flex justify-center"><button type="button" onClick={() => onFim(res.passou)} className="rounded-lg border-2 px-6 py-2.5 text-[15px] font-black uppercase tracking-[0.16em]" style={{ borderColor: res.passou ? "#ffc46b" : "#ff3344" }}>{res.passou ? "Entrar" : "Descer"}</button></div>
        </>)}
      </div>
    </div>
  );
}
