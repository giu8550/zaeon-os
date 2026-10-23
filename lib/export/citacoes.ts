/**
 * lib/export/citacoes.ts — as CHAMADAS no texto, da forma em que o trabalho foi escrito (ABNT NBR 10520: "(SILVA,
 * 2021)", "(SILVA; SOUZA, 2020, p. 12)", "Silva et al. (2019)") pra norma escolhida no export:
 *   - Vancouver: número entre colchetes na ORDEM DE CITAÇÃO ("[1]", "[1,3]"; narrativa: "Silva et al. [2]") — e a
 *     lista de referências sai nessa mesma ordem (as não citadas vão pro fim);
 *   - APA: autor-data em caixa normal ("(Silva, 2021)", "(Silva & Souza, 2020, p. 12)", 3+ = "et al.").
 * A chamada que não casa com nenhuma referência fica como está (nunca inventa número). Puro.
 */
import { sobrenome, type RefCampos } from "@/lib/export/referencias";

export type Estilo = "abnt" | "vancouver" | "apa";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

type Obra = { autores: string[]; ano?: string; pagina?: string };

/** O miolo de "(SILVA; SOUZA, 2020, p. 12; LIMA, 2019)" → obras (o ";" separa coautores E obras: o ano fecha uma obra). */
function obrasDoParentese(miolo: string): Obra[] | null {
  const obras: Obra[] = [];
  let autores: string[] = [];
  for (const parte of miolo.split(/\s*;\s*/)) {
    const m = parte.match(/^(.+?),\s*(\d{4}[a-z]?)(?:,\s*(p\.\s*[\d\-–]+))?$/);
    if (m) { obras.push({ autores: [...autores, m[1].trim()], ano: m[2], pagina: m[3] }); autores = []; }
    else if (/^[A-ZÀ-ÜÇ][A-ZÀ-ÜÇ'’\- ]+(\set al\.?)?$/.test(parte.trim())) autores.push(parte.trim());
    else return null; // não é chamada ABNT: deixa o parêntese em paz
  }
  return obras.length && !autores.length ? obras : null;
}

const CHAVE = (autor: string, ano?: string) => `${semAcento(autor.replace(/\set al\.?$/i, ""))}|${(ano ?? "").slice(0, 4)}`;

export function converterCitacoes(textos: string[], refs: RefCampos[], estilo: Estilo): { textos: string[]; refs: RefCampos[] } {
  if (estilo === "abnt") return { textos, refs };
  // índice das referências por "sobrenome|ano" (e só "sobrenome|" quando a referência não tem ano)
  const idx = new Map<string, number>();
  refs.forEach((r, i) => {
    const s = r.authors[0] ? sobrenome(r.authors[0]) : "";
    if (!s) return;
    idx.set(CHAVE(s, r.year ? String(r.year) : ""), i);
    if (!idx.has(CHAVE(s))) idx.set(CHAVE(s), i);
  });
  const achar = (o: Obra) => idx.get(CHAVE(o.autores[0], o.ano)) ?? idx.get(CHAVE(o.autores[0]));

  const ordem: number[] = []; // Vancouver: a ordem de 1ª citação
  const numero = (i: number) => { let n = ordem.indexOf(i); if (n < 0) { ordem.push(i); n = ordem.length - 1; } return n + 1; };

  const apaAutores = (a: string[]) => {
    const nomes = a.map((x) => titulo(x.replace(/\set al\.?$/i, "")));
    if (a.some((x) => /et al/i.test(x)) || nomes.length >= 3) return `${nomes[0]} et al.`;
    return nomes.join(" & ");
  };

  const out = textos.map((texto) => {
    // 1) parentéticas: (SILVA, 2021) · (SILVA; SOUZA, 2020, p. 12) · (SILVA, 2019; LIMA, 2020)
    let t = texto.replace(/\(([^()]{3,200}?\d{4}[a-z]?(?:,\s*p\.\s*[\d\-–]+)?)\)/g, (todo, miolo: string) => {
      const obras = obrasDoParentese(miolo);
      if (!obras) return todo;
      if (estilo === "apa") return `(${obras.map((o) => `${apaAutores(o.autores)}, ${o.ano}${o.pagina ? `, ${o.pagina}` : ""}`).join("; ")})`;
      const ns = obras.map(achar);
      if (ns.some((n) => n === undefined)) return todo;
      return `[${[...new Set(ns.map((n) => numero(n!)))].sort((a, b) => a - b).join(",")}]`;
    });
    // 2) narrativas (Vancouver): "Silva et al. (2019)" → "Silva et al. [2]" (APA já escreve assim)
    if (estilo === "vancouver") {
      t = t.replace(/(\p{Lu}[\p{Ll}'-]+(?:\s+et al\.)?(?:\s+e\s+\p{Lu}[\p{Ll}'-]+)?)\s+\((\d{4})[a-z]?(?:,\s*p\.\s*[\d\-–]+)?\)/gu, (todo, quem: string, ano: string) => {
        const i = achar({ autores: [quem.split(/\s+(?:et al\.|e)\s*/)[0]], ano });
        return i === undefined ? todo : `${quem} [${numero(i)}]`;
      });
    }
    return t;
  });

  if (estilo !== "vancouver") return { textos: out, refs };
  const resto = refs.map((_, i) => i).filter((i) => !ordem.includes(i));
  return { textos: out, refs: [...ordem, ...resto].map((i) => refs[i]) };
}
