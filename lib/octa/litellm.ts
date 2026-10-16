/**
 * lib/octa/litellm.ts — P2 do Pack Octa (§3 + lacunas §9.4/§9.7). Virtual keys do LiteLLM por
 * usuário/sessão, com budget e TTL. A chave real do provedor (Anthropic/Vertex) mora SÓ no gateway;
 * o Octa só manipula a virtual key, e o modelo nunca vê nenhuma das duas.
 *
 * Sem LITELLM_URL/LITELLM_MASTER_KEY → `octaGatewayConfigurado() === false` e tudo recusa limpo
 * (portão do dono: chaves reais no LiteLLM).
 * Endpoints do proxy LiteLLM: POST /key/generate, POST /key/delete, GET /key/info.
 */
export type VirtualKey = { key: string; userId: string; sessionId: string; maxBudget: number; expiraEm?: string };
export type GatewayErro = { ok: false; code: "gateway_off" | "budget_exceeded" | "gateway_error"; error: string };

type Fetch = typeof fetch;

export function octaGatewayConfigurado(env = process.env): boolean {
  return !!(env.LITELLM_URL && env.LITELLM_MASTER_KEY);
}

function cfg(env = process.env) {
  return { url: (env.LITELLM_URL ?? "").replace(/\/$/, ""), master: env.LITELLM_MASTER_KEY ?? "" };
}

/** Emite uma virtual key com teto de gasto (USD) e duração (ex.: "8h", "1d"). */
export async function emitirVirtualKey(
  p: { userId: string; sessionId: string; maxBudgetUsd: number; duracao?: string; modelos?: string[] },
  f: Fetch = fetch,
  env = process.env,
): Promise<{ ok: true; vk: VirtualKey } | GatewayErro> {
  if (!octaGatewayConfigurado(env)) return { ok: false, code: "gateway_off", error: "LiteLLM não configurado" };
  const { url, master } = cfg(env);
  try {
    const r = await f(`${url}/key/generate`, {
      method: "POST",
      headers: { authorization: `Bearer ${master}`, "content-type": "application/json" },
      body: JSON.stringify({
        user_id: p.userId,
        max_budget: p.maxBudgetUsd,
        duration: p.duracao ?? "8h",
        models: p.modelos,
        metadata: { octa_session: p.sessionId },
      }),
    });
    if (!r.ok) return { ok: false, code: "gateway_error", error: `LiteLLM /key/generate ${r.status}` };
    const j: any = await r.json();
    return { ok: true, vk: { key: j.key, userId: p.userId, sessionId: p.sessionId, maxBudget: p.maxBudgetUsd, expiraEm: j.expires ?? undefined } };
  } catch (e: any) {
    return { ok: false, code: "gateway_error", error: String(e?.message ?? e) };
  }
}

export async function revogarVirtualKey(key: string, f: Fetch = fetch, env = process.env): Promise<boolean> {
  if (!octaGatewayConfigurado(env)) return false;
  const { url, master } = cfg(env);
  const r = await f(`${url}/key/delete`, {
    method: "POST",
    headers: { authorization: `Bearer ${master}`, "content-type": "application/json" },
    body: JSON.stringify({ keys: [key] }),
  }).catch(() => null);
  return !!r?.ok;
}

/**
 * Traduz a resposta de uma chamada de modelo via gateway: LiteLLM responde 400/429 com
 * "Budget has been exceeded" quando a virtual key estoura → recusa explícita (nunca re-tenta com outra chave).
 */
export async function classificarRespostaGateway(r: Response): Promise<{ ok: true } | GatewayErro> {
  if (r.ok) return { ok: true };
  const txt = await r.text().catch(() => "");
  if ((r.status === 400 || r.status === 429) && /budget/i.test(txt) && /exceed/i.test(txt)) {
    return { ok: false, code: "budget_exceeded", error: "orçamento da sessão esgotado" };
  }
  return { ok: false, code: "gateway_error", error: `gateway ${r.status}` };
}
