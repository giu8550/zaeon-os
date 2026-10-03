/**
 * lib/map/memoria-turno.ts — o ÚNICO ponto de escrita de memória por turno (HANDOFF_CEREBRO_AURA §7).
 *
 * O runChatTurn chama só estas duas funções. Com MAP_HARNESS=1 o GRAFO é canônico: o turno
 * entra no MapaProbabilistico e a cartolina recebe a PROJEÇÃO (card.id === nó.id), pelo mesmo
 * patch com controle otimista de sempre. Com a flag off, cai na ponte antiga (cartolina direta) —
 * nada muda até ligar.
 *
 * Tudo best-effort: memória nunca derruba nem atrasa a resposta. Sem LLM aqui.
 */
import { sanitizeScopeId } from "@/lib/cartolina/scope";
import { cartolinaMemoriaOn, createBoard, findOwnBoard, patchBoard } from "@/lib/cartolina/store";
import * as cartolinaBridge from "@/lib/cartolina/memoria-turno";
import { arestasDoTurno, bussolaDoGrafo, cardsAlterados, fundirNoGrafo, nosFromStructured, projetarCards } from "@/lib/map/grafo";
import { completudes, quantoFaltaConcluir } from "@/lib/map/backbone";
import { atribuirRegioes, consolidar, recuperarMemoria, textoDeLembrancas } from "@/lib/map/memoria";
import { createMapa, findOwnMapa, patchMapa, type MapSurface } from "@/lib/map/store";
import { mapHarnessOn, type MapaAresta, type MapaNo, type MapaView } from "@/lib/map/tipos";
import type { StructuredAnswer } from "@/lib/agent/contracts";

const SURFACE: MapSurface = "estudos"; // a conversa da sala (mesmo scope da cartolina)

/** Texto da bússola pro systemContext ("" se desligado/sem mapa/sem conversa). */
export async function bussolaParaTurno(userId: string | null, scopeId: unknown, prompt?: string): Promise<string> {
  if (!mapHarnessOn()) return cartolinaBridge.bussolaParaTurno(userId, scopeId);
  const scope = sanitizeScopeId(scopeId);
  if (!userId || !scope) return "";
  try {
    const mapa = await findOwnMapa(userId, SURFACE, scope);
    if (mapa) return bussolaAdaptativa(mapa, prompt);
    // Mapa ainda não existe (conversa anterior à flag): a cartolina antiga continua valendo como memória.
    return cartolinaBridge.bussolaParaTurno(userId, scopeId);
  } catch { return ""; }
}

/** Bússola ciente do arquétipo: o grafo + "o que falta" no vocabulário do tipo de tópico (§4, §6). */
export function bussolaAdaptativa(mapa: MapaView, prompt?: string): string {
  const base = bussolaDoGrafo(mapa.nos, { objetivo: mapa.objetivo || undefined, maxChars: 1100 });
  if (!base) return "";
  // Recuperação associativa (§4.2): só as gavetas relevantes pra ESTA pergunta entram — custo controlado.
  const lembrancas = prompt ? textoDeLembrancas(recuperarMemoria(mapa.nos, mapa.arestas, prompt, { k: 4 })) : "";
  const percurso = mapa.backbone.length ? "\nPercurso: " + quantoFaltaConcluir(mapa) : "";
  return base + percurso + (lembrancas ? "\n" + lembrancas : "");
}

export type FixarInput = { userId: string | null; scopeId: unknown; prompt: string; answer: StructuredAnswer; msgId?: unknown };
export type FixarResultado = { mapaId: string; novos: string[]; tocados: string[] } | null;

/**
 * Fixa o turno: nós/arestas no grafo (fonte única) → projeção na cartolina. Devolve o que mudou
 * (quem quiser avisar o painel ao vivo usa isto — §3). null = nada gravado.
 */
