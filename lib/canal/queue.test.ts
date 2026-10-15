import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dispararTurno, dispararTurnos, filaLigada, jobIdDe } from "./queue";

const CANAL = "d".repeat(24), A = "a".repeat(24);

describe("queue · inline por padrão, 1 turno por canal", () => {
  const envs = { CANAL_QUEUE: process.env.CANAL_QUEUE, REDIS_URL: process.env.REDIS_URL };
  beforeEach(() => { delete process.env.CANAL_QUEUE; delete process.env.REDIS_URL; });
  afterEach(() => { for (const [k, v] of Object.entries(envs)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

  it("filaLigada só com CANAL_QUEUE=1 e REDIS_URL", () => {
    expect(filaLigada()).toBe(false);
    process.env.CANAL_QUEUE = "1";
    expect(filaLigada()).toBe(false);
    process.env.REDIS_URL = "redis://x";
    expect(filaLigada()).toBe(true);
  });
  it("jobId idempotente por canal:agente:mensagem", () => {
    expect(jobIdDe({ canalId: "c", agentKey: "aura", userId: A, mensagemId: "m1" })).toBe("c:aura:m1");
  });
  it("sem fila → inline, serializado por canal, deps resolvidas uma vez por turno", async () => {
    const ordem: string[] = [];
    const prisma: any = {
      canal: { findUnique: async () => ({ id: CANAL, ownerId: A, titulo: "t", acesso: "privado", membros: [], agentes: [] }) },
      canalMensagem: { findMany: async () => [{ id: "m1", canalId: CANAL, autorTipo: "humano", autorId: A, texto: "@aura oi", mencoes: ["aura"], createdAt: new Date() }], create: async ({ data }: any) => ({ id: "n", createdAt: new Date(), ...data }) },
      agentProfile: { findMany: async () => [] }, mentorTemplate: { findMany: async () => [] },
      user: { findMany: async () => [] }, agentUsage: { upsert: async () => ({}) },
    };
    const deps = vi.fn(async () => ({ prisma, publicar: async () => {}, gerar: async ({ agente }: any) => { ordem.push(`${agente.agentKey}:in`); await new Promise((r) => setTimeout(r, 15)); ordem.push(`${agente.agentKey}:out`); return "r"; } }));
    const res = await dispararTurnos([
      { canalId: CANAL, agentKey: "aura", userId: A, mensagemId: "m1" },
      { canalId: CANAL, agentKey: "nina", userId: A, mensagemId: "m1" },
    ], deps);
    expect(res).toEqual(["inline", "inline"]);
    // espera os dois turnos terminarem (antes era um sleep fixo de 80ms, que falhava com a máquina carregada)
    await vi.waitFor(() => expect(ordem).toHaveLength(4), { timeout: 2000 });
    expect(ordem).toEqual(["aura:in", "aura:out", "nina:in", "nina:out"]);
    expect(deps).toHaveBeenCalledTimes(2);
  });
  it("dispararTurno nunca lança mesmo com deps quebradas", async () => {
    await expect(dispararTurno({ canalId: CANAL, agentKey: "aura", userId: A, mensagemId: "m" }, async () => { throw new Error("x"); })).resolves.toBe("inline");
  });
});
