/**
 * lib/lounge3d/realtime.ts — QUAL transporte de tempo real o cyberespaço usa (client-safe).
 *   NEXT_PUBLIC_REALTIME = "pusher" (padrão) | "colyseus"  → posição/presença (rollback = trocar a flag)
 *   NEXT_PUBLIC_VOZ      = "on" | "off" (padrão)            → voz push-to-talk (só com colyseus: é o signaling)
 *   NEXT_PUBLIC_COLYSEUS_URL (opcional)                     → padrão: wss://<mesmo host>/colyseus (Caddy)
 * Chat, conteúdo e recado continuam pelo Pusher (eventos raros do servidor) nos dois modos.
 */
export type Transporte = "pusher" | "colyseus";
export const transporteRealtime = (): Transporte => (process.env.NEXT_PUBLIC_REALTIME === "colyseus" ? "colyseus" : "pusher");
export const vozLigada = (): boolean => process.env.NEXT_PUBLIC_VOZ === "on" && transporteRealtime() === "colyseus";
export function urlColyseus(loc?: { protocol: string; host: string }): string {
  const env = process.env.NEXT_PUBLIC_COLYSEUS_URL;
  if (env) return env;
  const l = loc ?? window.location;
  return `${l.protocol === "https:" ? "wss" : "ws"}://${l.host}/colyseus`;
}
/** frequência de envio da pose pelo Colyseus (o servidor difunde a 20 Hz) */
export const POSE_HZ_COLYSEUS = 15;
