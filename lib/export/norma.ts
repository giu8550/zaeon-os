/**
 * lib/export/norma.ts — o trabalho (seções já separadas) preparado pra NORMA do export.
 * ABNT: passa direto (o motor da ABNT é o de sempre). Vancouver/APA: as referências saem da seção REFERÊNCIAS
 * (texto 6023) + das citações salvas, viram CAMPOS (lib/export/referencias), as chamadas no texto mudam de forma
 * (lib/export/citacoes) e a seção REFERÊNCIAS sai do corpo — o serviço monta a lista na ordem/forma da norma.
 */
import { converterCitacoes, type Estilo } from "@/lib/export/citacoes";
import { lerReferencia, linhasDeReferencia, type RefCampos } from "@/lib/export/referencias";

export type { Estilo };
export const ESTILOS: { id: Estilo; nome: string; dica: string }[] = [
  { id: "abnt", nome: "ABNT", dica: "NBR 14724 (trabalhos) · autor-data NBR 10520 · referências NBR 6023 — capa e folha de rosto" },
  { id: "vancouver", nome: "Vancouver", dica: "ICMJE (área da saúde) · citações numeradas [1] na ordem · referências numeradas" },
  { id: "apa", nome: "APA", dica: "APA 7ª ed. · autor-data (Silva, 2021) · espaço duplo · referências em ordem alfabética" },
];
export const ehEstilo = (v: unknown): v is Estilo => v === "abnt" || v === "vancouver" || v === "apa";

type Secao = { type: string; title: string; content: string; subsections: { title: string; content: string }[] };
type Citacao = { text: string; authors?: string[]; title?: string; year?: number; venue?: string; doi?: string; url?: string };

const ehRefs = (s: Secao) => s.type === "referencias" || /^refer[eê]ncias/i.test(s.title.trim());

export function prepararParaNorma(secoes: Secao[], citacoes: Citacao[], estilo: Estilo): { sections: Secao[]; references: RefCampos[] | null } {
  if (estilo === "abnt") return { sections: secoes, references: null };
  const daSecao = secoes.filter(ehRefs).flatMap((s) => linhasDeReferencia(s.content)).map(lerReferencia);
  const salvas: RefCampos[] = citacoes.map((c) => (c.title ? { text: c.text, authors: c.authors ?? [], title: c.title, year: c.year, venue: c.venue, doi: c.doi, url: c.url } : lerReferencia(c.text)));
  // sem duplicar a mesma obra (título + ano)
  const vistas = new Set<string>();
  const refs = [...daSecao, ...salvas].filter((r) => {
    const k = `${(r.title ?? r.text).toLowerCase()}|${r.year ?? ""}`;
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
  const corpo = secoes.filter((s) => !ehRefs(s));
  // todo texto do corpo, na ordem de leitura (seção, depois as subseções) — a ordem de citação do Vancouver
  const textos = corpo.flatMap((s) => [s.content, ...s.subsections.map((x) => x.content)]);
  const r = converterCitacoes(textos, refs, estilo);
  let k = 0;
  const sections = corpo.map((s) => ({ ...s, content: r.textos[k++], subsections: s.subsections.map((x) => ({ ...x, content: r.textos[k++] })) }));
  return { sections, references: r.refs };
}
