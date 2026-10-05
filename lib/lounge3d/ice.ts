/**
 * lib/lounge3d/ice.ts — servidores ICE da voz (WebRTC). STUN público sempre; TURN (coturn na VPS) quando
 * configurado, com CREDENCIAIS TEMPORÁRIAS no padrão "REST API" do coturn (use-auth-secret / static-auth-secret):
 *   username = "<expira em segundos>:<userId>",  credential = base64(HMAC-SHA1(TURN_SECRET, username)).
 * Server-only (usa o segredo). Env: TURN_URLS="turn:turn.exemplo:3478?transport=udp,turns:turn.exemplo:5349"
 * e TURN_SECRET (o mesmo `static-auth-secret` do turnserver.conf).
 */
import { createHmac } from "node:crypto";

export type ServidorIce = { urls: string | string[]; username?: string; credential?: string };
export const STUN_PUBLICO: ServidorIce = { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] };
export const TTL_TURN_S = 12 * 3600;

export function servidoresIce(userId: string, env: { TURN_URLS?: string; TURN_SECRET?: string } = { TURN_URLS: process.env.TURN_URLS, TURN_SECRET: process.env.TURN_SECRET }, agora = Date.now()): ServidorIce[] {
  const urls = (env.TURN_URLS ?? "").split(",").map((u) => u.trim()).filter((u) => /^turns?:/.test(u));
  if (!urls.length || !env.TURN_SECRET) return [STUN_PUBLICO];
  const username = `${Math.floor(agora / 1000) + TTL_TURN_S}:${userId}`;
  const credential = createHmac("sha1", env.TURN_SECRET).update(username).digest("base64");
  return [STUN_PUBLICO, { urls, username, credential }];
}
