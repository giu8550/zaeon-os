import { describe, it, expect } from "vitest";
import { ESTADOS, estadoDeFase, normalizarEstado, estaAtivo, frase, rotulo, aindaEscrevendo, PULSO_AGENTE_MS, PRAZO_AGENTE_MS } from "./estadoAgente";

describe("estadoAgente · #468 'redigindo…' não fica preso", () => {
  it("quem ficou sem aviso no prazo sai; quem teve aviso recente fica", () => {
    expect(aindaEscrevendo(["aura", "teo", "nina"], { aura: 1_000, teo: 5_000 }, 2_000)).toEqual(["teo"]);
  });
  it("o prazo cabe mais de um pulso (um aviso perdido não apaga quem ainda trabalha)", () => {
    expect(PRAZO_AGENTE_MS).toBeGreaterThanOrEqual(2 * PULSO_AGENTE_MS);
  });
});

describe("estadoAgente · fase do harness → estado", () => {
  it.each([
    ["route", "entendendo"], ["plan", "planejando"], ["gather", "pesquisando"],
    ["reason", "investigando"], ["critique", "investigando"],
    ["draft", "redigindo"], ["finalize", "redigindo"],
  ])("%s → %s", (fase, estado) => {
    expect(estadoDeFase(fase)).toBe(estado);
  });

  it("tolera espaços e cai em 'digitando' no que não conhece", () => {
    expect(estadoDeFase("  gather ")).toBe("pesquisando");
    expect(estadoDeFase("degradado: nenhuma evidência reunida")).toBe("digitando");
    expect(estadoDeFase("")).toBe("digitando");
    expect(estadoDeFase(undefined)).toBe("digitando");
    expect(estadoDeFase(42)).toBe("digitando");
  });
});

describe("estadoAgente · normalizar o que vem do fio", () => {
  it("aceita os conhecidos", () => {
    for (const e of ESTADOS) expect(normalizarEstado(e)).toBe(e);
  });
  it("valor estranho vira 'digitando', nunca quebra", () => {
    expect(normalizarEstado("hackeando")).toBe("digitando");
    expect(normalizarEstado(null)).toBe("digitando");
    expect(normalizarEstado({})).toBe("digitando");
  });
});

describe("estadoAgente · ativo e rótulos", () => {
  it("ocioso e descanso não são 'no ar'; os demais são", () => {
    expect(estaAtivo("ocioso")).toBe(false);
    expect(estaAtivo("descanso")).toBe(false);
    for (const e of ESTADOS.filter((x) => x !== "ocioso" && x !== "descanso")) expect(estaAtivo(e)).toBe(true);
  });

  it("todo estado ativo tem frase; ocioso é vazio", () => {
    expect(frase("ocioso")).toBe("");
    for (const e of ESTADOS.filter((x) => x !== "ocioso")) expect(frase(e).length).toBeGreaterThan(0);
  });

  it("rótulo junta nome e frase", () => {
    expect(rotulo("Nina", "pesquisando")).toBe("Nina está pesquisando");
    expect(rotulo("Nina", "descanso")).toBe("Nina está em descanso (chegou ao limite de uso)");
    expect(rotulo("Nina", "ocioso")).toBe("Nina");
  });
});
