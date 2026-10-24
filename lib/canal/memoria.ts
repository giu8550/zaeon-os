/**
 * lib/canal/memoria.ts — DE QUEM é a memória profunda (L3, lib/agent/memory) num turno do Escritório (#562). PURO.
 *
 * Privacidade total: a resposta da agente aparece pra TODO MUNDO que lê o escritório. Então:
 *   - conversa só da pessoa (um humano só, e o escritório não é "aberto" — o aberto qualquer um lê): a memória é
 *     DELA, igual ao chat — relembra tudo dela (escritório, chat…; com mentor, a ala do mentor) e guarda o turno;
 *   - qualquer outro caso (duas pessoas, grupo, aberto): a memória é DO ESCRITÓRIO — o dono da lembrança é o próprio
 *     escritório (o id dele), nunca uma pessoa. Só o que foi dito ali; nenhuma memória pessoal é lida nem gravada.
 * A regra é recalculada a cada turno: conversa de dois que vira grupo passa pra memória do escritório na hora.
 */
import { humanosNoCanal } from "./convite";
import { normalizarAcesso } from "./gate";

/** A "ala" (wing) das lembranças guardadas pelo Escritório (igual ao chat, que usa a superfície). */
export const SUPERFICIE_ESCRITORIO = "escritorio";

export type CanalDaMemoria = { id: string; ownerId: string; acesso: string; membros: string[]; dmCom?: string | null };

export type EscopoMemoria = {
  /** "pessoal" = a memória de quem mandou; "escritorio" = a memória do próprio escritório */
  tipo: "pessoal" | "escritorio";
  /** o dono da lembrança (o userId do drawer): a pessoa, ou o id do escritório */
  dono: string;
  /** a ala usada pra RELEMBRAR: null = tudo do dono (sem filtro de ala) */
  alaLeitura: string | null;
  /** a ala onde GUARDAR (ausente = a ala da superfície "escritorio") */
  alaEscrita?: { kind: "agente"; label: string };
};

/** A conversa é só da pessoa? (um humano só e ninguém de fora lendo) */
export function conversaSoDaPessoa(canal: CanalDaMemoria): boolean {
  return humanosNoCanal(canal) === 1 && normalizarAcesso(canal.acesso) !== "aberto";
}

/**
 * O escopo da memória deste turno. `alaMentor` = a ala do mentor dessa pessoa ("<slug>/<userId>", o mesmo do chat);
 * só vale na conversa da própria pessoa — em grupo, a ala carrega o id de alguém e não entra.
 */
export function escopoDaMemoria(canal: CanalDaMemoria, remetenteId: string, alaMentor?: string | null): EscopoMemoria {
  if (conversaSoDaPessoa(canal) && remetenteId === canal.ownerId) {
    return alaMentor
      ? { tipo: "pessoal", dono: remetenteId, alaLeitura: alaMentor, alaEscrita: { kind: "agente", label: alaMentor } }
      : { tipo: "pessoal", dono: remetenteId, alaLeitura: null };
  }
  return { tipo: "escritorio", dono: canal.id, alaLeitura: SUPERFICIE_ESCRITORIO };
}
