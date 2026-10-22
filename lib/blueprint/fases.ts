/**
 * BLUEPRINT PRÁTICO — as FASES (PURO). Pedido do dono: "pra passar de uma fase pra outra tem que ter entrega real".
 * Uma fase só fecha quando TODOS os seus críticos têm prova conferida pelo servidor E a Zaeon aprova pela rubrica
 * (rigor, originalidade, usabilidade real, viabilidade, impacto). A fase 4 (Final) aprovada pela Zaeon fica
 * "aguardando mentor" — o humano entra só ali. Nada aqui regride.
 */
import { DIMENSOES, type Avaliacao, type Critico, type DocBlueprint, type Entrega, type Fase, type Rubrica } from "./tipos";

export const LIMIAR = { media: 60, minimo: 40 } as const;

/** as fases aprovadas: as anteriores à atual (só avança aprovando) + a final, quando aguarda o mentor */
export const fasesAprovadas = (d: Pick<DocBlueprint, "fase" | "aguardandoMentor">): number => d.fase - 1 + (d.aguardandoMentor ? 1 : 0);

export const criticosAbertos = (doc: DocBlueprint, fase: Fase = doc.fase): Critico[] => doc.criticos.filter((c) => c.status === "aberto" && c.fase === fase);

/** a fase atual tem crítico e todos estão provados (e ainda não está esperando o mentor) */
export function prontaPraAvaliar(doc: DocBlueprint): boolean {
  const daFase = doc.criticos.filter((c) => c.fase === doc.fase);
  return !doc.aguardandoMentor && daFase.length > 0 && daFase.every((c) => c.status === "provado");
}

/** pronta E ainda sem veredito válido: nenhuma avaliação desta fase, ou a última reprovou ANTES de uma prova nova
 *  (a avaliação que falhou por erro do modelo não grava nada — então dá pra pedir de novo) */
export function precisaAvaliar(doc: DocBlueprint): boolean {
  if (!prontaPraAvaliar(doc)) return false;
  const daFase = doc.avaliacoes.filter((a) => a.fase === doc.fase);
  if (daFase.some((a) => a.aprovada)) return false;
  const ultima = daFase[daFase.length - 1];
  const ultimaProva = Math.max(0, ...doc.criticos.filter((c) => c.fase === doc.fase).map((c) => c.entrega?.em ?? 0));
  return !ultima || ultimaProva > ultima.em;
}

/** marca o crítico da fase ATUAL como provado com a entrega conferida (idempotente: o primeiro registro vale) */
export function registrarEntrega(doc: DocBlueprint, criticoId: string, e: Entrega): DocBlueprint {
  const alvo = doc.criticos.find((c) => c.id === criticoId);
  if (!alvo || alvo.status === "provado" || alvo.fase !== doc.fase) return doc;
  return { ...doc, criticos: doc.criticos.map((c) => (c.id === criticoId ? { ...c, status: "provado", entrega: e } : c)) };
}

export const mediaDe = (n: Rubrica): number => DIMENSOES.reduce((s, k) => s + n[k], 0) / DIMENSOES.length;
export const aprovada = (n: Rubrica): boolean => mediaDe(n) >= LIMIAR.media && DIMENSOES.every((k) => n[k] >= LIMIAR.minimo);

/** grava a avaliação; aprovada na fase atual avança (ou, na final, passa a aguardar o mentor) */
export function aplicarAvaliacao(doc: DocBlueprint, a: Omit<Avaliacao, "aprovada">): DocBlueprint {
  const av: Avaliacao = { ...a, aprovada: aprovada(a.nota) };
  const out: DocBlueprint = { ...doc, avaliacoes: [...doc.avaliacoes, av] };
  if (!av.aprovada || a.fase !== doc.fase || doc.aguardandoMentor) return out;
  if (doc.fase === 4) out.aguardandoMentor = true;
  else out.fase = (doc.fase + 1) as Fase;
  return out;
}
