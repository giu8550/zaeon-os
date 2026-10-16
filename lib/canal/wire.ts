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

export const canalChannel = (canalId: string) => `canal-${canalId}`;
export const presenceChannel = (canalId: string) => `presence-canal-${canalId}`;
/** `presence-canal-<id>` → id (null se não é um canal de presença nosso). */
export function canalIdDePresence(channelName: string): string | null {
  const m = /^presence-canal-([a-f0-9]{24})$/i.exec(channelName || "");
  return m ? m[1]! : null;
}

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
