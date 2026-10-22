// @vitest-environment jsdom
/** G6 (Fatia 7): texto de agente NUNCA vira <img> no render — imagem remota é canal de exfiltração. */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import RichText from "./RichText";

afterEach(() => cleanup());

describe("RichText — sem imagem remota", () => {
  it("![x](url) e <img src> renderizam como TEXTO, nunca <img>", () => {
    const { container } = render(<RichText text={'veja ![x](https://evil/p.png?d=1) e <img src="https://evil/q.png"> **forte**'} />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.textContent).toContain("![x](https://evil/p.png?d=1)");
    expect(container.textContent).toContain('<img src="https://evil/q.png">');
    expect(container.querySelector("strong, b")?.textContent).toBe("forte");
  });
  it("HTML não é interpretado (sem script/iframe no DOM)", () => {
    const { container } = render(<RichText text={"<script>alert(1)</script><iframe src='x'></iframe>"} />);
    expect(container.querySelectorAll("script, iframe")).toHaveLength(0);
  });
});

describe("RichText — matemática (chat de PDF / resumos da Sala de Pesquisa)", () => {
  const RESPOSTA = [
    "Matematicamente, a operação de atenção é definida pela equação:",
    "",
    "$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$",
    "",
    "Onde $Q$ (Query), $K$ (Key) e $V$ (Value) são projeções, e $d_k$ é a dimensão das chaves.",
    "",
    "$$P(w_t | w_1, w_2, \\dots, w_{t-1})$$",
  ].join("\n");

  it("$$…$$ e $…$ viram KaTeX, sem LaTeX cru na tela", async () => {
    const { container } = render(<RichText text={RESPOSTA} />);
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(6)); // 2 display + 4 inline (KaTeX carrega tardio)
    expect(container.querySelectorAll(".katex-display")).toHaveLength(2);
    // fora das fórmulas (o KaTeX guarda o TeX numa anotação de acessibilidade, invisível)
    const fora = container.cloneNode(true) as HTMLElement;
    fora.querySelectorAll(".katex").forEach((k) => k.remove());
    expect(fora.textContent).not.toContain("$");
    expect(fora.textContent).not.toContain("\\frac");
  });
  it("texto sem fórmula segue no render leve (e R$ 10 não vira fórmula)", () => {
    const { container } = render(<RichText text={"custa R$ 10 e **vale**"} />);
    expect(container.querySelectorAll(".katex")).toHaveLength(0);
    expect(container.querySelector("strong")?.textContent).toBe("vale");
  });
  it("com fórmula continua sem <img> (link vira texto/âncora, nunca imagem)", () => {
    const { container } = render(<RichText text={"$x^2$ e ![x](https://evil/p.png)"} />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});
