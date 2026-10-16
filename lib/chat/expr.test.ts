import { describe, it, expect } from "vitest";
import { compilarExpr, deLatex } from "./expr";

const v = (s: string, x: number) => compilarExpr(s)(x);

describe("compilarExpr", () => {
  it("aritmética, precedência e potência à direita", () => {
    expect(v("x^2-4", 3)).toBe(5);
    expect(v("2+3*4", 0)).toBe(14);
    expect(v("2^3^2", 0)).toBe(512);
    expect(v("-x^2", 3)).toBe(-9);
    expect(v("(x+1)/(x-1)", 3)).toBe(2);
    expect(v("2^-1", 0)).toBe(0.5);
  });
  it("multiplicação implícita", () => {
    expect(v("2x", 3)).toBe(6);
    expect(v("3(x+1)", 1)).toBe(6);
    expect(v("(x+1)(x-1)", 3)).toBe(8);
    expect(v("2x^2", 3)).toBe(18);
    expect(v("2sin(x)", Math.PI / 2)).toBeCloseTo(2);
    expect(v("xsin(x)", Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(v("2pi", 0)).toBeCloseTo(2 * Math.PI);
  });
  it("funções e constantes", () => {
    expect(v("sqrt(x)", 9)).toBe(3);
    expect(v("ln(e)", 0)).toBeCloseTo(1);
    expect(v("log(100)", 0)).toBe(2);
    expect(v("abs(x)", -4)).toBe(4);
    expect(v("e^x", 0)).toBe(1);
    expect(v("exp(x)", 1)).toBeCloseTo(Math.E);
    expect(v("sen(x)", 0)).toBe(0);
    expect(v("cos pi", 0)).toBeCloseTo(-1);
  });
  it("LaTeX leve que o modelo manda", () => {
    expect(deLatex("f(x) = \\frac{1}{x}")).toBe("((1)/(x))");
    expect(v("y = \\frac{x^{2}}{2}", 4)).toBe(8);
    expect(v("\\sqrt{x} \\cdot 2", 4)).toBe(4);
    expect(v("x²", 3)).toBe(9);
    expect(v("3 − x", 1)).toBe(2);
  });
  it("recusa o que não é matemática (nada vira código)", () => {
    for (const s of ["alert(1)", "x;process.exit()", "constructor", "x =>1", "", "(x+1", "y+1", "2 3 4 ,"]) {
      expect(() => compilarExpr(s), s).toThrow();
    }
  });
});
