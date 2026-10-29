/** #645: o /api/health diz se os turnos do Escritório rodam na fila (worker) ou no próprio web. */
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/llm/saude", () => ({ estadoGateway: async () => "on", provedorAtual: () => "litellm" }));
vi.mock("@/lib/leitor/saude", () => ({ estadoLeitor: async () => "off" }));
vi.mock("@/lib/llm/pool", () => ({ poolConfigurado: () => [] }));
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("health · escritorio", () => {
  it("CANAL_QUEUE=1 com Redis → 'fila'; sem → 'inline' (e nenhum segredo sai)", async () => {
    vi.stubEnv("CANAL_QUEUE", "1"); vi.stubEnv("REDIS_URL", "redis://segredo:6379");
    const fila = await (await GET()).json();
    expect(fila.escritorio).toBe("fila");
    expect(JSON.stringify(fila)).not.toContain("segredo");
    vi.stubEnv("CANAL_QUEUE", "");
    expect((await (await GET()).json()).escritorio).toBe("inline");
  });
});
