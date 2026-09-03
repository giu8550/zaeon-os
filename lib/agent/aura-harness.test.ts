import { describe, it, expect, vi } from "vitest";
import {
  buildHarnessDeps,
  pickStudioKind,
  normalizeAnswer,
  renderStructuredAnswer,
  resolveHarnessOutput,
  isRetryableCode,
} from "./aura-harness";
import { INTENTS, type StructuredAnswer } from "./contracts";
import type { ToolContext } from "./runtime";
import { runTrajectoryTraced, type TrajectoryState } from "./trajectory";

const ctx: ToolContext = { activeTab: "estudos", plan: "free", execMode: "auto" };

// genJson "esperto" — devolve a forma certa por fase (subquestions/reasoning/draft), sem rede.
// Assinatura completa (3 params, Promise<any>) p/ ser atribuível a GenJson.
const smartGen = () =>
  vi.fn(async (system: string, _user?: string, _opts?: any): Promise<any> => {
    if (/subquestions/i.test(system)) return { subquestions: ["q1", "q2"] };
    if (/reasoning/i.test(system)) return { reasoning: "R" };
    return { nucleo: "N", conceitos: ["c"], proximos_passos: ["p"] };
  });

const stFor = (over: Partial<TrajectoryState> = {}): TrajectoryState =>
  ({
    objective: "explique entropia",
    intent: "explicar_conceito",
    mode: "elaborated",
    academicMode: "flexible",
    spec: INTENTS.explicar_conceito,
    iter: 1,
    evidence: [],
    artifacts: [],
    reasoning: "",
    ...over,
  }) as TrajectoryState;

describe("aura-harness · A2 retry (só nesta camada)", () => {
  it("retenta 1x em tool_timeout e sucede", async () => {
    const runToolImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "tool_timeout", provenance: {} })
      .mockResolvedValueOnce({ ok: true, findings: [], provenance: {} });
    const deps = buildHarnessDeps(ctx, { genJson: smartGen(), runToolImpl, retryDelayMs: 0 });
    const res = await deps.runTool("literature_search", { query: "x" }, ctx);
    expect(res.ok).toBe(true);
    expect(runToolImpl).toHaveBeenCalledTimes(2);
  });

  it("NÃO retenta tool_denied (nem validação)", async () => {
    const runToolImpl = vi.fn().mockResolvedValue({ ok: false, code: "tool_denied", provenance: {} });
    const deps = buildHarnessDeps(ctx, { genJson: smartGen(), runToolImpl, retryDelayMs: 0 });
    const res = await deps.runTool("studio_generate", {}, ctx);
    expect(res.ok).toBe(false);
    expect(runToolImpl).toHaveBeenCalledTimes(1);
  });

  it("isRetryableCode: só timeout/network/rate", () => {
    expect(isRetryableCode("tool_timeout")).toBe(true);
    expect(isRetryableCode("network")).toBe(true);
    expect(isRetryableCode("rate_limited")).toBe(true);
    expect(isRetryableCode("tool_denied")).toBe(false);
    expect(isRetryableCode(undefined)).toBe(false);
  });
});

describe("aura-harness · A1 erro-como-observação", () => {
  it("falha de tool entra no prompt do draft seguinte", async () => {
    const genJson = smartGen();
    const runToolImpl = vi.fn().mockResolvedValue({ ok: false, code: "skill_offline", provenance: {} });
    const deps = buildHarnessDeps(ctx, { genJson, runToolImpl, retryDelayMs: 0 });
    await deps.runTool("literature_search", { query: "x" }, ctx); // registra observação
    await deps.draft(stFor());
    // o user-prompt do draft menciona a ferramenta que falhou ("Campos obrigatórios" é único do draft)
    const draftCall = genJson.mock.calls.find((c) => /Campos obrigat/i.test(String(c[0])));
    expect(draftCall).toBeTruthy();
    expect(String(draftCall![1])).toMatch(/literature_search/);
    expect(String(draftCall![1])).toMatch(/FALHARAM/);
  });

  it("draft resiliente: genJson estoura → nucleo amigável via messageForError (não erro cru)", async () => {
    const genJson = vi.fn(async () => { throw new Error("fetch failed ECONNREFUSED"); });
    const deps = buildHarnessDeps(ctx, { genJson, runToolImpl: vi.fn(), retryDelayMs: 0 });
    const answer = await deps.draft(stFor());
    expect(answer.nucleo).toMatch(/conex[ãa]o/i);
    expect(answer.nucleo).not.toMatch(/ECONNREFUSED/);
  });
});

describe("aura-harness · plan", () => {
  it("gerar_artefato → 1 step studio_generate com kind inferido", async () => {
    const deps = buildHarnessDeps(ctx, { genJson: smartGen() });
    const steps = await deps.plan(stFor({ intent: "gerar_artefato", mode: "elaborated", objective: "cria um mapa mental de fotossíntese" }));
    expect(steps).toHaveLength(1);
    expect(steps[0].tool).toBe("studio_generate");
    expect(steps[0].args.kind).toBe("mindmap");
  });

  it("criar_trabalho research → A6 sub-perguntas × tools de coleta", async () => {
    const genJson = smartGen();
    const deps = buildHarnessDeps(ctx, { genJson });
    const steps = await deps.plan(stFor({ intent: "criar_trabalho", mode: "research", academicMode: "enforced", spec: INTENTS.criar_trabalho, objective: "artigo sobre X" }));
    // gather tools de criar_trabalho = literature_search + memory_search; 2 sub-perguntas → 4 steps
    expect(steps.length).toBe(4);
    expect(steps.every((s) => s.tool === "literature_search" || s.tool === "memory_search")).toBe(true);
  });
});

