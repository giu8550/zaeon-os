/**
 * VÍDEO DO DOCUMENTO pedido no CHAT (PURO). Pedido do dono: "isso também deve entrar como pedido dentro do chat — se o
 * usuário pedir, deve ser feito". Aqui: reconhecer o pedido ("faz um vídeo desse artigo", "explica esse PDF em vídeo",
 * "quero um vídeo do Zether") e escolher DE QUAL documento — pelo título citado no pedido; senão, o mais recente.
 */
import type { Documento } from "@/lib/blueprint/tipos";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const VERBO = /\b(faz|faca|fazer|gera|gere|gerar|cria|crie|criar|quero|queria|monta|monte|explica|explique|apresenta|apresente|transforma|transforme|vira|virar|prepara|prepare)\b/;
const DOC = /\b(artigo|paper|pdf|documento|livro|apostila|trabalho|tcc)\b/;
const DEMONSTRATIVO = /\b(esse|essa|desse|dessa|deste|desta|este|esta|disso|dele|dela)\b/;

/** a pessoa pediu um VÍDEO de um documento? Precisa do verbo E do vídeo ligado ao documento — "vídeo desse/do X",
 *  "<documento> em vídeo", "um vídeo do/de um <documento>". Não pega "vi um vídeo", "tem vídeo?", "um vídeo sobre X". */
export function pedidoDeVideo(prompt: string): boolean {
  const p = norm(prompt || "");
  if (!VERBO.test(p)) return false;
  if (/\b(v[ií]deo|videoaula)s? (d[oa]s?|dess[ea]s?|dest[ea]s?|disso|dele|dela)\b/.test(p)) return true;
  if (/\bem (um )?(v[ií]deo|videoaula)\b/.test(p) && (DOC.test(p) || DEMONSTRATIVO.test(p))) return true;
  return /\b(um|uma) (v[ií]deo|videoaula)\b/.test(p) && DOC.test(p);
}

const palavras = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));

/** o documento do pedido: o que mais divide palavras do título com o pedido; sem título citado, o mais recente SÓ se o
 *  pedido aponta pra ele ("desse artigo") — senão nenhum (não adivinha). `preferir` (o PDF anexado) vence sempre. */
export function escolherDocumento(prompt: string, docs: readonly Documento[], preferir?: Documento | null): Documento | null {
  if (preferir) return preferir;
  if (!docs.length) return null;
  const ps = palavras(prompt);
  let melhor: Documento | null = null, nota = 0;
  docs.forEach((d) => { const n = [...palavras(d.titulo)].filter((w) => ps.has(w)).length; if (n > nota || (n === nota && n > 0)) { melhor = d; nota = n; } });
  return melhor ?? (DEMONSTRATIVO.test(norm(prompt)) ? docs[docs.length - 1]! : null);
}

/** a resposta pra quem pediu e não deu (vai no card do chat — ninguém fica sem retorno) */
export const MOTIVO_CHAT: Record<string, string> = {
  nenhum_documento: "Não achei de qual documento fazer o vídeo — cite o título, peça uma busca de artigos antes, ou me mande o PDF.",
  sem_fonte: "Esse documento não tem PDF aberto nem DOI — não consigo lê-lo inteiro pra fazer o vídeo (e não resumo só pelo título).",
  limite_do_dia: "Você chegou ao limite de vídeos novos de hoje — amanhã eu faço este.",
  base_cheia: "Sua base já está no limite de documentos; apague algum na Minha base pra eu guardar este PDF.",
  pdf_falhou: "Não consegui ler esse PDF pra fazer o vídeo.",
};
