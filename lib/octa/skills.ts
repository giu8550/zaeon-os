/**
 * lib/octa/skills.ts — P5 do Pack Octa (§7/§8). As skills de terceiros do Octa, VENDORIZADAS e pinadas por
 * SHA (config/vetting/repos.json). Passam pelo mesmo validateSkill do pilar Skills e entram por
 * progressive disclosure (só name+description no prompt; o corpo via activate_skill).
 *
 *   - genart                      → arte generativa determinística (feature exclusiva do chat Octa)
 *   - appllama-app-design-skill   → telas mobile nativas (Expo/RN, HIG). Funciona SEM o MCP Appllama;
 *                                   o MCP é pago (portão do dono) e NÃO está ligado.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateSkill, makeActivateSkillTool, skillsSystemPrompt, type SkillManifest } from "@/lib/agent/skills";
import type { ToolDef } from "@/lib/agent/runtime";

export const OCTA_SKILLS = ["genart", "appllama-app-design-skill"] as const;
export type OctaSkill = (typeof OCTA_SKILLS)[number];

const RAIZ = join(process.cwd(), "vendor", "skills");

export async function carregarSkill(nome: OctaSkill): Promise<{ manifest: SkillManifest; corpo: string }> {
  const md = await readFile(join(RAIZ, nome, "SKILL.md"), "utf8");
  const v = validateSkill(md, { mode: "lenient", dir: nome });
  if (!v.ok || !v.skill) throw new Error(`skill ${nome} inválida: ${v.errors.join("; ")}`);
  const corpo = md.replace(/^---[\s\S]*?\n---\s*\n?/, "");
  return { manifest: v.skill, corpo };
}

/** Bloco do system prompt (só name+description) + a tool activate_skill que devolve o corpo sob demanda. */
export async function skillsDoOcta(): Promise<{ prompt: string; activate: ToolDef }> {
  const todas = await Promise.all(OCTA_SKILLS.map(carregarSkill));
  const prompt = skillsSystemPrompt(todas.map((s) => ({ name: s.manifest.name, description: s.manifest.description })));
  const corpos = new Map(todas.map((s) => [s.manifest.name, s.corpo]));
  return { prompt, activate: makeActivateSkillTool([...corpos.keys()], (n) => corpos.get(n) ?? null) };
}
