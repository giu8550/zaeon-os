import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SOURCE_FN, searchAll, _zerarPausas } from "./index";
import { searchSemanticScholar } from "./semanticScholar";
import { retrievePapers } from "../retrieve";

const original = { ...SOURCE_FN };
afterEach(() => { Object.assign(SOURCE_FN, original); _zerarPausas(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
beforeEach(() => _zerarPausas());

describe("searchAll — pausa após 429 (medido em prod: S2 sem chave limitava TODA busca)", () => {
  it("a fonte que deu rate_limited fica de fora (custo zero) até a pausa acabar", async () => {
    let t = 1_000;
    const s2 = vi.fn(async () => ({ papers: [], status: "rate_limited" as const }));
    SOURCE_FN.semanticscholar = s2;
    SOURCE_FN.openalex = async () => ({ papers: [{ id: "a", title: "A", authors: [], sources: ["openalex"] } as any], status: "ok" as const });
    await searchAll("q", ["semanticscholar", "openalex"], { agora: () => t });
    const r = await searchAll("q", ["semanticscholar", "openalex"], { agora: () => t + 60_000 });
    expect(s2).toHaveBeenCalledTimes(1);                       // 2ª busca nem chamou
    expect(r.find((x) => x.source === "semanticscholar")!.status).toBe("rate_limited");
    expect(r.find((x) => x.source === "openalex")!.papers).toHaveLength(1);
    await searchAll("q", ["semanticscholar"], { agora: () => t + 11 * 60_000 });   // pausa (10 min) acabou
    expect(s2).toHaveBeenCalledTimes(2);
  });
  it("prazo por busca: fonte lenta vira vazio no prazo pedido (o chat não espera)", async () => {
    SOURCE_FN.crossref = () => new Promise((ok) => setTimeout(() => ok({ papers: [], status: "ok" }), 5_000));
    const t0 = Date.now();
    const [r] = await searchAll("q", ["crossref"], { prazoMs: 50 });
    expect(r!.status).toBe("error"); expect(Date.now() - t0).toBeLessThan(1_000);
  });
  it("erro comum (não 429) não pausa a fonte", async () => {
    const f = vi.fn(async () => ({ papers: [], status: "error" as const }));
    SOURCE_FN.arxiv = f;
    await searchAll("q", ["arxiv"]); await searchAll("q", ["arxiv"]);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("Semantic Scholar — sem chave, 1 tentativa só", () => {
  it("429 sem chave: não re-tenta (antes: 4 tentativas, ~6 s)", async () => {
    vi.stubEnv("SEMANTIC_SCHOLAR_API_KEY", "");
    const f = vi.fn(async () => new Response("", { status: 429 }));
    vi.stubGlobal("fetch", f);
    expect((await searchSemanticScholar("q")).status).toBe("rate_limited");
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("retrievePapers — repassa o prazo por fonte", () => {
  it("prazoFonteMs chega no search", async () => {
    const search = vi.fn(async () => [{ source: "openalex" as const, papers: [], status: "ok" as const }]);
    await retrievePapers("q", { search, prazoFonteMs: 2500, minResults: 0 });
    expect(search).toHaveBeenCalledWith("q", expect.any(Array), { prazoMs: 2500 });
  });
});
