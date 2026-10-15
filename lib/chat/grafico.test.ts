import { describe, it, expect } from "vitest";
import { parseGrafico, amostrar, marcas, faixaY } from "./grafico";

describe("parseGrafico", () => {
  it("aceita strings e objetos; teto de 4 funções", () => {
    const r = parseGrafico('{"funcoes":["x^2-4",{"expr":"2x+1","rotulo":"reta"},"x","x","x","x"],"x":[-5,5],"pontos":[{"x":2,"y":0,"rotulo":"raiz"}]}');
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.spec.funcoes).toHaveLength(4); expect(r.spec.funcoes[1].rotulo).toBe("reta"); expect(r.spec.pontos[0].rotulo).toBe("raiz"); expect(r.spec.x).toEqual([-5, 5]); }
  });
  it("erros legíveis", () => {
    expect(parseGrafico("{oops")).toEqual({ ok: false, erro: "JSON do gráfico inválido" });
    expect(parseGrafico('{"funcoes":["alert(1)"]}').ok).toBe(false);
    expect(parseGrafico('{"funcoes":[]}').ok).toBe(false);
  });
  it("domínio inválido → padrão [-10, 10]", () => {
    const r = parseGrafico('{"funcoes":["x"],"x":[5,1]}');
    expect(r.ok && r.spec.x).toEqual([-10, 10]);
  });
});

describe("amostrar", () => {
  it("parábola contínua num trecho só; faixa inclui o mínimo", () => {
    const r = parseGrafico('{"funcoes":["x^2-4"],"x":[-3,3]}');
    if (!r.ok) throw new Error();
    const { curvas, y } = amostrar(r.spec);
    expect(curvas[0].trechos).toHaveLength(1);
    expect(y[0]).toBeLessThan(-4); expect(y[1]).toBeGreaterThan(5);
  });
  it("1/x quebra na assíntota (sem reta vertical falsa)", () => {
    const r = parseGrafico('{"funcoes":["1/x"],"x":[-2,2]}');
    if (!r.ok) throw new Error();
    expect(amostrar(r.spec).curvas[0].trechos.length).toBeGreaterThanOrEqual(2);
  });
  it("sqrt(x) só no domínio (NaN fora)", () => {
    const r = parseGrafico('{"funcoes":["sqrt(x)"],"x":[-4,4]}');
    if (!r.ok) throw new Error();
    const t = amostrar(r.spec).curvas[0].trechos;
    expect(t).toHaveLength(1); expect(t[0][0][0]).toBeGreaterThanOrEqual(0);
  });
});

describe("marcas / faixaY", () => {
  it("marcas bonitas", () => {
    expect(marcas(-5, 5)).toEqual([-4, -2, 0, 2, 4]);
    expect(marcas(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
  it("faixa vazia → padrão", () => { expect(faixaY([])).toEqual([-10, 10]); });
});

describe("geometria", () => {
  it("formas sem funções: faixa automática cobre o triângulo e a origem; proporcional por padrão", () => {
    const r = parseGrafico('{"formas":[{"tipo":"poligono","pontos":[[0,0],[4,0],[0,3]],"rotulo":"triângulo"},{"tipo":"vetor","de":[0,0],"ate":[2,1]},{"tipo":"circulo","centro":[1,1],"raio":1},{"tipo":"lixo"}]}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.formas).toHaveLength(3);
    expect(r.spec.proporcional).toBe(true);
    expect(r.spec.x[0]).toBeLessThan(0); expect(r.spec.x[1]).toBeGreaterThan(4);
    expect(r.spec.y![1]).toBeGreaterThan(3);
  });
  it("proporcionalizar iguala a unidade dos dois eixos", async () => {
    const { proporcionalizar } = await import("./grafico");
    const { x, y } = proporcionalizar([0, 10], [0, 1], 500, 250);
    expect((x[1] - x[0]) / 500).toBeCloseTo((y[1] - y[0]) / 250);
  });
});
