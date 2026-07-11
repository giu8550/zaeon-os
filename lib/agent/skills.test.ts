import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  validateSkill,
  skillsSystemPrompt,
  makeActivateSkillTool,
  parseMarketplaceJson,
  toSkillRecord,
} from "./skills";
import { runTool, type ToolContext } from "./runtime";

const VALID = `---
name: paper-lookup
description: Busca papers acadêmicos por consulta e devolve metadados.
license: MIT
version: 1.2.0
allowedTools: [literature_search, memory_search]
runtime: python
risk: read
minPlan: free
---
# Paper Lookup
Corpo da skill.`;

const ctx = { plan: "free", execMode: "auto" } as ToolContext;

describe("skills · parseFrontmatter", () => {
  it("extrai frontmatter + corpo; array inline", () => {
    const p = parseFrontmatter(VALID)!;
    expect(p.frontmatter.name).toBe("paper-lookup");
    expect(p.frontmatter.allowedTools).toEqual(["literature_search", "memory_search"]);
    expect(p.body).toMatch(/# Paper Lookup/);
  });
  it("sem frontmatter → null (YAML ausente)", () => {
    expect(parseFrontmatter("# só markdown")).toBeNull();
  });
  it("lista em bloco (- item)", () => {
    const p = parseFrontmatter(`---\nname: x\ndescription: y\ncourseTags:\n  - bio\n  - quimica\n---\nbody`)!;
    expect(p.frontmatter.courseTags).toEqual(["bio", "quimica"]);
  });
});

describe("skills · validateSkill (lenient/strict)", () => {
  it("skill válida → ok + manifest (version resolvida)", () => {
    const r = validateSkill(VALID, { dir: "paper-lookup" });
    expect(r.ok).toBe(true);
    expect(r.skill?.name).toBe("paper-lookup");
    expect(r.skill?.version).toBe("1.2.0");
    expect(r.errors).toHaveLength(0);
  });
  it("description vazia → REJEITA", () => {
    const r = validateSkill(`---\nname: ok-skill\ndescription: \n---\nb`);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/description/);
  });
  it("name inválido (maiúsc/espaço) → REJEITA", () => {
    const r = validateSkill(`---\nname: Paper Lookup\ndescription: ok\n---\nb`);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/name/);
  });
  it("YAML quebrado (sem ---) → REJEITA", () => {
    const r = validateSkill(`name: x\ndescription: y`);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/YAML/);
  });
  it("path traversal em allowedTools → REJEITA (segurança)", () => {
    const r = validateSkill(`---\nname: ok-skill\ndescription: d\nallowedTools: [../etc/passwd]\n---\nb`);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/traversal/);
  });
  it("name≠dir → aviso: lenient ACEITA, strict REJEITA", () => {
    const lenient = validateSkill(VALID, { dir: "outro-dir" });
    expect(lenient.ok).toBe(true);
    expect(lenient.warnings.join()).toMatch(/diret[óo]rio/);
    const strict = validateSkill(VALID, { dir: "outro-dir", mode: "strict" });
    expect(strict.ok).toBe(false);
  });
});

describe("skills · progressive disclosure", () => {
  it("system prompt só com name+description", () => {
    const s = skillsSystemPrompt([{ name: "a", description: "faz A" }]);
    expect(s).toMatch(/a: faz A/);
    expect(s).toMatch(/activate_skill/);
    expect(skillsSystemPrompt([])).toBe("");
  });
  it("activate_skill: conhecida → corpo; desconhecida → unknown_skill", async () => {
    const tool = makeActivateSkillTool(["paper-lookup"], (n) => (n === "paper-lookup" ? "CORPO DA SKILL" : null));
    const ok = await runTool(tool, { name: "paper-lookup" }, ctx);
    expect(ok.ok).toBe(true);
    expect(ok.findings?.[0].claim).toMatch(/CORPO/);
    const no = await runTool(tool, { name: "nope" }, ctx);
    expect(no.ok).toBe(false);
    expect(no.code).toBe("unknown_skill");
  });
});

describe("skills · catálogo + record", () => {
  it("parseMarketplaceJson aceita array e { skills }", () => {
    const a = parseMarketplaceJson([{ name: "x", source: "gh:o/r", version: "1", tags: ["t"] }]);
    expect(a[0].name).toBe("x");
    const b = parseMarketplaceJson({ skills: [{ name: "y", source: "gh:o/r" }] });
    expect(b[0].name).toBe("y");
    expect(parseMarketplaceJson({ nope: 1 })).toEqual([]);
  });
  it("toSkillRecord: version em metadata.version + envelope", () => {
    const r = toSkillRecord({ name: "paper-lookup", description: "d", version: "2.0.0", runtime: "python" });
    expect(r.metadata.version).toBe("2.0.0");
    expect(r.slug).toBe("paper-lookup");
    expect(r.runtime).toBe("python");
    expect(r.autoAuthored).toBe(false);
  });
});
