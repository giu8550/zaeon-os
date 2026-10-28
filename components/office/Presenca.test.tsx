// @vitest-environment jsdom
/** #423/#425 · presença na tela: a linha "fulano entrou" e o balão de quem está digitando. */
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

describe("AvisoDigitando (balão)", () => {
  it("uma pessoa: um balão com a foto e os três pontinhos, sem texto na tela", () => {
    const { container } = render(<AvisoDigitando pessoas={[{ id: "a", nome: "Giulia", avatar: null }]} />);
    const balao = screen.getByRole("status", { name: "Giulia está digitando" });
    expect(balao).toBeTruthy();
    expect(screen.getAllByTestId("tres-pontos")).toHaveLength(1);
    expect(balao.querySelectorAll(".animate-bounce")).toHaveLength(3);
    // nada de "está digitando" escrito na tela — só pro leitor de tela
    expect(container.textContent).not.toMatch(/digitando/);
  });

  it("os pontinhos pulam um depois do outro", () => {
    render(<AvisoDigitando pessoas={[{ id: "a", nome: "Giulia" }]} />);
    const atrasos = Array.from(screen.getByTestId("tres-pontos").children).map((el) => (el as HTMLElement).style.animationDelay);
    expect(atrasos).toEqual(["0ms", "150ms", "300ms"]);
  });

  it("duas pessoas: dois balões, cada um com o nome dela", () => {
    render(<AvisoDigitando pessoas={[{ id: "a", nome: "Giulia" }, { id: "b", nome: "Martinez" }]} />);
    expect(screen.getByRole("status", { name: "Giulia está digitando" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Martinez está digitando" })).toBeTruthy();
    expect(screen.getAllByTestId("tres-pontos")).toHaveLength(2);
  });

  it("ninguém digitando: não aparece nada", () => {
    const { container } = render(<AvisoDigitando pessoas={[]} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("LinhaSistema · #635 'Chamar de volta'", () => {
  it("com a ação, a linha 'saiu' ganha o botão; clicar chama", async () => {
    const { fireEvent } = await import("@testing-library/react");
    let chamou = 0;
    render(<LinhaSistema texto="Téo saiu da conversa" hora="16:02" acao={{ rotulo: "Chamar de volta", onClick: () => { chamou++; } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Chamar de volta" }));
    expect(chamou).toBe(1);
  });
  it("sem a ação, nada de botão (as outras linhas)", () => {
    render(<LinhaSistema texto="Ana interrompeu a resposta" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
