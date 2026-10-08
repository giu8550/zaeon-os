/**
 * lib/llm/saude.ts — estado do gateway para /api/health (PR-G1).
 *   "off"      → GATEWAY_URL vazio (Vertex direto; é o default)
 *   "on"       → GET ${GATEWAY_URL}/health/liveliness respondeu 2xx (cache 60s em memória)
 *   "degraded" → configurado e falhando (o envelope cai para o Vertex na mesma chamada)
 */
export type EstadoGateway = "off" | "on" | "degraded";

type Deps = { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; agora?: () => number; timeoutMs?: number };
const CACHE_MS = 60_000;
let cache: { estado: EstadoGateway; url: string; at: number } | null = null;

export function __resetSaudeParaTeste(): void { cache = null; }

export async function estadoGateway(d: Deps = {}): Promise<EstadoGateway> {
  const env = d.env ?? process.env;
  const url = env.GATEWAY_URL?.trim();
  if (!url) return "off";
  const agora = d.agora ?? Date.now;
  if (cache && cache.url === url && agora() - cache.at < CACHE_MS) return cache.estado;
  const f = d.fetchImpl ?? fetch;
  let estado: EstadoGateway = "degraded";
  try {
    // cache:"no-store": o fetch do Next tem data cache (até em disco, no dev) — sem isto o 1º "on" vira eterno.
    const r = await f(`${url.replace(/\/+$/, "")}/health/liveliness`, { cache: "no-store", signal: AbortSignal.timeout(d.timeoutMs ?? 3000) });
    estado = r.ok ? "on" : "degraded";
  } catch { estado = "degraded"; }
  cache = { estado, url, at: agora() };
  return estado;
}

/** Quem está servindo a camada autônoma neste instante. */
export const provedorAtual = (estado: EstadoGateway): "vertex-direct" | "litellm" => (estado === "on" ? "litellm" : "vertex-direct");
