/**
 * Ponte chat da Sala de Estudos ⇄ TCC, para UM turno do harness (mesmo desenho do
 * lib/cartolina/memoria-turno.ts). O route só chama estas funções; a regra mora aqui, atrás de
 * TCC_CROSS. Ambas são BEST-EFFORT: o TCC nunca derruba a resposta da Aura.
 *
 * - `tccContextoParaTurno`: se a conversa já tem TCC, a Aura sabe (bloco no systemContext) e é
 *   instruída a devolver `work.sections` só com o que muda — o MESMO campo que ela já usa.
 * - `tccDoTurno`: "crie um TCC sobre X" CRIA o TCC amarrado à conversa (scopeId); nos turnos
 *   seguintes, `work.sections` vira operação por seção (origem "estudos", aplicada direto).
 *
 * Não chama modelo: só lê/escreve o que a resposta já trouxe. Com o work sem seções (o modelo não
 * escreveu nada), cai no esqueleto + geração em background (lib/tcc/gerar.ts) e o cliente faz poll.
 */
import type { IntentId, StructuredAnswer, WorkKind } from "@/lib/agent/contracts";
import { sanitizeScopeId } from "@/lib/cartolina/route-auth";
import { aplicarNoTcc, criarTcc, findTccDoEscopo, tccCrossOn, type TccView } from "@/lib/tcc/store";
import { ESQUELETO_TCC, opsDeWork, palavras } from "@/lib/tcc/secoes";
import { cartolinaMemoriaOn, createBoard, findOwnBoard, patchBoard } from "@/lib/cartolina/store";
import { fundirNoBoard } from "@/lib/cartolina/fromStructured";

export type TccTurno = { workId: string; titulo: string; criado: boolean; alteradas: number; gerando?: boolean };

const MAX_CONTEXTO = 1200;

/** "crie um TCC sobre a fotossíntese" → "a fotossíntese" (o tema, sem o verbo/pedido). */
export function temaDoPedido(prompt: string): string {
  const t = String(prompt || "").replace(/\s+/g, " ").trim();
  const m = t.match(/\b(?:sobre|acerca de|a respeito de|com o tema|tema:?)\s+(.+)$/i);
  const tema = (m ? m[1] : t).replace(/[.!?]+$/, "").trim();
  return tema.slice(0, 160) || "TCC";
}

