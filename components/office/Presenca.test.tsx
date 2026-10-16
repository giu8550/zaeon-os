// @vitest-environment jsdom
/** #423 · presença na tela: a linha "fulano entrou" e o "fulano está digitando". */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LinhaSistema, AvisoDigitando } from "./Presenca";

afterEach(() => cleanup());

describe("LinhaSistema", () => {
  it("mostra o aviso centralizado, com a hora", () => {
    render(<LinhaSistema texto="Martinez entrou no escritório" hora="16:01" />);
    const linha = screen.getByRole("status");
    expect(linha.textContent).toContain("Martinez entrou no escritório");
    expect(linha.textContent).toContain("16:01");
    expect(linha.className).toContain("justify-center");
  });
});

describe("AvisoDigitando", () => {
  it("uma pessoa", () => {
    render(<AvisoDigitando nomes={["Giulia"]} />);
    expect(screen.getByText(/Giulia está digitando/)).toBeTruthy();
  });
  it("duas pessoas", () => {
    render(<AvisoDigitando nomes={["Giulia", "Martinez"]} />);
    expect(screen.getByText(/Giulia e Martinez estão digitando/)).toBeTruthy();
  });
  it("ninguém digitando: não aparece nada", () => {
    const { container } = render(<AvisoDigitando nomes={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
