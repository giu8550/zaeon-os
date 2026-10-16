import { describe, it, expect } from "vitest";
import { PASSOS_SALA, deveMostrarTourSala } from "./tourSala";
import { ETAPAS_LAB } from "./tutorialLab";

describe("o tour da sala (fora do tutorial)", () => {
  it("passeia pela sala inteira: Aura → Sala de Estudos → Marketplace → referências → Sala de Pesquisa → citações → salvar", () => {
    expect(PASSOS_SALA.map((p) => p.id)).toEqual(["aura", "sala-de-estudos", "marketplace", "referencias", "sala-de-pesquisa", "citacoes", "salvar"]);
    for (const p of PASSOS_SALA) { expect(p.alvos.length).toBeGreaterThan(0); expect(p.fala.length).toBeLessThan(260); }
  });
  it("as CITAÇÕES com detalhe: ABNT, arrastar pro texto, o sinal vermelho", () => {
    const c = PASSOS_SALA.find((p) => p.id === "citacoes")!.fala;
    expect(c).toMatch(/ABNT/); expect(c).toMatch(/arraste/); expect(c).toMatch(/vermelho/); expect(c).toMatch(/Creditar fonte/);
  });
  it("o que a 1ª missão não mostra, o tour da sala mostra", () => {
    const missao = ETAPAS_LAB.flatMap((e) => e.alvos).join(" ");
    expect(missao).not.toMatch(/bandeja|salvar-ref|relacionados/);
    expect(PASSOS_SALA.flatMap((p) => p.alvos).join(" ")).toMatch(/bandeja/);
  });
  it("só fora do tutorial, uma vez, sem outro tour rodando e nunca no celular", () => {
    const base = { noTutorial: false, largura: 1280, visto: false, outroTour: false };
    expect(deveMostrarTourSala(base)).toBe(true);
    expect(deveMostrarTourSala({ ...base, noTutorial: true })).toBe(false);
    expect(deveMostrarTourSala({ ...base, visto: true })).toBe(false);
    expect(deveMostrarTourSala({ ...base, outroTour: true })).toBe(false);
    expect(deveMostrarTourSala({ ...base, largura: 390 })).toBe(false);
  });
});
