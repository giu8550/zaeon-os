/**
 * A ENTREGA ao Droid (PURO) — depois do tutorial, na Sala do Saber, a pessoa entrega uma pesquisa e o Droid só ACEITA
 * se ela estiver COMPLETA e TOTALMENTE ESTRUTURADA em ABNT (pedido do dono, out/2026). Aceita → o tutorial das MOTOS.
 * Os critérios são objetivos (o Droid diz o que falta):
 *  - título; seções marcadas (`# TÍTULO` — o formato do editor da Sala de Pesquisa, lib/abntTemplate);
 *  - RESUMO com palavras-chave; INTRODUÇÃO; DESENVOLVIMENTO (fundamentação/metodologia/resultados…); CONCLUSÃO (ou
 *    considerações finais) — cada uma com corpo de verdade;
 *  - REFERÊNCIAS no padrão ABNT (SOBRENOME, Nome… ano), no mínimo `refsMin`;
 *  - CITAÇÕES no texto — (SOBRENOME, ano) ou Sobrenome (ano) —, no mínimo `citacoesMin`;
 *  - TAMANHO mínimo (`palavrasMin` ≈ 5 páginas) e nenhum trecho de MODELO sem preencher.
 */
import { parseAbntMarkers, type ParsedSection } from "@/lib/abntTemplate";

export const REQUISITOS_ENTREGA = { palavrasMin: 1500, refsMin: 5, citacoesMin: 3, resumoMin: 60, introMin: 120, desenvMin: 300, conclusaoMin: 80 } as const;
export type AvaliacaoEntrega = { aceito: boolean; palavras: number; paginas: number; faltando: string[] };

const semAcento = (s: string) => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const palavras = (t: string) => (t.match(/[\p{L}\p{N}]+/gu) ?? []).length;
const corpo = (s: ParsedSection) => [s.content, ...s.subsections.map((x) => `${x.title}\n${x.content}`)].join("\n");

/** linhas de referência no padrão ABNT: SOBRENOME, Nome (ou Iniciais)… com um ano */
export function contarReferencias(texto: string): number {
  return texto.split(/\n+/).map((l) => l.trim().replace(/^[-*•\d.)\s]+/, "")).filter((l) => /^[A-ZÀ-Ý][A-ZÀ-Ý'´`\- ]{1,40},\s*[A-ZÀ-Ýa-zà-ý]/.test(l) && /\b(1[6-9]|20)\d{2}\b/.test(l)).length;
}
/** citações no texto: (SOBRENOME, 2020) · (SOBRENOME; OUTRO, 2020, p. 3) · Sobrenome (2020) · Sobrenome et al. (2020) */
export function contarCitacoes(texto: string): number {
  const entre = texto.match(/\((?:[A-ZÀ-Ý][A-ZÀ-Ý'\- ]+(?: et al\.)?;?\s*)+,\s*(?:1[6-9]|20)\d{2}[a-z]?(?:,\s*p\.\s*\d+(?:-\d+)?)?\)/g) ?? [];
  const narrativa = texto.match(/\b[A-ZÀ-Ý][a-zà-ý]+(?: et al\.)? \((?:1[6-9]|20)\d{2}[a-z]?\)/g) ?? [];
  return entre.length + narrativa.length;
}
/** sobrou texto de MODELO (o template do editor sem preencher)? */
export const temModelo = (t: string) => /\[(?:[^\]]{0,80})(escreva|insira|digite|descreva|preencha)/i.test(t) || /lorem ipsum/i.test(t);

export function avaliarEntrega(o: { titulo: string | null | undefined; conteudo: string | null | undefined }): AvaliacaoEntrega {
  const titulo = (o.titulo ?? "").replace(/\.(pdf|docx)$/i, "").trim(), texto = o.conteudo ?? "";
  const total = palavras(texto), paginas = Math.max(1, Math.ceil(total / 300)), faltando: string[] = [];
  const R = REQUISITOS_ENTREGA;
  if (titulo.length < 4 || /^pesquisa sem t[ií]tulo$/i.test(titulo)) faltando.push("um título de verdade");
  const secoes = parseAbntMarkers(texto);
  if (!secoes) {
    faltando.push("a estrutura ABNT (as seções com # TÍTULO: resumo, introdução, desenvolvimento, conclusão e referências)");
  } else {
    const achar = (re: RegExp) => secoes.filter((s) => re.test(semAcento(s.title)));
    const resumo = achar(/RESUMO|ABSTRACT/), intro = achar(/INTRODU/), concl = achar(/CONCLUS|CONSIDERACOES FINAIS/), refs = achar(/REFERENCIA|BIBLIOGRAFIA/);
    const usadas = new Set([...resumo, ...intro, ...concl, ...refs]);
    const desenv = secoes.filter((s) => !usadas.has(s) && !/SUMARIO|AGRADEC|DEDICAT|EPIGRAFE|APENDICE|ANEXO|OBJETIVOS?$/.test(semAcento(s.title)));
    const soma = (xs: ParsedSection[]) => xs.reduce((n, s) => n + palavras(corpo(s)), 0);
    if (soma(resumo) < R.resumoMin) faltando.push("o RESUMO (um parágrafo de verdade)");
    else if (!/palavras?-chave/i.test(resumo.map(corpo).join("\n"))) faltando.push("as palavras-chave no resumo");
    if (soma(intro) < R.introMin) faltando.push("a INTRODUÇÃO completa");
    if (soma(desenv) < R.desenvMin) faltando.push("o DESENVOLVIMENTO (fundamentação, metodologia, resultados)");
    if (soma(concl) < R.conclusaoMin) faltando.push("a CONCLUSÃO");
    const nRefs = contarReferencias(refs.map(corpo).join("\n"));
    if (nRefs < R.refsMin) faltando.push(`as REFERÊNCIAS no padrão ABNT (tem ${nRefs}, precisa de ${R.refsMin})`);
    const nCit = contarCitacoes(secoes.filter((s) => !refs.includes(s)).map(corpo).join("\n"));
    if (nCit < R.citacoesMin) faltando.push(`as CITAÇÕES no texto, tipo (SOBRENOME, 2020) (tem ${nCit}, precisa de ${R.citacoesMin})`);
  }
  if (total < R.palavrasMin) faltando.push(`mais conteúdo (tem ~${paginas} página${paginas === 1 ? "" : "s"}, precisa de ~${Math.ceil(R.palavrasMin / 300)})`);
  if (temModelo(texto)) faltando.push("tirar os trechos de modelo que ainda estão sem preencher");
  return { aceito: faltando.length === 0, palavras: total, paginas, faltando };
}
