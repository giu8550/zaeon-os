/**
 * lib/canal/encadear.ts — um agente passa a bola pra outro (#396, item B). PURO.
 *
 * Quando a resposta de um agente marca um colega com @ ("essa parte é com a @nina"), o colega
 * responde SOZINHO em seguida — sem a pessoa ter que chamar de novo — e fecha com próximos passos.
 *
 * Limites (combinados no card):
 *   - no máximo MAX_CADEIA agentes encadeados depois do primeiro (o humano chamou = cadeia 0);
 *   - UM por vez (o primeiro @ válido da resposta), nunca o próprio agente, nunca quem já falou na cadeia;
 *   - só agentes PERMITIDOS: os que já estão no canal + as personas da plataforma (o chamador monta);
 *   - os encadeados rodam como "autonomo" → o teto de uso (AGENT_TETO_ENFORCE) vale pra eles.
 */
import { parseMentions } from "@/lib/canal/mention";

export const MAX_CADEIA = 2;

export type EntradaEncadear = {
  /** texto da resposta do agente que acabou de falar. */
  texto: string;
  /** alias→agentKey (lib/canal/mention montarAliases). */
  aliases: Map<string, string>;
  /** agentKeys que podem ser chamados neste canal. */
  permitidos: string[];
  /** quem acabou de falar. */
  eu: string;
  /** em que ponto da cadeia este turno estava (0 = chamado por humano). */
  cadeia: number;
  /** quem já falou nesta cadeia (não chama de volta: evita ping-pong). */
  jaNaCadeia?: string[];
};

/** Próximo agente a responder sozinho, ou null (sem @ válido, no limite, ou só repetidos). */
export function proximoDaCadeia(e: EntradaEncadear): string | null {
  if (!Number.isInteger(e.cadeia) || e.cadeia < 0 || e.cadeia >= MAX_CADEIA) return null;
  const ja = new Set([e.eu, ...(e.jaNaCadeia ?? [])]);
  // o agente responde em markdown: "**@Osler**" também conta (tira a marcação antes de procurar o @)
  const limpo = String(e.texto ?? "").replace(/[*_`~]/g, " ");
  for (const k of parseMentions(limpo, e.aliases)) {
    if (!ja.has(k) && e.permitidos.includes(k)) return k;
  }
  return null;
}

/** Ainda dá pra passar a bola depois deste turno? (vai no prompt: no limite, o agente não chama ninguém) */
export const podePassar = (cadeia: number): boolean => Number.isInteger(cadeia) && cadeia >= 0 && cadeia < MAX_CADEIA;
