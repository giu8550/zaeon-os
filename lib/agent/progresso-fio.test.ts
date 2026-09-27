/**
 * O teste da COSTURA: trajetória real → serialização real → parser real.
 *
 * Os testes de `progresso.test.ts` provam o protocolo isolado. Este prova o que de fato
 * quebrava: o harness narrava, ninguém escutava. Aqui a narração passa pelo mesmo fio
 * que o route usa e chega do outro lado como o chat a lê — sem HTTP, sem modelo, mas com
 * o LAÇO DE VERDADE no meio. Se alguém desligar o `emit` de novo, isto cai.
 */
import { describe, it, expect, vi } from "vitest";
import { runTrajectoryTraced, type HarnessDeps } from "./trajectory";
import type { ExaminerVerdict, StructuredAnswer } from "./contracts";
import type { RouterResult } from "./router";
import type { AgentContext } from "./context";
import { serializarProgresso, separarProgresso, faseCorrente } from "./progresso";

const ctx: AgentContext = { activeTab: "estudos" };
const verdict = (over: Partial<ExaminerVerdict> = {}): ExaminerVerdict => ({
  soundness: 8, contribution: 7, score: 9, decision: "aprovado",
  rubric: {}, evidenceLevel: 3, integrity: [], issues: [], ...over,
});

/**
 * O fio. Reproduz o que `app/api/ai/chat/route.ts` faz: cada `emit` vira um chunk no
 * stream, e no fim vem a sentinela com a resposta.
 */
function fio(over: Partial<HarnessDeps> = {}) {
  let wire = "";
  const deps: HarnessDeps = {
    classify: async (): Promise<RouterResult> => ({ intent: "explicar_conceito", mode: "elaborated", academicMode: "flexible" }),
    plan: async () => [{ tool: "memory_search", args: { query: "x" } }],
    runTool: async () => ({ ok: true, findings: [{ claim: "f", source: { title: "S" }, confidence: "alta" }], provenance: {} }),
    reason: async () => "porque sim",
    draft: vi.fn(async (): Promise<StructuredAnswer> => ({ nucleo: "A cafeína bloqueia a adenosina." })),
    critique: async () => verdict(),
    // ISTO é o que o route passa agora e não passava antes.
    emit: (step) => {
      if (step.kind !== "say") return;
      const rotulo = String(step.label ?? "").trim();
      if (rotulo) wire += serializarProgresso({ fase: String(step.detail ?? ""), rotulo });
    },
    persistMemory: async () => {},
    ...over,
  };
  return { deps, fim: () => wire, comResposta: (a: StructuredAnswer) => wire + "@@STRUCTURED@@" + JSON.stringify(a) };
}

describe("a trajetória narra e o cliente escuta", () => {
  it("um turno elaborated entrega as fases na ordem em que aconteceram", async () => {
    const f = fio();
    await runTrajectoryTraced("por que o café tira o sono?", ctx, f.deps);
    const { eventos } = separarProgresso(f.fim());
    expect(eventos.map((e) => e.fase)).toEqual(
      ["route", "plan", "gather", "reason", "draft", "critique", "finalize"],
    );
  });

  it("todo rótulo que chega na tela é texto humano, nunca o nome interno da fase", async () => {
    const f = fio();
    await runTrajectoryTraced("explica isso", ctx, f.deps);
    const { eventos } = separarProgresso(f.fim());
    expect(eventos.length).toBeGreaterThan(0);
    for (const e of eventos) {
      expect(e.rotulo).not.toBe(e.fase);
      expect(e.rotulo).toMatch(/[a-záéíóúâêôãõç]/i);
    }
    expect(eventos.map((e) => e.rotulo)).toContain("Redigindo");
  });

  it("o turno quick também narra — resposta curta não é motivo pra tela muda", async () => {
    const f = fio({ classify: async () => ({ intent: "duvida_rapida", mode: "quick", academicMode: "flexible" }) });
    await runTrajectoryTraced("quanto é 2+2?", ctx, f.deps);
    const { eventos } = separarProgresso(f.fim());
    expect(eventos.map((e) => e.fase)).toEqual(["route", "draft", "finalize"]);
  });

  it("a revisão aparece como segunda passada, não some", async () => {
    // O PIOR caso pro aluno, e por isso o que mais precisa narrar: `criar_trabalho` é o
    // único intent com maxRevisions 2 (contracts.ts) — o crítico reprova, o laço inteiro
    // recomeça, e até aqui a tela seguia morta durante as duas passadas.
    let n = 0;
    const f = fio({
      classify: async (): Promise<RouterResult> => ({ intent: "criar_trabalho", mode: "research", academicMode: "enforced", kind: "artigo" }),
      critique: async () => (++n === 1 ? verdict({ score: 3, decision: "revisar" }) : verdict()),
      draft: vi.fn(async () => ({ nucleo: `tentativa ${n}` })),
    });
    await runTrajectoryTraced("escreve um artigo sobre cafeína", ctx, f.deps);
    const { eventos } = separarProgresso(f.fim());
    expect(eventos.filter((e) => e.fase === "draft").length).toBe(2);
    expect(eventos.filter((e) => e.fase === "critique").length).toBe(2);
    // E a fase que fica na tela no fim é a última de verdade, não a primeira.
    expect(faseCorrente(eventos)?.fase).toBe("finalize");
  });

  it("a resposta atravessa o fio intacta, com o progresso na frente", async () => {
    const f = fio();
    const { answer } = await runTrajectoryTraced("por que o café tira o sono?", ctx, f.deps);
    const { limpo, eventos } = separarProgresso(f.comResposta(answer));
    expect(eventos.length).toBeGreaterThan(0);
    // O que sobra é EXATAMENTE o payload: nenhum resto de protocolo virou texto.
    expect(limpo.startsWith("@@STRUCTURED@@")).toBe(true);
    expect(JSON.parse(limpo.slice("@@STRUCTURED@@".length)).nucleo).toBe("A cafeína bloqueia a adenosina.");
  });

  it("chunk a chunk, a fase corrente só anda pra frente e nunca vaza texto", async () => {
    // Simula a leitura do stream byte a byte — é onde meia-sentinela apareceria.
    const f = fio();
    const { answer } = await runTrajectoryTraced("tema", ctx, f.deps);
    const total = f.comResposta(answer);
    let acc = "";
    const vistas: string[] = [];
    for (const ch of total) {
      acc += ch;
      const { limpo, eventos } = separarProgresso(acc);
      expect(limpo).not.toContain("@@PROGRESS@@");
      const atual = faseCorrente(eventos);
      if (atual && vistas[vistas.length - 1] !== atual.rotulo) vistas.push(atual.rotulo);
    }
    expect(vistas).toEqual(["Entendendo o pedido", "Planejando a resposta", "Reunindo evidências",
                            "Raciocinando", "Redigindo", "Revisando criticamente", "Finalizando"]);
  });
});
