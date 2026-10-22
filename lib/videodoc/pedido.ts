/**
 * VÍDEO DO DOCUMENTO pedido no CHAT (PURO). Pedido do dono: "isso também deve entrar como pedido dentro do chat — se o
 * usuário pedir, deve ser feito". Aqui: reconhecer o pedido ("faz um vídeo desse artigo", "explica esse PDF em vídeo",
 * "quero um vídeo do Zether") e escolher DE QUAL documento — pelo título citado no pedido; senão, o mais recente.
 */
import type { Documento } from "@/lib/blueprint/tipos";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const VIDEO = /\b(v[ií]deo|videoaula|video-aula)\b/;
const ALVO = /\b(artigo|paper|pdf|documento|livro|texto|apostila|trabalho|tcc|esse|desse|deste|disso|dele|dela|sobre)\b/;
const VERBO = /\b(faz|faca|fazer|gera|gere|gerar|cria|crie|criar|quero|queria|monta|monte|explica|explique|apresenta|apresente|transforma|transforme|vira|virar)\b/;

/** a pessoa pediu um VÍDEO de um documento? (não pega "vi um vídeo ontem") */
export function pedidoDeVideo(prompt: string): boolean {
  const p = norm(prompt || "");
  return VIDEO.test(p) && (VERBO.test(p) || /\bem v[ií]deo\b/.test(p)) && (ALVO.test(p) || /\bv[ií]deo (do|da|de|sobre o|sobre a)\b/.test(p));
}

const palavras = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));

/** o documento do pedido: o que mais divide palavras do título com o pedido; empate/nenhum → o mais recente
 *  (o último da lista). `preferir` (o PDF que veio anexado) vence sempre. */
export function escolherDocumento(prompt: string, docs: readonly Documento[], preferir?: Documento | null): Documento | null {
  if (preferir) return preferir;
  if (!docs.length) return null;
  const ps = palavras(prompt);
  let melhor: Documento | null = null, nota = 0;
  docs.forEach((d) => { const n = [...palavras(d.titulo)].filter((w) => ps.has(w)).length; if (n > nota || (n === nota && n > 0)) { melhor = d; nota = n; } });
  return melhor ?? docs[docs.length - 1]!;
}
