/**
 * lib/llm/usage.ts — o contrato C5/C6 em funções PURAS (sem rede, sem Prisma, sem env lido
 * implicitamente). Especificado em docs/VERIFICACAO_CHAVES_GATEWAY.md §4; consumido pelo
 * envelope (lib/llm/envelope.ts, Fatia 1) e pela fila (lib/queue/reenfileirar.ts, Fatia 7).
 *
 *  - usageDoVertex / usageDoOpenAI → tokens normalizados. `cached` é contado À PARTE e descontado
 *    do prompt: somar tudo como token cheio infla o custo justamente quando o contextCache funciona.
 *    Sem bloco de usage → zeros com `reportado:false`. NUNCA inventar número.
 *  - classificarErroLlm → 11 classes. reenfileiravel() = a fila tenta de novo; declaravel() = o
 *    agente declara ao humano (lei 5). `auth`/`credito` são problema NOSSO, nunca recado pro aluno.
 *  - lerRateLimit → o que o provedor declara nos headers; `null` quando não declara (não sabemos ≠ acabou).
 *  - chaveDoAgente / nomeEnvDaChave → virtual key por agente (C6): agente > default > nenhuma.
 */

export type Usage = {
  promptTokens: number;      // NÃO cacheado (promptTokenCount − cachedContentTokenCount)
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;       // como o provedor devolve
  reportado: boolean;        // false = provedor cego (zeros, nunca inventados)
};

const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export const USAGE_VAZIO: Usage = { promptTokens: 0, completionTokens: 0, cachedTokens: 0, totalTokens: 0, reportado: false };

/** Vertex / Gemini: `response.usageMetadata` ({promptTokenCount, candidatesTokenCount, cachedContentTokenCount, totalTokenCount}). */
export function usageDoVertex(meta: unknown): Usage {
  const m = (meta ?? null) as Record<string, unknown> | null;
  if (!m || typeof m !== "object") return USAGE_VAZIO;
  const prompt = n(m.promptTokenCount), out = n(m.candidatesTokenCount), cached = n(m.cachedContentTokenCount);
  const reportado = "promptTokenCount" in m || "candidatesTokenCount" in m || "totalTokenCount" in m;
  if (!reportado) return USAGE_VAZIO;
  const total = "totalTokenCount" in m ? n(m.totalTokenCount) : prompt + out;
  return { promptTokens: Math.max(0, prompt - cached), completionTokens: out, cachedTokens: Math.min(cached, prompt), totalTokens: total, reportado: true };
}

/** OpenAI-compatible (LiteLLM, Groq, OpenRouter, Cloudflare, GLM…): `usage` ({prompt_tokens, completion_tokens, total_tokens, prompt_tokens_details.cached_tokens}). */
export function usageDoOpenAI(usage: unknown): Usage {
  const u = (usage ?? null) as Record<string, any> | null;
  if (!u || typeof u !== "object") return USAGE_VAZIO;
  const reportado = "prompt_tokens" in u || "completion_tokens" in u || "total_tokens" in u;
  if (!reportado) return USAGE_VAZIO;
  const prompt = n(u.prompt_tokens), out = n(u.completion_tokens);
  const cached = n(u.prompt_tokens_details?.cached_tokens ?? u.cached_tokens);
  const total = "total_tokens" in u ? n(u.total_tokens) : prompt + out;
  return { promptTokens: Math.max(0, prompt - cached), completionTokens: out, cachedTokens: Math.min(cached, prompt), totalTokens: total, reportado: true };
}

