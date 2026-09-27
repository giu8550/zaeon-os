/**
 * lib/agent/skills.ts — PILAR SKILLS · marketplace core (PASSO 9). Fiel ao spec agentskills.io.
 *
 * - Parse do SKILL.md (frontmatter YAML mínimo + corpo markdown) SEM dep externa.
 * - Validação na instalação (lenient/strict): rejeita SÓ os erros duros (description vazia, YAML
 *   quebrado, name inválido, path traversal); AVISA (aceita) name≠dir e corpo grande.
 * - Progressive disclosure: só name+description entram no system prompt; `activate_skill(name)`
 *   devolve o corpo sob demanda.
 * - Catálogo no formato marketplace.json (name/source/version/category/tags).
 * Envelope Zaeon exportável em metadata.zaeon-* → a skill exportada continua spec-válida.
 */
import type { ToolDef } from "@/lib/agent/runtime";

export const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_NAME = 64;
export const MAX_DESC = 1024;
export const MAX_BODY = 50_000;

export type SkillRuntime = "ts" | "python" | "mcp";
export type SkillRisk = "read" | "write" | "destructive";

export type SkillManifest = {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  version?: string;
  allowedTools?: string[];
  // envelope Zaeon
  runtime?: SkillRuntime;
  risk?: SkillRisk;
  minPlan?: string;
  tier?: string;
  courseTags?: string[];
  defaultOn?: boolean;
  metadata?: Record<string, unknown>;
};

export type ParsedSkill = { frontmatter: Record<string, any>; body: string };
export type ValidationResult = { ok: boolean; errors: string[]; warnings: string[]; skill?: SkillManifest };

