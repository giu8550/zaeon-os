/**
 * lib/abntBlocks.ts — o contrato editor → motor ABNT. Espelho EXATO de `_normalize_blocks` em
 * abnt-service/formatter.py (os testes usam as mesmas fixtures dos dois lados): o editor emite blocos
 * limpos, a prévia mostra os mesmos parágrafos que o Word vai ter, e o motor normaliza de novo
 * (blinda qualquer outra origem). Puro, sem DOM.
 */

const LIST_ITEM_RE = /^([-*•–]\s+|\d{1,3}[.)]\s+|[a-z][)]\s+)/;
const TERMINAL_RE = /[.!?:;…"”»]$/;
const ZERO_WIDTH_RE = /[​-‍﻿]/g;
const FIGURE_RE = /^!\[([\s\S]*?)\]\((\S+?)\)$/;
const TABLE_RE = /^%%(tabela|quadro)\b/i;
const QUOTE_OPEN = ['"', "“", "‘", "«"];
const QUOTE_CLOSE = ['"', "”", "’", "»"];

export const isFigure = (t: string) => FIGURE_RE.test(t.trim());
export const isTableBlock = (t: string) => TABLE_RE.test(t.trim());
export const isQuotation = (t: string) => QUOTE_OPEN.includes(t.trim().slice(0, 1));

export function oneLine(text: string): string {
  return (text || "").replace(ZERO_WIDTH_RE, "").replace(/\s+/g, " ").trim();
}

/** Divide o conteúdo em parágrafos limpos (mesmas regras do motor Python). */
export function normalizeBlocks(content: string): string[] {
  const text = (content || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\t/g, " ").replace(ZERO_WIDTH_RE, "");
  const out: string[] = [];
  for (const raw of text.split(/\n[  ]*\n/)) {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (isTableBlock(lines[0])) { out.push(lines.join("\n")); continue; }
    let cur: string[] = [];
    for (const ln of lines) {
      let startsNew = !cur.length || LIST_ITEM_RE.test(ln) || isFigure(ln) || isFigure(cur.join(" ")) || isTableBlock(ln);
      if (!startsNew) {
        const joined = cur.join(" ");
        const inOpenQuote = isQuotation(joined) && !QUOTE_CLOSE.includes(joined.slice(-1));
        startsNew = TERMINAL_RE.test(joined) && !inOpenQuote;
      }
      if (startsNew && cur.length) { out.push(oneLine(cur.join(" "))); cur = []; }
      cur.push(ln);
    }
    if (cur.length) out.push(oneLine(cur.join(" ")));
  }
  return out.filter(Boolean);
}

/** Conteúdo limpo pro motor: blocos separados por exatamente uma linha em branco. */
export const cleanContent = (content: string) => normalizeBlocks(content).join("\n\n");

/**
 * Insere um bloco no caret como BLOCO PRÓPRIO: garante uma linha em branco antes e depois, sem
 * acumular quebras. Devolve o texto novo e onde o caret deve ficar (ou a seleção, se `select` for
 * um trecho do bloco — ex.: o título da figura pra o usuário sobrescrever).
 */
export function insertBlock(value: string, cursor: number, block: string, select?: string): { value: string; start: number; end: number } {
  const at = Math.max(0, Math.min(cursor, value.length));
  const before = value.slice(0, at).replace(/[ \t]*\n*[ \t]*$/, "");
  const after = value.slice(at).replace(/^[ \t]*\n*/, "");
  const pre = before ? `${before}\n\n` : "";
  const post = after ? `\n\n${after}` : "\n";
  const next = pre + block + post;
  const blockStart = pre.length;
  const i = select ? block.indexOf(select) : -1;
  return i >= 0
    ? { value: next, start: blockStart + i, end: blockStart + i + select!.length }
    : { value: next, start: blockStart + block.length, end: blockStart + block.length };
}

/** Os blocos que a barra do editor insere (o usuário clica, não decora sintaxe). */
export const BLOCOS = {
  secao: { block: "# NOVA SEÇÃO", select: "NOVA SEÇÃO" },
  subsecao: { block: "## Nova subseção", select: "Nova subseção" },
  citacaoLonga: { block: "\"Cole aqui a citação direta longa (mais de 3 linhas) entre aspas, seguida da referência (SOBRENOME, ano, p. X).\"", select: "Cole aqui a citação direta longa (mais de 3 linhas) entre aspas, seguida da referência (SOBRENOME, ano, p. X)." },
  tabela: { block: "%%tabela Título da tabela\n%%fonte própria\n| Coluna 1 | Coluna 2 |\n| --- | --- |\n| valor | valor |", select: "Título da tabela" },
  quadro: { block: "%%quadro Título do quadro\n%%fonte própria\n| Item | Descrição |\n| --- | --- |\n| ... | ... |", select: "Título do quadro" },
} as const;
