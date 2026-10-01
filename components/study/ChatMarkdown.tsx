"use client";

import React from "react";

/**
 * Formatador leve de markdown pro chat da Aura — sem lib, seguro em streaming.
 *
 * O bug que resolve: o texto vinha sendo renderizado CRU (`whitespace-pre-wrap`),
 * então `**negrito**`, `***x***` e `### título` apareciam com os asteriscos/hashes
 * literais na tela. Aqui a gente formata inline (negrito/itálico/código) e por
 * linha (títulos e bullets), e — importante pra streaming — pares não fechados
 * (`**` ainda sem o fecho) são deixados como texto até fecharem, sem "piscar".
 */

// ── inline: ***x*** / **x** / *x* / `code` ──
function inline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[2] !== undefined) {
      out.push(<strong key={k++} className="font-semibold"><em>{m[2]}</em></strong>);
    } else if (m[3] !== undefined) {
      out.push(<strong key={k++} className="font-semibold text-slate-900 dark:text-white">{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      out.push(<em key={k++}>{m[4]}</em>);
    } else if (m[5] !== undefined) {
      out.push(<code key={k++} className="rounded bg-black/[0.06] dark:bg-white/10 px-1.5 py-0.5 text-[0.9em] font-mono">{m[5]}</code>);
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export default function ChatMarkdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let bullets: React.ReactNode[] | null = null;

  const flush = () => {
    if (bullets && bullets.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1.5 ml-4 list-disc space-y-1">
          {bullets}
        </ul>,
      );
    }
    bullets = null;
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const b = /^\s*[-•*]\s+(.*)$/.exec(line);

    if (h) {
      flush();
      const lvl = h[1].length;
      const cls = lvl === 1 ? "text-[1.15em] font-semibold mt-3 mb-1"
        : lvl === 2 ? "text-[1.08em] font-semibold mt-2.5 mb-1"
        : "text-[1em] font-semibold mt-2 mb-0.5";
      blocks.push(<div key={`h-${i}`} className={`${cls} text-slate-900 dark:text-white`}>{inline(h[2])}</div>);
    } else if (b) {
      if (!bullets) bullets = [];
      bullets.push(<li key={`li-${i}`}>{inline(b[1])}</li>);
    } else if (line.trim() === "") {
      flush();
      blocks.push(<div key={`sp-${i}`} className="h-2" />);
    } else {
      flush();
      blocks.push(<p key={`p-${i}`} className="my-0">{inline(line)}</p>);
    }
  });
  flush();

  return <div className="[&_p]:leading-[1.65]">{blocks}</div>;
}
