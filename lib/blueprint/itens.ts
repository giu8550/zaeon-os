/**
 * BLUEPRINT PRÁTICO → ITEM RARO do jogo (PURO). Pedido do dono: "os blueprints alimentam o jogo sim, são itens raros".
 * Mesmo formato dos estudos do board (lib/estudos/itens — inventário, livros da biblioteca, vitrine, Relicário), mas a
 * raridade vem do que foi ENTREGUE de verdade: fases aprovadas (o peso maior), a nota da Zaeon e as fontes conferidas.
 * VENDÁVEL = a prova de conceito (fase 2) aprovada.
 */
import { raridadeDe } from "@/lib/estudos/blueprint";
import { proximaRaridade, type ItemEstudo } from "@/lib/estudos/itens";
import { fasesAprovadas, mediaDe } from "./fases";
import type { DocBlueprint } from "./tipos";

export const CARD_BLUEPRINT = "blueprint";

const fontesUnicas = (doc: DocBlueprint) => new Set(doc.passos.flatMap((p) => p.fontes.map((f) => (f.url ?? f.titulo).toLowerCase()))).size;

/** 0..100: 22 por fase aprovada (até 3 = 66) + 20% da média da última avaliação aprovada + 2 por fonte (até 5) + 4 aguardando o mentor */
export function pontosDoBlueprint(doc: DocBlueprint): number {
  const aprovadas = doc.avaliacoes.filter((a) => a.aprovada), ultima = aprovadas[aprovadas.length - 1];
  const bruto = Math.min(3, fasesAprovadas(doc)) * 22 + (ultima ? Math.round(mediaDe(ultima.nota) * 0.2) : 0) + Math.min(5, fontesUnicas(doc)) * 2 + (doc.aguardandoMentor ? 4 : 0);
  return Math.min(100, bruto);
}

export function itemDoBlueprint(cartolinaId: string, doc: DocBlueprint): ItemEstudo {
  const nivel = pontosDoBlueprint(doc);
  return {
    id: `${cartolinaId}:${CARD_BLUEPRINT}`, boardId: cartolinaId, cardId: CARD_BLUEPRINT,
    titulo: doc.titulo, raridade: raridadeDe(nivel), nivel,
    componentes: doc.pecas.length, fontes: fontesUnicas(doc), vendavel: fasesAprovadas(doc) >= 2,
    proxima: proximaRaridade(nivel),
  };
}
