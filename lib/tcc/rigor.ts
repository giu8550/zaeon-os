/**
 * Sala de Pesquisa lapidando o TCC — o lado RIGOR do cross-sala.
 *
 * Diferença pra Sala de Estudos: aqui NADA é aplicado direto. O pipeline devolve operações por
 * seção que viram SUGESTÕES (o aluno aceita/rejeita), e cada uma precisa vir com FONTE VERIFICADA:
 *
 *   1. buscar papers reais (lib/scholar/retrieve — Semantic Scholar/OpenAlex/arXiv/Crossref/PubMed);
 *   2. o modelo propõe edições citando SÓ as fontes numeradas que recebeu;
 *   3. o CRÍTICO (determinístico, `critic: "full"` do contrato) derruba toda edição sem fonte
 *      válida, sem seção-alvo ou que tente apagar; garante a citação autor-data (ABNT NBR 10520)
 *      no texto e anexa a referência NBR 6023 de cada fonte.
 *
 * O rigor é CONTRATO (INTENTS.revisar em lib/agent/contracts.ts), não um modelo novo. A busca de
 * literatura do harness (`literature_search`) ainda é stub — por isso a busca aqui é a do Scholar,
 * que é a mesma que a Sala de Pesquisa já usa e que só devolve papers que existem.
 */
import { INTENTS } from "@/lib/agent/contracts";
import { formatAbntReference } from "@/lib/scholar/abnt";
import type { Paper } from "@/lib/scholar/types";
import { isOpTipo, MAX_CORPO, type OpSecao, type Secao } from "@/lib/tcc/secoes";
import type { FonteVerificada } from "@/lib/tcc/store";

export const SPEC_RIGOR = INTENTS.revisar; // critic: "full"
export const MAX_SUGESTOES = 4;
const MAX_FONTES = 8;

export type Proposta = { secaoId?: string; op?: string; titulo?: string; corpo?: string; fontes?: unknown; nota?: string };
export type SugestaoRigor = OpSecao & { fontes: FonteVerificada[]; nota: string };
export type ResultadoRigor = { texto: string; sugestoes: SugestaoRigor[]; descartadas: number; fontes: FonteVerificada[] };

export type RigorDeps = {
  retrieve: (queries: string[]) => Promise<Paper[]>;
  gen: (sys: string, user: string) => Promise<{ resumo?: string; edicoes?: Proposta[] }>;
};

/** "SOBRENOME, ano" — a chamada autor-data que tem que aparecer no texto (NBR 10520). */
export function chamadaAutorData(p: Paper): string {
  const primeiro = (p.authors?.[0] ?? "").trim();
  const tokens = primeiro.split(/\s+/).filter(Boolean);
  // "Family Initials" (PubMed) → 1º token; "Given Family" → último (mesma regra do formatAbntAuthor)
  const pubmed = tokens.length > 1 && /^[A-Z.]{1,4}$/.test(tokens[tokens.length - 1]) && tokens[0].length > 1;
  const sobrenome = (pubmed ? tokens[0] : tokens[tokens.length - 1]) || (p.title || "S.N.").split(/\s+/)[0];
  const etal = (p.authors?.length ?? 0) > 3 ? " et al." : "";
  return `${sobrenome.toUpperCase()}${etal}, ${p.year ?? "[s.d.]"}`;
}

export const fonteDe = (p: Paper): FonteVerificada => ({
  abnt: formatAbntReference(p), titulo: p.title,
  ...(p.url ? { url: p.url } : {}), ...(p.doi ? { doi: p.doi } : {}),
});

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O texto já cita a fonte? (sobrenome do 1º autor e ano, em qualquer caixa) */
export function citaNoTexto(corpo: string, p: Paper): boolean {
  const [sob, ano] = chamadaAutorData(p).replace(" et al.", "").split(", ");
  const t = norm(corpo);
  return t.includes(norm(sob)) && t.includes(String(ano));
}

/**
 * O CRÍTICO. Puro e determinístico: o que passa aqui é o que o aluno vê como sugestão.
 * Regras: op válida (Pesquisa não apaga seção) · seção-alvo existe (exceto inserir) · corpo não
 * vazio · ≥1 fonte, e só índices que existem · chamada autor-data no texto (acrescenta se faltar).
 */
