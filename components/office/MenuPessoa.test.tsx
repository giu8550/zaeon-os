// @vitest-environment jsdom
/** #425 · clicar na foto: o menu da pessoa (Ver perfil / Remover) e o cartão do perfil. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MenuPessoa, { type PerfilCarregado } from "./MenuPessoa";
import PessoasTopo from "./PessoasTopo";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
afterEach(() => cleanup());

const pessoa = { id: "m", nome: "Martinez", avatar: null };
const perfil: PerfilCarregado = {
  pessoa: { id: "m", nome: "Martinez", avatar: null, curso: "Engenharia", nivel: "Mestrado", instituicao: "USP", bio: "Construindo a Zaeon." },
  papel: "dono",
};
const base = { pessoa, carregarPerfil: async () => perfil, podeRemover: false, onRemover: () => {} };

describe("MenuPessoa", () => {
  it("abre com 'Ver perfil'; sem permissão, nada de Remover", () => {
    render(<MenuPessoa {...base} />);
    expect(screen.getByRole("button", { name: /Ver perfil/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remover do escritório/ })).toBeNull();
  });

  it("dono: aparece 'Remover do escritório' e chama onRemover", () => {
    const onRemover = vi.fn();
    render(<MenuPessoa {...base} podeRemover onRemover={onRemover} />);
    fireEvent.click(screen.getByRole("button", { name: /Remover do escritório/ }));
    expect(onRemover).toHaveBeenCalledTimes(1);
  });

  it("Ver perfil carrega e mostra o cartão: nome, papel, curso, nível, instituição e bio", async () => {
    const carregarPerfil = vi.fn(async () => perfil);
    render(<MenuPessoa {...base} carregarPerfil={carregarPerfil} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver perfil/ }));
    const cartao = await screen.findByTestId("perfil-pessoa");
    expect(carregarPerfil).toHaveBeenCalledWith("m");
    for (const t of ["Martinez", "Dono do escritório", "Engenharia", "Mestrado", "USP", "Construindo a Zaeon."]) expect(cartao.textContent).toContain(t);
    expect(cartao.textContent).not.toMatch(/cérebro|cerebro/i);
  });

  it("já são contatos: o cartão tem 'Conversar'", async () => {
    const onConversar = vi.fn();
    render(<MenuPessoa {...base} onConversar={onConversar} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver perfil/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Conversar/ }));
    expect(onConversar).toHaveBeenCalledTimes(1);
  });

  it("perfil não carregou: aviso, e o menu continua lá", async () => {
    render(<MenuPessoa {...base} carregarPerfil={async () => null} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver perfil/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("Não deu pra abrir o perfil");
    expect(screen.getByRole("button", { name: /Ver perfil/ })).toBeTruthy();
  });
});

describe("PessoasTopo · #425 foto clicável", () => {
  const p = (id: string, nome: string) => ({ id, nome, avatar: null });

  it("clicar na foto chama onAlternar com o id da pessoa", () => {
    const onAlternar = vi.fn();
    render(<PessoasTopo visiveis={[p("a", "Giulia"), p("b", "Martinez")]} extras={0} onlineIds={new Set()} total={2} onAlternar={onAlternar} menuDe={() => null} />);
    fireEvent.click(screen.getByRole("button", { name: "Martinez" }));
    expect(onAlternar).toHaveBeenCalledWith("b");
  });

  it("só a pessoa aberta mostra o menu", () => {
    render(<PessoasTopo visiveis={[p("a", "Giulia"), p("b", "Martinez")]} extras={0} onlineIds={new Set()} total={2}
      aberta="b" onAlternar={() => {}} menuDe={(x) => <div data-testid={`menu-${x.id}`} />} />);
    expect(screen.getByTestId("menu-b")).toBeTruthy();
    expect(screen.queryByTestId("menu-a")).toBeNull();
    expect(screen.getByRole("button", { name: "Martinez" }).getAttribute("aria-expanded")).toBe("true");
  });
});
