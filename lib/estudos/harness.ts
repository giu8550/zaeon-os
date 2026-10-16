/**
 * MEUS ESTUDOS — o HARNESS dentro do board (PURO). Dentro de um card de estudo (ou de um passo do percurso):
 *  - GERAR PERCURSO: o percursor (o Cérebro — lib/map) classifica o tema e devolve os passos; cada passo vira um card de
 *    PERCURSO ramificado à esquerda do estudo (o caminho, em leque);
 *  - RESPOSTA CERTEIRA: a busca na literatura (lib/scholar) com a checagem DETERMINÍSTICA de cada citação no texto do
 *    artigo; cada afirmação CONFIRMADA (a citação estava lá) vira um card de CONFIRMAÇÃO com as fontes; o que o modelo
 *    afirmou mas a checagem DERRUBOU, e as lacunas abertas da literatura, viram ESPECULAÇÕES (cards menores). Sem
 *    nenhum artigo nas bases, a resposta inteira fica como especulação (não é fonte acadêmica).
 * Aqui só o que vira card (e onde): o servidor chama os modelos (lib/estudos/harness-server).
 */
import { LARGURA, filhosDe, novoIdCard, posicaoDoFilho, type CardEstudo, type Fonte, type TipoCard } from "./board";

/** quantos cards no máximo cada ação cria (o board não vira uma parede) */
export const MAX_PASSOS = 8, MAX_CONFIRMACOES = 6, MAX_ESPECULACOES = 4;

/** a altura estimada de um card (sem o DOM: o servidor posiciona) — pelo texto que ele carrega */
export function alturaEstimada(c: Pick<CardEstudo, "tipo" | "titulo" | "corpo" | "fontes" | "w">): number {
  const porLinha = Math.max(20, Math.floor((c.w - 24) / 7.2)), linhas = (t?: string) => (t ? Math.ceil(t.length / porLinha) : 0);
  const base = c.tipo === "estudo" ? 170 : c.tipo === "especulacao" ? 46 : 58;
  return base + linhas(c.titulo) * 18 + linhas(c.corpo) * 17 + (c.fontes?.length ?? 0) * 18;
}

/** o tema que se pergunta a partir de um card (o título e o texto, enxutos) */
export function temaDoCard(c: Pick<CardEstudo, "titulo" | "corpo">): string {
  return [c.titulo, c.corpo].filter(Boolean).join(" — ").replace(/\s+/g, " ").trim().slice(0, 300);
}

/** encaixa os `novos` (já com tipo/texto) como FILHOS de `pai`, um embaixo do outro, à esquerda dele */
function encaixar(pai: CardEstudo, cards: readonly CardEstudo[], novos: { tipo: TipoCard; titulo?: string; corpo?: string; fontes?: Fonte[] }[], autor?: string): CardEstudo[] {
  const irmaos = [...filhosDe(cards, pai.id)], out: CardEstudo[] = [];
  for (const n of novos) {
    const w = LARGURA[n.tipo], pos = posicaoDoFilho(pai, irmaos, n.tipo, (c) => alturaEstimada(c));
    const card: CardEstudo = { id: novoIdCard(n.tipo), tipo: n.tipo, x: Math.round(pos.x), y: Math.round(pos.y), w, pai: pai.id, ...(n.titulo ? { titulo: n.titulo.slice(0, 200) } : {}), ...(n.corpo ? { corpo: n.corpo.slice(0, 6000) } : {}), ...(n.fontes?.length ? { fontes: n.fontes } : {}), ...(autor ? { autor } : {}) };
    irmaos.push(card); out.push(card);
  }
  return out;
}

export type PassoPercurso = { label: string; corpo?: string; tipo?: string };
/** os passos do percursor → os cards de PERCURSO (numerados, na ordem) */
export function cardsDoPercurso(pai: CardEstudo, cards: readonly CardEstudo[], passos: readonly PassoPercurso[], autor?: string): CardEstudo[] {
  const ok = passos.filter((p) => p.label?.trim()).slice(0, MAX_PASSOS);
  return encaixar(pai, cards, ok.map((p, i) => ({ tipo: "percurso" as const, titulo: `${i + 1}. ${p.label.trim()}`, corpo: p.corpo?.trim() || undefined })), autor);
}

/** o que a resposta certeira devolve (o essencial do lib/scholar): as evidências CHECADAS, as derrubadas, as lacunas */
export type Evidencia = { claim: string; quote: string; paperId: string };
export type Artigo = { id: string; title: string; year?: number; doi?: string; url?: string };
export type RespostaCerteira = {
  confirmadas: Evidencia[];
  derrubadas: Evidencia[];
  lacunas: string[];
  artigos: Artigo[];
  /** sem nenhum artigo nas bases: a resposta (web/modelo) — vira UMA especulação */
  semFontes?: string | null;
};
const urlDoArtigo = (a: Artigo) => a.url || (a.doi ? `https://doi.org/${a.doi}` : undefined);
/** a resposta → CONFIRMAÇÕES (uma por afirmação, com as fontes que a confirmam) + ESPECULAÇÕES (as derrubadas e as lacunas) */
export function cardsDaResposta(pai: CardEstudo, cards: readonly CardEstudo[], r: RespostaCerteira, autor?: string): CardEstudo[] {
  const porId = new Map(r.artigos.map((a) => [a.id, a] as const));
  const porClaim = new Map<string, { claim: string; fontes: Fonte[] }>();
  for (const e of r.confirmadas) {
    const k = e.claim.trim().toLowerCase(); if (!k) continue;
    const a = porId.get(e.paperId); if (!a) continue;
    const g = porClaim.get(k) ?? { claim: e.claim.trim(), fontes: [] };
    if (!g.fontes.some((f) => f.titulo === a.title)) g.fontes.push({ titulo: a.title.slice(0, 300), ...(urlDoArtigo(a) ? { url: urlDoArtigo(a) } : {}), ...(a.year ? { ano: a.year } : {}), trecho: e.quote.slice(0, 600) });
    porClaim.set(k, g);
  }
  const confirmadas = [...porClaim.values()].slice(0, MAX_CONFIRMACOES).map((g) => ({ tipo: "confirmacao" as const, titulo: g.claim.slice(0, 200), corpo: g.fontes[0]?.trecho ? `“${g.fontes[0].trecho}”` : undefined, fontes: g.fontes.map(({ trecho: _t, ...f }) => { void _t; return f; }) }));
  const jaConfirmado = new Set(porClaim.keys());
  const especulacoes: { tipo: "especulacao"; titulo?: string; corpo?: string }[] = [];
  if (r.semFontes) especulacoes.push({ tipo: "especulacao", titulo: "Sem fonte acadêmica indexada", corpo: r.semFontes.slice(0, 1200) });
  for (const e of r.derrubadas) { const k = e.claim.trim().toLowerCase(); if (k && !jaConfirmado.has(k) && !especulacoes.some((s) => s.titulo?.toLowerCase() === k)) especulacoes.push({ tipo: "especulacao", titulo: e.claim.trim().slice(0, 200), corpo: "A citação não foi encontrada no texto do artigo — fica como especulação." }); }
  for (const l of r.lacunas) if (l.trim()) especulacoes.push({ tipo: "especulacao", titulo: "Lacuna aberta", corpo: l.trim().slice(0, 600) });
  return encaixar(pai, cards, [...confirmadas, ...especulacoes.slice(0, MAX_ESPECULACOES)], autor);
}
