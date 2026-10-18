/**
 * lib/canal/realtime.ts — publish best-effort dos eventos do canal via Pusher (SERVER).
 * Reusa `lib/collab/realtime.ts` (mesmas envs do chat humano). Nada aqui derruba rota.
 *   canal-<id>           evento "mensagem"          → CanalMensagem nova (humano OU agente)
 *   canal-<id>           evento "agente-digitando"  → { agentKey, estado: "digitando"|"ocioso" }
 *   presence-canal-<id>  (presença nativa do Pusher; auth em /api/canal/pusher-auth)
 */
import { triggerSafe } from "@/lib/collab/realtime";
import { canalChannel, EV_MENSAGEM, type MensagemWire } from "@/lib/canal/wire";
import { avisoDaMensagem } from "@/lib/canal/aviso";

export * from "@/lib/canal/wire";

export type Publicar = (canalId: string, evento: string, payload: unknown) => Promise<void>;

/**
 * #438: mensagem nova SEMPRE cabe no Pusher (sem foto inteira; texto enorme vira aviso leve) — antes, a
 * mensagem de quem tinha foto guardada inteira passava dos 10 KB e não chegava ao vivo. Ver lib/canal/aviso.ts.
 */
export const publicarPusher: Publicar = (canalId, evento, payload) =>
  triggerSafe(canalChannel(canalId), evento, evento === EV_MENSAGEM ? avisoDaMensagem(payload as MensagemWire) : payload);
