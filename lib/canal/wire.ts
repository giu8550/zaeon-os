/**
 * lib/canal/wire.ts — nomes de canal/evento Pusher + tipo de mensagem no fio. PURO e isomórfico
 * (o cliente importa daqui; `realtime.ts` reexporta e adiciona o publish server-side).
 */
export const EV_MENSAGEM = "mensagem";
export const EV_DIGITANDO = "agente-digitando";
/** a agenda do canal mudou (payload { canalId }): quem está com a bandeja aberta recarrega. */
export const EV_AGENDA = "agenda";
/** #423: uma PESSOA está digitando (payload { userId, nome }). Passageiro: não grava nada. */
export const EV_HUMANO_DIGITANDO = "humano-digitando";

/**
 * #468: as mensagens vão por canal PRIVADO (`private-canal-<id>`): o Pusher só deixa assinar quem a nossa rota
 * /api/canal/pusher-auth autoriza (quem pode ler o canal). Antes era `canal-<id>`, público: quem soubesse o id
 * ouvia as mensagens (até das conversas privadas) sem login.
 */
export const canalChannel = (canalId: string) => `private-canal-${canalId}`;
export const presenceChannel = (canalId: string) => `presence-canal-${canalId}`;
/** `presence-canal-<id>` → id (null se não é um canal de presença nosso). */
export function canalIdDePresence(channelName: string): string | null {
  const m = /^presence-canal-([a-f0-9]{24})$/i.exec(channelName || "");
  return m ? m[1]! : null;
}
/** #468: `private-canal-<id>` → id (null se não é o canal privado de mensagens de um escritório). */
export function canalIdDePrivado(channelName: string): string | null {
  const m = /^private-canal-([a-f0-9]{24})$/i.exec(channelName || "");
  return m ? m[1]! : null;
}
/** #468: alguém foi tirado do escritório (payload { userId }) — a tela DELA para de ouvir o canal na hora. */
export const EV_REMOVIDO = "membro-removido";

export type MensagemWire = {
  id: string;
  canalId: string;
  /** "sistema" (#423) = linha de aviso do canal, ex.: "Martinez entrou no escritório" (autorId = quem entrou). */
  autorTipo: "humano" | "agente" | "sistema";
  autorId: string;
  texto: string;
  mencoes: string[];
  createdAt: string;
  /** identidade pra UI não precisar resolver: nome + avatar do autor. */
  autorNome?: string | null;
  autorAvatar?: string | null;
};
