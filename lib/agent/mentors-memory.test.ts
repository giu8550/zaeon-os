import { describe, it, expect } from "vitest";
import { deriveTurnDrawers } from "./memory-provider";
import { mentorWing, isObjectId } from "./mentors-server";

// Gate "outra conta não vê a memória": o andar do mentor é <slug>/<userId> — isola por
// mentor E por usuário; sem mentor, o andar segue derivado da surface (inalterado).
describe("mentors · memória escopada (wing = slug/userId)", () => {
  const base = { userId: "u1", surface: "sala-de-estudos", prompt: "me explica a cafeína em detalhe", answer: { nucleo: "A cafeína é um alcaloide que antagoniza receptores de adenosina." } };

  it("mentorWing: kind agente, label slug/userId (e só slug sem userId)", () => {
    expect(mentorWing("farmacia", "u1")).toEqual({ kind: "agente", label: "farmacia/u1" });
    expect(mentorWing("farmacia", null)).toEqual({ kind: "agente", label: "farmacia" });
  });

  it("com wing do mentor, TODOS os drawers do turno vão pro andar do mentor", () => {
    const drawers = deriveTurnDrawers({ ...base, wing: mentorWing("farmacia", "u1") });
    expect(drawers.length).toBeGreaterThan(0);
    for (const d of drawers) {
      expect(d.userId).toBe("u1");
      expect(d.wing).toEqual({ kind: "agente", label: "farmacia/u1" });
    }
  });

  it("dois usuários com o MESMO mentor têm andares diferentes", () => {
    const a = deriveTurnDrawers({ ...base, userId: "u1", wing: mentorWing("farmacia", "u1") })[0];
    const b = deriveTurnDrawers({ ...base, userId: "u2", wing: mentorWing("farmacia", "u2") })[0];
    expect(a.wing.label).not.toBe(b.wing.label);
    expect(a.userId).not.toBe(b.userId);
  });

  it("sem mentor: andar derivado da surface (comportamento de antes, intacto)", () => {
    const d = deriveTurnDrawers(base)[0];
    expect(d.wing).toEqual({ kind: "usuario", label: "sala-de-estudos" });
  });

  it("isObjectId: aceita 24 hex; rejeita slug/lixo", () => {
    expect(isObjectId("64f1c2a9b3e4d5f60718a9b0")).toBe(true);
    expect(isObjectId("farmacia")).toBe(false);
    expect(isObjectId("64f1c2a9b3e4d5f60718a9b")).toBe(false);
    expect(isObjectId(null)).toBe(false);
  });
});
