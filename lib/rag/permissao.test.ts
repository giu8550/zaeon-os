import { describe, it, expect } from "vitest";
import { filtroVetorial, filtroTextual, podeVer, temBase } from "./permissao";

describe("permissão RAG", () => {
  it("filtroVetorial com turmas: $or turma/dono", () => {
    expect(filtroVetorial({ userId: "u1", turmaIds: ["t1", "t2"] })).toEqual({
      $or: [{ turmaIds: { $in: ["t1", "t2"] } }, { donoIds: { $eq: "u1" } }],
    });
  });

  it("filtroVetorial sem turmas: só o dono", () => {
    expect(filtroVetorial({ userId: "u1", turmaIds: [] })).toEqual({ donoIds: { $eq: "u1" } });
  });

  it("podeVer: aluno A não vê turma alheia nem a base de B", () => {
    expect(podeVer({ turmaIds: ["t9"], donoIds: ["u2"] }, { userId: "u1", turmaIds: ["t1"] })).toBe(false);
  });

  it("podeVer: por turma e por dono", () => {
    expect(podeVer({ turmaIds: ["t1"], donoIds: [] }, { userId: "u1", turmaIds: ["t1"] })).toBe(true);
    expect(podeVer({ turmaIds: [], donoIds: ["u1"] }, { userId: "u1", turmaIds: [] })).toBe(true);
  });

  it("temBase", () => {
    const e = { userId: "u1", turmaIds: [] };
    expect(temBase(e, { pessoais: 0, deTurma: 0 })).toBe(false);
    expect(temBase(e, { pessoais: 1, deTurma: 0 })).toBe(true);
    expect(temBase(e, { pessoais: 0, deTurma: 2 })).toBe(true);
  });

  it("filtroTextual usa in/equals com minimumShouldMatch", () => {
    const f = JSON.stringify(filtroTextual({ userId: "u1", turmaIds: ["t1"] }));
    expect(f).toContain(JSON.stringify({ in: { path: "turmaIds", value: ["t1"] } }));
    expect(f).toContain(JSON.stringify({ equals: { path: "donoIds", value: "u1" } }));
    expect(f).toContain('"minimumShouldMatch":1');
  });

  it("filtroTextual sem turmas omite o 'in'", () => {
    const f = JSON.stringify(filtroTextual({ userId: "u1", turmaIds: [] }));
    expect(f).not.toContain('"in"');
    expect(f).toContain('"equals"');
  });
});
