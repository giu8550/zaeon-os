"use client";

/**
 * ResearchChat — a MESMA interface de chat do co-working, com roupagem ACADÊMICA,
 * dentro da Sala de Pesquisa. O output é a voz do ESCRITOR e do REVISOR científico
 * (alterna no topo). Vive num painel que a pill do WindowSwitcher liga/desliga —
 * o aluno alterna entre o chat e o próprio trabalho de forma responsiva.
 *
 * Reusa CoworkComposer + AuraThinking + a datilografia do co-working. Fase 0: texto
 * (sem tools); na camada agêntica, o Escritor/Revisor ganham skills e o crítico.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import CoworkComposer from "@/components/study/CoworkComposer";
import AuraThinking from "@/components/study/AuraThinking";
import ChatMarkdown from "@/components/study/ChatMarkdown";
import { researchWorkType } from "@/lib/agent/tools";
import { appendTranscript, hydrateTranscript } from "@/lib/agent/transcriptClient";
import StructuredAnswerView from "@/components/study/StructuredAnswerView";
import type { StructuredAnswer } from "@/lib/agent/contracts";
import { parseStructuredStream, STRUCTURED_SENTINEL } from "@/lib/agent/structured-client";
import { separarProgresso, faseCorrente } from "@/lib/agent/progresso";
import { TCC_CROSS_ON, avisarTccMudou, tccApi } from "@/lib/tcc/client";

// `answer` presente = resposta estruturada do harness (render rico); `text` = nucleo (histórico).
type Msg = { id: string; role: "user" | "assistant"; text: string; answer?: StructuredAnswer; fase?: string };

// Deve bater com RESEARCH_SENTINEL de app/api/ai/chat/route.ts (a estruturada vem do structured-client).
const RESEARCH_SENTINEL = "@@RESEARCH_ACTION@@";
// L0 (docs/MEMORY_AND_PERSISTENCE.md): antes a conversa da Sala de Pesquisa ZERAVA
// (sem persistência + desmonta ao trocar de aba). Agora espelha o thread e o rascunho.
const THREAD_KEY_R = "zaeon.research.thread.v1";
const DRAFT_KEY_R = "zaeon.research.draft.v1";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const isQuick = (t: string) => t.trim().split(/\s+/).filter(Boolean).length <= 8;

// Sala de Pesquisa = MODO ACADÊMICO ESTRITO (única possibilidade, não é opção).
const ACADEMIC_STRICT =
  " MODO ACADÊMICO ESTRITO: aqui o rigor acadêmico é a ÚNICA possibilidade. Use apenas " +
  "fontes acadêmicas confiáveis (papers, periódicos revisados); NUNCA invente citações. Se não " +
  "houver base acadêmica sólida, diga isso e proponha caminhos — não preencha com achismo nem web casual.";

// Um assistente científico ÚNICO e completo: o PAPEL (escrever, revisar, pesquisar,
// explicar, estruturar) sai do CONTEXTO da conversa — não de um botão.
const SYS = (wt: string) =>
  `Você é o assistente científico da Zaeon na Sala de Pesquisa, dedicado ao ${wt} do aluno. ` +
  `É um parceiro acadêmico completo e inteligente, geral dentro do campo da ciência: conforme o que ` +
  `a pessoa pedir e o contexto do trabalho, você ESCREVE seções, REVISA e critica o texto, SUGERE e ` +
  `verifica referências, EXPLICA conceitos e ESTRUTURA o trabalho — sem escolher um papel fixo. ` +
  `Rigor acadêmico e linguagem formal em PT-BR; vá direto ao conteúdo. ` +
  `IMPORTANTE: quando a pessoa PEDIR pra GERAR/CRIAR/REDIGIR um trabalho (ex.: "gera um artigo sobre X", ` +
  `"faz um TCC sobre Y", "monta uma pesquisa disso"), CHAME a ferramenta research_generate (kind + topic) ` +
  `em vez de responder em texto — o trabalho é montado no documento. Para conversar, tirar dúvida ou ` +
  `revisar um trecho, responda em texto.` + ACADEMIC_STRICT;

const QUICK: { label: string; tpl: string }[] = [
  { label: "Escrever seção", tpl: "Escreva a seção sobre " },
  { label: "Revisar trecho", tpl: "Revise este trecho e aponte melhorias:\n" },
  { label: "Sugerir fontes", tpl: "Sugira referências acadêmicas sobre " },
  { label: "Resumir", tpl: "Resuma em 3 parágrafos: " },
];

export default function ResearchChat({
  workType,
  tccWorkId,
  active = true,
}: {
  workType?: string | null;
  /** TCC cross-sala aberto na folha: o chat lapida ESTE documento — e tudo nasce como sugestão. */
  tccWorkId?: string | null;
  /** Em cena (sala/sub-aba visível): o composer recebe o cursor sem precisar clicar. */
  active?: boolean;
}) {
  // Com um TCC cross-sala aberto, o padrão é LAPIDAR (sugestões com fonte verificada); o aluno
  // pode desligar pra só conversar sobre o tema.
  const [lapidar, setLapidar] = useState(true);
  const modoTcc = TCC_CROSS_ON && !!tccWorkId && lapidar;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [quick, setQuick] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const wt = workType || "trabalho";
  const msgsRef = useRef<Msg[]>([]);
  msgsRef.current = messages;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Carga inicial: L0 (localStorage) primeiro; se vazio, L1 durável (DB). + rascunho.
  useEffect(() => {
    try { const d = localStorage.getItem(DRAFT_KEY_R); if (d) setInput(d); } catch { /* ignore */ }
    let hadLocal = false;
    try {
      const raw = localStorage.getItem(THREAD_KEY_R);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) { setMessages(p); hadLocal = true; } }
    } catch { /* ignore */ }
    if (!hadLocal) {
      (async () => {
        const wire = await hydrateTranscript("pesquisa", null);
        if (wire.length) setMessages(wire.map((w) => ({ id: w.id, role: w.role, text: w.text })));
      })();
    }
  }, []);

  // Espelha thread (últimas 60) e rascunho no localStorage — não perde ao trocar de aba/reload.
  useEffect(() => {
    try { localStorage.setItem(THREAD_KEY_R, JSON.stringify(messages.filter((m) => m.text).slice(-60))); } catch { /* ignore */ }
  }, [messages]);
  useEffect(() => {
    try { input ? localStorage.setItem(DRAFT_KEY_R, input) : localStorage.removeItem(DRAFT_KEY_R); } catch { /* ignore */ }
  }, [input]);

  // Gera o trabalho e o ENCAIXA no documento (reusa /api/ai/research-draft + o
  // evento zaeon:research:newdoc que o page.tsx escuta → buildDocFromDraft).
  // Os tiers dos planos são respeitados no fluxo de geração/salvamento existente.
  const runResearchGenerate = useCallback(async (kind: string, topic: string) => {
    const wtype = researchWorkType(kind);
    try {
      const r = await fetch("/api/ai/research-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, references: [] }),
      });
      const d = await r.json().catch(() => null);
      const title = (d && (d.title || topic)) || topic;
      window.dispatchEvent(new CustomEvent("zaeon:research:newdoc", {
        detail: { title, fields: d?.fields, workType: wtype },
      }));
    } catch { /* ignore — a Fase 1 mostra erro no trace */ }
  }, []);

  // `text` presente = envio DIRETO (sugestão/conceito clicado na resposta) sem passar pelo
  // input; ausente = o que está digitado no composer.
  const send = useCallback(async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || sending) return;
    setQuick(isQuick(prompt));

    const history = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    }));
    const asstId = uid();
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", text: prompt },
      { id: asstId, role: "assistant", text: "" },
    ]);
    if (text === undefined) setInput("");   // envio direto preserva o rascunho do composer
    setSending(true);
    const patch = (text: string) => setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, text } : m)));

    // TCC cross-sala: o pedido vira SUGESTÕES no mesmo documento (busca fonte verificada →
    // propõe por seção → o crítico derruba o que não tem fonte). Nada é aplicado aqui.
    if (modoTcc && tccWorkId) {
      setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, fase: "Buscando fontes verificadas" } : m)));
      try {
        const d = await tccApi.revisar(tccWorkId, prompt);
        patch(d.texto);
        if (d.sugestoes.length) avisarTccMudou(tccWorkId);
        appendTranscript("pesquisa", null, [{ role: "user", text: prompt }, { role: "assistant", text: d.texto }]);
      } catch (e: any) {
        patch(e?.status === 403 ? "Você só pode ler este TCC — sugestões ficam com quem edita." : (e?.body?.texto || "Não consegui revisar agora. Tente de novo."));
      } finally {
        setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, fase: undefined } : m)));
        setSending(false);
      }
      return;
    }

    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, agent: "aura", surface: "pesquisa", history, systemContext: SYS(wt), stream: true }),
      });
      if (!r.ok || !r.body) { patch("Não consegui responder agora. Tente de novo."); return; }

      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let acc = "", limpo = "", faseVista = "", target = "", shown = 0, ended = false;
      const typed = new Promise<void>((resolve) => {
        const id = setInterval(() => {
          if (shown < target.length) {
            shown = Math.min(target.length, shown + Math.max(1, Math.ceil((target.length - shown) / 8)));
            patch(target.slice(0, shown));
          } else if (ended) { clearInterval(id); resolve(); }
        }, 18);
      });
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        // Mesmo contrato do co-working: o progresso sai do fio antes de qualquer conta.
        const { limpo: lp, eventos } = separarProgresso(acc);
        limpo = lp;
        const f = faseCorrente(eventos);
        if (f && f.rotulo !== faseVista) {
          faseVista = f.rotulo;
          setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, fase: f.rotulo } : m)));
        }
        const cut = [limpo.indexOf(RESEARCH_SENTINEL), limpo.indexOf(STRUCTURED_SENTINEL)].filter((i) => i >= 0);
        target = cut.length ? limpo.slice(0, Math.min(...cut)) : limpo;   // datilografa só o visível
      }
      const structured = parseStructuredStream(limpo);
      const si = limpo.indexOf(RESEARCH_SENTINEL);
      if (structured) {
        // HARNESS: resposta estruturada → cartão rico; payload malformado → TEXTO (nunca vazio).
        target = ""; ended = true;
        const text = structured.kind === "answer" ? structured.answer.nucleo : structured.text;
        setMessages((prev) => prev.map((m) => (m.id === asstId
          ? { ...m, text, answer: structured.kind === "answer" ? structured.answer : undefined }
          : m)));
        appendTranscript("pesquisa", null, [
          { role: "user", text: prompt },
          { role: "assistant", text },
        ]);
      } else if (si >= 0) {
        // TOOL-LOOP: research_generate → gera o trabalho e encaixa no documento.
        target = ""; ended = true;
        let action: any = null;
        try { action = JSON.parse(limpo.slice(si + RESEARCH_SENTINEL.length)); } catch { /* ignore */ }
        if (action?.kind) {
          patch(action.text || "Gerando o trabalho…");
          void runResearchGenerate(action.kind, action.topic || prompt);
        } else {
          patch("Sem resposta agora.");
        }
      } else {
        target = limpo; ended = true;
        await typed;
        if (!limpo.trim()) patch("Sem resposta agora.");
        else appendTranscript("pesquisa", null, [
          { role: "user", text: prompt },
          { role: "assistant", text: limpo },
        ]);
      }
    } catch {
      patch("Falha de rede ao falar com o agente.");
    } finally {
      setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, fase: undefined } : m)));
      setSending(false);
    }
  }, [input, sending, messages, wt, runResearchGenerate, modoTcc, tccWorkId]);

  return (
    <div className="h-full flex flex-col bg-white/95 dark:bg-[#0a0f1c]/95 text-slate-900 dark:text-white">
      {/* Conversa — bolhas com cara de manuscrito (serif, texto justificado).
          Sem cabeçalho/X: a alternância chat ↔ trabalho é feita pela pill ⟁ Chat. */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 sm:px-6">
        <div className="ml-4 sm:ml-8 lg:ml-14 mr-0 sm:mr-2 py-5 flex flex-col gap-4">
          {messages.map((m) => {
            const isUser = m.role === "user";
            if (!isUser && m.answer) {
              return (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[88%] w-full">
                    {/* Clicar num conceito/próximo passo proposto pela IA já ENVIA (sem clicar no input nem Enter). */}
                    <StructuredAnswerView answer={m.answer} onConcept={(c) => void send(`Explique: ${c}`)} onNext={(s) => void send(s)} />
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] px-4 py-3 font-serif text-[22px] leading-[1.65] whitespace-pre-wrap ${
                    isUser
                      ? "rounded-2xl bg-slate-100 text-slate-900 border border-slate-200 dark:bg-white/[0.08] dark:text-white/90 dark:border-white/10"
                      : "rounded-r-2xl rounded-bl-2xl bg-slate-50 text-slate-800 border-l-2 border-cyan-500/60 text-justify dark:bg-white/[0.03] dark:text-white/90 dark:border-cyan-400/50"
                  }`}
                >
                  {isUser
                    ? m.text
                    : (m.text
                        ? <ChatMarkdown text={m.text} />
                        : <AuraThinking active fase={m.fase} phases={quick ? ["Pensando"] : ["Pensando", "Elaborando"]} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Composer (mesmo do co-working); ⟁ abre atalhos acadêmicos */}
      <div className="px-4 sm:px-6 pb-4 pt-2">
        <div className="ml-4 sm:ml-8 lg:ml-14 mr-0 sm:mr-2">
          {TCC_CROSS_ON && tccWorkId && (
            <div className="flex items-center gap-2 pb-2">
              <button
                type="button" role="switch" aria-checked={lapidar} onClick={() => setLapidar((v) => !v)}
                className={`min-h-[36px] px-3 rounded-full text-[12px] border transition-colors ${lapidar
                  ? "bg-amber-500/15 border-amber-400/50 text-amber-800 dark:text-amber-200"
                  : "bg-transparent border-slate-300 dark:border-white/15 text-slate-600 dark:text-white/60"}`}
              >
                {lapidar ? "Lapidando o TCC · sugestões com fonte" : "Só conversa (não mexe no TCC)"}
              </button>
            </div>
          )}
          <CoworkComposer
            value={input}
            onChange={setInput}
            onSubmit={() => void send()}
            onToggleStudio={() => setPaletteOpen((v) => !v)}
            studioOpen={paletteOpen}
            busy={sending}
            idle={messages.length === 0 && !sending}
            active={active}
            placeholder=""
          >
            {paletteOpen && (
              <div className="flex flex-wrap items-center gap-1.5 px-1 pb-2">
                {QUICK.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => { setInput((v) => q.tpl + v.trim()); setPaletteOpen(false); }}
                    className="px-2.5 py-1.5 rounded-full text-[12px] font-serif text-slate-700 bg-slate-100 border border-slate-200 hover:border-cyan-400/50 hover:text-cyan-700 dark:text-white/80 dark:bg-white/[0.06] dark:border-white/10 dark:hover:text-cyan-200 transition-colors"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </CoworkComposer>
        </div>
      </div>
    </div>
  );
}
