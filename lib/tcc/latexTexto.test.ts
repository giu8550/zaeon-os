import { describe, it, expect } from "vitest";
import { conteudoSemLatex, latexParaTexto, quimicaParaTexto } from "./latexTexto";

describe("fórmula → texto legível (export .docx)", () => {
  it("frações, potências, índices, gregas e operadores", () => {
    expect(latexParaTexto(String.raw`\frac{QK^T}{\sqrt{d_k}}`)).toBe("(QKᵀ)/(√(dₖ))");
    expect(latexParaTexto(String.raw`E = mc^2`)).toBe("E = mc²");
    expect(latexParaTexto(String.raw`\Delta G = \Delta H - T\Delta S`)).toBe("ΔG = ΔH - TΔS");
    expect(latexParaTexto(String.raw`a \times b \leq c \cdot d`)).toBe("a × b ≤ c · d");
    expect(latexParaTexto(String.raw`25^\circ C`)).toBe("25° C");
    expect(latexParaTexto(String.raw`\text{Attention}(Q,K,V)`)).toBe("Attention(Q,K,V)");
    expect(latexParaTexto(String.raw`x^{1/2}`)).toBe("x^(1/2)");
  });
  it("química (mhchem): índices, coeficientes, setas e cargas", () => {
    expect(quimicaParaTexto("2H2 + O2 -> 2H2O")).toBe("2H₂ + O₂ → 2H₂O");
    expect(quimicaParaTexto("CO2 + H2O <=> H2CO3")).toBe("CO₂ + H₂O ⇌ H₂CO₃");
    expect(quimicaParaTexto("SO4^2-")).toBe("SO₄²⁻");
    expect(quimicaParaTexto("Ca(OH)2")).toBe("Ca(OH)₂");
    expect(latexParaTexto(String.raw`\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}`)).toBe("6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂");
  });
  it("no conteúdo: só os trechos de fórmula mudam (inline, destaque, \\( \\)); dinheiro fica", () => {
    const md = "# INTRODUÇÃO\n\nA fotossíntese $\\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}$ custa R$ 10.\n\n$$E=mc^2$$\n\nE \\(\\alpha\\) também.";
    expect(conteudoSemLatex(md)).toBe("# INTRODUÇÃO\n\nA fotossíntese 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ custa R$ 10.\n\nE=mc²\n\nE α também.");
  });
});
