/**
 * lib/canal/alvo.ts — QUEM responde a uma mensagem do canal (PURO).
 *
 * Antes: só respondia quem fosse marcado com @. Agora o canal tem um "agente ativo":
 *   1. Com @menção → os marcados respondem (a menção sempre manda, e troca o agente ativo).
 *   2. Sem @ → continua o ÚLTIMO agente que falou no canal, sem limite de tempo
 *      (a pessoa pode sair para fazer outra coisa e voltar na mesma conversa).
 *   3. Sem @ e sem nenhum agente ainda → o agente padrão (Aura) dá o primeiro oi.
 *
 * Canal com 2+ humanos (dono + membros): conversa entre pessoas não pode acionar IA a cada
 * mensagem (custo e ruído). Aí o agente ativo só atende quem estava falando com ele (o último
 * humano antes da resposta dele), e o primeiro contato continua exigindo @.
 */

export const AGENTE_PADRAO = "aura";

export type MsgResumo = { autorTipo: string; autorId: string };

export type EntradaAlvo = {
  /** agentKeys marcados com @ na mensagem (já resolvidos). */
  mencoes: string[];
  /** mensagens ANTERIORES à atual, da mais antiga pra mais recente. */
  historico: MsgResumo[];
  /** quem está enviando. */
  remetenteId: string;
  /** agentKeys que podem ser convocados neste canal. */
  disponiveis: string[];
  /** quem dá o primeiro oi (null = ninguém). */
  padrao?: string | null;
  /** quantos humanos o canal tem (dono + membros). */
  humanos: number;
};

export type SaidaAlvo = { alvos: string[]; implicito: boolean };

export function resolverAlvos(e: EntradaAlvo): SaidaAlvo {
  if (e.mencoes.length) return { alvos: [...e.mencoes], implicito: false };

  // último agente (ainda convocável) que falou no canal
  let idx = -1;
  for (let i = e.historico.length - 1; i >= 0; i--) {
    const m = e.historico[i]!;
    if (m.autorTipo === "agente" && e.disponiveis.includes(m.autorId)) { idx = i; break; }
  }

  if (idx >= 0) {
    const agente = e.historico[idx]!.autorId;
    if (e.humanos > 1) {
      // canal compartilhado: só atende quem estava conversando com ele
      let interlocutor: string | null = null;
      for (let i = idx - 1; i >= 0; i--) {
        if (e.historico[i]!.autorTipo === "humano") { interlocutor = e.historico[i]!.autorId; break; }
      }
      if (interlocutor !== e.remetenteId) return { alvos: [], implicito: true };
    }
    return { alvos: [agente], implicito: true };
  }

  // nenhum agente falou ainda: o padrão dá o primeiro oi (só em canal de uma pessoa)
  const padrao = e.padrao === undefined ? AGENTE_PADRAO : e.padrao;
  if (e.humanos <= 1 && padrao && e.disponiveis.includes(padrao)) return { alvos: [padrao], implicito: true };
  return { alvos: [], implicito: true };
}
