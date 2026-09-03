import { describe, it, expect } from "vitest";
import {
  MENTOR_SEED,
  BASE_MENTOR,
  ALL_MENTOR_SKILLS,
  mentorBySlug,
  mentorPersonaText,
  mentorSystemContext,
  degradedSkills,
  isMentorSlug,
} from "./mentors";

const HEALTH = ["medicina", "enfermagem", "veterinaria", "psicologia", "farmacia"];

describe("mentors · seed dos 13", () => {
  it("são exatamente 13, slugs únicos e válidos, order 1..13", () => {
    expect(MENTOR_SEED).toHaveLength(13);
    const slugs = MENTOR_SEED.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(13);
    for (const s of slugs) expect(isMentorSlug(s)).toBe(true);
    expect([...MENTOR_SEED].map((m) => m.order).sort((a, b) => a - b)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
  });

  it("todo mentor tem os campos obrigatórios do MentorTemplate", () => {
    for (const m of MENTOR_SEED) {
      expect(m.name).toBeTruthy();
      expect(m.course).toBeTruthy();
      expect(m.emoji).toBe("⟁");
      expect(m.personaId).toBe(m.slug);
      expect(m.personaText.length).toBeGreaterThan(80);
      expect(m.enabledSkills.length).toBeGreaterThan(0);
      expect(m.signatureArtifacts.length).toBeGreaterThan(0);
      expect(m.sources.length).toBeGreaterThan(0);
      expect(m.academicLevel).toBe("graduacao");
    }
  });

  it("enabledSkills só usa skills conhecidas (memory/studio vivas; literature/code/molecule degradam)", () => {
    for (const m of MENTOR_SEED) {
      for (const s of m.enabledSkills) expect(ALL_MENTOR_SKILLS).toContain(s);
      expect(m.enabledSkills).toContain("memory");
      expect(m.enabledSkills).toContain("studio");
    }
    expect(degradedSkills(mentorBySlug("quimica")!)).toEqual(expect.arrayContaining(["molecule", "literature"]));
    expect(degradedSkills(mentorBySlug("matematica")!)).toEqual([]);
  });

  it("guardrails de saúde são obrigatórios (Osler/Nightingale/Pasteur/James/Kekulé)", () => {
    for (const slug of HEALTH) {
      const m = mentorBySlug(slug)!;
      expect(m.guardrail, slug).toBeTruthy();
      expect(m.personaText, slug).toMatch(/EDUCACIONAL|Educacional/);
    }
    expect(mentorBySlug("fisica")!.guardrail).toBeUndefined();
  });

  it("mentorBySlug: acha por slug; rejeita lixo/injeção", () => {
    expect(mentorBySlug("medicina")?.name).toBe("Osler");
    expect(mentorBySlug("nao-existe")).toBeUndefined();
    expect(mentorBySlug("../x")).toBeUndefined();
    expect(mentorBySlug(undefined)).toBeUndefined();
    expect(mentorBySlug("MEDICINA")).toBeUndefined(); // slug é minúsculo
  });
});

describe("mentors · personaText completo", () => {
  it("prefixa a BASE comum antes do texto específico, uma vez só", () => {
    const m = mentorBySlug("fisica")!;
    const txt = mentorPersonaText(m);
    expect(txt.startsWith(BASE_MENTOR)).toBe(true);
    expect(txt.indexOf(m.personaText.trim())).toBeGreaterThan(BASE_MENTOR.length);
    expect(txt.split("Você é um MENTOR da Zaeon").length - 1).toBe(1);
  });

  it("rodapé traz nome/curso, artefatos assinatura e o guardrail quando há", () => {
    const osler = mentorPersonaText(mentorBySlug("medicina")!);
    expect(osler).toMatch(/Você é Osler, mentor\(a\) de Medicina/);
    expect(osler).toMatch(/Artefatos assinatura: .*fluxograma clínico/);
    expect(osler).toMatch(/GUARDRAIL \(inviolável\)/);
    const noether = mentorPersonaText(mentorBySlug("matematica")!);
    expect(noether).not.toMatch(/GUARDRAIL/);
  });

  it("mentorSystemContext rotula o bloco pro systemContext do chat", () => {
    expect(mentorSystemContext(mentorBySlug("quimica")!)).toMatch(/^=== MENTOR ATIVO ===\n/);
  });
});
