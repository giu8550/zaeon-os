/**
 * lib/whatsapp/sender.ts — transporte de SAÍDA, provider-agnóstico.
 *
 *   evolution → instância única da plataforma no Evolution API (POST /message/sendText/{instance})
 *   disparos  → o repo de disparos (ChipFlow) como sender (POST {DISPAROS_URL}{DISPAROS_SEND_PATH})
 *               ⚠️ seam: o path/corpo exatos são confirmados contra a API real do repo.
 *   log       → sem provider configurado: só loga (dev/CI). Nunca derruba a rota.
 *
 * `buildSendRequest` é puro (testável); `sendWhatsAppText` faz o fetch.
 */
import { jidNumber } from "./phone";

export type Provider = "evolution" | "disparos" | "log";
export type SenderEnv = Record<string, string | undefined>;
export type SendRequest = { url: string; init: RequestInit };

const trimSlash = (u: string) => u.replace(/\/+$/, "");

export function resolveProvider(env: SenderEnv = process.env): Provider {
  const p = (env.WHATSAPP_PROVIDER ?? "").toLowerCase();
  if (p === "evolution" || p === "disparos" || p === "log") return p;
  if (env.EVOLUTION_URL) return "evolution";
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
  return null;
}

export type SendResult = { ok: boolean; provider: Provider; status?: number; error?: string };

export async function sendWhatsAppText(phone: string, text: string, env: SenderEnv = process.env): Promise<SendResult> {
  const provider = resolveProvider(env);
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
