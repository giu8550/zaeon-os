// @vitest-environment jsdom
/** #423 · barra de cima: as fotos das pessoas não podem ficar sobrepostas. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PessoasTopo from "./PessoasTopo";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
afterEach(() => cleanup());

const p = (id: string, nome: string) => ({ id, nome, avatar: null });

describe("PessoasTopo", () => {
  it("fotos com espaço entre elas (sem a sobreposição -space-x de antes)", () => {
    render(<PessoasTopo visiveis={[p("a", "Giulia"), p("b", "Martinez")]} extras={0} onlineIds={new Set(["a"])} total={2} />);
    const grupo = screen.getByTestId("pessoas-topo");
    expect(grupo.className).toContain("gap-1.5");
    expect(grupo.className).not.toMatch(/-space-x/);
  });

  it("cada pessoa aparece com o nome, e quem está online é marcado", () => {
    render(<PessoasTopo visiveis={[p("a", "Giulia"), p("b", "Martinez")]} extras={0} onlineIds={new Set(["a"])} total={2} />);
    // uma entrada por pessoa no grupo (o avatar por dentro também usa o nome, por isso olha só os filhos diretos)
    const titulos = [...screen.getByTestId("pessoas-topo").children].map((e) => e.getAttribute("title"));
    expect(titulos).toEqual(["Giulia · online", "Martinez"]);
  });

  it("quem passou do limite vira +N", () => {
    render(<PessoasTopo visiveis={[p("a", "A")]} extras={3} onlineIds={new Set()} total={4} />);
    expect(screen.getByText("+3")).toBeTruthy();
  });

  it("sem ninguém, não desenha nada", () => {
    const { container } = render(<PessoasTopo visiveis={[]} extras={0} onlineIds={new Set()} total={0} />);
    expect(container.innerHTML).toBe("");
  });
});
