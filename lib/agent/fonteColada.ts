/**
 * lib/agent/fonteColada.ts — "escreva um artigo com base neste aqui: <artigo inteiro colado>".
 *
 * Antes, a mensagem INTEIRA (milhares de caracteres) virava o objetivo do turno: ia como consulta das buscas de
 * literatura (que falham com uma query de 20 mil caracteres), era repetida no raciocínio e no rascunho, e virava o
 * título do trabalho. O padrão dos nossos repositórios-base (docs/FONTES_BASE.md: AI-Scientist — pipeline por
 * estágios; K-Dense scientific-writer — o documento-fonte é ENTRADA, não pergunta) é separar:
 *   - o PEDIDO (curto) → objetivo do turno, roteador, buscas, título;
 *   - a FONTE (o texto colado) → um bloco de contexto ("use como base, cite, não copie").
 * Puro, sem rede.
 */

/** Abaixo disto a mensagem é só uma pergunta (mesmo que comprida): nada a separar. */
export const MIN_FONTE = 1200;
/** Teto do texto-fonte que vai pro modelo (o resto é cortado com aviso). */
export const MAX_FONTE = 30_000;
/** Um pedido é curto: até isto. */
const MAX_PEDIDO = 600;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Frase de pedido: verbo de produção/edição ou "com base/a partir/baseado". */
// palavras inteiras, em forma de PEDIDO (imperativo/infinitivo): "Resumo" ou "Revisão sistemática…" (o começo do
// artigo colado) não contam — "resuma", "revise", "escreva um artigo com base nisto" contam
const PEDIDO_RE = /(^|[^a-z])(escreva|escrever|redija|redigir|elabore|elaborar|produza|produzir|gere|gerar|crie|criar|faca|fazer|faz|monte|montar|reescreva|reescrever|resuma|resumir|revise|revisar|transforme|transformar|adapte|adaptar|melhore|melhorar|use|usando|com base|a partir d[eoa]s?|baseado|baseada|inspirado|inspirada|write|draft|rewrite|summarize|summarise|based on)([^a-z]|$)/;

export type FonteColada = { pedido: string; fonte: string | null };

/** Separa o pedido do texto colado. Sem texto colado longo → `{ pedido: prompt, fonte: null }`. */
export function separarFonteColada(prompt: string): FonteColada {
  const texto = String(prompt ?? "").replace(/\r\n/g, "\n").trim();
  if (texto.length < MIN_FONTE) return { pedido: texto, fonte: null };

  // 1) pedido na 1ª linha / 1º parágrafo (o mais comum: "Faça um artigo com base nisto:\n<texto>")
  const quebra = texto.search(/\n/);
  const primeiraLinha = quebra < 0 ? texto : texto.slice(0, quebra);
  const pars = texto.split(/\n\s*\n/);
  const cand: Array<{ pedido: string; fonte: string }> = [];
  if (quebra > 0) cand.push({ pedido: primeiraLinha, fonte: texto.slice(quebra + 1) });
  if (pars.length > 1) {
    cand.push({ pedido: pars[0], fonte: pars.slice(1).join("\n\n") });
    // 2) pedido no fim ("<texto colado>\n\nAgora escreva um artigo com base nisso")
    cand.push({ pedido: pars[pars.length - 1], fonte: pars.slice(0, -1).join("\n\n") });
  }
  // 3) mesma linha: "Escreva um artigo baseado neste: Introdução. A fotossíntese…" → corta no 1º ":"
  const doisPontos = texto.indexOf(":");
  if (doisPontos > 0 && doisPontos < MAX_PEDIDO) cand.push({ pedido: texto.slice(0, doisPontos + 1), fonte: texto.slice(doisPontos + 1) });

  for (const c of cand) {
    const p = c.pedido.trim(), f = c.fonte.trim();
    if (p && p.length <= MAX_PEDIDO && f.length >= MIN_FONTE / 2 && PEDIDO_RE.test(norm(p))) return { pedido: p, fonte: f };
  }
  // 4) colou só o texto, sem pedido: trata como "use isto como base"
  return { pedido: "", fonte: texto };
}

/** O título provável do texto colado: a 1ª linha curta (sem "#", sem "Título:"). */
export function tituloDaFonte(fonte: string): string {
  for (const linha of fonte.split("\n")) {
    const l = linha.replace(/^#+\s*/, "").replace(/^t[ií]tulo\s*:\s*/i, "").trim();
    if (l.length >= 4 && l.length <= 180 && !/[.!?]$/.test(l)) return l;
    if (l) break;
  }
  const frase = fonte.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return frase.slice(0, 120).trim();
}

/** O objetivo do turno: o pedido (ou um padrão) + o tema do texto colado — é o que vai pro roteador e pras buscas. */
export function objetivoComFonte(f: FonteColada): string {
  if (!f.fonte) return f.pedido;
  const tema = tituloDaFonte(f.fonte);
  const pedido = f.pedido.replace(/[:\s]+$/, "") || "Escreva um artigo acadêmico com base no texto colado";
  return tema ? `${pedido} — tema do texto-fonte: ${tema}` : pedido;
}

/** O pedido que nomeia o trabalho (lib/tcc/turno `temaDoPedido` lê o "sobre X"). */
export function pedidoParaTitulo(f: FonteColada): string {
  if (!f.fonte) return f.pedido;
  const p = f.pedido.replace(/[:\s]+$/, "");
  if (/\b(sobre|acerca de|a respeito de|tema)\b/i.test(p)) return p;
  return `${p || "artigo"} sobre ${tituloDaFonte(f.fonte)}`;
}

/** O bloco de contexto com o texto-fonte (vai no systemContext; cortado em MAX_FONTE). */
export function blocoFonteColada(fonte: string): string {
  const cortado = fonte.length > MAX_FONTE;
  return [
    "=== TEXTO-FONTE COLADO PELO ALUNO (a base do trabalho pedido) ===",
    cortado ? fonte.slice(0, MAX_FONTE) + "\n[… texto cortado — o resto não coube]" : fonte,
    "=== FIM DO TEXTO-FONTE ===",
    "Use o texto-fonte como BASE: reaproveite a estrutura de ideias, os dados e as referências DELE (citando-o como fonte),",
    "complete com a evidência reunida e escreva com as suas palavras — nunca copie trechos longos literalmente.",
    "Se ele trouxer referências, mantenha-as na seção de referências do trabalho.",
  ].join("\n");
}
