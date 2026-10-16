/**
 * MEUS ESTUDOS — o HARNESS no servidor: chama o PERCURSOR (o Cérebro — lib/map: classifica o tema e devolve os passos)
 * e a RESPOSTA CERTEIRA (lib/scholar: busca nas bases acadêmicas, abre o texto, sintetiza e CONFERE cada citação no
 * texto do artigo — `assembleResults`/`verifyQuote`). Sem sessão do Scholar: só o resultado vira cards no board
 * (lib/estudos/harness).
 */
import { BACKBONE_SYSTEM, backboneFallback, classificarTopico, promptBackbone } from "@/lib/map/generateMap";
import { GEMINI_MODEL_FLASH } from "@/lib/ai/model";
import type { PassoPercurso, RespostaCerteira } from "@/lib/estudos/harness";

/** os passos do percurso pro tema (o mesmo percursor do Cérebro; se o modelo falhar, o caminho genérico do arquétipo) */
export async function gerarPassos(tema: string): Promise<PassoPercurso[]> {
  const c = await classificarTopico(tema);
  try {
    const { geminiJson } = await import("@/lib/scholar/gemini");
    const raw = await geminiJson<{ passos?: unknown }>(BACKBONE_SYSTEM, promptBackbone(c, tema, []), { temperature: 0.3, model: GEMINI_MODEL_FLASH, timeoutMs: 30_000 });
    const lista = Array.isArray(raw?.passos) ? raw.passos : Array.isArray(raw) ? (raw as unknown[]) : [];
    const passos = lista.map((p): PassoPercurso | null => {
      const o = p as Record<string, unknown>, label = typeof p === "string" ? p : typeof o?.label === "string" ? o.label : "";
      if (!label.trim()) return null;
      const corpo = typeof o?.corpo === "string" ? o.corpo : typeof o?.resumo === "string" ? o.resumo : undefined;
      return { label: label.trim(), corpo, tipo: typeof o?.tipo === "string" ? o.tipo : undefined };
    }).filter((p): p is PassoPercurso => p !== null);
    if (passos.length) return passos;
  } catch { /* cai no caminho genérico */ }
  return backboneFallback(c.tipoTopico, tema);
}

/** a resposta certeira pro tema: o que foi CONFIRMADO no texto dos artigos, o que a checagem derrubou e as lacunas */
export async function respostaCerteira(tema: string): Promise<RespostaCerteira> {
  const [{ planQuery, synthesize }, { retrievePapers, MIN_RESULTS }, { resolveFullText }, { assembleResults }, { mapLimit }, { responderSemFontes }] = await Promise.all([
    import("@/lib/scholar/synthesize"), import("@/lib/scholar/retrieve"), import("@/lib/scholar/fulltext"), import("@/lib/scholar/assemble"), import("@/lib/scholar/http"), import("@/lib/scholar/semFontes"),
  ]);
  const plan = await planQuery(tema);
  const achados = await retrievePapers(plan.queries.length ? plan.queries : [tema], { domain: plan.domain, minResults: MIN_RESULTS });
  const termos = [...new Set((tema.toLowerCase().match(/[a-zà-ú0-9]{4,}/gi) || []))];
  const relevantes = achados.papers.filter((p) => !termos.length || termos.some((t) => `${p.title ?? ""} ${p.abstract ?? ""}`.toLowerCase().includes(t)));
  const top = (relevantes.length ? relevantes : achados.papers).slice(0, 4);
  const comTexto = (await mapLimit(top, 4, (p) => resolveFullText(p))).filter((p) => p.retrievedText);
  if (!comTexto.length) {
    const sf = await responderSemFontes(tema);
    return { confirmadas: [], derrubadas: [], lacunas: [], artigos: [], semFontes: sf.answer };
  }
  const raw = await synthesize(tema, comTexto);
  const r = assembleResults(tema, comTexto, raw);
  const verificadas = new Set(r.evidence.map((e) => `${e.paperId}|${e.quote}`));
  return {
    confirmadas: r.evidence.filter((e) => e.verified).map((e) => ({ claim: e.claim, quote: e.quote, paperId: e.paperId })),
    derrubadas: (raw.evidence ?? []).filter((e) => !verificadas.has(`${e.paperId}|${e.quote}`)).map((e) => ({ claim: e.claim, quote: e.quote, paperId: e.paperId })),
    lacunas: (raw.gaps?.rqCards ?? []).slice(0, 3),
    artigos: comTexto.map((p) => ({ id: p.id, title: p.title, year: p.year, doi: p.doi, url: p.url })),
  };
}
