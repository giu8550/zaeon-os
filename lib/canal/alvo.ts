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
 *
 * #438: agente DISPENSADA ("pode ir", "tchau"… — lib/canal/dispensa.ts) deixa a linha de sistema
 * "Zenita saiu da conversa" (autorTipo "sistema", autorId = agentKey). Depois dela, sem @ ninguém responde
 * (nem o primeiro oi da Aura): a agente volta só quando alguém chamar com @.
 *
 * #635: quem está FORA se decide só pelas linhas "saiu"/"voltou" — uma fala da agente depois do "saiu" (a resposta
 * que ela já estava escrevendo quando foi dispensada e chegou atrasada) NÃO a traz de volta. Antes trazia: o Téo
 * saía, a resposta atrasada dele caía depois da linha e a próxima mensagem sem @ ia pra ele.
 */

export const AGENTE_PADRAO = "aura";

export type MsgResumo = { autorTipo: string; autorId: string; /** #440: só pra distinguir a linha "voltou" da "saiu". */ texto?: string | null };

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

/** #440: a linha "Zenita voltou para a conversa" (o texto que lib/canal/dispensa textoVoltou grava). */
export const ehLinhaVoltou = (texto: string | null | undefined): boolean => /voltou para a conversa$/.test((texto ?? "").trim());

/** #438: a linha "Zenita saiu da conversa" — sistema com o agentKey como autor (e não a de "voltou"). */
export const saiuDaConversa = (m: MsgResumo, disponiveis: readonly string[]): boolean =>
  m.autorTipo === "sistema" && disponiveis.includes(m.autorId) && !ehLinhaVoltou(m.texto);

/** #440: a linha "Zenita voltou para a conversa" — ela está de novo na conversa (conta como a agente da vez). */
export const voltouParaConversa = (m: MsgResumo, disponiveis: readonly string[]): boolean =>
  m.autorTipo === "sistema" && disponiveis.includes(m.autorId) && ehLinhaVoltou(m.texto);

/** #440: essa agente SAIU da conversa e ainda não voltou? (aí, chamada com @, entra a linha "voltou") */
export function estaForaDaConversa(historico: readonly MsgResumo[], agentKey: string): boolean {
  for (let i = historico.length - 1; i >= 0; i--) {
    const m = historico[i]!;
    if (m.autorId !== agentKey) continue;
    // #635: só as linhas contam — a fala atrasada não traz de volta (ela volta pela linha "voltou", que o @ grava)
    if (voltouParaConversa(m, [agentKey])) return false;
    if (saiuDaConversa(m, [agentKey])) return true;
  }
  return false;
}

/** #635: as agentes que estão fora da conversa agora (saíram e não voltaram). */
export function foraDaConversa(historico: readonly MsgResumo[], disponiveis: readonly string[]): Set<string> {
  return new Set(disponiveis.filter((k) => estaForaDaConversa(historico, k)));
}

/**
 * O agente "da vez" (quem responde sem @), pela mesma regra do servidor: o último agente que falou, a não ser
 * que ele tenha saído da conversa depois. A tela usa pra dizer "Zenita responde" no campo de mensagem.
 */
export function agenteDaVez(historico: readonly MsgResumo[], disponiveis: readonly string[]): string | null {
  const fora = foraDaConversa(historico, disponiveis);
  for (let i = historico.length - 1; i >= 0; i--) {
    const m = historico[i]!;
    if (saiuDaConversa(m, disponiveis)) return null;
    if (m.autorTipo === "agente" && fora.has(m.autorId)) continue;   // #635: a fala atrasada de quem já saiu
    if ((m.autorTipo === "agente" && disponiveis.includes(m.autorId)) || voltouParaConversa(m, disponiveis)) return m.autorId;
  }
  return null;
}

/**
 * #560: as agentes na ordem em que falaram, da última pra trás (cada uma pela sua fala mais recente, ou pela linha
 * "voltou"). Quem nunca falou fica de fora. Serve pra "vocês duas podem ir" (as duas últimas) e pra "explica você".
 */
export function agentesPorRecencia(historico: readonly MsgResumo[], disponiveis: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = historico.length - 1; i >= 0; i--) {
    const m = historico[i]!;
    const fala = (m.autorTipo === "agente" && disponiveis.includes(m.autorId)) || voltouParaConversa(m, disponiveis);
    if (fala && !out.includes(m.autorId)) out.push(m.autorId);
  }
  return out;
}

export function resolverAlvos(e: EntradaAlvo): SaidaAlvo {
  if (e.mencoes.length) return { alvos: [...e.mencoes], implicito: false };

  // último agente (ainda convocável) que falou no canal — ou a saída dele (#438)
  const fora = foraDaConversa(e.historico, e.disponiveis);
  let idx = -1;
  for (let i = e.historico.length - 1; i >= 0; i--) {
    const m = e.historico[i]!;
    if (saiuDaConversa(m, e.disponiveis)) return { alvos: [], implicito: true };
    if (m.autorTipo === "agente" && fora.has(m.autorId)) continue;   // #635: a fala atrasada de quem já saiu
    if ((m.autorTipo === "agente" && e.disponiveis.includes(m.autorId)) || voltouParaConversa(m, e.disponiveis)) { idx = i; break; }
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

/**
 * #466: quem responde se EU mandar uma mensagem sem @ agora — a dica "Zenita responde" do campo de mensagem.
 * É a mesma regra do servidor (resolverAlvos): numa conversa com outras pessoas, a agente só responde quem estava
 * falando com ela; antes, a tela mostrava "Zenita responde" pra todo mundo numa conversa de duas pessoas.
 */
export function quemRespondeSemArroba(historico: readonly MsgResumo[], disponiveis: readonly string[], eu: string, humanos: number): string | null {
  return resolverAlvos({ mencoes: [], historico: [...historico], remetenteId: eu, disponiveis: [...disponiveis], humanos }).alvos[0] ?? null;
}

/**
 * #635: as linhas "Fulana saiu da conversa" que ganham o botão "Chamar de volta" — a ÚLTIMA saída de cada agente que
 * AINDA está fora (voltou depois → a linha perde o botão; saídas antigas da mesma agente também não têm).
 */
export function linhasChamaveis(historico: readonly (MsgResumo & { id: string })[], disponiveis: readonly string[]): Set<string> {
  const out = new Set<string>();
  const visto = new Set<string>();
  for (let i = historico.length - 1; i >= 0; i--) {
    const m = historico[i]!;
    if (m.autorTipo !== "sistema" || !disponiveis.includes(m.autorId) || visto.has(m.autorId)) continue;
    visto.add(m.autorId);   // a linha mais recente (saiu OU voltou) desta agente decide
    if (saiuDaConversa(m, disponiveis)) out.add(m.id);
  }
  return out;
}
