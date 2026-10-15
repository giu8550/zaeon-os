import { describe, it, expect } from "vitest";
import { montarTopoPessoas, MAX_NO_TOPO, type PessoaTopo } from "./topoPessoas";

const p = (id: string, nome = id): PessoaTopo => ({ id, nome, avatar: null });
const DONO = p("dono", "Dono"), EU = p("eu", "Eu"), ANA = p("ana", "Ana"), BIA = p("bia", "Bia"), VISITA = p("visita", "Visita");
const base = { donoId: "dono", meuId: "eu", membros: ["eu", "ana"] };

describe("topoPessoas · quem aparece", () => {
  it("dono, membros e você, com o dono primeiro", () => {
    const r = montarTopoPessoas({ ...base, pessoas: [ANA, EU, DONO], online: [] });
    expect(r.visiveis.map((x) => x.id)).toEqual(["dono", "ana", "eu"]);
    expect(r.extras).toBe(0);
    expect(r.total).toBe(3);
  });

  it("autor que não é membro nem dono (canal aberto) fica de fora, a menos que esteja online", () => {
    const fora = montarTopoPessoas({ ...base, pessoas: [DONO, EU, BIA], online: [] });
    expect(fora.visiveis.map((x) => x.id)).toEqual(["dono", "eu"]);
    const dentro = montarTopoPessoas({ ...base, pessoas: [DONO, EU, BIA], online: [BIA] });
    expect(dentro.visiveis.map((x) => x.id)).toEqual(["dono", "eu", "bia"]);
  });

  it("visitante online sem estar em `pessoas` aparece depois dos membros", () => {
    const r = montarTopoPessoas({ ...base, pessoas: [DONO, EU, ANA], online: [VISITA] });
    expect(r.visiveis.map((x) => x.id)).toEqual(["dono", "eu", "ana", "visita"]);
  });

  it("não duplica quem está nas duas listas", () => {
    const r = montarTopoPessoas({ ...base, pessoas: [DONO, EU, ANA], online: [DONO, ANA, EU] });
    expect(r.visiveis.map((x) => x.id)).toEqual(["dono", "eu", "ana"]);
    expect(r.total).toBe(3);
  });

  it("não duplica quando `pessoas` já vem repetido", () => {
    const r = montarTopoPessoas({ ...base, pessoas: [DONO, DONO, EU, EU], online: [] });
    expect(r.total).toBe(2);
  });
});

describe("topoPessoas · online e limite", () => {
  it("onlineIds reflete só a presença", () => {
    const r = montarTopoPessoas({ ...base, pessoas: [DONO, EU, ANA], online: [EU, VISITA] });
    expect(r.onlineIds.has("eu")).toBe(true);
    expect(r.onlineIds.has("visita")).toBe(true);
    expect(r.onlineIds.has("ana")).toBe(false);
  });

  it("acima do limite vira +N, sem perder a contagem total", () => {
    const muitos = Array.from({ length: 9 }, (_, i) => p(`m${i}`));
    const r = montarTopoPessoas({
      pessoas: [DONO, EU, ...muitos], online: [], donoId: "dono", meuId: "eu", membros: muitos.map((m) => m.id),
    });
    expect(r.visiveis).toHaveLength(MAX_NO_TOPO);
    expect(r.extras).toBe(11 - MAX_NO_TOPO);
    expect(r.total).toBe(11);
    expect(r.visiveis[0]!.id).toBe("dono");
  });

  it("canal só com o dono (você é o dono)", () => {
    const r = montarTopoPessoas({ pessoas: [DONO], online: [], donoId: "dono", meuId: "dono", membros: [] });
    expect(r.visiveis.map((x) => x.id)).toEqual(["dono"]);
    expect(r.extras).toBe(0);
  });

  it("sem ninguém conhecido: lista vazia, sem erro", () => {
    const r = montarTopoPessoas({ pessoas: [], online: [], donoId: "dono", meuId: "eu", membros: [] });
    expect(r.visiveis).toEqual([]);
    expect(r.total).toBe(0);
  });
});
