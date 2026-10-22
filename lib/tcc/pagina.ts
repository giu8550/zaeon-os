/**
 * lib/tcc/pagina.ts — o miolo PURO do editor estilo Word dos trabalhos (components/tcc/TccPanel):
 *   - `montarPagina`: as seções do trabalho viram a página ABNT (numeração 1, 2, 3… das seções textuais,
 *     subseções 1.1 pelo `## `, pré/pós-textuais sem número e centralizadas, figura/tabela/quadro com
 *     contador global) — a mesma regra do motor (abnt-service) e da prévia (components/research/AbntPreview);
 *   - as operações da BARRA (negrito, itálico, listas, estilo do parágrafo) sobre o texto da seção em edição,
 *     no markdown que o motor entende (`**`/`*`, `- ` → alíneas, `1. `, `## `, citação longa entre aspas).
 * Sem DOM: o componente só passa valor + seleção e aplica o que volta.
 */
import { normalizeBlocks, isFigure, isTableBlock } from "@/lib/abntBlocks";
import { chaveTitulo, type Secao } from "@/lib/tcc/secoes";

// ───────────────────────────── a página ─────────────────────────────

export type ItemPagina = { texto: string; n: number };
export type SecaoPagina = {
  id: string; titulo: string; corpo: string;
  /** "1", "2"… nas textuais; null nas pré/pós-textuais (resumo, referências, apêndice…) */
  numero: string | null;
  /** pré/pós-textual: título centralizado, sem número */
  centralizada: boolean;
  /** referências: alinhadas à esquerda, espaço simples, sem recuo */
  referencias: boolean;
  blocos: ItemPagina[];
  subs: { titulo: string; numero: string | null; blocos: ItemPagina[] }[];
};

const SEM_NUMERO = /^(resumo|abstract|resumen|sumario|referencias|referencias-bibliograficas|apendice.*|anexo.*|glossario|agradecimentos|dedicatoria|epigrafe)$/;

/** Uma seção é pré/pós-textual (sem número, título centralizado)? */
export const semNumero = (titulo: string) => SEM_NUMERO.test(chaveTitulo(titulo));
export const ehReferencias = (titulo: string) => /^referencias/.test(chaveTitulo(titulo));

export function montarPagina(secoes: Secao[]): SecaoPagina[] {
  let numero = 0, fig = 0;
  const tab: Record<string, number> = {};
  const itens = (c: string): ItemPagina[] => normalizeBlocks(c).map((texto) => {
    if (isFigure(texto)) return { texto, n: ++fig };
    if (isTableBlock(texto)) { const k = /^%%(tabela|quadro)/i.exec(texto)![1].toLowerCase(); return { texto, n: (tab[k] = (tab[k] ?? 0) + 1) }; }
    return { texto, n: 0 };
  });
  return secoes.map((s) => {
    const sem = semNumero(s.titulo);
    const num = sem ? null : String(++numero);
    // `## Subtítulo` dentro do corpo = subseção (1.1, 1.2…), como no parseAbntMarkers
    const partes = s.corpo.split(/^##[ \t]+/m);
    const antes = partes.shift() ?? "";
    const subs = partes.map((p, j) => {
      const quebra = p.indexOf("\n");
      const titulo = (quebra < 0 ? p : p.slice(0, quebra)).trim();
      return { titulo, numero: num ? `${num}.${j + 1}` : null, blocos: itens(quebra < 0 ? "" : p.slice(quebra + 1)) };
    });
    return { id: s.id, titulo: s.titulo, corpo: s.corpo, numero: num, centralizada: sem, referencias: ehReferencias(s.titulo), blocos: itens(antes), subs };
  });
}

/** Ênfase inline pra prévia: `**negrito**` e `*itálico*` (mesma regra do motor: o marcador cola no texto). */
export type Trecho = { t: string; negrito?: boolean; italico?: boolean };
const ENFASE_RE = /\*\*(\S(?:.*?\S)?)\*\*|\*(\S(?:.*?\S)?)\*/g;
export function trechosComEnfase(texto: string): Trecho[] {
  const out: Trecho[] = [];
  let pos = 0;
  for (const m of texto.matchAll(ENFASE_RE)) {
    const i = m.index ?? 0;
    if (i > pos) out.push({ t: texto.slice(pos, i) });
    out.push(m[1] !== undefined ? { t: m[1], negrito: true } : { t: m[2], italico: true });
    pos = i + m[0].length;
  }
  if (pos < texto.length) out.push({ t: texto.slice(pos) });
  return out.length ? out : [{ t: texto }];
}

export const palavrasDaPagina = (secoes: Secao[]) =>
  secoes.reduce((n, s) => n + (s.corpo.trim() ? s.corpo.trim().split(/\s+/).length : 0), 0);

// ───────────────────────────── a barra ─────────────────────────────

/** Texto + seleção (o que o textarea tem) → texto + seleção novos. */
export type Edicao = { value: string; start: number; end: number };

/** Negrito/itálico: envolve a seleção (sem seleção, insere o par e põe o cursor no meio); de novo = tira. */
export function alternarEnfase(e: Edicao, marca: "**" | "*"): Edicao {
  const { value, start, end } = e;
  const sel = value.slice(start, end);
  const antes = value.slice(0, start), depois = value.slice(end);
  const m = marca.length;
  // já envolvida (por fora da seleção) → desfaz
  if (antes.endsWith(marca) && depois.startsWith(marca) && !(marca === "*" && antes.endsWith("**") && depois.startsWith("**"))) {
    return { value: antes.slice(0, -m) + sel + depois.slice(m), start: start - m, end: end - m };
  }
  // a seleção inclui os marcadores → desfaz
  if (sel.length > 2 * m && sel.startsWith(marca) && sel.endsWith(marca)) {
    const dentro = sel.slice(m, -m);
    return { value: antes + dentro + depois, start, end: start + dentro.length };
  }
  // espaços nas pontas ficam de fora (o motor só aceita o marcador colado no texto)
  const ini = sel.length - sel.trimStart().length, fim = sel.length - sel.trimEnd().length;
  const miolo = sel.trim();
  const novo = antes + sel.slice(0, ini) + marca + miolo + marca + sel.slice(sel.length - fim) + depois;
  const s0 = start + ini + m;
  return { value: novo, start: s0, end: s0 + miolo.length };
}

/** As linhas tocadas pela seleção: [início da 1ª, fim da última). */
function linhasDa(value: string, start: number, end: number): [number, number] {
  const a = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const fimSel = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const b = value.indexOf("\n", fimSel);
  return [start === 0 ? 0 : a, b < 0 ? value.length : b];
}

const LISTA_RE = /^(\s*)(?:[-*•–]\s+|\d{1,3}[.)]\s+|[a-z][)]\s+)/;

