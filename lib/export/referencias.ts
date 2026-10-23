/**
 * lib/export/referencias.ts — a referência que o trabalho JÁ tem em texto (ABNT NBR 6023, escrita pela Aura ou
 * pelo aluno na seção REFERÊNCIAS) em CAMPOS (autores, título, ano, veículo, DOI, URL) — é com campos que o
 * serviço de formatação monta Vancouver e APA (abnt-service/styles.py). Puro, determinístico, sem modelo.
 *
 * Forma esperada (a da 6023): "SOBRENOME, Nome; OUTRO, Nome. Título: subtítulo. Veículo, v. 3, n. 2, p. 1-9, 2020.
 * DOI/Disponível em: <url>. Acesso em: …". O que não der pra separar fica em `text` e sai como veio.
 */
export type RefCampos = {
  text: string; authors: string[]; title?: string; year?: number; venue?: string; doi?: string; url?: string;
};

const AUTOR_RE = /^[A-ZÀ-ÜÇ][A-ZÀ-ÜÇ'’\- ]+,\s*[^;.]+/; // "SILVA, Ana" (sobrenome em CAIXA ALTA)
const ANO_RE = /\b(1[5-9]\d{2}|20\d{2})\b/g;

/** As linhas de referência de uma seção REFERÊNCIAS (uma por parágrafo; ignora vazias e marcadores de lista). */
export function linhasDeReferencia(corpo: string): string[] {
  return String(corpo || "").split(/\n+/).map((l) => l.replace(/^\s*(?:[-*•]|\d{1,3}[.)])\s+/, "").trim()).filter((l) => l.length > 8);
}

export function lerReferencia(linha: string): RefCampos {
  const text = linha.replace(/\s+/g, " ").trim();
  const out: RefCampos = { text, authors: [] };
  const doi = text.match(/\b(10\.\d{4,9}\/[^\s<>"]+?)(?=[.,;]?(\s|$))/i);
  if (doi) out.doi = doi[1];
  const url = text.match(/https?:\/\/[^\s<>]+?(?=[>.,;]?(\s|$))/i);
  if (url && !(doi && url[0].includes(doi[1]))) out.url = url[0];
  const anos = [...text.replace(/acesso em:.*$/i, "").matchAll(ANO_RE)].map((m) => Number(m[1]));
  if (anos.length) out.year = anos[anos.length - 1];

  // autores: segmentos "SOBRENOME, Nome" separados por ";" até o primeiro ". " que fecha o bloco de autoria
  let resto = text;
  if (AUTOR_RE.test(text)) {
    const fim = acharFimDosAutores(text);
    if (fim > 0) {
      out.authors = text.slice(0, fim).split(/\s*;\s*/).map((a) => a.replace(/\bet al\.?$/i, "").trim()).filter(Boolean);
      resto = text.slice(fim + 1).trim();
    }
  }
  // título = até o próximo ". " (subtítulo depois de ":" fica junto); veículo = o trecho seguinte até a vírgula/ponto
  const tit = resto.match(/^(.+?)\.(\s|$)/);
  if (tit && tit[1].length > 2) {
    out.title = tit[1].trim();
    const depois = resto.slice(tit[0].length).trim();
    const venue = depois.match(/^([^,.]+?)(?:,|\.\s|\.$)/);
    if (venue && !/^(dispon|acesso|doi|https?:|\d)/i.test(venue[1].trim()) && !/^(\d+\.? ed\.|[A-ZÀ-Ü][^:]{0,40}:\s)/.test(depois)) {
      out.venue = venue[1].trim();
    }
  }
  return out;
}

/** O "." que fecha os autores: o 1º ". " depois do último "SOBRENOME, Nome" — sem confundir "A. B." de iniciais. */
function acharFimDosAutores(t: string): number {
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== ".") continue;
    if (/\bet al$/i.test(t.slice(0, i))) return i;
    if (!(t[i + 1] === " " || i === t.length - 1)) continue; // "A.;" / "v.3" — não fecha
    const antes = t.slice(Math.max(0, i - 3), i);
    // ponto de INICIAL ("Silva, A. B.") só continua os autores se vier outra inicial logo depois
    if (/(^|[\s,])[A-ZÀ-Ü]$/.test(antes) && /^[A-ZÀ-Ü]\.(\s|;|$)/.test(t.slice(i + 1).trimStart())) continue;
    return i;
  }
  return -1;
}

/** O sobrenome de cada autor (pra casar com as chamadas no texto). */
export const sobrenome = (autor: string) => {
  const a = autor.trim();
  return (a.includes(",") ? a.split(",")[0] : a.split(/\s+/).pop() ?? "").trim();
};
