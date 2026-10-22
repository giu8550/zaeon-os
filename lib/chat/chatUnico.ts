/**
 * lib/chat/chatUnico.ts — UM chat só (o da Aura) com o MODO PESQUISA dentro dele.
 *
 * Flag NEXT_PUBLIC_CHAT_UNICO (build-arg; off = layout de hoje intacto). Ligada:
 *   - a "Sala de Pesquisa" some da sidebar; links antigos (?tab=pesquisa, ?work=) caem no chat da Aura;
 *   - o chat ganha o interruptor "Modo pesquisa" (por conversa): ligado, o turno vai com a superfície
 *     "pesquisa" — academicMode enforced, fontes/citações, rigor — que era o que a sala fazia;
 *   - a conversa pode ter VÁRIOS trabalhos (artigo, TCC, relatório), cada um numa pasta no topo, escritos
 *     no editor estilo Word (components/tcc/TccPanel).
 * No servidor o motor dos trabalhos liga com CHAT_UNICO=1 (lib/tcc/store `tccCrossOn`).
 *
 * Pedidos de fora do chat (deep-link, sidebar) vão como no lib/chat/conversasNav: evento pro chat
 * montado + bilhete no localStorage pro chat que ainda vai montar.
 */
const on = (v: string | undefined) => v === "1" || v === "true";

export const chatUnicoOn = (): boolean => on(process.env.NEXT_PUBLIC_CHAT_UNICO);

// ───────────────────────────── modo pesquisa por conversa ─────────────────────────────

const CHAVE_MODO = "zaeon.chat.modoPesquisa.v1";

type Armazem = Pick<Storage, "getItem" | "setItem">;

/** As conversas com o modo pesquisa ligado (lista de ids; a mais recente no fim, teto de 200). */
function lerLigadas(s: Armazem): string[] {
  try {
    const v = JSON.parse(s.getItem(CHAVE_MODO) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

export function modoPesquisaDa(s: Armazem, aba: string | null | undefined): boolean {
  return !!aba && lerLigadas(s).includes(aba);
}

export function gravarModoPesquisa(s: Armazem, aba: string, ligado: boolean): void {
  const resto = lerLigadas(s).filter((x) => x !== aba);
  const lista = ligado ? [...resto, aba].slice(-200) : resto;
  try { s.setItem(CHAVE_MODO, JSON.stringify(lista)); } catch { /* cota: o modo vale só nesta sessão */ }
}

// ───────────────────────────── pedidos de fora do chat ─────────────────────────────

/** `modoPesquisa`: liga o modo na conversa aberta. `trabalhoId`: abre aquele trabalho no editor. */
export type PedidoChat = { modoPesquisa?: boolean; trabalhoId?: string };

export const EVT_PEDIDO_CHAT = "zaeon:chat-unico:pedido";
const CHAVE_PEDIDO = "zaeon.chat-unico.pedido";

export function pedirAoChat(p: PedidoChat): void {
  try { localStorage.setItem(CHAVE_PEDIDO, JSON.stringify(p)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent<PedidoChat>(EVT_PEDIDO_CHAT, { detail: p })); } catch { /* SSR */ }
}

/** O chat atendeu (ou leu ao montar): apaga o bilhete pra não repetir no próximo carregamento. */
export function consumirPedidoChat(): PedidoChat | null {
  try {
    const v = localStorage.getItem(CHAVE_PEDIDO);
    if (!v) return null;
    localStorage.removeItem(CHAVE_PEDIDO);
    const p = JSON.parse(v);
    if (!p || typeof p !== "object") return null;
    return {
      ...(p.modoPesquisa === true ? { modoPesquisa: true } : {}),
      ...(typeof p.trabalhoId === "string" && /^[a-f0-9]{24}$/i.test(p.trabalhoId) ? { trabalhoId: p.trabalhoId } : {}),
    };
  } catch { return null; }
}

/**
 * Deep-link antigo da Sala de Pesquisa → pedido ao chat único. `?tab=pesquisa|pesquisas`, `?session=`,
 * `?worktype=` = modo pesquisa; `?work=<id>` = modo pesquisa + abrir o trabalho. null = nada a pedir.
 */
export function pedidoDoLink(params: URLSearchParams): PedidoChat | null {
  const tab = params.get("tab");
  const work = params.get("work");
  const pesquisa = tab === "pesquisa" || tab === "pesquisas" || !!params.get("session") || !!params.get("worktype") || !!work;
  if (!pesquisa) return null;
  return { modoPesquisa: true, ...(work && /^[a-f0-9]{24}$/i.test(work) ? { trabalhoId: work } : {}) };
}