/** Lista com marcadores (`- ` → alíneas a), b) no ABNT) ou numerada (`1. `); de novo = tira a lista. */
export function alternarLista(e: Edicao, tipo: "marcadores" | "numerada"): Edicao {
  const [a, b] = linhasDa(e.value, e.start, e.end);
  const linhas = e.value.slice(a, b).split("\n");
  const mesmo = tipo === "marcadores" ? /^\s*[-*•–]\s+/ : /^\s*\d{1,3}[.)]\s+/;
  const todas = linhas.filter((l) => l.trim()).every((l) => mesmo.test(l));
  let n = 0;
  const novas = linhas.map((l) => {
    if (!l.trim()) return l;
    const limpa = l.replace(LISTA_RE, "$1");
    if (todas) return limpa;
    n++;
    return (tipo === "marcadores" ? "- " : `${n}. `) + limpa.trimStart();
  });
  const bloco = novas.join("\n");
  return { value: e.value.slice(0, a) + bloco + e.value.slice(b), start: a, end: a + bloco.length };
}

export type EstiloParagrafo = "normal" | "subsecao" | "citacao";
export const ESTILOS: { id: EstiloParagrafo; rotulo: string; dica: string }[] = [
  { id: "normal", rotulo: "Normal", dica: "Parágrafo do corpo: justificado, recuo 1,25 cm, entrelinha 1,5" },
  { id: "subsecao", rotulo: "Título 2 (subseção)", dica: "Subseção numerada (1.1, 1.2…)" },
  { id: "citacao", rotulo: "Citação longa", dica: "Citação direta com mais de 3 linhas: recuo 4 cm, fonte 10, espaço simples" },
];

/** O estilo do parágrafo onde está o cursor (a caixa "Estilo" mostra isso, como no Word). */
export function estiloNoCursor(value: string, cursor: number): EstiloParagrafo {
  const [a, b] = linhasDa(value, cursor, cursor);
  const linha = value.slice(a, b).trim();
  if (/^##\s+/.test(linha)) return "subsecao";
  if (/^["“«]/.test(linha)) return "citacao";
  return "normal";
}

/** Aplica um estilo ao parágrafo do cursor: `## ` (subseção), aspas (citação longa) ou limpa (normal). */
export function aplicarEstilo(e: Edicao, estilo: EstiloParagrafo): Edicao {
  const [a, b] = linhasDa(e.value, e.start, e.end);
  const bruto = e.value.slice(a, b);
  const limpo = bruto.replace(/^\s*##\s+/, "").replace(/^\s*["“«]/, "").replace(/["”»]\s*$/, "").trim();
  const novo = estilo === "subsecao" ? `## ${limpo}` : estilo === "citacao" ? `“${limpo}”` : limpo;
  const delta = estilo === "subsecao" ? 3 : estilo === "citacao" ? 1 : 0;
  return { value: e.value.slice(0, a) + novo + e.value.slice(b), start: a + delta, end: a + delta + limpo.length };
}
