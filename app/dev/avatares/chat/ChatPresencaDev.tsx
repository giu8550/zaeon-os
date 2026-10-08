"use client";

import { useEffect, useRef, useState } from "react";
import CoworkComposer from "@/components/study/CoworkComposer";
import RostoDaAba from "@/components/agents/avatar/RostoDaAba";
import BoasVindasAgente from "@/components/agents/avatar/BoasVindasAgente";
import AgentePilula from "@/components/agents/avatar/AgentePilula";
import { useFalaAoChegar, usePublicarPresenca } from "@/components/agents/avatar/hooks";
import { sinalDoChat } from "@/lib/avatars/presenca";
import { AcoesResposta } from "@/components/chat/MensagemAcoes";

type Msg = { id: string; role: "user" | "assistant"; text: string };

const RESPOSTAS = [
  "Boa pergunta! Em resumo: a ideia central é dividir o problema em partes menores, resolver cada uma e juntar no final. Quer que eu monte um exemplo passo a passo?",
  "Fechado. Separei em 3 blocos: conceito, exemplo resolvido e 5 exercícios do mais fácil pro mais difícil. Começo pelo conceito?",
  "Achei! O trecho que você procura fala justamente disso — e dá pra citar assim: (SILVA, 2021, p. 12). Salvo nas suas citações?",
];

export default function ChatPresencaDev() {
  const [aba, setAba] = useState<"chat" | "estudos">("chat");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const n = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // como o chat de verdade: a conversa acompanha a última mensagem
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  const ultima = [...msgs].reverse().find((m) => m.role === "assistant");
  const sinalTurno = sinalDoChat({
    pensando: sending && !!ultima && !ultima.text,
    falando: sending && !!ultima && !!ultima.text,
    digitando: !sending && input.trim().length > 0,
  });
  const sinal = useFalaAoChegar(sinalTurno, ultima?.text || "");
  const rosto = usePublicarPresenca("aura", sinal);

  const enviar = () => {
    const texto = input.trim();
    if (!texto || sending) return;
    const id = `a${++n.current}`;
    setMsgs((m) => [...m, { id: `u${n.current}`, role: "user", text: texto }, { id, role: "assistant", text: "" }]);
    setInput("");
    setSending(true);
    const palavras = RESPOSTAS[(n.current - 1) % RESPOSTAS.length].split(" ");
    let t = 1800; // pensando
    palavras.forEach((_, k) => {
      t += 90 + Math.random() * 110;
      timers.current.push(setTimeout(() => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, text: palavras.slice(0, k + 1).join(" ") } : x))), t));
    });
    timers.current.push(setTimeout(() => setSending(false), t + 200));
  };

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-violet-100/60 dark:from-[#060a16] dark:to-[#0b1020]">
      <header className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-slate-200/70 dark:border-white/10">
        <span className="mr-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/40">Sala de Estudos · prova sem login</span>
        <button type="button" onClick={() => setAba("chat")} aria-pressed={aba === "chat"}
          className={`flex items-center gap-1.5 pl-1.5 pr-3.5 py-1.5 rounded-[13px] border font-tech ${aba === "chat" ? "bg-gradient-to-b from-cyan-100 to-violet-100 border-cyan-300 dark:from-cyan-400/20 dark:to-violet-500/15 dark:border-cyan-300/30 text-slate-900 dark:text-white" : "bg-white border-slate-200 text-slate-700 dark:bg-white/[0.04] dark:border-white/10 dark:text-white/70"}`}>
          <RostoDaAba agentId="aura" nome="Aura" ativa={aba === "chat"} size={24}><span>⟁</span></RostoDaAba>
          <span className="text-[13px] font-bold">Chat</span>
        </button>
        <button type="button" onClick={() => setAba("estudos")} aria-pressed={aba === "estudos"}
          className={`px-3.5 py-2 rounded-[12px] border text-[11px] font-semibold ${aba === "estudos" ? "bg-slate-900 text-white border-transparent dark:bg-white dark:text-black" : "bg-white border-slate-200 text-slate-700 dark:bg-white/[0.04] dark:border-white/10 dark:text-white/70"}`}>
          Meus Estudos
        </button>
      </header>

      {aba === "estudos" ? (
        <section className="flex-1 grid place-items-center p-8 text-center text-[14px] text-slate-600 dark:text-white/60">
          <p className="max-w-md">Outra aba. Olhe a <b>bolinha do Chat</b> lá em cima: ela continua pensando/falando junto com a conversa e, quando a Aura termina, aparece um anel pulsando até você voltar.</p>
        </section>
      ) : (
        <section className="flex-1 min-h-0 flex flex-col w-full max-w-3xl mx-auto px-4">
          <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-4">
            {msgs.length === 0 && <BoasVindasAgente agentId="aura" nome="Aura" sinal={rosto.sinal} boca={rosto.boca} />}
            {msgs.map((m) => m.role === "user" ? (
              <p key={m.id} className="self-end max-w-[80%] px-4 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-900 dark:bg-white/[0.09] dark:border-white/10 dark:text-white/90 font-tech text-[16px]">{m.text}</p>
            ) : (
              <div key={m.id} className="self-start max-w-[85%] flex flex-col items-start relative pl-12">
                <AgentePilula agentId="aura" nome="Aura" estado={rosto.sinal} boca={rosto.boca} ultima={m.id === ultima?.id} className="absolute left-0 top-0" />
                <div className="px-4 py-2.5 rounded-2xl bg-white/80 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/10 text-slate-800 dark:text-white/90 font-tech text-[16px] leading-relaxed">
                  {m.text || <span className="inline-flex gap-1 py-1">{[0, 1, 2].map((k) => <span key={k} className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: `${k * 140}ms` }} />)}</span>}
                </div>
                {/* as mini-ações de verdade (com "ouvir resposta" → a boca segue a voz) */}
                {m.text && !(sending && m.id === ultima?.id) && <AcoesResposta msgId={m.id} texto={m.text} className="!opacity-100" />}
              </div>
            ))}
            <div ref={fim} />
          </div>
          <div className="pb-5">
            <CoworkComposer value={input} onChange={setInput} onSubmit={enviar} onToggleStudio={() => {}} busy={sending} idle={msgs.length === 0} active placeholder="Fale com a Aura…" />
          </div>
        </section>
      )}
    </main>
  );
}
