// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import ChatMarkdown from "./ChatMarkdown";

afterEach(() => cleanup());

describe("ChatMarkdown — matemática", () => {
  it("$…$ inline e $$…$$ em destaque viram KaTeX", async () => {
    const { container } = render(<ChatMarkdown text={"Seja $f(x)=x^2$.\n$$\\frac{a}{b}$$\nfim"} />);
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    expect(container.querySelector(".katex-display")).not.toBeNull();
    expect(container.textContent).not.toContain("$");
  });
  it("```grafico vira SVG com a curva", () => {
    const { container } = render(<ChatMarkdown text={'Veja:\n```grafico\n{"funcoes":["x^2-4"],"x":[-3,3],"pontos":[{"x":2,"y":0,"rotulo":"raiz"}]}\n```'} />);
    expect(container.querySelector("svg[role=img]")).not.toBeNull();
    expect(container.querySelectorAll("polyline").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("y = x^2-4");
  });
  it("gráfico inválido avisa sem quebrar", () => {
    const { container } = render(<ChatMarkdown text={'```grafico\n{"funcoes":["alert(1)"]}\n```'} />);
    expect(container.textContent).toMatch(/Não consegui desenhar/);
  });
  it("dinheiro continua texto; a*b não vira itálico dentro de fórmula", async () => {
    const { container } = render(<ChatMarkdown text={"Custa R$ 10 e o produto é $a*b*c$."} />);
    expect(container.textContent).toContain("R$ 10");
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(1));
    expect(container.querySelector("em")).toBeNull();
  });
  it("links http(s) viram <a> em nova aba; javascript: não", () => {
    const { container } = render(<ChatMarkdown text={"[PDF](https://www.gutenberg.org/x.pdf) e [mau](javascript:alert(1))"} />);
    const as = container.querySelectorAll("a");
    expect(as).toHaveLength(1);
    expect(as[0].getAttribute("href")).toBe("https://www.gutenberg.org/x.pdf");
    expect(as[0].getAttribute("target")).toBe("_blank");
    expect(as[0].getAttribute("rel")).toContain("noopener");
  });
  it("markdown de sempre continua (título, bullet, negrito)", () => {
    const { container } = render(<ChatMarkdown text={"## Título\n- item **forte**"} />);
    expect(container.querySelector("li strong")?.textContent).toBe("forte");
  });
});

describe("ChatMarkdown — geometria", () => {
  it("polígono, círculo e vetor viram SVG", () => {
    const { container } = render(<ChatMarkdown text={'```grafico\n{"formas":[{"tipo":"poligono","pontos":[[0,0],[4,0],[0,3]],"rotulo":"ABC"},{"tipo":"circulo","centro":[0,0],"raio":2},{"tipo":"vetor","de":[0,0],"ate":[2,1]}]}\n```'} />);
    expect(container.querySelector("polygon")).not.toBeNull();
    expect(container.querySelector("ellipse")).not.toBeNull();
    expect(container.querySelector("line[marker-end]")).not.toBeNull();
    expect(container.textContent).toContain("ABC");
  });
});
