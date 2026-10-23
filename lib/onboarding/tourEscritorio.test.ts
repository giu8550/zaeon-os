import { describe, it, expect } from "vitest";
import { PASSOS_ESCRITORIO, PASSOS_ESCRITORIO_3D, deveMostrarTourEscritorio, passosDoEscritorio } from "./tourEscritorio";

describe("o tour do Escritório", () => {
  it("o canal: o Escritório, os agentes (@), onde escrever e a turma", () => {
    expect(PASSOS_ESCRITORIO.map((p) => p.id)).toEqual(["canal", "agentes", "escrever", "convidar"]);
    expect(PASSOS_ESCRITORIO.find((p) => p.id === "agentes")!.fala).toMatch(/@/);
  });
  it("o 3D antigo tem o roteiro dele (sem canal nem @)", () => {
    expect(passosDoEscritorio(true)).toBe(PASSOS_ESCRITORIO);
    expect(passosDoEscritorio(false)).toBe(PASSOS_ESCRITORIO_3D);
    expect(PASSOS_ESCRITORIO_3D.map((p) => p.fala).join(" ")).not.toMatch(/@/);
  });
  it("cada passo tem alvo e botão; o último encerra", () => {
    for (const p of [...PASSOS_ESCRITORIO, ...PASSOS_ESCRITORIO_3D]) { expect(p.alvos.length).toBeGreaterThan(0); expect(p.cta).toBeTruthy(); }
    expect(PASSOS_ESCRITORIO.at(-1)!.cta).not.toBe("Próximo");
  });
  it("só na aba, uma vez, fora do tutorial, sem outro tour e nunca no celular", () => {
    const base = { naAba: true, noTutorial: false, largura: 1280, visto: false, outroTour: false };
    expect(deveMostrarTourEscritorio(base)).toBe(true);
    expect(deveMostrarTourEscritorio({ ...base, naAba: false })).toBe(false);
    expect(deveMostrarTourEscritorio({ ...base, noTutorial: true })).toBe(false);
    expect(deveMostrarTourEscritorio({ ...base, visto: true })).toBe(false);
    expect(deveMostrarTourEscritorio({ ...base, outroTour: true })).toBe(false);
    expect(deveMostrarTourEscritorio({ ...base, largura: 390 })).toBe(false);
  });
});
