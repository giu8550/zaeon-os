/**
 * lib/whatsapp/sender.ts — transporte de SAÍDA, provider-agnóstico.
 *
 *   bridge    → chip da ChipFlow via Redis Streams (lib/chipflow/bridge.ts): AgentChannel do agente
 *               (ou BRIDGE_INSTANCE_ID) define a instância. Handoff v3 §1.2.
 *   evolution → instância única da plataforma no Evolution API (POST /message/sendText/{instance})
 *   disparos  → legado (repo de disparos); rota não confirmada — remoção prevista no PR-W2 (§8).
 *   log       → sem provider configurado: só loga (dev/CI). Nunca derruba a rota.
 *
 * `buildSendRequest` é puro (testável) pros providers HTTP; `sendWhatsAppText` faz o IO.
 * Resultado é objeto com `.ok` explícito — nunca truthiness.
 */
import { jidNumber } from "./phone";
import { resolveBridgeRedisUrl } from "@/lib/chipflow/bridge-request";

export type Provider = "evolution" | "disparos" | "log" | "bridge";
export type SenderEnv = Record<string, string | undefined>;
export type SendRequest = { url: string; init: RequestInit };
export type SendOpts = { agentKey?: string; idemKey?: string };

const trimSlash = (u: string) => u.replace(/\/+$/, "");

export function resolveProvider(env: SenderEnv = process.env): Provider {
  const p = (env.WHATSAPP_PROVIDER ?? "").toLowerCase();
  if (p === "evolution" || p === "disparos" || p === "log" || p === "bridge") return p;
  if (env.EVOLUTION_URL) return "evolution";
  if (resolveBridgeRedisUrl(env)) return "bridge";
  if (env.DISPAROS_URL) return "disparos";
  return "log";
}

export function buildSendRequest(provider: Provider, env: SenderEnv, phone: string, text: string): SendRequest | null {
  const number = jidNumber(phone);
  if (provider === "evolution") {
    if (!env.EVOLUTION_URL || !env.EVOLUTION_INSTANCE) return null;
    return {
      url: `${trimSlash(env.EVOLUTION_URL)}/message/sendText/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: env.EVOLUTION_API_KEY ?? "" },
        body: JSON.stringify({ number, text }),
      },
    };
  }
  if (provider === "disparos") {
    if (!env.DISPAROS_URL) return null;
    const path = env.DISPAROS_SEND_PATH || "/api/send";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (env.DISPAROS_API_KEY) headers.Authorization = `Bearer ${env.DISPAROS_API_KEY}`;
    return {
      url: `${trimSlash(env.DISPAROS_URL)}${path.startsWith("/") ? path : `/${path}`}`,
      init: { method: "POST", headers, body: JSON.stringify({ phone, number, text }) },
    };
  }
  return null; // log e bridge não são HTTP
}

export type SendResult = { ok: boolean; provider: Provider; status?: number; error?: string; commandId?: string };

async function sendViaBridge(phone: string, text: string, env: SenderEnv, opts: SendOpts): Promise<SendResult> {
  const [{ resolverCanalEnvio, registrarEnvio }, { sendTextViaBridge, bridgeConfigurado }] = await Promise.all([
    import("@/lib/chipflow/canal"),
    import("@/lib/chipflow/bridge"),
  ]);
  // Sem URL do bridge é erro de configuração do servidor — não vira "erro do canal" no banco.
  if (!bridgeConfigurado(env)) {
    console.log(`[whatsapp:bridge] sem CHIPFLOW_BRIDGE_REDIS_URL/BRIDGE_REDIS_URL → ${phone}: ${text.slice(0, 200)}`);
    return { ok: false, provider: "bridge", error: "provider_misconfigured" };
  }
  const destino = await resolverCanalEnvio(opts.agentKey ?? "aura", env);
  if (!destino) {
    console.log(`[whatsapp:bridge] sem canal/BRIDGE_INSTANCE_ID pra ${opts.agentKey ?? "aura"} → ${phone}: ${text.slice(0, 200)}`);
    return { ok: false, provider: "bridge", error: "provider_misconfigured" };
  }
  const r = await sendTextViaBridge({ instanceId: destino.chipflowId, phone, text, idemKey: opts.idemKey, env });
  if (destino.fonte === "canal") await registrarEnvio(destino.canalId, r);
  return r.ok
    ? { ok: true, provider: "bridge", commandId: r.commandId }
    : { ok: false, provider: "bridge", error: r.error ?? r.status, commandId: r.commandId };
}

export async function sendWhatsAppText(phone: string, text: string, env: SenderEnv = process.env, opts: SendOpts = {}): Promise<SendResult> {
  const provider = resolveProvider(env);
  if (provider === "bridge") return sendViaBridge(phone, text, env, opts);

  const req = buildSendRequest(provider, env, phone, text);
  if (!req) {
    console.log(`[whatsapp:${provider}] → ${phone}: ${text.slice(0, 200)}`);
    return { ok: provider === "log", provider, error: provider === "log" ? undefined : "provider_misconfigured" };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(req.url, { ...req.init, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false, provider, status: res.status, error: (await res.text().catch(() => "")).slice(0, 300) };
    return { ok: true, provider, status: res.status };
  } catch (e: any) {
    return { ok: false, provider, error: String(e?.message ?? e) };
  }
}