// ───────────────────────────── parse do SKILL.md (YAML mínimo) ─────────────────────────────
function parseScalar(val: string): any {
  if (/^\[.*\]$/.test(val)) {
    return val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  const unq = val.replace(/^["']|["']$/g, "");
  if (unq === "true") return true;
  if (unq === "false") return false;
  return unq;
}

/** Extrai frontmatter (--- ... ---) + corpo. `null` = ausente/quebrado. */
export function parseFrontmatter(md: string): ParsedSkill | null {
  const s = (md ?? "").replace(/^﻿/, "");
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(s);
  if (!m) return null;
  const fmRaw = m[1];
  const body = m[2] ?? "";
  const fm: Record<string, any> = {};
  const lines = fmRaw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) { i++; continue; }
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) return null; // linha inválida → YAML quebrado
    const key = kv[1];
    const val = kv[2].trim();
    if (val === "") {
      // pode ser uma lista em bloco (- item)
      const list: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        list.push(lines[j].replace(/^\s*-\s+/, "").trim().replace(/^["']|["']$/g, ""));
        j++;
      }
      fm[key] = list.length ? list : "";
      i = j;
      continue;
    }
    fm[key] = parseScalar(val);
    i++;
  }
  return { frontmatter: fm, body };
}

function toManifest(fm: Record<string, any>): SkillManifest {
  const meta = (fm.metadata && typeof fm.metadata === "object") ? fm.metadata : undefined;
  const asArr = (v: any): string[] | undefined => (Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? [v] : undefined);
  return {
    name: String(fm.name),
    description: String(fm.description),
    license: fm.license ? String(fm.license) : undefined,
    compatibility: fm.compatibility ? String(fm.compatibility) : undefined,
    version: fm.version ? String(fm.version) : (meta?.version ? String(meta.version) : undefined),
    allowedTools: asArr(fm.allowedTools ?? fm["allowed-tools"]),
    runtime: fm.runtime,
    risk: fm.risk,
    minPlan: fm.minPlan ? String(fm.minPlan) : undefined,
    tier: fm.tier ? String(fm.tier) : undefined,
    courseTags: asArr(fm.courseTags),
    defaultOn: fm.defaultOn === true,
    metadata: meta,
  };
}

const hasTraversal = (v: unknown): boolean => typeof v === "string" && (/(\.\.[\/\\])/.test(v) || /^\//.test(v) || /^[A-Za-z]:[\/\\]/.test(v));

/**
 * Valida a instalação. `strict` promove os avisos a erros (rejeita); `lenient` aceita com avisos.
 * Erros DUROS (rejeitam em qualquer modo): YAML quebrado, name ausente/inválido, description vazia,
 * path traversal. Avisos (aceitos em lenient): name≠dir, description/corpo grandes.
 */
export function validateSkill(md: string, opts: { mode?: "lenient" | "strict"; dir?: string } = {}): ValidationResult {
  const mode = opts.mode ?? "lenient";
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = parseFrontmatter(md);
  if (!parsed) return { ok: false, errors: ["frontmatter YAML ausente ou quebrado (esperado bloco --- ... ---)"], warnings };

  const fm = parsed.frontmatter;
  const name = typeof fm.name === "string" ? fm.name.trim() : "";
  const description = typeof fm.description === "string" ? fm.description.trim() : "";

  if (!name) errors.push("campo obrigatório 'name' ausente");
  else if (name.length > MAX_NAME) errors.push(`'name' excede ${MAX_NAME} caracteres`);
  else if (!NAME_RE.test(name)) errors.push("'name' inválido — use ^[a-z0-9]+(-[a-z0-9]+)*$ (minúsculas, dígitos, hífens)");

  if (!description) errors.push("campo obrigatório 'description' vazio");

  const tools = Array.isArray(fm.allowedTools) ? fm.allowedTools : [];
  if (hasTraversal(name) || tools.some(hasTraversal) || /\.\.[\/\\]/.test(parsed.body)) {
    errors.push("path traversal detectado (../ ou caminho absoluto) — rejeitado por segurança");
  }

  if (description.length > MAX_DESC) warnings.push(`'description' > ${MAX_DESC} caracteres`);
  if (opts.dir && name && opts.dir !== name) warnings.push(`name ("${name}") ≠ diretório ("${opts.dir}")`);
  if (parsed.body.length > MAX_BODY) warnings.push("corpo do SKILL.md muito grande");

  const ok = errors.length === 0 && !(mode === "strict" && warnings.length > 0);
  return { ok, errors, warnings, skill: ok ? toManifest(fm) : undefined };
}

// ───────────────────────────── progressive disclosure ─────────────────────────────
/** Só name+description das skills instaladas entram no system prompt (economiza tokens). */
export function skillsSystemPrompt(skills: { name: string; description: string }[]): string {
  if (!skills.length) return "";
  return (
    "Skills instaladas (chame activate_skill(name) p/ carregar o conteúdo sob demanda):\n" +
    skills.map((s) => `- ${s.name}: ${s.description}`).join("\n")
  );
}

/** A tool `activate_skill(name: enum)` — devolve o corpo (SKILL.md) sob demanda. */
export function makeActivateSkillTool(names: string[], getBody: (name: string) => Promise<string | null> | string | null): ToolDef {
  return {
    name: "activate_skill",
    runtime: "ts",
    risk: "read",
    minPlan: "free",
    schema: {
      name: "activate_skill",
      description: "Carrega o conteúdo (SKILL.md) de uma skill instalada, sob demanda.",
      parameters: {
        type: "OBJECT" as any,
        properties: { name: { type: "STRING" as any, description: "nome da skill a ativar", enum: names } as any },
        required: ["name"],
      },
    } as any,
    async run(args) {
      const name = String(args?.name ?? "");
      if (!names.includes(name)) return { ok: false, error: `skill desconhecida: ${name}`, code: "unknown_skill", provenance: {} };
      const body = await getBody(name);
      if (!body) return { ok: false, error: "skill sem conteúdo", code: "empty", provenance: {} };
      return { ok: true, findings: [{ claim: String(body).slice(0, 20_000), confidence: "alta" }], provenance: { toolsUsed: ["activate_skill"], at: new Date().toISOString() } };
    },
  };
}

// ───────────────────────────── catálogo (marketplace.json) ─────────────────────────────
export type CatalogSkill = { name: string; source: string; version?: string; category?: string; tags?: string[] };

/** Lê um marketplace.json (array OU { skills: [...] }) → catálogo tipado. */
export function parseMarketplaceJson(json: unknown): CatalogSkill[] {
  const arr: any[] = Array.isArray(json) ? json : Array.isArray((json as any)?.skills) ? (json as any).skills : [];
  return arr
    .filter((e) => e && typeof e.name === "string" && typeof e.source === "string")
    .map((e) => ({ name: e.name, source: e.source, version: e.version, category: e.category, tags: Array.isArray(e.tags) ? e.tags : [] }));
}

/** Manifesto → registro de persistência (envelope + version em metadata.version). */
export function toSkillRecord(skill: SkillManifest, source?: { repo?: string; sha?: string }) {
  return {
    slug: skill.name,
    name: skill.name,
    description: skill.description,
    license: skill.license ?? null,
    compatibility: skill.compatibility ?? null,
    allowedTools: skill.allowedTools ?? [],
    runtime: skill.runtime ?? "ts",
    risk: skill.risk ?? "read",
    minPlan: skill.minPlan ?? "free",
    tier: skill.tier ?? null,
    courseTags: skill.courseTags ?? [],
    defaultOn: skill.defaultOn ?? false,
    sourceRepo: source?.repo ?? null,
    sourceSha: source?.sha ?? null,
    autoAuthored: false,
    metadata: { ...(skill.metadata ?? {}), version: skill.version ?? (skill.metadata as any)?.version },
  };
}