describe("aura-harness · helpers puros", () => {
  it("pickStudioKind reconhece os kinds", () => {
    expect(pickStudioKind("faz um mapa mental disso")).toBe("mindmap");
    expect(pickStudioKind("gera flashcards")).toBe("flashcards");
    expect(pickStudioKind("cria um podcast")).toBe("podcast");
    expect(pickStudioKind("me explica isso")).toBe("guide"); // default
  });

  it("normalizeAnswer garante nucleo e coage arrays", () => {
    const a = normalizeAnswer({ conceitos: "x" as any }, stFor());
    expect(typeof a.nucleo).toBe("string");
    expect(a.nucleo.length).toBeGreaterThan(0);
    expect(Array.isArray(a.conceitos)).toBe(true);
  });

  it("renderStructuredAnswer inclui as seções preenchidas", () => {
    const a: StructuredAnswer = {
      nucleo: "núcleo",
      conceitos: ["A", "B"],
      proximos_passos: ["passo"],
      sources: [{ title: "Fonte", url: "http://x" }],
    };
    const txt = renderStructuredAnswer(a);
    expect(txt).toMatch(/núcleo/);
    expect(txt).toMatch(/Conceitos-chave/);
    expect(txt).toMatch(/Fontes/);
    expect(txt).toMatch(/Próximos passos/);
  });
});

describe("aura-harness · resolveHarnessOutput (protocolo do cliente)", () => {
  const base = { intent: "explicar_conceito", kind: undefined, artifacts: [] } as any;

  it("sem artefato → structured carregando o answer inteiro (render rico no cliente)", () => {
    const out = resolveHarnessOutput(base, { nucleo: "oi", conceitos: ["a"] }, "estudos", "obj");
    expect(out.mode).toBe("structured");
    if (out.mode === "structured") { expect(out.answer.nucleo).toBe("oi"); expect(out.answer.conceitos).toEqual(["a"]); }
  });

  it("explicar_conceito COM artefato → structured preservando artifacts[] (texto + artefato inline)", () => {
    const answer: StructuredAnswer = { nucleo: "N", artifacts: [{ studioKind: "image", title: "img" }] };
    const out = resolveHarnessOutput({ intent: "explicar_conceito", artifacts: answer.artifacts } as any, answer, "estudos", "obj");
    expect(out.mode).toBe("structured");
    if (out.mode === "structured") expect(out.answer.artifacts?.[0]?.studioKind).toBe("image");
  });

  it("artifacts só no state (answer sem o campo) → structured os herda", () => {
    const out = resolveHarnessOutput({ intent: "explicar_conceito", artifacts: [{ studioKind: "mindmap" }] } as any, { nucleo: "N" }, "estudos", "obj");
    expect(out.mode).toBe("structured");
    if (out.mode === "structured") expect(out.answer.artifacts?.[0]?.studioKind).toBe("mindmap");
  });

  it("artefato studio → sentinela studio (topic = objetivo)", () => {
    const answer: StructuredAnswer = { nucleo: "gerando", artifacts: [{ studioKind: "mindmap", title: "mapa" }] };
    const out = resolveHarnessOutput({ intent: "gerar_artefato", artifacts: answer.artifacts } as any, answer, "estudos", "mapa de X");
    expect(out.mode).toBe("studio");
    if (out.mode === "studio") { expect(out.kind).toBe("mindmap"); expect(out.topic).toBe("mapa de X"); }
  });

  it("criar_trabalho na pesquisa → sentinela research", () => {
    const out = resolveHarnessOutput({ intent: "criar_trabalho", kind: "tcc", artifacts: [] } as any, { nucleo: "gerando" }, "pesquisa", "faz um tcc sobre X");
    expect(out.mode).toBe("research");
    if (out.mode === "research") expect(out.kind).toBe("tcc");
  });
});

describe("aura-harness · integração motor+adaptador (ponta-a-ponta, sem rede)", () => {
  // classify é sobrescrito p/ não bater na rede (o router real cairia no fallback, mas com latência).
  it("explicar_conceito → runTrajectory → saída estruturada", async () => {
    const runToolImpl = vi.fn(async () => ({ ok: true, findings: [{ claim: "f", source: { title: "S" }, confidence: "alta" as const }], provenance: {} }));
    const deps = buildHarnessDeps(ctx, { genJson: smartGen(), runToolImpl, retryDelayMs: 0 });
    deps.classify = async () => ({ intent: "explicar_conceito", mode: "elaborated", academicMode: "flexible" });
    const { answer, state } = await runTrajectoryTraced("explique entropia", ctx, deps);
    expect(answer.nucleo).toBeTruthy();
    expect(answer.provenance?.intent).toBe("explicar_conceito");
    // sem artefato, o harness entrega o StructuredAnswer inteiro (render rico no cliente)
    expect(resolveHarnessOutput(state, answer, "estudos", "explique entropia").mode).toBe("structured");
  });

  it("gerar_artefato → runTrajectory (studio_generate real) → sentinela studio", async () => {
    const deps = buildHarnessDeps(ctx, { genJson: smartGen(), retryDelayMs: 0 });
    deps.classify = async () => ({ intent: "gerar_artefato", mode: "elaborated", academicMode: "flexible" });
    const { answer, state } = await runTrajectoryTraced("cria um mapa mental de fotossíntese", ctx, deps);
    const out = resolveHarnessOutput(state, answer, "estudos", "cria um mapa mental de fotossíntese");
    expect(out.mode).toBe("studio");
    if (out.mode === "studio") expect(out.kind).toBe("mindmap");
  });
});
