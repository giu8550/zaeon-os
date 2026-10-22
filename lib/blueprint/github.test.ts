import { beforeEach, describe, expect, it, vi } from "vitest";
import { buscarRepos, limparCacheRepos, repoInfo } from "./github";

const resp = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const item = (full: string, stars: number) => ({ full_name: full, html_url: `https://github.com/${full}`, description: `desc ${full}`, stargazers_count: stars });

describe("buscarRepos — os repositórios do tema vêm da API do GitHub, nunca do modelo", () => {
  beforeEach(() => limparCacheRepos());

  it("mapeia, junta os termos sem repetir e ordena por estrelas", async () => {
    const f = vi.fn(async (url: string) => resp({ items: url.includes("zk") ? [item("a/zk", 10), item("b/c", 50)] : [item("b/c", 50), item("d/e", 5)] }));
    const r = await buscarRepos(["zk proofs", "confidential transfer"], { fetch: f });
    expect(r.map((x) => x.nome)).toEqual(["b/c", "a/zk", "d/e"]);
    expect(r[0]).toMatchObject({ url: "https://github.com/b/c", descricao: "desc b/c", estrelas: 50 });
  });

  it("mesmo termo de novo sai do cache (não chama a API)", async () => {
    const f = vi.fn(async () => resp({ items: [item("a/b", 1)] }));
    await buscarRepos(["Solana Privacy"], { fetch: f }); await buscarRepos(["solana privacy "], { fetch: f });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("erro, limite (403) ou timeout = lista vazia, sem lançar", async () => {
    expect(await buscarRepos(["x"], { fetch: async () => { throw new Error("rede"); } })).toEqual([]);
    expect(await buscarRepos(["y"], { fetch: async () => resp({ message: "rate limit" }, 403) })).toEqual([]);
  });

  it("manda o token quando há", async () => {
    const f = vi.fn(async (_u: string, init?: RequestInit) => { expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer t0k"); return resp({ items: [] }); });
    await buscarRepos(["z"], { fetch: f, token: "t0k" }); expect(f).toHaveBeenCalled();
  });
});

describe("repoInfo", () => {
  it("só github.com/<dono>/<repo>", async () => {
    const f = vi.fn(); expect(await repoInfo("https://gitlab.com/a/b", { fetch: f })).toBeNull(); expect(f).not.toHaveBeenCalled();
  });
  it("lê público e o último push", async () => {
    const f = vi.fn(async (u: string) => { expect(u).toBe("https://api.github.com/repos/voce/privado"); return resp({ full_name: "voce/privado", private: false, pushed_at: "2026-10-22T10:00:00Z" }); });
    expect(await repoInfo("https://github.com/voce/privado/tree/main", { fetch: f })).toEqual({ nome: "voce/privado", publico: true, pushedAt: Date.parse("2026-10-22T10:00:00Z") });
  });
  it("404 = null", async () => { expect(await repoInfo("https://github.com/x/y", { fetch: async () => resp({}, 404) })).toBeNull(); });
});
