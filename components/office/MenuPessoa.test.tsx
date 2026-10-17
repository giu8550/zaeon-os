// @vitest-environment jsdom
/** #425/#427 · clicar na foto: um menu só com Ver perfil, Conversar (ou Convidar pra conversar) e Remover. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MenuPessoa from "./MenuPessoa";
import PessoasTopo from "./PessoasTopo";
import { abrirPerfil, EVT_VER_PERFIL, idDoEvento } from "@/lib/perfil/eventos";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
afterEach(() => cleanup());

const pessoa = { id: "m", nome: "Martinez", avatar: null };
const base = { pessoa, onVerPerfil: () => {}, conversa: null, podeRemover: false, onRemover: () => {} };

describe("MenuPessoa", () => {
  it("Ver perfil chama a abertura do perfil (não abre mais um cartãozinho)", () => {
    const onVerPerfil = vi.fn();
    render(<MenuPessoa {...base} onVerPerfil={onVerPerfil} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver perfil/ }));
    expect(onVerPerfil).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("perfil-pessoa")).toBeNull();
  });

  it("já são contatos: 'Conversar' no mesmo menu", () => {
    const onClick = vi.fn();
    render(<MenuPessoa {...base} conversa={{ tipo: "abrir", onClick }} />);
    fireEvent.click(screen.getByRole("button", { name: /Conversar/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Convidar pra conversar/ })).toBeNull();
  });

  it("ainda não são contatos: 'Convidar pra conversar' manda o convite e mostra a resposta", async () => {
    const onClick = vi.fn(async () => ({ ok: true, msg: "Convite enviado. Ela aceita pelo sino." }));
    render(<MenuPessoa {...base} conversa={{ tipo: "convidar", onClick }} />);
    fireEvent.click(screen.getByRole("button", { name: /Convidar pra conversar/ }));
    expect((await screen.findByRole("status")).textContent).toContain("Convite enviado");
    expect(onClick).toHaveBeenCalledTimes(1);
    // não manda duas vezes
    expect((screen.getByRole("button", { name: /Convidar pra conversar/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("convite que falha: mostra o motivo", async () => {
    render(<MenuPessoa {...base} conversa={{ tipo: "convidar", onClick: async () => ({ ok: false, msg: "Já existe um convite pendente entre vocês." }) }} />);
    fireEvent.click(screen.getByRole("button", { name: /Convidar pra conversar/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("convite pendente");
  });

  it("sem conversa (é você, ou já estão na conversa de vocês): só Ver perfil", () => {
    render(<MenuPessoa {...base} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("dono: 'Remover do escritório' no mesmo menu; quem não é dono não vê", () => {
    const onRemover = vi.fn();
    const { unmount } = render(<MenuPessoa {...base} podeRemover onRemover={onRemover} />);
    fireEvent.click(screen.getByRole("button", { name: /Remover do escritório/ }));
    expect(onRemover).toHaveBeenCalledTimes(1);
    unmount();
    render(<MenuPessoa {...base} />);
    expect(screen.queryByRole("button", { name: /Remover do escritório/ })).toBeNull();
  });

  it("as três opções juntas, na ordem", () => {
    render(<MenuPessoa {...base} conversa={{ tipo: "abrir", onClick: () => {} }} podeRemover />);
    expect(screen.getAllByRole("button").map((b) => b.textContent?.trim())).toEqual(["Ver perfil", "Conversar", "Remover do escritório"]);
  });
});

describe("abrir o perfil (evento pra página do laboratório)", () => {
  it("dispara o evento com o id, e o id volta certinho", () => {
    const ouvidos: (string | null)[] = [];
    const ouvir = (e: Event) => ouvidos.push(idDoEvento(e));
    window.addEventListener(EVT_VER_PERFIL, ouvir);
    abrirPerfil("b".repeat(24));
    window.removeEventListener(EVT_VER_PERFIL, ouvir);
    expect(ouvidos).toEqual(["b".repeat(24)]);
  });
  it("id estranho no evento é ignorado", () => {
    expect(idDoEvento(new CustomEvent("x", { detail: { userId: "../admin" } }))).toBeNull();
    expect(idDoEvento(null)).toBeNull();
  });
});

describe("PessoasTopo · foto clicável", () => {
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
