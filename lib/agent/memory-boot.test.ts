import { describe, it, expect, vi, afterEach } from "vitest";
import { memoriaL3Ligada, ligarMemoriaL3 } from "./memory-boot";
import { __setMemoryForTest, configureMemory } from "./memory-provider";

afterEach(() => { __setMemoryForTest(null); vi.resetModules(); });

describe("memory-boot", () => {
  it("flag: só com MEMORY_L3=1 E DATABASE_URL", () => {
    expect(memoriaL3Ligada({})).toBe(false);
    expect(memoriaL3Ligada({ MEMORY_L3: "1" })).toBe(false);
    expect(memoriaL3Ligada({ MEMORY_L3: "0", DATABASE_URL: "mongodb://x" })).toBe(false);
    expect(memoriaL3Ligada({ MEMORY_L3: "1", DATABASE_URL: "mongodb://x" })).toBe(true);
  });

  it("sem a flag não liga nem conecta", async () => {
    expect(await ligarMemoriaL3({ DATABASE_URL: "mongodb://nao-conecta" })).toBe(false);
  });

  it("a configuração do boot vale numa OUTRA cópia do módulo (globalThis, como as rotas do Next)", async () => {
    configureMemory({ drawers: { insertMany: async () => {}, aggregate: async () => [] }, embed: async (t) => t.map(() => [0]) });
    vi.resetModules();
    const outraCopia = await import("./memory-provider");
    expect(outraCopia.isMemoryConfigured()).toBe(true);
  });
});
