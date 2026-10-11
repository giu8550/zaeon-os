// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import { useSidebarHover, ABRIR_SIDEBAR_MS, FECHAR_SIDEBAR_MS } from "./useSidebarHover";

function Nav() {
  const { aberta, navRef, handlers } = useSidebarHover<HTMLElement>();
  return (
    <div>
      <nav ref={navRef} data-testid="nav" data-aberta={aberta ? "1" : "0"} {...handlers}>
        <button data-testid="item">Sala</button>
        <input data-testid="renomear" />
      </nav>
      <button data-testid="fora">chat</button>
    </div>
  );
}

const aberta = (r: ReturnType<typeof render>) => r.getByTestId("nav").getAttribute("data-aberta") === "1";
const passar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const mover = (x: number, y: number) => act(() => { document.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y })); });

describe("useSidebarHover", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // a nav ocupa x 16..280, y 100..700
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 16, right: 280, top: 100, bottom: 700, x: 16, y: 100, width: 264, height: 600, toJSON() {} } as DOMRect);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("abre com o mouse em cima e volta pro canto quando ele sai", () => {
    const r = render(<Nav />);
    fireEvent.mouseEnter(r.getByTestId("nav"));
    passar(ABRIR_SIDEBAR_MS);
    expect(aberta(r)).toBe(true);
    fireEvent.mouseLeave(r.getByTestId("nav"));
    passar(FECHAR_SIDEBAR_MS);
    expect(aberta(r)).toBe(false);
  });

  it("passar rápido por cima não abre", () => {
    const r = render(<Nav />);
    fireEvent.mouseEnter(r.getByTestId("nav"));
    passar(ABRIR_SIDEBAR_MS / 2);
    fireEvent.mouseLeave(r.getByTestId("nav"));
    passar(ABRIR_SIDEBAR_MS * 3);
    expect(aberta(r)).toBe(false);
  });

  it("o foco devolvido a um botão dela (sem mouse, sem teclado) NÃO abre — era o que a prendia aberta", () => {
    const r = render(<Nav />);
    act(() => { r.getByTestId("item").focus(); });
    passar(2000);
    expect(aberta(r)).toBe(false);
  });

  it("um mouseleave perdido não prende: o ponteiro andando fora dela fecha", () => {
    const r = render(<Nav />);
    fireEvent.mouseEnter(r.getByTestId("nav"));
    passar(ABRIR_SIDEBAR_MS);
    expect(aberta(r)).toBe(true);
    mover(600, 400);   // saiu sem o navegador avisar
    passar(FECHAR_SIDEBAR_MS);
    expect(aberta(r)).toBe(false);
  });

  it("andar DENTRO dela mantém aberta", () => {
    const r = render(<Nav />);
    fireEvent.mouseEnter(r.getByTestId("nav"));
    passar(ABRIR_SIDEBAR_MS);
    mover(100, 300);
    passar(FECHAR_SIDEBAR_MS * 3);
    expect(aberta(r)).toBe(true);
  });

  it("a janela perdendo o foco fecha", () => {
    const r = render(<Nav />);
    fireEvent.mouseEnter(r.getByTestId("nav"));
    passar(ABRIR_SIDEBAR_MS);
    act(() => { window.dispatchEvent(new Event("blur")); });
    passar(FECHAR_SIDEBAR_MS);
    expect(aberta(r)).toBe(false);
  });

  it("não fecha no meio de uma edição; fecha quando ela termina", () => {
    const r = render(<Nav />);
    fireEvent.mouseEnter(r.getByTestId("nav"));
    passar(ABRIR_SIDEBAR_MS);
    act(() => { r.getByTestId("renomear").focus(); });
    fireEvent.mouseLeave(r.getByTestId("nav"));
    passar(FECHAR_SIDEBAR_MS * 4);
    expect(aberta(r)).toBe(true);
    act(() => { r.getByTestId("renomear").blur(); });
    passar(FECHAR_SIDEBAR_MS * 2);
    expect(aberta(r)).toBe(false);
  });
});

describe("useSidebarHover — teclado", () => {
  afterEach(() => { cleanup(); });
  it("Tab até ela abre (acessível)", () => {
    const r = render(<Nav />);
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" })); r.getByTestId("item").focus(); });
    expect(aberta(r)).toBe(true);
  });
});
