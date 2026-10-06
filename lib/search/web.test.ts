import { describe, it, expect, vi } from "vitest";
import { webSearch, provedoresConfigurados, parseSearxng, parseTavily, parseBrave, webParaPrompt, webSearchConfigurada } from "@/lib/search/web";

const resp = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;

describe("provedores", () => {
  it("ordem searxng > tavily > brave; WEB_SEARCH_PROVIDER força; nenhum = indisponível", () => {
    expect(provedoresConfigurados({})).toEqual([]);
    expect(webSearchConfigurada({})).toBe(false);
    expect(provedoresConfigurados({ SEARXNG_URL: "http://s", TAVILY_API_KEY: "t", BRAVE_API_KEY: "b" })).toEqual(["searxng", "tavily", "brave"]);
    expect(provedoresConfigurados({ TAVILY_API_KEY: "t", BRAVE_API_KEY: "b", WEB_SEARCH_PROVIDER: "brave" })).toEqual(["brave", "tavily"]);
    expect(provedoresConfigurados({ TAVILY_API_KEY: "t", WEB_SEARCH_PROVIDER: "searxng" })).toEqual(["tavily"]); // forçado mas não configurado: ignora
  });
});

describe("parsers (só http(s), texto limpo, teto)", () => {
  it("searxng/tavily/brave → WebResult; descarta url perigosa e sem título", () => {
    expect(parseSearxng({ results: [{ title: " A ", url: "https://a.com/x", content: "txt  longo" }, { title: "B", url: "javascript:alert(1)", content: "x" }, { title: "", url: "https://c.com" }] })).toEqual([{ title: "A", url: "https://a.com/x", snippet: "txt longo" }]);
    expect(parseTavily({ results: [{ title: "T", url: "https://t.io", content: "c" }] })).toHaveLength(1);
    expect(parseBrave({ web: { results: [{ title: "<b>B</b> r", url: "https://b.io", description: "<i>d</i>" }] } })[0]).toEqual({ title: "B r", url: "https://b.io", snippet: "d" });
    expect(parseSearxng({})).toEqual([]);
    expect(parseSearxng({ results: [...Array(20)].map((_, i) => ({ title: "t" + i, url: "https://x.com/" + i })) }, 3)).toHaveLength(3);
  });
  it("webParaPrompt respeita o teto", () => {
    expect(webParaPrompt([...Array(50)].map((_, i) => ({ title: "t" + i, url: "https://x.com/" + i, snippet: "s".repeat(100) })), 300).length).toBeLessThanOrEqual(300);
  });
});

describe("webSearch", () => {
  it("sem provedor → web_unavailable (nunca lança); consulta vazia → no_results", async () => {
    expect(await webSearch("x", { env: {} })).toMatchObject({ ok: false, code: "web_unavailable" });
    expect(await webSearch("   ", { env: { SEARXNG_URL: "http://s" } })).toMatchObject({ ok: false, code: "no_results" });
  });
  it("searxng: monta a URL JSON com a consulta e devolve os resultados", async () => {
    const f = vi.fn(async () => resp({ results: [{ title: "Solo", url: "https://solo.org", content: "ph" }] }));
    const r = await webSearch("ph do solo", { env: { SEARXNG_URL: "http://searxng:8080/" }, fetchImpl: f as any });
    expect(r).toMatchObject({ ok: true, provider: "searxng", results: [{ title: "Solo" }] });
    expect((f.mock.calls[0] as any[])[0]).toBe("http://searxng:8080/search?q=ph%20do%20solo&format=json&language=pt-BR&safesearch=1");
  });
  it("cai pro próximo provedor quando o 1º falha ou vem vazio; tavily vai com Bearer", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(resp({}, false, 502))
      .mockResolvedValueOnce(resp({ results: [{ title: "T", url: "https://t.io", content: "c" }] }));
    const r = await webSearch("q", { env: { SEARXNG_URL: "http://s", TAVILY_API_KEY: "k" }, fetchImpl: f as any });
    expect(r).toMatchObject({ ok: true, provider: "tavily" });
    expect((f.mock.calls[1] as any[])[1].headers.Authorization).toBe("Bearer k");
  });
  it("todos falham → ok:false com o motivo; timeout aborta", async () => {
    const f = vi.fn(async () => { throw new Error("boom"); });
    expect(await webSearch("q", { env: { SEARXNG_URL: "http://s" }, fetchImpl: f as any })).toMatchObject({ ok: false, code: "web_error" });
    const lento = vi.fn((_u: any, init: any) => new Promise((_r, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("abort"), { name: "AbortError" })))));
    const r = await webSearch("q", { env: { SEARXNG_URL: "http://s" }, fetchImpl: lento as any, timeoutMs: 20 });
    expect(r).toMatchObject({ ok: false }); expect((r as any).error).toMatch(/timeout/);
    expect(await webSearch("q", { env: { SEARXNG_URL: "http://s" }, fetchImpl: (async () => resp({ results: [] })) as any })).toMatchObject({ ok: false, code: "no_results" });
  });
});
