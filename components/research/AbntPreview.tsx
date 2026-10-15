"use client";
/**
 * components/research/AbntPreview.tsx — prévia ABNT ao vivo do editor da Sala de Pesquisa.
 * Imita as regras do motor (abnt-service): A4 com margens 3/3/2/2 cm, 12pt, entrelinha 1,5, recuo de
 * 1,25 cm, justificado, títulos numerados, citação longa recuada 4 cm em 10pt, figura/tabela com
 * legenda em cima e fonte embaixo. Usa os MESMOS blocos do motor (lib/abntBlocks) — o que aparece
 * aqui é o que vira parágrafo no Word. É só visual: não pagina (o Word pagina na exportação).
 *
 * Escala com a largura do painel: tudo é medido em `cqw` (21 cm = 100cqw).
 */
import { useMemo } from "react";
import { parseAbntMarkers } from "@/lib/abntTemplate";
import { normalizeBlocks, isFigure, isTableBlock, isQuotation } from "@/lib/abntBlocks";

const CM = 100 / 21; // 1 cm em cqw
const cqw = (cm: number) => `${(cm * CM).toFixed(3)}cqw`;
const PT = 2.54 / 72; // 1 pt em cm
const CHARS_PER_LINE = 75;
const OWN = new Set(["própria", "propria", "autor", "autoral", "own", "elaboração própria", "elaboracao propria"]);

function fonte(raw: string | undefined, fem = false): string {
  const f = (raw || "").trim();
  if (!f || OWN.has(f.toLowerCase())) return fem ? "elaborada pelo próprio autor" : "elaborado pelo próprio autor";
  return f;
}

function Bloco({ texto, n }: { texto: string; n: number }) {
  if (isFigure(texto)) {
    const m = /^!\[([\s\S]*?)\]\((\S+?)\)$/.exec(texto.trim())!;
    const [titulo, src] = m[1].split("|");
    return (
      <figure style={{ margin: `${cqw(12 * PT)} 0`, textAlign: "center" }}>
        <figcaption style={{ fontSize: cqw(10 * PT) }}>Figura {n} – {titulo?.trim() || "sem título"}</figcaption>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m[2]} alt={titulo} style={{ maxWidth: cqw(15), margin: "0 auto", display: "block" }} />
        <div style={{ fontSize: cqw(10 * PT) }}>Fonte: {fonte(src)}.</div>
      </figure>
    );
  }
  if (isTableBlock(texto)) {
    const linhas = texto.split("\n");
    const head = /^%%(tabela|quadro)\s*(.*)$/i.exec(linhas[0].trim())!;
    const kind = head[1].toLowerCase();
    let rest = linhas.slice(1);
    let fonteRaw: string | undefined;
    if (rest[0] && /^%%fonte\b/i.test(rest[0].trim())) { fonteRaw = rest[0].trim().replace(/^%%fonte\s*/i, ""); rest = rest.slice(1); }
    const rows = rest.filter((l) => l.includes("|")).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()))
      .filter((cells) => !cells.filter(Boolean).every((c) => /^:?-{2,}:?$/.test(c)));
    const quadro = kind === "quadro";
    const borda = "1px solid currentColor";
    return (
      <div style={{ margin: `${cqw(12 * PT)} 0`, fontSize: cqw(10 * PT), lineHeight: 1.15 }}>
        <div style={{ textAlign: "center" }}>{quadro ? "Quadro" : "Tabela"} {n} – {head[2] || "sem título"}</div>
        <table style={{ width: "100%", borderCollapse: "collapse", borderTop: borda, borderBottom: borda, ...(quadro ? { border: borda } : {}) }}>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={i === 0 ? { borderBottom: borda, fontWeight: 700 } : undefined}>
                {r.map((c, j) => <td key={j} style={{ padding: `0 ${cqw(0.15)}`, textAlign: "center", ...(quadro ? { border: borda } : {}) }}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <div>Fonte: {fonte(fonteRaw, !quadro)}.</div>
      </div>
    );
  }
  const longa = isQuotation(texto) && Math.ceil(texto.length / CHARS_PER_LINE) > 3;
  if (longa) {
    return (
      <p style={{ fontSize: cqw(10 * PT), lineHeight: 1.15, textAlign: "justify", margin: `${cqw(12 * PT)} 0 ${cqw(12 * PT)} ${cqw(4)}` }}>
        {texto.trim().replace(/^["“‘«]|["”’»]$/g, "")}
      </p>
    );
  }
  return <p style={{ textIndent: cqw(1.25), textAlign: "justify", margin: 0 }}>{texto}</p>;
}