export async function fixarTurno(input: FixarInput): Promise<FixarResultado> {
  if (!mapHarnessOn()) { await cartolinaBridge.fixarTurno(input); return null; }
  const scope = sanitizeScopeId(input.scopeId);
  if (!input.userId || !scope) return null;
  const userId = input.userId;
  try {
    const msgId = sanitizeScopeId(input.msgId) ?? undefined;
    // Verbatim-first (MemPalace): a conversa entra na gaveta do nó; o closet é o resumo.
    const nosTurno = nosFromStructured(input.answer, msgId, { prompt: input.prompt });
    if (!nosTurno.length) return null;
    const turno = { nos: nosTurno, arestas: arestasDoTurno(nosTurno) };
    // Pós-fusão (puro): consolidação associativa (A-MEM) + regiões (novas áreas) — sem LLM.
    const posFusao = (f: { nos: MapaNo[]; arestas: MapaAresta[]; novos: string[]; tocados: string[] }, backbone: string[]) => {
      const arestas = [...f.arestas, ...consolidar(f.nos, f.arestas, [...f.novos, ...f.tocados])];
      return { nos: atribuirRegioes(f.nos, arestas, backbone), arestas };
    };

    // 1) GRAFO (canônico)
    let mapa: MapaView;
    let novos: string[], tocados: string[], realizados: string[] = [];
    const existente = await findOwnMapa(userId, SURFACE, scope);
    if (!existente) {
      const f = fundirNoGrafo({ nos: [], arestas: [] }, turno);
      const g = posFusao(f, []);
      mapa = await createMapa({ ownerId: userId, surface: SURFACE, scopeId: scope, titulo: input.prompt.slice(0, 80) || "Estudo", nos: g.nos, arestas: g.arestas });
      novos = f.novos; tocados = f.tocados;
    } else {
      let f = fundirNoGrafo(existente, turno);
      const r = await patchMapa(existente.id, (atual) => {
        f = fundirNoGrafo(atual, turno);
        const g = posFusao(f, atual.backbone);
        const c = completudes({ nos: g.nos, backbone: atual.backbone, modoValidacao: atual.modoValidacao });
        return { nos: g.nos, arestas: g.arestas, completudeAprendizado: c.aprendizado, completudeConclusao: c.conclusao };
      });
      if (!r.ok) { console.warn("[cerebro] fixarTurno: patch do mapa falhou:", r.reason); return null; }
      mapa = r.mapa; novos = f.novos; tocados = f.tocados; realizados = f.realizados;
    }
    // AURA de aprendizado (§8): só nós do PERCURSO que este turno realizou (planejado → aprendido),
    // pesados pelo arquétipo; cap diário no ledger. Fire-and-forget.
    if (realizados.length) {
      void Promise.all([import("@/lib/map/validacao"), import("@/lib/map/validacao-server")])
        .then(([v, s]) => v.pagarRealizados(s.depsReais(), mapa, realizados)).catch(() => {});
    }

    // 2) PROJEÇÃO na cartolina (só se a cartolina está ligada). Falha aqui não desfaz o grafo.
    if (cartolinaMemoriaOn()) {
      try {
        const board = await findOwnBoard(userId, "estudos", scope);
        if (!board) {
          await createBoard({ ownerId: userId, surface: "estudos", scopeId: scope, titulo: mapa.titulo, cards: projetarCards(mapa.nos, []) });
        } else {
          const ups = cardsAlterados(board.cards, projetarCards(mapa.nos, board.cards));
          if (ups.length) await patchBoard(board.id, userId, { upsert: ups });
        }
      } catch (e: any) {
        console.warn("[cerebro] projeção na cartolina falhou:", e?.message ?? e);
      }
    }
    // 3) REAÇÃO AO VIVO (§3): o painel aberto acende o que mudou. Best-effort.
    if (novos.length || tocados.length) {
      void import("@/lib/map/realtime").then((r) => r.avisarTurno({ mapaId: mapa.id, novos, tocados, completudeAprendizado: mapa.completudeAprendizado, completudeConclusao: mapa.completudeConclusao })).catch(() => {});
    }
    return { mapaId: mapa.id, novos, tocados };
  } catch (e: any) {
    console.warn("[cerebro] fixarTurno falhou:", e?.message ?? e);
    return null;
  }
}
