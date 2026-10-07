/**
 * lib/chat/conversasNav.ts — a sidebar principal pedindo coisas ao chat de uma sala.
 *
 * Na sidebar cada sala é um nó com as SUAS conversas embaixo (Sala de Estudos → nova conversa +
 * conversas; Sala de Pesquisa → nova pesquisa + conversas). Clicar numa conversa da OUTRA sala
 * troca de sala e abre aquela conversa — mas o chat dela pode nem estar montado ainda. Então o
 * pedido vai pelos dois caminhos: evento (chat montado reage na hora) e um bilhete no
 * localStorage (chat que monta depois lê e apaga).
 */
export type SalaChat = "estudos" | "pesquisa";
export type PedidoConversa = { sala: SalaChat; id?: string; nova?: boolean };

export const EVT_PEDIDO_CONVERSA = "zaeon:conversa:pedido";
/** A Sala de Estudos volta a mostrar a CONVERSA (sai de "Meus Estudos"/"Estudos") — StudyRoomContent escuta. */
export const EVT_ESTUDOS_CHAT = "zaeon:estudos:chat";
const chave = (sala: SalaChat) => `zaeon.conversa.pedido.${sala}`;

export function pedirConversa(p: PedidoConversa): void {
  try { localStorage.setItem(chave(p.sala), JSON.stringify(p)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent<PedidoConversa>(EVT_PEDIDO_CONVERSA, { detail: p }));
}

/** O chat atendeu (ou leu ao montar): apaga o bilhete pra não reabrir no próximo carregamento. */
export function consumirPedido(sala: SalaChat): PedidoConversa | null {
  try {
    const v = localStorage.getItem(chave(sala));
    if (!v) return null;
    localStorage.removeItem(chave(sala));
    const p = JSON.parse(v);
    return p && p.sala === sala ? p : null;
  } catch { return null; }
}
