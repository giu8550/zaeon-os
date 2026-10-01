import { describe, it, expect } from "vitest";
import { emSerie, emAndamento } from "./serial";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("serial · um turno por canal", () => {
  it("mesmo canal roda em fila; canais diferentes em paralelo", async () => {
    const ordem: string[] = [];
    const p1 = emSerie("c1", async () => { ordem.push("c1-a:in"); await sleep(30); ordem.push("c1-a:out"); });
    const p2 = emSerie("c1", async () => { ordem.push("c1-b:in"); ordem.push("c1-b:out"); });
    const p3 = emSerie("c2", async () => { ordem.push("c2:in"); ordem.push("c2:out"); });
    await Promise.all([p1, p2, p3]);
    expect(ordem.indexOf("c1-b:in")).toBeGreaterThan(ordem.indexOf("c1-a:out"));
    expect(ordem.indexOf("c2:in")).toBeLessThan(ordem.indexOf("c1-a:out"));
  });
  it("erro de um turno não trava o próximo e a fila esvazia", async () => {
    await expect(emSerie("c3", async () => { throw new Error("x"); })).rejects.toThrow("x");
    expect(await emSerie("c3", async () => 42)).toBe(42);
    await sleep(0);
    expect(emAndamento()).toBe(0);
  });
});
