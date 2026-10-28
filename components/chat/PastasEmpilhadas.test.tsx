// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PastasEmpilhadas, { type Pasta } from "@/components/chat/PastasEmpilhadas";

afterEach(cleanup);

const pastas: Pasta[] = [{ id: "conversa", rotulo: "Conversa" }, { id: "doc", rotulo: "Minha pesquisa" }];
const montar = (ativa: string, gerando?: string | null) =>
  render(<PastasEmpilhadas pastas={pastas} ativa={ativa} gerando={gerando} onAbrir={() => {}} />);
const aba = (nome: string) => screen.getByRole("tab", { name: new RegExp(nome) });

describe("PastasEmpilhadas — friso durante a geração", () => {
  it("parado: friso estático na pasta da frente, sem varredura", () => {
    const { container } = montar("conversa");
    expect(container.querySelectorAll("[data-friso]")).toHaveLength(1);
    expect(container.querySelector("[data-varredura]")).toBeNull();
    expect(aba("Conversa").getAttribute("aria-busy")).toBeNull();
  });

  it("gerando na pasta da frente: o friso varre e a aba fica aria-busy", () => {
    const { container } = montar("conversa", "conversa");
    const varre = container.querySelector("[data-varredura]");
    expect(varre).not.toBeNull();
    expect(varre!.className).toContain("pe-varre");
    expect(aba("Conversa").getAttribute("aria-busy")).toBe("true");
  });

  it("gerando, mas com um documento na frente: nada varre", () => {
    const { container } = montar("doc", "conversa");
    expect(container.querySelector("[data-varredura]")).toBeNull();
  });

  it("terminou (gerando volta a null): a varredura some", () => {
    const { container, rerender } = montar("conversa", "conversa");
    rerender(<PastasEmpilhadas pastas={pastas} ativa="conversa" gerando={null} onAbrir={() => {}} />);
    expect(container.querySelector("[data-varredura]")).toBeNull();
    expect(container.querySelectorAll("[data-friso]")).toHaveLength(1);
  });
});

describe("#640: a altura de verdade da barra", () => {
  it("avisa a altura medida (e de novo quando ela muda), pra quem abre telas por cima começar nela", async () => {
    const { vi } = await import("vitest");
    let avisar: () => void = () => {};
    const original = (globalThis as any).ResizeObserver;
    (globalThis as any).ResizeObserver = class { constructor(cb: () => void) { avisar = cb; } observe() {} disconnect() {} };
    const altura = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 56.4 } as DOMRect);
    const medidas: number[] = [];
    render(<PastasEmpilhadas pastas={pastas} ativa="doc" onAbrir={() => {}} aoMedirAltura={(h) => medidas.push(h)} />);
    avisar();
    altura.mockReturnValue({ height: 46 } as DOMRect);
    avisar();
    expect(medidas).toEqual([56, 46]);
    altura.mockRestore();
    (globalThis as any).ResizeObserver = original;
  });
});
