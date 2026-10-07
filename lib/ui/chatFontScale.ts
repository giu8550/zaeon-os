/**
 * lib/ui/chatFontScale.ts — zoom do TEXTO das mensagens (A− / A+), por aparelho.
 *
 * Uns acham a letra do chat grande, outros precisam dela maior. Só o corpo das mensagens
 * muda (a UI em volta fica onde está): a sala põe `--chat-font-scale` na raiz do chat e o
 * texto usa `fonteChat(px)`, que multiplica e nunca deixa cair abaixo de 14px efetivos.
 *
 * Passos discretos (como o zoom do leitor de PDF), salvos no localStorage — embrulhado,
 * porque em aba anônima ele lança.
 */
export const CHAVE_ESCALA = "zaeon.chat.fontScale.v1";
export const PASSOS = [0.85, 1, 1.15, 1.3] as const;
export const ESCALA_PADRAO = 1;
/** Piso acessível: nenhum corpo de mensagem fica menor que isto, em nenhum passo. */
export const MINIMO_PX = 14;
/** Avisa as outras salas abertas na mesma aba (Estudos e Pesquisa leem a mesma escolha). */
export const EVT_ESCALA = "zaeon:chat:font-scale";

export function normalizarEscala(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return (PASSOS as readonly number[]).includes(n) ? n : ESCALA_PADRAO;
}

export function passo(escala: number, direcao: 1 | -1): number {
  const i = (PASSOS as readonly number[]).indexOf(normalizarEscala(escala));
  return PASSOS[Math.max(0, Math.min(PASSOS.length - 1, i + direcao))];
}

export function lerEscala(a: Pick<Storage, "getItem"> | null | undefined): number {
  try { return normalizarEscala(a?.getItem(CHAVE_ESCALA)); } catch { return ESCALA_PADRAO; }
}

export function gravarEscala(a: Pick<Storage, "setItem"> | null | undefined, escala: number): void {
  try { a?.setItem(CHAVE_ESCALA, String(normalizarEscala(escala))); } catch { /* sem L0: vale só nesta sessão */ }
}

/** Tamanho de fonte de um corpo de mensagem: `px` × escala, com piso de 14px. */
export const fonteChat = (px: number) => `max(${MINIMO_PX}px, calc(${px}px * var(--chat-font-scale, 1)))`;
