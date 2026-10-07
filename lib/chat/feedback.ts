/**
 * lib/chat/feedback.ts — 👍/👎 numa resposta. Por ora fica no aparelho (localStorage) e sai
 * num evento de janela (`zaeon:chat:feedback`) — quem quiser mandar pro servidor escuta ali,
 * sem o chat precisar saber de endpoint.
 */
export type Voto = "up" | "down";
export const CHAVE_FEEDBACK = "zaeon.chat.feedback.v1";
export const EVT_FEEDBACK = "zaeon:chat:feedback";
/** Teto do mapa local: o mais antigo sai primeiro (inserção preserva ordem). */
const MAX = 300;

type Armazem = Pick<Storage, "getItem" | "setItem">;

export function lerVotos(a: Armazem | null | undefined): Record<string, Voto> {
  try {
    const v = JSON.parse(a?.getItem(CHAVE_FEEDBACK) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

/** Grava (ou desfaz, com `null`) o voto de uma mensagem. Devolve o mapa novo. */
export function votar(a: Armazem | null | undefined, msgId: string, voto: Voto | null): Record<string, Voto> {
  const votos = lerVotos(a);
  delete votos[msgId];
  if (voto) votos[msgId] = voto;
  const chaves = Object.keys(votos);
  for (const k of chaves.slice(0, Math.max(0, chaves.length - MAX))) delete votos[k];
  try { a?.setItem(CHAVE_FEEDBACK, JSON.stringify(votos)); } catch { /* sem L0 */ }
  return votos;
}
