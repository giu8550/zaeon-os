/**
 * MEUS ESTUDOS — o BLUEPRINT de um estudo (PURO). O ponto focal de UX/UI e de CONCEITO (o dono, out/2026): pedir um
 * estudo engloba não só o científico, mas o FACTÍVEL, o PRODUTO FINAL, o RESULTADO, a "PATENTE" (em construção). O
 * blueprint lê o board e monta a prancha técnica do estudo:
 *  - o PRODUTO FINAL (o que se entrega) e o OBJETIVO;
 *  - os COMPONENTES: o que é factível — as CONFIRMAÇÕES checadas na literatura, numeradas (C-01…), com as fontes;
 *  - o CAMINHO (o percurso) e o EM ABERTO (as especulações);
 *  - os SELOS da camada de validação: links funcionando (o servidor checou), entregável com código (link privado) e a
 *    SUPERVISÃO (a validação por gente — ainda pendente);
 *  - a RARIDADE do item (o estudo vira um item de colecionador no inventário do game — e um livro no cyberespaço): sobe
 *    com a profundidade e com os selos. Quando há base pra ENTREGAR um produto, o blueprint ganha o selo de VENDÁVEL.
 */
import { filhosDe, profundidade, type CardEstudo, type Fonte } from "./board";

export type Raridade = "comum" | "rara" | "epica" | "lendaria";
export const RARIDADES: readonly Raridade[] = ["comum", "rara", "epica", "lendaria"];
export const NOME_RARIDADE: Record<Raridade, string> = { comum: "Comum", rara: "Rara", epica: "Épica", lendaria: "Lendária" };
export const COR_RARIDADE: Record<Raridade, string> = { comum: "#9fb8cc", rara: "#4fc3ff", epica: "#b98cff", lendaria: "#ffc23d" };
/** de quando os links checados valem (depois disso, precisa checar de novo) */
export const VALIDADE_LINKS_MS = 30 * 24 * 3600 * 1000;

export type SeloEstado = "ok" | "pendente" | "falhou";
export type Blueprint = {
  estudo: CardEstudo;
  titulo: string; objetivo: string; produto: string;
  componentes: { id: string; codigo: string; titulo: string; corpo?: string; fontes: Fonte[] }[];
  passos: { id: string; titulo: string }[];
  abertos: { id: string; titulo: string }[];
  fontes: Fonte[];
  profundidade: ReturnType<typeof profundidade>;
  /** a nota do ITEM (0..100): a profundidade + os selos */
  pontos: number; raridade: Raridade;
  selos: { links: SeloEstado; codigo: SeloEstado; supervisao: SeloEstado };
  /** dá pra ENTREGAR um produto com isso? (profundidade, produto final escrito, links ok e um entregável/supervisão) */
  vendavel: boolean;
};

export const raridadeDe = (pontos: number): Raridade => (pontos >= 75 ? "lendaria" : pontos >= 50 ? "epica" : pontos >= 25 ? "rara" : "comum");

/** todos os cards que descendem de um card (em largura, sem laço) */
function ramo(cards: readonly CardEstudo[], id: string): CardEstudo[] {
  const out: CardEstudo[] = [], fila = [id], vistos = new Set<string>();
  while (fila.length) { const k = fila.shift()!; if (vistos.has(k)) continue; vistos.add(k); for (const f of filhosDe(cards, k)) { out.push(f); fila.push(f.id); } }
  return out;
}

export function montarBlueprint(cards: readonly CardEstudo[], estudoId: string, agora = Date.now()): Blueprint | null {
  const estudo = cards.find((c) => c.id === estudoId && c.tipo === "estudo"); if (!estudo) return null;
  const r = ramo(cards, estudo.id), prof = profundidade(cards, estudo.id);
  const componentes = r.filter((c) => c.tipo === "confirmacao" && (c.fontes?.length ?? 0) > 0)
    .map((c, i) => ({ id: c.id, codigo: `C-${String(i + 1).padStart(2, "0")}`, titulo: c.titulo ?? "(sem título)", corpo: c.corpo, fontes: c.fontes ?? [] }));
  const vistas = new Set<string>(), fontes: Fonte[] = [];
  for (const f of componentes.flatMap((c) => c.fontes)) { const k = (f.url ?? f.titulo).toLowerCase(); if (!vistas.has(k)) { vistas.add(k); fontes.push(f); } }
  const l = estudo.selos?.links, linksValem = !!l && agora - l.em < VALIDADE_LINKS_MS;
  const links: SeloEstado = !l || !linksValem ? "pendente" : l.total > 0 && l.ok === l.total ? "ok" : "falhou";
  const codigo: SeloEstado = estudo.repo ? (links === "ok" ? "ok" : "pendente") : "pendente";
  const supervisao = "pendente" as SeloEstado;   // (a validação por gente — o professor vinculado — entra numa próxima etapa)
  const bonus = (links === "ok" ? 6 : 0) + (codigo === "ok" ? 8 : 0) + (estudo.produto ? 4 : 0);
  const pontos = Math.min(100, prof.nota + bonus);
  return {
    estudo, titulo: estudo.titulo ?? "Estudo", objetivo: estudo.corpo ?? "", produto: estudo.produto ?? "",
    componentes, passos: r.filter((c) => c.tipo === "percurso").map((c) => ({ id: c.id, titulo: c.titulo ?? "" })),
    abertos: r.filter((c) => c.tipo === "especulacao").map((c) => ({ id: c.id, titulo: c.titulo ?? c.corpo?.slice(0, 80) ?? "" })),
    fontes, profundidade: prof, pontos, raridade: raridadeDe(pontos),
    selos: { links, codigo, supervisao },
    vendavel: pontos >= 50 && !!estudo.produto && links === "ok" && (codigo === "ok" || supervisao === "ok"),
  };
}

/** os links que a checagem confere: as fontes do estudo (só http/https) e o repositório */
export function linksDoBlueprint(b: Blueprint): string[] {
  return [...new Set([...b.fontes.map((f) => f.url).filter((u): u is string => !!u), ...(b.estudo.repo ? [b.estudo.repo] : [])])].slice(0, 20);
}