/** Pedido de TCC (não de qualquer trabalho): o roteador diz `tcc`, ou o texto diz. */
export function ehPedidoDeTcc(intent: IntentId | undefined, kind: WorkKind | undefined, prompt: string): boolean {
  if (intent !== "criar_trabalho") return false;
  if (kind === "tcc") return true;
  const t = String(prompt || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /\btcc\b|monografia|trabalho de conclusao/.test(t);
}

/** O bloco que a Aura lê quando a conversa já tem TCC ("" se desligado / sem TCC). */
export function contextoDoTcc(t: TccView): string {
  const linhas = t.secoes.map((s) => `- ${s.titulo} (${palavras(s.corpo)} palavras)`);
  const bloco = [
    `TCC EM CONSTRUÇÃO NESTA CONVERSA: "${t.titulo}" (o aluno vê numa aba ao lado).`,
    "Seções:",
    ...linhas,
    "Se o aluno pedir para escrever, continuar ou mudar o TCC, devolva `work` com `sections` contendo",
    "SÓ as seções que mudam, cada uma com o MESMO título (substitui aquela seção) ou um título novo",
    "(vira seção nova). Corpo completo da seção, tom didático. Se a conversa não for sobre o TCC, não mande `work`.",
  ].join("\n");
  return bloco.length > MAX_CONTEXTO ? bloco.slice(0, MAX_CONTEXTO - 1) + "…" : bloco;
}

export async function tccContextoParaTurno(userId: string | null, scopeId: unknown): Promise<string> {
  const scope = sanitizeScopeId(scopeId);
  if (!tccCrossOn() || !userId || !scope) return "";
  try {
    const t = await findTccDoEscopo(userId, scope);
    return t ? contextoDoTcc(t) : "";
  } catch { return ""; }
}

export async function tccDoTurno(input: {
  userId: string | null; scopeId: unknown; surface?: string | null; intent?: IntentId; kind?: WorkKind;
  prompt: string; answer: StructuredAnswer;
  /** dispara a geração do esqueleto (injetável pra teste; padrão = lib/tcc/gerar em background) */
  gerar?: (workId: string, userId: string, topic: string) => void;
}): Promise<TccTurno | null> {
  const scope = sanitizeScopeId(input.scopeId);
  // A Sala de Pesquisa não escreve por aqui: lá tudo nasce como sugestão (POST /api/tcc/:id/revisar).
  if (!tccCrossOn() || !input.userId || !scope || input.surface === "pesquisa") return null;
  try {
    const sections = input.answer.work?.sections;
    const existente = await findTccDoEscopo(input.userId, scope);

    if (existente) {
      if (!Array.isArray(sections) || !sections.length) return null;
      const r = await aplicarNoTcc(existente.id, input.userId, (t) => opsDeWork(t.secoes, sections), "estudos");
      if (!r.ok || !r.efeitos.length) return null;
      void fixarCardTcc(input.userId, scope, resumoDoCard(r.tcc));
      return { workId: existente.id, titulo: r.tcc.titulo, criado: false, alteradas: r.efeitos.length };
    }

    if (!ehPedidoDeTcc(input.intent, input.kind, input.prompt)) return null;
    const titulo = temaDoPedido(input.prompt);
    const doModelo = (Array.isArray(sections) ? sections : [])
      .map((s: any) => ({ titulo: String(s?.title ?? s?.titulo ?? ""), corpo: String(s?.body ?? s?.corpo ?? "") }))
      .filter((s) => s.titulo.trim() && s.corpo.trim());
    // O modelo já escreveu → o TCC nasce com essas seções. Não escreveu → esqueleto ABNT vazio e a
    // geração roda solta (o aluno vê a aba crescer pelo poll).
    const gerando = doModelo.length === 0;
    const t = await criarTcc({
      userId: input.userId, scopeId: scope, titulo, origem: "estudos",
      secoes: gerando ? ESQUELETO_TCC.map((titulo) => ({ titulo })) : doModelo,
      status: gerando ? "gerando" : "pronto",
    });
    void fixarCardTcc(input.userId, scope, resumoDoCard(t));
    if (gerando) {
      const disparar = input.gerar ?? ((id, uid, topic) => {
        void import("@/lib/tcc/gerar").then((m) => m.gerarTccEmBackground(id, uid, topic)).catch(() => {});
      });
      disparar(t.id, input.userId, titulo);
    }
    return { workId: t.id, titulo: t.titulo, criado: true, alteradas: t.secoes.filter((s) => s.corpo.trim()).length, gerando };
  } catch (e: any) {
    console.warn("[tcc] tccDoTurno falhou:", e?.message ?? e); // o TCC é opcional; a resposta segue
    return null;
  }
}

const resumoDoCard = (t: TccView) => ({
  workId: t.id, titulo: t.titulo, secoes: t.secoes.length,
  palavras: t.secoes.reduce((n, s) => n + palavras(s.corpo), 0),
});

/** id do card do TCC na cartolina — o prefixo `tcc:` é o que faz o card abrir a aba do TCC. */
export const cardIdDoTcc = (workId: string) => `tcc:${workId}`;

/**
 * O card "TCC — em construção" na cartolina da conversa (abre a aba do TCC). Best-effort e só com
 * a cartolina ligada (CARTOLINA_MEMORIA): sem cartolina, o TCC vive só na aba.
 */
export async function fixarCardTcc(userId: string, scopeId: string, t: { workId: string; titulo: string; secoes?: number; palavras?: number }): Promise<void> {
  if (!cartolinaMemoriaOn()) return;
  try {
    const card = {
      id: cardIdDoTcc(t.workId), tipo: "nota" as const, titulo: "TCC — em construção",
      corpo: `${t.titulo}${t.secoes ? ` · ${t.secoes} seções` : ""}${t.palavras ? ` · ${t.palavras} palavras` : ""}`,
    };
    const board = await findOwnBoard(userId, "estudos", scopeId);
    if (!board) {
      await createBoard({ ownerId: userId, surface: "estudos", scopeId, titulo: t.titulo.slice(0, 80) || "Estudo", cards: fundirNoBoard([], [card]) });
      return;
    }
    const ja = board.cards.find((c) => c.id === card.id);
    const novo = ja ? { ...ja, titulo: card.titulo, corpo: card.corpo } : fundirNoBoard(board.cards, [card]).find((c) => c.id === card.id)!;
    if (ja && ja.corpo === novo.corpo) return;
    await patchBoard(board.id, userId, { upsert: [novo] });
  } catch (e: any) {
    console.warn("[tcc] card da cartolina falhou:", e?.message ?? e);
  }
}
