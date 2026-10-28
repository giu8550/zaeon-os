/**
 * lib/canal/parar.ts — o "■ Parar" do Escritório e a resposta que chega tarde demais (#635). PURO.
 *
 * O turno do agente leva segundos. Nesse meio tempo a pessoa pode:
 *   - apertar "■ Parar" → entra a linha "Fulana interrompeu a resposta" (sistema, autorId = AUTOR_PARAR);
 *   - dispensar a agente ("@teo sai") → entra a linha "Téo saiu da conversa".
 * Nos dois casos a resposta que estava sendo escrita NÃO entra no canal: o turno confere, antes de gravar, as
 * mensagens que chegaram depois da que o convocou. (Se mais de uma agente estava respondendo, para todas.)
 */
import { saiuDaConversa, type MsgResumo } from "./alvo";

/** O autorId da linha de sistema do "■ Parar" (não é agente nem pessoa: nenhuma regra de "quem responde" a vê). */
export const AUTOR_PARAR = "parar";

export const textoParou = (nome: string) => `${nome || "Alguém"} interrompeu a resposta`;

export type MsgComHora = MsgResumo & { createdAt: Date | string };

/**
 * A resposta desta agente ainda pode entrar? `depois` = as mensagens do canal; só contam as que chegaram DEPOIS de
 * `corte` (a hora da mensagem que convocou o turno). Parou → não. A agente saiu da conversa → não.
 */
export function respostaCancelada(depois: readonly MsgComHora[], agentKey: string, corte: Date | string): "parou" | "saiu" | null {
  const t0 = +new Date(corte);
  const novas = depois.filter((m) => +new Date(m.createdAt) > t0);
  if (novas.some((m) => m.autorTipo === "sistema" && m.autorId === AUTOR_PARAR)) return "parou";
  if (novas.some((m) => saiuDaConversa(m, [agentKey]))) return "saiu";
  return null;
}

/** #635: o ↑ vira "■ Parar" quando alguma agente está escrevendo E a caixa está vazia (escrevendo algo, segue ↑). */
export const mostraParar = (escrevendo: number, texto: string, temAnexo: boolean): boolean => escrevendo > 0 && !texto.trim() && !temAnexo;
