/**
 * lib/search/web.ts — busca na INTERNET geral (não acadêmica), o fallback quando as bases
 * acadêmicas (OpenAlex/Crossref/arXiv/PubMed…) não cobrem o tema. Antes não existia.
 *
 * Provedores (o primeiro configurado vence; `WEB_SEARCH_PROVIDER` força um):
 *   - searxng — SearXNG self-hosted (SEARXNG_URL, ex.: http://searxng:8080). Open-source, sem key e
 *               sem custo por query; JSON em /search?format=json (habilitado em searxng/settings.yml).
 *   - tavily  — TAVILY_API_KEY (gerenciado, 1.000 buscas/mês grátis, retorno já enxuto pra LLM).
 *   - brave   — BRAVE_API_KEY (gerenciado, crédito grátis mensal).
 * Nenhum configurado ou todos falhando → `{ ok:false }` — quem chama NUNCA trata isso como beco:
 * responde pelo conhecimento do modelo. Funções puras de parse separadas (testáveis sem rede).
 */
export type WebResult = { title: string; url: string; snippet: string };
export type WebProvider = "searxng" | "tavily" | "brave";
export type WebSearchOk = { ok: true; provider: WebProvider; results: WebResult[] };
export type WebSearchFail = { ok: false; code: "web_unavailable" | "web_error" | "no_results"; error: string };
export type WebSearchResult = WebSearchOk | WebSearchFail;

type Env = Record<string, string | undefined>;
export const WEB_TIMEOUT_MS = 8_000;
export const WEB_MAX = 6;

const limpa = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** Só http(s): nada de javascript:/data: indo parar num <a href>. */
const urlOk = (u: unknown): string | null => { const s = String(u ?? "").trim(); return /^https?:\/\/[^\s"'<>]{4,2000}$/.test(s) ? s : null; };

export function provedoresConfigurados(env: Env = process.env): WebProvider[] {
  const out: WebProvider[] = [];
  if (env.SEARXNG_URL?.trim()) out.push("searxng");
  if (env.TAVILY_API_KEY?.trim()) out.push("tavily");
  if (env.BRAVE_API_KEY?.trim()) out.push("brave");
  const forcado = env.WEB_SEARCH_PROVIDER?.trim().toLowerCase();
  if (forcado && (out as string[]).includes(forcado)) return [forcado as WebProvider, ...out.filter((p) => p !== forcado)];
  return out;
}
export const webSearchConfigurada = (env: Env = process.env) => provedoresConfigurados(env).length > 0;

// ── parsers puros ──
export function parseSearxng(j: any, max = WEB_MAX): WebResult[] {
  const r = Array.isArray(j?.results) ? j.results : [];
  return r.map((x: any) => ({ title: limpa(x?.title, 160), url: urlOk(x?.url) ?? "", snippet: limpa(x?.content, 300) })).filter((x: WebResult) => x.url && x.title).slice(0, max);
}
export function parseTavily(j: any, max = WEB_MAX): WebResult[] {
  const r = Array.isArray(j?.results) ? j.results : [];
  return r.map((x: any) => ({ title: limpa(x?.title, 160), url: urlOk(x?.url) ?? "", snippet: limpa(x?.content, 300) })).filter((x: WebResult) => x.url && x.title).slice(0, max);
}
export function parseBrave(j: any, max = WEB_MAX): WebResult[] {
  const r = Array.isArray(j?.web?.results) ? j.web.results : [];
  return r.map((x: any) => ({ title: limpa(String(x?.title ?? "").replace(/<[^>]+>/g, ""), 160), url: urlOk(x?.url) ?? "", snippet: limpa(String(x?.description ?? "").replace(/<[^>]+>/g, ""), 300) })).filter((x: WebResult) => x.url && x.title).slice(0, max);
}

type Fetch = typeof fetch;
async function chamar(p: WebProvider, query: string, env: Env, f: Fetch, max: number, signal: AbortSignal): Promise<WebResult[]> {
  if (p === "searxng") {
    const base = String(env.SEARXNG_URL).replace(/\/+$/, "");
    const r = await f(`${base}/search?q=${encodeURIComponent(query)}&format=json&language=pt-BR&safesearch=1`, { signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`searxng HTTP ${r.status}`);
    return parseSearxng(await r.json(), max);
  }
  if (p === "tavily") {
    const r = await f("https://api.tavily.com/search", { method: "POST", signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TAVILY_API_KEY}` }, body: JSON.stringify({ query, max_results: max, search_depth: "basic" }) });
    if (!r.ok) throw new Error(`tavily HTTP ${r.status}`);
    return parseTavily(await r.json(), max);
  }
  const r = await f(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}`, { signal, headers: { Accept: "application/json", "X-Subscription-Token": String(env.BRAVE_API_KEY) } });
  if (!r.ok) throw new Error(`brave HTTP ${r.status}`);
  return parseBrave(await r.json(), max);
}

/** Busca na web: tenta os provedores configurados em ordem; o 1º que devolver resultado vence. Nunca lança. */
export async function webSearch(query: string, opts: { env?: Env; fetchImpl?: Fetch; max?: number; timeoutMs?: number } = {}): Promise<WebSearchResult> {
  const env = opts.env ?? process.env, f = opts.fetchImpl ?? fetch, max = opts.max ?? WEB_MAX;
  const q = limpa(query, 300);
  if (!q) return { ok: false, code: "no_results", error: "consulta vazia" };
  const provs = provedoresConfigurados(env);
  if (!provs.length) return { ok: false, code: "web_unavailable", error: "nenhum provedor de busca web configurado" };
  let ultimoErro = "";
  for (const p of provs) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), opts.timeoutMs ?? WEB_TIMEOUT_MS);
    try {
      const results = await chamar(p, q, env, f, max, ac.signal);
      if (results.length) return { ok: true, provider: p, results };
      ultimoErro = `${p}: sem resultados`;
    } catch (e: any) { ultimoErro = `${p}: ${e?.name === "AbortError" ? "timeout" : e?.message ?? e}`; }
    finally { clearTimeout(t); }
  }
  return { ok: false, code: ultimoErro.includes("sem resultados") ? "no_results" : "web_error", error: ultimoErro };
}

/** Resultados prontos pro prompt (curto): "• título — snippet <url>". */
export function webParaPrompt(rs: WebResult[], maxChars = 2400): string {
  const t = rs.map((r, i) => `(${i + 1}) ${r.title} — ${r.snippet} <${r.url}>`).join("\n");
  return t.length > maxChars ? t.slice(0, maxChars - 1) + "…" : t;
}
