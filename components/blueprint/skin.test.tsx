import { describe, expect, it } from "vitest";
import { LETRAS, ROSA, SKINS, corNaSkin } from "./skin";

describe("skins da Sala de Estudos", () => {
  it("as três skins estão no seletor", () => {
    expect(SKINS.map((s) => s.id)).toEqual(["blueprint", "cartolina", "barbie"]);
  });
  it("barbie: o ciano vira rosa-choque, o branco vira ameixa, os azuis claros translúcidos viram ameixa translúcida", () => {
    expect(corNaSkin("barbie", "#7fe0ff")).toBe("#e6007e");
    expect(corNaSkin("barbie", "#e8f6ff")).toBe(ROSA.tinta);
    expect(corNaSkin("barbie", "rgba(186,230,253,.55)")).toMatch(/^rgba\(91,18,64,/);
    expect(corNaSkin("barbie", "#ff4d5e")).toBe("#e11d48");   // o crítico continua vermelho (rosa-sangue)
  });
  it("blueprint não muda nada; cartolina continua na canetinha", () => {
    expect(corNaSkin("blueprint", "#7fe0ff")).toBe("#7fe0ff");
    expect(corNaSkin("cartolina", "#7fe0ff")).toBe("#0e7490");
  });
  it("o tamanho da letra vai de 100% a 160%, em passos", () => {
    expect(LETRAS[0]).toBe(1); expect(LETRAS[LETRAS.length - 1]).toBe(1.6);
  });
});
