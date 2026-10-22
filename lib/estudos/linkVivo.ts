/**
 * O link RESPONDE? (servidor) — a checagem dos selos do blueprint (app/api/estudos/board/[id]/selos) e das provas do
 * blueprint prático (lib/blueprint/provas-server). Só URL pública (sem rede interna — lib/scholar/ssrf), sem seguir
 * redirecionamento (um 3xx conta como vivo), 6 s. 401/403 = existe, mas é privado (conta como vivo).
 */
import { isSafePublicHttpUrl } from "@/lib/scholar/ssrf";

export async function vivo(url: string): Promise<boolean> {
  if (!isSafePublicHttpUrl(url)) return false;
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const r = await fetch(url, { method, redirect: "manual", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "ZaeonLinkCheck/1.0", ...(method === "GET" ? { Range: "bytes=0-1023" } : {}) } });
      if (r.status < 400) return true;
      if (r.status === 401 || r.status === 403) return true;   // (existe, mas é PRIVADO — o repositório fechado conta)
      if (method === "GET") return false;
    } catch { if (method === "GET") return false; }
  }
  return false;
}
