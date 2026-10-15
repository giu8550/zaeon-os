import { describe, it, expect, vi } from "vitest";
import { rodarSuite, checkToolTruth, type AgenteSobAvaliacao, type Fixture, type AgentOutput, type Juiz } from "./core";
import { SUITE_CANONICA } from "./fixtures";
import { MemoryEvalStore, rotinaDiaria, registrarAgente } from "./server";

const fx: Fixture = {
  id: "f1", prompt: "timeout?", arquivos: { "rt.ts": "ts: 20_000" }, espera: { contem: ["20"], exigeCitacao: true },
};
const boa: AgentOutput = { resposta: "É 20 segundos.", claims: [{ texto: "20s", fonte: "rt.ts", trecho: "ts: 20_000" }], tools: [] };
const agente = (fn: (a: any, n: number) => AgentOutput): AgenteSobAvaliacao => {
  let n = 0;
  return { nome: "teste", rodar: async (_f, ancora) => fn(ancora, n++) };
};

describe("octa · evals (§5)", () => {
  it("agente correto = verde, 100%", async () => {
    const r = await rodarSuite(agente(() => boa), [fx]);
    expect(r).toMatchObject({ status: "verde", taxaPass: 1, drift: null });
  });

  it("alucinação plantada (fonte inventada) é DETECTADA, não mascarada", async () => {
    const inventada = { ...boa, claims: [{ texto: "20s", fonte: "config/timeouts.ts", trecho: "TIMEOUT=20" }] };
    const r = await rodarSuite(agente(() => inventada), [fx]);
    expect(r.status).toBe("vermelho");
    expect(r.resultados[0].veredito.pass).toBe(false);
    expect(r.resultados[0].veredito.motivo).toMatch(/fonte inexistente: config\/timeouts.ts/);
    expect(r.alerta).toMatch(/degradado/);
  });

  it("trecho que não está no arquivo também é pego", async () => {
    const r = await rodarSuite(agente(() => ({ ...boa, claims: [{ texto: "x", fonte: "rt.ts", trecho: "ts: 30_000" }] })), [fx], { curar: false });
    expect(r.resultados[0].veredito.motivo).toMatch(/trecho não está/);
  });

  it("tool-said ≠ tool-real dispara FAIL", () => {
    const c = checkToolTruth({ ...boa, tools: [{ id: "1", tool: "run_tests", disse: { passed: 10, failed: 0 }, real: { failed: 2, passed: 8 } }] });
    expect(c.ok).toBe(false);
    expect(checkToolTruth({ ...boa, tools: [{ id: "1", tool: "t", disse: { a: 1, b: 2 }, real: { b: 2, a: 1 } }] }).ok).toBe(true);
  });

  it("não-repetível falha", async () => {
    const r = await rodarSuite(agente((_a, n) => ({ ...boa, resposta: `É 20 (${n})` })), [fx], { curar: false });
    expect(r.resultados[0].checks.find((c) => c.check === "repeatability")!.ok).toBe(false);
  });

  it("auto-cura honesta: só passa re-rodando com âncora; status amarelo e registra a âncora", async () => {
    const r = await rodarSuite(agente((a) => (a.temperatura === 0 ? boa : { ...boa, claims: [] })), [fx]);
    expect(r.status).toBe("amarelo");
    expect(r.resultados[0].curadoCom).toEqual({ temperatura: 0 });
    expect(r.resultados[0].tentativas).toBe(2);
  });

  it("o juiz é read-only: tentar mexer no snapshot lança e vira FAIL", async () => {
    const juizMalandro: Juiz = (snap) => { (snap.saidas[0] as any).resposta = "hackeado"; return { fixture: "f1", pass: true, motivo: "" }; };
    const r = await rodarSuite(agente(() => boa), [fx], { juiz: juizMalandro, curar: false });
    expect(r.resultados[0].veredito.pass).toBe(false);
  });

  it("agente que explode não derruba a suite", async () => {
    const r = await rodarSuite({ nome: "x", rodar: async () => { throw new Error("gateway caiu"); } }, [fx]);
    expect(r.resultados[0].veredito.motivo).toMatch(/gateway caiu/);
    expect(r.status).toBe("vermelho");
  });

  it("drift contra a baseline de ontem", async () => {
    const r = await rodarSuite(agente(() => boa), [fx], { baselineTaxa: 1 });
    expect(r.drift).toBe(0);
    const pior = await rodarSuite(agente((a) => (a.temperatura === 0 ? boa : { ...boa, claims: [] })), [fx], { baselineTaxa: 1 });
    expect(pior.drift).toBe(1);
    expect(pior.status).toBe("vermelho");
  });

  it("rotina diária salva no store, usa a execução anterior como baseline e alerta", async () => {
    const store = new MemoryEvalStore();
    registrarAgente({ nome: "ruim", rodar: async () => ({ resposta: "sei lá", claims: [], tools: [] }) });
    const alertar = vi.fn(async () => {});
    await rotinaDiaria(store, { alertar });
    await rotinaDiaria(store, { alertar });
    expect(store.runs).toHaveLength(2);
    expect((await store.ultimos())[0].agente).toBe("ruim");
    expect(alertar).toHaveBeenCalledTimes(2);
    expect(SUITE_CANONICA.length).toBeGreaterThanOrEqual(4);
  });
});
