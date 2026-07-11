import { describe, it, expect } from "vitest";
import {
  permit,
  runTool,
  runToolByName,
  planAtLeast,
  type ToolDef,
  type ToolContext,
} from "./runtime";

// Gate do PR03: `runTool` NUNCA lança + `permit` nega por padrão quando o plano não cobre minPlan.
const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({ plan: "free", execMode: "auto", ...over });
const def = (over: Partial<ToolDef> = {}): ToolDef => ({
  name: "t",
  runtime: "ts",
  risk: "read",
  minPlan: "free",
  schema: { name: "t", parameters: { type: "OBJECT" as any, properties: {} } } as any,
  async run() { return { ok: true, provenance: {} }; },
  ...over,
});

describe("runtime · planAtLeast", () => {
  it("ordena free<plus<pro<max (undefined = free)", () => {
    expect(planAtLeast("free", "free")).toBe(true);
    expect(planAtLeast("free", "pro")).toBe(false);
    expect(planAtLeast("max", "pro")).toBe(true);
    expect(planAtLeast(undefined, "plus")).toBe(false);
  });
});

describe("runtime · permit (deny-by-default)", () => {
  it("nega quando o plano não cobre minPlan", () => {
    expect(permit(def({ minPlan: "pro" }), ctx({ plan: "free" }))).toBe("DENY");
    expect(permit(def({ minPlan: "pro" }), ctx({ plan: "max" }))).toBe("ALLOW");
  });
  it("destrutivo e GPU-por-demanda pedem aprovação", () => {
    expect(permit(def({ risk: "destructive" }), ctx())).toBe("REQUIRE_APPROVAL");
    expect(permit(def({ demandGpu: true }), ctx({ plan: "max" }))).toBe("REQUIRE_APPROVAL");
    expect(permit(def({ demandGpu: true }), ctx({ plan: "max", gpuAvailable: true }))).toBe("ALLOW");
  });
  it("guiado sobe write pra aprovação; auto libera leitura/geração", () => {
    expect(permit(def({ risk: "write" }), ctx({ execMode: "auto" }))).toBe("ALLOW");
    expect(permit(def({ risk: "write" }), ctx({ execMode: "guiado" }))).toBe("REQUIRE_APPROVAL");
    expect(permit(def({ risk: "read" }), ctx({ execMode: "guiado" }))).toBe("ALLOW");
  });
});

describe("runtime · runTool (nunca lança)", () => {
  const boom = def({ name: "boom", async run() { throw new Error("estourei"); } });

  it("tool que estoura → {ok:false,error} (não propaga a exceção)", async () => {
    const r = await runTool(boom, {}, ctx());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/estourei/);
    expect(r.code).toBe("tool_error");
  });
  it("DENY por plano → {ok:false, code:tool_denied} sem chamar run()", async () => {
    const r = await runTool(def({ minPlan: "pro", async run() { throw new Error("não deveria rodar"); } }), {}, ctx({ plan: "free" }));
    expect(r.ok).toBe(false);
    expect(r.code).toBe("tool_denied");
  });
  it("REQUIRE_APPROVAL sem aprovador → needs_approval", async () => {
    const r = await runTool(def({ risk: "destructive" }), {}, ctx());
    expect(r.ok).toBe(false);
    expect(r.code).toBe("needs_approval");
  });
  it("REQUIRE_APPROVAL com aprovador true → roda", async () => {
    const r = await runTool(def({ risk: "destructive" }), {}, ctx(), { approve: async () => true });
    expect(r.ok).toBe(true);
  });
  it("resultado sem provenance é normalizado (contrato garantido)", async () => {
    const r = await runTool(def({ async run() { return { ok: true } as any; } }), {}, ctx());
    expect(r.ok).toBe(true);
    expect(r.provenance).toBeTruthy();
  });
});

describe("runtime · registry + tools Fase 0", () => {
  it("studio_generate devolve StudioRef normalizado", async () => {
    const r = await runToolByName("studio_generate", { kind: "mapa mental", topic: "fotossíntese" }, ctx());
    expect(r.ok).toBe(true);
    expect(r.artifact?.studioKind).toBe("mindmap");
    expect(r.artifact?.title).toMatch(/fotossíntese/);
  });
  it("research_generate exige tema", async () => {
    const vazio = await runToolByName("research_generate", { kind: "artigo" }, ctx());
    expect(vazio.ok).toBe(false);
    expect(vazio.code).toBe("missing_topic");
    const ok = await runToolByName("research_generate", { kind: "tcc", topic: "IA na educação" }, ctx());
    expect(ok.ok).toBe(true);
    expect(ok.artifact?.title).toMatch(/^TCC:/);
  });
  it("memory_search é stub memory_unavailable — free, nunca DENY por plano", async () => {
    const r = await runToolByName("memory_search", { query: "x" }, ctx({ plan: "free" }));
    expect(r.ok).toBe(false);
    expect(r.code).toBe("memory_unavailable");
  });
  it("tool desconhecida → unknown_tool (deny-by-default)", async () => {
    const r = await runToolByName("does_not_exist", {}, ctx());
    expect(r.ok).toBe(false);
    expect(r.code).toBe("unknown_tool");
  });
});
