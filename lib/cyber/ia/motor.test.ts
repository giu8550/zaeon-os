import { describe, expect, it, vi } from "vitest";
import { CYBER_IA, falarJson } from "./motor";
import { USAGE_VAZIO } from "@/lib/llm/usage";
import * as fs from "node:fs";

const pedido = { system: "s", user: "u", agente: "zaeon", userId: "u1" };
describe("o harness do CYBERESPAÇO (separado do laboratório)", () => {
  it("não importa o harness do laboratório (envelope/personas/ferramentas) — é cópia, não dependência", () => {
    const src = fs.readFileSync(new URL("./motor.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from "@\/lib\/llm\/envelope"/); expect(src).not.toMatch(/lib\/ai\/personas/); expect(src).not.toMatch(/lib\/scholar/);
    expect(CYBER_IA.maxSaida).toBeLessThanOrEqual(600); expect(CYBER_IA.timeoutMs).toBeLessThanOrEqual(12000);
  });
  it("devolve o JSON (com cercas toleradas) e registra o custo como agente 'cyber:<agente>'", async () => {
    const registrar = vi.fn(async () => true);
    const v = await falarJson<{ a: number }>(pedido, { transporte: async () => ({ texto: "```json\n{\"a\":1}\n```", usage: USAGE_VAZIO }), registrar });
    expect(v).toEqual({ a: 1 });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ agentKey: "cyber:zaeon", userId: "u1", jsonValido: true, model: CYBER_IA.modelo }));
  });
  it("modelo leve indisponível no projeto → tenta o de reserva na mesma chamada; JSON inválido ou erro → lança (a rota tem a reserva local)", async () => {
    const t = vi.fn(async (_p: unknown, modelo: string) => { if (modelo === CYBER_IA.modelo) throw new Error("Publisher model not found (404)"); return { texto: "{\"ok\":true}", usage: USAGE_VAZIO }; });
    expect(await falarJson(pedido, { transporte: t, registrar: async () => true })).toEqual({ ok: true });
    expect(t).toHaveBeenLastCalledWith(pedido, CYBER_IA.reserva);
    await expect(falarJson(pedido, { transporte: async () => ({ texto: "não é json", usage: USAGE_VAZIO }), registrar: async () => true })).rejects.toThrow(/JSON inválido/);
    await expect(falarJson(pedido, { transporte: async () => { throw new Error("rede"); }, registrar: async () => true })).rejects.toThrow("rede");
  });
});