type Item = { texto: string; n: number };
type Secao = { titulo: string; refs: boolean; numero: number | null; blocos: Item[]; subs: Array<{ titulo: string; blocos: Item[] }> };

/** Numeração de seção/figura/tabela calculada UMA vez (pura): render nenhum incrementa contador. */
function montar(content: string): Secao[] {
  const parsed = parseAbntMarkers(content) ?? [{ type: "desenvolvimento", title: "", content, subsections: [] as Array<{ title: string; content: string }> }];
  let numero = 0, fig = 0;
  const tab: Record<string, number> = {};
  const itens = (c: string): Item[] => normalizeBlocks(c).map((texto) => {
    if (isFigure(texto)) return { texto, n: ++fig };
    if (isTableBlock(texto)) { const k = /^%%(tabela|quadro)/i.exec(texto)![1].toLowerCase(); return { texto, n: (tab[k] = (tab[k] ?? 0) + 1) }; }
    return { texto, n: 0 };
  });
  return parsed.map((s) => {
    const refs = s.type === "referencias";
    return {
      titulo: s.title, refs, numero: s.title && !refs ? ++numero : null,
      blocos: itens(s.content),
      subs: s.subsections.map((sub) => ({ titulo: sub.title, blocos: itens(sub.content) })),
    };
  });
}

export default function AbntPreview({ content, titulo }: { content: string; titulo?: string }) {
  const secoes = useMemo(() => montar(content), [content]);
  const titulo12 = { fontSize: "inherit", textTransform: "uppercase" as const, margin: `${cqw(12 * PT)} 0` };

  return (
    <div className="w-full flex-1 min-h-[400px] [container-type:inline-size]" aria-label="Prévia ABNT">
      <p className="mb-2 text-[11px] text-slate-500 dark:text-white/50">
        Prévia ABNT · aproximação visual (margens, 12pt, entrelinha 1,5, recuo 1,25 cm). A paginação final sai no Word/PDF.
      </p>
      <article
        className="bg-white text-black shadow-[0_1px_8px_rgba(0,0,0,0.12)] rounded-sm"
        style={{
          padding: `${cqw(3)} ${cqw(2)} ${cqw(2)} ${cqw(3)}`,
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: cqw(12 * PT),
          lineHeight: 1.5,
        }}
      >
        {titulo && <p style={{ textAlign: "center", fontWeight: 700, textTransform: "uppercase", margin: `0 0 ${cqw(1)}` }}>{titulo}</p>}
        {secoes.map((s, i) => (
          <section key={i}>
            {s.titulo && <h2 style={{ ...titulo12, fontWeight: 700, textAlign: s.refs ? "center" : "left" }}>{s.numero ? `${s.numero} ` : ""}{s.titulo}</h2>}
            {s.refs
              ? s.blocos.map((b, j) => <p key={j} style={{ textAlign: "left", lineHeight: 1.15, margin: `0 0 ${cqw(12 * PT)}` }}>{b.texto}</p>)
              : s.blocos.map((b, j) => <Bloco key={j} texto={b.texto} n={b.n} />)}
            {s.subs.map((sub, j) => (
              <div key={j}>
                <h3 style={{ ...titulo12, fontWeight: 400 }}>{s.numero}.{j + 1} {sub.titulo}</h3>
                {sub.blocos.map((b, k) => <Bloco key={k} texto={b.texto} n={b.n} />)}
              </div>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
