"use client";
import React, { useEffect, useState } from "react";
import ChatMarkdown from "@/components/study/ChatMarkdown";
import { temBlocoDeCodigo, temMatematica } from "@/lib/chat/matematica";

// Render leve de markdown — **negrito**, *itálico* e quebras de linha. Sem biblioteca.
// Texto com fórmula ($…$, $$…$$, \(…\), \[…\]) ou ```grafico vai pro ChatMarkdown (KaTeX, o mesmo do chat da
// Aura — PR #405): o chat de PDF e os resumos da Sala de Pesquisa mostravam o LaTeX cru.
// Bloco de código (```lang) também vai pro ChatMarkdown (#634): aqui sairia com as crases na tela.
// `reveal` (opt-in): revela o texto AOS POUCOS, como se a IA estivesse gerando — dá fluidez.
//   Regra do app: toda saída de IA usa reveal (ver docs/RESEARCH_ROOM_RULES.md §8).
export default function RichText({
  text,
  className,
  reveal,
}: {
  text: string;
  className?: string;
  reveal?: boolean;
}) {
  const { display, revealing } = useReveal(text || "", !!reveal);
  // Decide pelo texto INTEIRO (não pelo pedaço revelado), pra não trocar de render no meio da revelação.
  // O ChatMarkdown é seguro em streaming: $$ ainda sem fecho fica como texto até fechar.
  if (temMatematica(text || "") || temBlocoDeCodigo(text || "")) {
    return (
      <div className={className}>
        <ChatMarkdown text={display} />
        {revealing && <span className="animate-pulse opacity-60 ml-px">▍</span>}
      </div>
    );
  }
  const lines = display.split("\n");
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {renderInline(line)}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
      {revealing && <span className="animate-pulse opacity-60 ml-px">▍</span>}
    </span>
  );
}

/** Revela o texto progressivamente (cadência generativa). Cancelável; cap de ~3,5s pra textos longos. */
function useReveal(text: string, enabled: boolean): { display: string; revealing: boolean } {
  const len = text.length;
  const [shown, setShown] = useState(enabled ? 0 : len);
  useEffect(() => {
    if (!enabled) { setShown(len); return; }
    if (len === 0) { setShown(0); return; }
    setShown(0);
    const duration = Math.min(Math.max(len * 14, 350), 3500); // ms
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 2); // ease-out suave
      setShown(Math.max(1, Math.floor(eased * len)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setShown(len);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // re-revela quando o texto muda (nova mensagem) ou liga/desliga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, enabled]);
  return { display: enabled ? text.slice(0, shown) : text, revealing: enabled && shown < len };
}

function renderInline(line: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // **negrito** ou *itálico*
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(line)) !== null) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(<strong key={k++} className="font-bold">{tok.slice(2, -2)}</strong>);
    } else {
      out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
