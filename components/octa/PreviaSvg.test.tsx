// @vitest-environment jsdom
/** #421 · a arte do Octa aparece como IMAGEM (prévia do editor e miniatura no chat), com segurança. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import PreviaSvg from "./PreviaSvg";

afterEach(() => { cleanup(); vi.restoreAllMocks(); delete (window as any).__pwn; });

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="#1a0b07"/></svg>';

describe("PreviaSvg · grande (editor)", () => {
  it("desenha a arte como <img> com data URL, e não como texto", () => {
    render(<PreviaSvg conteudo={SVG} titulo="arte/soma.svg" />);
    const img = screen.getByRole("img", { name: "Arte: arte/soma.svg" }) as HTMLImageElement;
    expect(img.getAttribute("src")!.startsWith("data:image/svg+xml")).toBe(true);
    expect(screen.queryByText(/<svg/)).toBeNull(); // o código não aparece na prévia
  });

  it("SVG vazio ou que não é SVG → aviso de erro (não tela em branco)", () => {
    render(<PreviaSvg conteudo="" titulo="arte/x.svg" />);
    expect(screen.getByRole("alert").textContent).toContain("Não deu pra desenhar");
  });

  it("SVG quebrado (o navegador não consegue carregar) → aviso de erro", () => {
    render(<PreviaSvg conteudo={'<svg viewBox="0 0 1 1"><rect'} titulo="arte/x.svg" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("depois de corrigir o código, volta a desenhar", () => {
    const { rerender } = render(<PreviaSvg conteudo={'<svg viewBox="0 0 1 1"><rect'} titulo="arte/x.svg" />);
    fireEvent.error(screen.getByRole("img"));
    rerender(<PreviaSvg conteudo={SVG} titulo="arte/x.svg" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("img")).toBeTruthy();
  });

  it("segurança: <script> dentro do SVG NÃO entra na página nem roda", () => {
    const malicioso = '<svg xmlns="http://www.w3.org/2000/svg"><script>window.__pwn = 1</script><rect width="1" height="1"/></svg>';
    const { container } = render(<PreviaSvg conteudo={malicioso} titulo="arte/x.svg" />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("svg")).toBeNull(); // não foi injetado como HTML: só existe a <img>
    expect((window as any).__pwn).toBeUndefined();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
});

describe("PreviaSvg · mini (chat do agente)", () => {
  it("miniatura clicável que abre o arquivo", () => {
    const onClick = vi.fn();
    render(<PreviaSvg conteudo={SVG} titulo="arte/soma.svg" tamanho="mini" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir arte/soma.svg" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("img", { name: "Arte: arte/soma.svg" })).toBeTruthy();
  });

  it("no chat, SVG inválido simplesmente não mostra miniatura (sem aviso de erro)", () => {
    const { container } = render(<PreviaSvg conteudo="não é svg" titulo="arte/x.svg" tamanho="mini" />);
    expect(container.innerHTML).toBe("");
  });
});
