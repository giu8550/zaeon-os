// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import StructuredAnswerView from "./StructuredAnswerView";
import RichText from "@/components/research/RichText";
import { responderSemFontes } from "@/lib/scholar/semFontes";

afterEach(() => cleanup());

// A resposta que o dono viu crua na Sala de Pesquisa (atenção do Transformer).
const ATENCAO = "A atenção escalonada é\n$$\\text{Attention}(Q,K,V)=\\mathrm{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$\nonde $d_k$ é a dimensão das chaves.";

describe("matemática nas respostas do modo pesquisa", () => {
  it("resposta estruturada (o que o harness devolve com surface=pesquisa): $$…$$ e $…$ viram KaTeX", async () => {
    const { container } = render(
      <StructuredAnswerView answer={{ nucleo: "Segundo Vaswani et al. (2017):", desenvolvimento: ATENCAO, conceitos: ["atenção"] }} />,
    );
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    expect(container.querySelector(".katex-display")).not.toBeNull();
    expect(container.textContent).not.toContain("$$");
  });

  it("o núcleo também passa pelo formatador do chat (negrito + fórmula inline)", async () => {
    const { container } = render(<StructuredAnswerView answer={{ nucleo: "A energia é **$E=mc^2$** em repouso." }} />);
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(1));
    expect(container.textContent).not.toContain("$");
  });

  it("o texto 'sem fonte indexada' do Scholar (semFontes) com fórmula renderiza KaTeX no RichText", async () => {
    const sf = await responderSemFontes("atenção no transformer", {
      webSearch: async () => ({ ok: false } as any),
      genJson: async <T,>() => ({ answer: `Isto não veio de fontes acadêmicas indexadas.\n\n${ATENCAO}` }) as T,
    });
    const { container } = render(<RichText text={sf.answer} />);
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    expect(container.textContent).not.toContain("$$");
  });

  it("RichText sem fórmula segue igual (dinheiro não vira fórmula)", () => {
    const { container } = render(<RichText text={"Custa R$ 10 e é **forte**"} />);
    expect(container.querySelector(".katex")).toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe("forte");
    expect(container.textContent).toContain("R$ 10");
  });
});