export function criticar(propostas: unknown, secoes: Secao[], papers: Paper[]): { sugestoes: SugestaoRigor[]; descartadas: number } {
  const lista = Array.isArray(propostas) ? propostas : [];
  const ids = new Set(secoes.map((s) => s.id));
  const sugestoes: SugestaoRigor[] = [];
  let descartadas = 0;
  for (const raw of lista) {
    const p = (raw ?? {}) as Proposta;
    const op = p.op;
    let corpo = typeof p.corpo === "string" ? p.corpo.trim().slice(0, MAX_CORPO) : "";
    const valida = isOpTipo(op) && op !== "remover"
      && (op === "inserir" ? typeof p.titulo === "string" && !!p.titulo.trim() : typeof p.secaoId === "string" && ids.has(p.secaoId))
      && !!corpo;
    const idx = (Array.isArray(p.fontes) ? p.fontes : [])
      .map((n) => Number(n))
      .filter((n, i, a) => Number.isInteger(n) && n >= 1 && n <= papers.length && a.indexOf(n) === i);
    if (!valida || !idx.length || sugestoes.length >= MAX_SUGESTOES) { descartadas++; continue; }
    const citadas = idx.map((n) => papers[n - 1]);
    // Sem chamada no texto, a fonte vira enfeite: o crítico põe a chamada autor-data no fim.
    const faltando = citadas.filter((c) => !citaNoTexto(corpo, c));
    if (faltando.length) corpo = `${corpo} (${faltando.map(chamadaAutorData).join("; ")}).`;
    sugestoes.push({
      op: op as OpSecao["op"],
      ...(op === "inserir" ? { titulo: String(p.titulo).trim() } : { secaoId: p.secaoId }),
      corpo,
      fontes: citadas.map(fonteDe),
      nota: typeof p.nota === "string" ? p.nota.trim().slice(0, 600) : "",
    });
  }
  return { sugestoes, descartadas };
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

export function promptRigor(secoes: Secao[], titulo: string, pedido: string, papers: Paper[], foco?: string): { sys: string; user: string } {
  const sys = [
    "Você é o REVISOR CIENTÍFICO da Sala de Pesquisa da Zaeon. Rigor acadêmico é a única possibilidade.",
    "Proponha EDIÇÕES no TCC do aluno que atendam ao pedido, em PT-BR formal.",
    "REGRAS INEGOCIÁVEIS:",
    "- Use SOMENTE as FONTES numeradas fornecidas. Nunca invente autor, ano, dado ou citação.",
    "- Toda edição lista em `fontes` os NÚMEROS das fontes que a sustentam (no mínimo 1).",
    "- Cite no texto em autor-data ABNT: (SOBRENOME, ano).",
    "- Não apague seções. Prefira `anexar` (acrescentar ao fim) a `substituir`; use `substituir` só para reescrever trecho fraco, preservando o que estava certo.",
    "- `nota`: 1 frase dizendo POR QUE a mudança melhora o rigor.",
    `- No máximo ${MAX_SUGESTOES} edições. Se as fontes não sustentam nada, devolva "edicoes": [] e explique no resumo.`,
    'Responda SOMENTE JSON: {"resumo":"1-2 frases pro aluno","edicoes":[{"secaoId":"<id existente>","op":"anexar|substituir|inserir","titulo":"<só p/ inserir>","corpo":"...","fontes":[1],"nota":"..."}]}',
  ].join("\n");
  const docs = secoes.map((s) => `[${s.id}] # ${s.titulo}\n${clip(s.corpo.trim() || "(vazia)", 1500)}`).join("\n\n");
  const fontes = papers.map((p, i) => `${i + 1}. ${formatAbntReference(p)}${p.abstract ? `\n   Resumo: ${clip(p.abstract, 500)}` : ""}`).join("\n");
  const user = `TCC "${titulo}"${foco ? ` — foco na seção [${foco}]` : ""}\n\n${docs}\n\nPEDIDO DO ALUNO: ${pedido}\n\nFONTES VERIFICADAS:\n${fontes}`;
  return { sys, user };
}

/** Papers com metadado mínimo pra virar referência (título + autor ou ano), sem repetir. */
export function papersCitaveis(papers: Paper[]): Paper[] {
  return papers.filter((p) => p?.title?.trim() && (p.authors?.length || p.year)).slice(0, MAX_FONTES);
}

export async function lapidarComRigor(
  input: { titulo: string; secoes: Secao[]; pedido: string; secaoId?: string },
  deps: RigorDeps,
): Promise<ResultadoRigor> {
  const foco = input.secaoId && input.secoes.some((s) => s.id === input.secaoId) ? input.secaoId : undefined;
  const tituloFoco = foco ? input.secoes.find((s) => s.id === foco)!.titulo : "";
  const queries = [input.pedido, `${input.titulo} ${tituloFoco}`.trim()].map((q) => q.slice(0, 200)).filter(Boolean);
  const papers = papersCitaveis(await deps.retrieve(queries).catch(() => []));
  if (!papers.length) {
    return {
      texto: "Não encontrei fonte acadêmica verificada para sustentar essa mudança — e aqui, sem fonte, eu não proponho edição. Tente reformular o pedido com o tema mais específico.",
      sugestoes: [], descartadas: 0, fontes: [],
    };
  }
  const { sys, user } = promptRigor(input.secoes, input.titulo, input.pedido, papers, foco);
  const out = await deps.gen(sys, user);
  const { sugestoes, descartadas } = criticar(out?.edicoes, input.secoes, papers);
  const usadas = new Set(sugestoes.flatMap((s) => s.fontes.map((f) => f.abnt)));
  const base = typeof out?.resumo === "string" && out.resumo.trim() ? out.resumo.trim() : "";
  const texto = sugestoes.length
    ? `${base ? base + "\n\n" : ""}Deixei ${sugestoes.length} sugest${sugestoes.length > 1 ? "ões" : "ão"} no TCC, com ${usadas.size} fonte${usadas.size > 1 ? "s" : ""} verificada${usadas.size > 1 ? "s" : ""}. Nada muda até você aceitar.`
    : `${base ? base + "\n\n" : ""}Nenhuma edição passou no crivo de rigor (toda mudança precisa de fonte verificada), então não sugeri nada.`;
  return { texto, sugestoes, descartadas, fontes: papers.map(fonteDe) };
}
