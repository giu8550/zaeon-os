import { describe, it, expect } from "vitest";
import { parseJsonComLatex, repararLatexNoJson } from "./latexJson";

// O que o modelo manda (barra simples), escrito aqui como o TEXTO cru que chega do Vertex.
const cru = (s: string) => s; // legibilidade: os testes usam String.raw

describe("LaTeX dentro de JSON (fórmulas e reações nos trabalhos)", () => {
  it("\\frac \\rightarrow \\times \\beta \\nabla não viram caracteres de controle", () => {
    const raw = String.raw`{"body":"$\frac{a}{b}$, $\rightarrow$, $2\times 3$, $\beta$, $\nabla f$"}`;
    expect(JSON.parse(raw).body).toContain("\f"); // o bug: form feed no lugar de \frac
    const v = parseJsonComLatex<{ body: string }>(raw);
    expect(v.body).toBe(String.raw`$\frac{a}{b}$, $\rightarrow$, $2\times 3$, $\beta$, $\nabla f$`);
    expect(v.body).not.toMatch(/[\f\r\t\b]/);
  });
  it("escapes inválidos (\\cdot \\Delta \\sqrt \\ce \\alpha) deixam de derrubar o JSON inteiro", () => {
    const raw = String.raw`{"body":"$\Delta H$, $a\cdot b$, $\sqrt{2}$, $\ce{2H2 + O2 -> 2H2O}$, $\alpha$, $\underline{x}$"}`;
    expect(() => JSON.parse(raw)).toThrow();
    expect(parseJsonComLatex<{ body: string }>(raw).body).toBe(String.raw`$\Delta H$, $a\cdot b$, $\sqrt{2}$, $\ce{2H2 + O2 -> 2H2O}$, $\alpha$, $\underline{x}$`);
  });
  it("escapes de verdade continuam: \\n quebra linha (inclusive antes de palavra), \\\" aspas, \\u00e9, \\\\ já escapada", () => {
    const raw = cru(String.raw`{"body":"linha\nSegunda\numa frase\tcom tab \"aspas\" café e $\\frac{1}{2}$"}`);
    expect(parseJsonComLatex<{ body: string }>(raw).body).toBe("linha\nSegunda\numa frase\tcom tab \"aspas\" café e $\\frac{1}{2}$");
  });
  it("sem barra não mexe; reparo nunca piora um JSON que já era válido", () => {
    expect(repararLatexNoJson('{"a":1}')).toBe('{"a":1}');
    expect(parseJsonComLatex('{"a":"ok\\n"}')).toEqual({ a: "ok\n" });
  });
});
