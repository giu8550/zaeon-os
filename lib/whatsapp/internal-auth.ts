/** Auth das rotas INTERNAS (/send, /dispatch): token compartilhado `WHATSAPP_INTERNAL_TOKEN` no header `x-internal-token`. */
export function internalAuthorized(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const token = env.WHATSAPP_INTERNAL_TOKEN;
  if (!token) return false;
  return req.headers.get("x-internal-token") === token || req.headers.get("authorization") === `Bearer ${token}`;
}
