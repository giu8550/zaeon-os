/**
 * lib/canal/realtime.ts — publish best-effort dos eventos do canal via Pusher (SERVER).
 * Reusa `lib/collab/realtime.ts` (mesmas envs do chat humano). Nada aqui derruba rota.
 *   canal-<id>           evento "mensagem"          → CanalMensagem nova (humano OU agente)
 *   canal-<id>           evento "agente-digitando"  → { agentKey, estado: "digitando"|"ocioso" }
 *   presence-canal-<id>  (presença nativa do Pusher; auth em /api/canal/pusher-auth)
 */
import { triggerSafe } from "@/lib/collab/realtime";
import { canalChannel } from "@/lib/canal/wire";

export * from "@/lib/canal/wire";

export type Publicar = (canalId: string, evento: string, payload: unknown) => Promise<void>;

export const publicarPusher: Publicar = (canalId, evento, payload) => triggerSafe(canalChannel(canalId), evento, payload);