// ───────────────────────────── erros ─────────────────────────────
export type ClasseErroLlm =
  | "auth"               // 401/403, key inválida/revogada — problema NOSSO
  | "credito"            // 402, billing, saldo — problema NOSSO
  | "rate_limit"         // 429 transitório (por minuto) — fila tenta de novo
  | "cota_esgotada"      // 429 de cota diária/mensal do provedor — o agente declara
  | "teto"               // budget da virtual key (LiteLLM) — o agente declara
  | "modelo_inexistente" // 404 / model not found — config errada
  | "timeout"            // abort/ETIMEDOUT — fila tenta de novo (teto de tentativas é da fila)
  | "provedor_fora"      // 5xx, ECONNREFUSED, ENOTFOUND, fetch failed — fila tenta de novo
  | "pool_esgotado"      // LiteLLM: todos os deployments em cooldown — fila adia (backoff NOSSO)
  | "resposta_nao_json"  // corpo não é JSON (proxy de egress respondendo, HTML de erro…)
  | "outro";

export const CLASSES_ERRO: readonly ClasseErroLlm[] = ["auth", "credito", "rate_limit", "cota_esgotada", "teto", "modelo_inexistente", "timeout", "provedor_fora", "pool_esgotado", "resposta_nao_json", "outro"];

/** Mensagem literal do LiteLLM quando todos os deployments do grupo estão em cooldown. Se mudar numa versão futura, o teste avisa antes da produção. */
export const LITELLM_SEM_DEPLOYMENTS = "No deployments available for selected model";

function statusDe(e: any): number | null {
  for (const k of ["status", "statusCode", "code"]) {
    const v = e?.[k] ?? e?.response?.[k] ?? e?.cause?.[k];
    if (typeof v === "number" && v >= 100 && v < 600) return v;
    if (typeof v === "string" && /^\d{3}$/.test(v)) return Number(v);
  }
  return null;
}
function textoDe(e: any): string {
  if (e == null) return "";
  if (typeof e === "string") return e;
  const partes = [e.message, e.error?.message, e.body, e.response?.body, e.cause?.message, e.code, e.name, e.error?.type, e.error?.code];
  return partes.filter((p) => p != null).map((p) => (typeof p === "string" ? p : safeJson(p))).join(" | ");
}
function safeJson(v: unknown): string { try { return JSON.stringify(v); } catch { return String(v); } }

/** PURO. Olha status + texto; em dúvida, `outro` (nunca inventa transitório). */
export function classificarErroLlm(e: unknown): ClasseErroLlm {
  const status = statusDe(e);
  const t = textoDe(e);
  const s = t.toLowerCase();

  if (s.includes(LITELLM_SEM_DEPLOYMENTS.toLowerCase()) || /all fallbacks? failed|routerratelimiterror|no healthy deployment|all deployments .*cooldown/.test(s)) return "pool_esgotado";
  if (/budget (has been |)exceeded|exceededbudget|max_budget|budget_exceeded|limite di[aá]rio/.test(s)) return "teto";
  if (/unexpected token|not valid json|invalid json|json parse|resposta n[aã]o[- ]json|<!doctype|<html/.test(s)) return "resposta_nao_json";
  if (/abort|timeout|timed out|etimedout|deadline exceeded/.test(s) && status !== 429) return "timeout";

  if (status === 401 || status === 403 || /invalid api key|incorrect api key|unauthorized|forbidden|authentication|permission denied|api key not valid|invalid_api_key/.test(s)) return "auth";
  if (status === 402 || /insufficient_quota|insufficient credits|credit|billing|payment required|saldo/.test(s)) return "credito";
  if (status === 404 || /model(_|\s)?not(_|\s)?found|does not exist|unknown model|no such model|modelo inexistente|not_found_error/.test(s)) return "modelo_inexistente";
  if (status === 429 || /rate.?limit|resource.?exhausted|too many requests|\b429\b/.test(s)) {
    if (/per minute|per_minute|\brpm\b|\btpm\b|per second/.test(s)) return "rate_limit";
    if (/per day|daily|per_day|quota.*(day|month)|monthly|free_model_daily|cota esgotada|code.?4006|allocation/.test(s)) return "cota_esgotada";
    return "rate_limit";
  }
  if ((status != null && status >= 500) || /econnrefused|enotfound|econnreset|fetch failed|socket hang up|service unavailable|bad gateway|upstream/.test(s)) return "provedor_fora";
  return "outro";
}

