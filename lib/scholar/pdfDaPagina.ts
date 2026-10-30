/**
 * lib/scholar/pdfDaPagina.ts — o link do PDF quando o endereço salvo é a PÁGINA do artigo, não o arquivo (#414). PURO.
 *
 * "Alguns PDFs não aparecem pra leitura quando arrastamos": o proxy (/api/ai/scholar/pdf) baixava o endereço salvo e,
 * quando vinha HTML (a página do artigo, o doi.org que redireciona pra editora), respondia 502 — e o PDF não abria.
 * As páginas acadêmicas dizem onde está o PDF numa marcação padrão (a mesma que o Google Acadêmico lê):
 *   <meta name="citation_pdf_url" content="…">  ·  <link rel="alternate" type="application/pdf" href="…">
 * E o arXiv tem a página em /abs/<id> e o arquivo em /pdf/<id>.
 */

/** arXiv: a página (/abs/2401.00001v2) → o arquivo (/pdf/2401.00001v2). Outro endereço → null. */
export function pdfDoArxiv(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)arxiv\.org$/i.test(u.hostname)) return null;
    const m = /^\/abs\/(.+?)\/?$/.exec(u.pathname);
    return m ? `${u.protocol}//${u.host}/pdf/${m[1]}` : null;
  } catch { return null; }
}

const attr = (tag: string, nome: string): string | null => {
  const m = new RegExp(`\\b${nome}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4] ?? "").trim() : null;
};

const desescapar = (s: string) => s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/");

/**
 * O endereço do PDF que a página anuncia (absoluto, resolvido contra a própria página). Só olha o começo da página
 * (as marcações ficam no <head>). Nada anunciado → null. NÃO checa se o host é público: quem chama revalida (SSRF).
 */
export function pdfDaPagina(html: string, base: string): string | null {
  const head = html.slice(0, 200_000);
  const candidatos: string[] = [];
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const nome = (attr(tag, "name") ?? attr(tag, "property") ?? "").toLowerCase();
    if (nome === "citation_pdf_url" || nome === "eprints.document_url" || nome === "bepress_citation_pdf_url") {
      const c = attr(tag, "content");
      if (c) candidatos.push(c);
    }
  }
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    if (/application\/pdf/i.test(attr(tag, "type") ?? "") && /alternate/i.test(attr(tag, "rel") ?? "")) {
      const h = attr(tag, "href");
      if (h) candidatos.push(h);
    }
  }
  for (const c of candidatos) {
    try {
      const u = new URL(desescapar(c), base);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch { /* endereço inválido: tenta o próximo */ }
  }
  return null;
}
