import { describe, it, expect } from "vitest";
import type { ToolDef, ToolContext } from "@/lib/agent/runtime";
import { octaPermit, commitGuard, newTaskState, inFileLock, normalizePath, type OctaTask } from "./guard";
import { detectShit } from "./shit";

const ctx: ToolContext = { plan: "free", execMode: "auto" };
const def = (over: Partial<ToolDef> = {}): ToolDef => ({
  name: "edit_file", runtime: "ts", risk: "write", minPlan: "free",
  schema: { name: "edit_file" } as any, async run() { return { ok: true, provenance: {} }; }, ...over,
});
const task = (over: Partial<OctaTask> = {}): OctaTask => ({ id: "t1", mode: "change", fileLock: ["lib/octa/**", "app/page.tsx"], ...over });

describe("octa · guard (§2)", () => {
  it("em review, edit é negado com MODE_FORBIDS_MUTATION", () => {
    const d = octaPermit(def(), { path: "lib/octa/x.ts" }, ctx, task({ mode: "review" }), newTaskState());
    expect(d).toMatchObject({ gate: "DENY", reason: "MODE_FORBIDS_MUTATION" });
  });
  it("em review, leitura passa", () => {
    expect(octaPermit(def({ risk: "read", name: "read_file" }), { path: "x" }, ctx, task({ mode: "review" }), newTaskState()).gate).toBe("ALLOW");
  });
  it("escrita fora do file-lock é negada; dentro passa", () => {
    expect(octaPermit(def(), { path: "lib/agent/runtime.ts" }, ctx, task(), newTaskState())).toMatchObject({ gate: "DENY", reason: "OUTSIDE_FILE_LOCK" });
    expect(octaPermit(def(), { path: "lib/octa/a/b.ts" }, ctx, task(), newTaskState()).gate).toBe("ALLOW");
    expect(octaPermit(def(), { paths: ["app/page.tsx", "lib/octa/z.ts"] }, ctx, task(), newTaskState()).gate).toBe("ALLOW");
    expect(octaPermit(def(), { paths: ["app/page.tsx", "README.md"] }, ctx, task(), newTaskState()).reason).toBe("OUTSIDE_FILE_LOCK");
  });
  it("traversal, absoluto e escrita sem path são negados", () => {
    expect(octaPermit(def(), { path: "lib/octa/../../etc/passwd" }, ctx, task(), newTaskState()).reason).toBe("PATH_NOT_ALLOWED");
    expect(octaPermit(def(), { path: "/etc/passwd" }, ctx, task(), newTaskState()).reason).toBe("PATH_NOT_ALLOWED");
    expect(octaPermit(def(), {}, ctx, task(), newTaskState()).reason).toBe("MUTATION_WITHOUT_PATH");
  });
  it("file-lock vazio em change = nada gravável", () => {
    expect(octaPermit(def(), { path: "a.ts" }, ctx, task({ fileLock: [] }), newTaskState()).reason).toBe("OUTSIDE_FILE_LOCK");
  });
  it("orçamento de subagentes", () => {
    const sub = def({ name: "spawn_subagent", risk: "read" });
    const st = newTaskState();
    const t = task({ subagentBudget: 1 });
    expect(octaPermit(sub, {}, ctx, t, st).gate).toBe("ALLOW");
    commitGuard(sub, st);
    expect(octaPermit(sub, {}, ctx, t, st).reason).toBe("SUBAGENT_BUDGET_EXCEEDED");
  });
  it("destrutivo ainda pede aprovação dentro do lock", () => {
    expect(octaPermit(def({ risk: "destructive" }), { path: "lib/octa/x" }, ctx, task(), newTaskState()).gate).toBe("REQUIRE_APPROVAL");
  });
  it("glob e normalização", () => {
    expect(normalizePath("./a//b/./c")).toBe("a/b/c");
    expect(inFileLock("lib/octa/x.ts", ["lib/*/x.ts"])).toBe(true);
    expect(inFileLock("lib/octa/deep/x.ts", ["lib/*/x.ts"])).toBe(false);
    expect(inFileLock("lib/octa", ["lib/octa/**"])).toBe(false);
  });
});

describe("octa · SHIT (§2)", () => {
  it("scope-creep sintético é sinalizado", () => {
    const f = detectShit(task(), [{ tool: "edit_file", mutates: true, path: "lib/agent/runtime.ts" }]);
    expect(f.map((x) => x.kind)).toContain("scope_creep");
  });
  it("review que tenta editar = intent_violation", () => {
    const f = detectShit(task({ mode: "review" }), [{ tool: "edit_file", mutates: true, path: "lib/octa/x.ts", denied: true }]);
    expect(f.map((x) => x.kind)).toEqual(["intent_violation"]);
  });
  it("guard sem consumidor = hypothetical_hardening; com consumidor, não", () => {
    const sem = detectShit(task(), [{ tool: "edit_file", mutates: true, path: "lib/octa/x.ts", added: ["validateSeed"] }]);
    expect(sem.map((x) => x.kind)).toContain("hypothetical_hardening");
    const com = detectShit(task(), [
      { tool: "edit_file", mutates: true, path: "lib/octa/x.ts", added: ["validateSeed"] },
      { tool: "edit_file", mutates: true, path: "lib/octa/y.ts", uses: ["validateSeed"] },
    ]);
    expect(com.map((x) => x.kind)).not.toContain("hypothetical_hardening");
  });
  it("A→B→A no mesmo arquivo = task_thrashing", () => {
    const e = (h: string) => ({ tool: "edit_file", mutates: true, path: "lib/octa/x.ts", contentHash: h });
    expect(detectShit(task(), [e("A"), e("B"), e("A")]).map((x) => x.kind)).toContain("task_thrashing");
    expect(detectShit(task(), [e("A"), e("B")])).toEqual([]);
  });
});