/** A fila tenta de novo (transitório). */
export function reenfileiravel(c: ClasseErroLlm): boolean {
  return c === "rate_limit" || c === "timeout" || c === "provedor_fora" || c === "pool_esgotado";
}
/** O agente DECLARA ao humano em 1 linha (lei 5). auth/credito/modelo são problema nosso → admin, não aluno. */
export function declaravel(c: ClasseErroLlm): boolean {
  return c === "teto" || c === "cota_esgotada";
}

// ───────────────────────────── rate limit por header ─────────────────────────────
export type RateLimitInfo = {
  remainingRequests: number | null;
  remainingTokens: number | null;
  resetRequestsMs: number | null;
  resetTokensMs: number | null;
  retryAfterMs: number | null;
};
type HeadersLike = { get(name: string): string | null } | Record<string, string | string[] | undefined>;
function h(headers: HeadersLike, name: string): string | null {
  if (typeof (headers as any).get === "function") return (headers as any).get(name) ?? (headers as any).get(name.toLowerCase());
  const rec = headers as Record<string, string | string[] | undefined>;
  const k = Object.keys(rec).find((x) => x.toLowerCase() === name.toLowerCase());
  const v = k == null ? undefined : rec[k];
  return v == null ? null : Array.isArray(v) ? v[0] ?? null : String(v);
}
const num = (v: string | null): number | null => { if (v == null || v.trim() === "") return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
/** "2m59.56s" | "7.66s" | "30" (segundos) | "1500ms" → ms. */
export function duracaoMs(v: string | null): number | null {
  if (v == null) return null;
  const s = v.trim().toLowerCase();
  if (s === "") return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000);
  let total = 0, ok = false;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    ok = true; const x = Number(m[1]);
    total += m[2] === "h" ? x * 3_600_000 : m[2] === "m" ? x * 60_000 : m[2] === "s" ? x * 1000 : x;
  }
  return ok ? Math.round(total) : null;
}
/** `null` quando o provedor não expõe NADA (Gemini AI Studio, Cloudflare, Mistral, GitHub Models). Groq expõe tudo. */
export function lerRateLimit(headers: HeadersLike | null | undefined): RateLimitInfo | null {
  if (!headers) return null;
  const info: RateLimitInfo = {
    remainingRequests: num(h(headers, "x-ratelimit-remaining-requests")),
    remainingTokens: num(h(headers, "x-ratelimit-remaining-tokens")),
    resetRequestsMs: duracaoMs(h(headers, "x-ratelimit-reset-requests")),
    resetTokensMs: duracaoMs(h(headers, "x-ratelimit-reset-tokens")),
    retryAfterMs: duracaoMs(h(headers, "retry-after")),
  };
  return Object.values(info).every((v) => v === null) ? null : info;
}

// ───────────────────────────── C6: virtual key por agente ─────────────────────────────
type Env = Record<string, string | undefined>;
/** "eng-computacao" → "GATEWAY_KEY_ENG_COMPUTACAO" (não-alfanumérico vira "_"). */
export function nomeEnvDaChave(agentKey: string): string {
  return "GATEWAY_KEY_" + String(agentKey).trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}
/** agente > GATEWAY_KEY_DEFAULT > null. Chave vazia/só espaço conta como ausente. */
export function chaveDoAgente(agentKey: string, env: Env = process.env): string | null {
  const propria = env[nomeEnvDaChave(agentKey)]?.trim();
  if (propria) return propria;
  const def = env.GATEWAY_KEY_DEFAULT?.trim();
  return def || null;
}
export const gatewayLigado = (env: Env = process.env): boolean => Boolean(env.GATEWAY_URL?.trim());
