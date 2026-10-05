/**
 * Token de ENTRADA na sala do Colyseus — assinado pelo APP (que conhece a sessão do NextAuth) e verificado aqui.
 * O Colyseus não fala com o banco nem com o NextAuth: só confere a assinatura HMAC-SHA256 com o segredo
 * compartilhado (`REALTIME_SECRET`, só no servidor) e a validade curta. Nada de confiar em `userId` do cliente.
 *
 * Formato: base64url(JSON do payload) + "." + base64url(HMAC). Puro (node:crypto) — o app importa daqui também.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type PayloadToken = {
  /** userId (sessão) */ u: string;
  /** nome */ n: string;
  /** cor do avatar (#rrggbb) */ c: string;
  /** fundador = dono da Zaeon (regalias: topo/céu/nave) */ f: boolean;
  /** dono do QG (Andrei) */ q: boolean;
  /** id da sala (CollabDoc) — a room do Colyseus é por sala */ s: string;
  /** expira (ms desde a época) */ exp: number;
};

/** validade padrão do token (só serve pra ENTRAR; a conexão segue viva depois) */
export const VALIDADE_TOKEN_MS = 2 * 60_000;

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const assinatura = (corpo: string, segredo: string) => createHmac("sha256", segredo).update(corpo).digest();

export function assinarToken(p: PayloadToken, segredo: string): string {
  if (!segredo) throw new Error("REALTIME_SECRET ausente");
  const corpo = b64url(Buffer.from(JSON.stringify(p)));
  return `${corpo}.${b64url(assinatura(corpo, segredo))}`;
}

/** confere assinatura, validade e formato; qualquer problema → null (a entrada é recusada) */
export function verificarToken(token: unknown, segredo: string, agora = Date.now()): PayloadToken | null {
  if (typeof token !== "string" || !segredo || token.length > 2048) return null;
  const [corpo, sig] = token.split(".");
  if (!corpo || !sig) return null;
  const esperada = assinatura(corpo, segredo), recebida = deB64url(sig);
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;
  let p: unknown;
  try { p = JSON.parse(deB64url(corpo).toString("utf8")); } catch { return null; }
  const o = p as Record<string, unknown>;
  if (!o || typeof o.u !== "string" || !/^[a-f0-9]{24}$/i.test(o.u) || typeof o.s !== "string" || !/^[a-f0-9]{24}$/i.test(o.s)) return null;
  if (typeof o.exp !== "number" || o.exp < agora) return null;
  return {
    u: o.u, s: o.s, exp: o.exp,
    n: typeof o.n === "string" ? o.n.slice(0, 40) : "Alguém",
    c: typeof o.c === "string" && /^#[0-9a-f]{6}$/i.test(o.c) ? o.c : "#4aa3ff",
    f: o.f === true, q: o.q === true,
  };
}
