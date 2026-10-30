// @vitest-environment jsdom
/** #645: o "Abrindo…" avisa a demora pelo tempo e, mais um pouco, oferece "Tentar de novo". */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import Carregando, { AVISO_MS, TENTAR_MS } from "./Carregando";

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Carregando (#645)", () => {
  it("só o texto no começo; depois de ~4 s o aviso da conexão; depois de ~15 s o 'Tentar de novo'", () => {
    vi.useFakeTimers();
    let tentou = 0;
    render(<Carregando texto="Abrindo o canal…" onTentar={() => { tentou++; }} />);
    expect(screen.getByText("Abrindo o canal…")).toBeTruthy();
    expect(screen.queryByText(/pode ser a conexão/)).toBeNull();
    act(() => { vi.advanceTimersByTime(AVISO_MS + 10); });
    expect(screen.getByText(/pode ser a conexão/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    act(() => { vi.advanceTimersByTime(TENTAR_MS - AVISO_MS); });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(tentou).toBe(1);
  });
});

describe("Carregando · #657", () => {
  it("falhou: avisa NA HORA (sem esperar 4 s/15 s) e já oferece 'Tentar de novo'; sem o pontinho girando", () => {
    let tentou = 0;
    const { container } = render(<Carregando texto="Abrindo o canal…" falhou onTentar={() => { tentou++; }} />);
    expect(screen.getByText("Não deu pra abrir o Escritório")).toBeTruthy();
    expect(container.querySelector("[data-girando]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(tentou).toBe(1);
  });
  it("sem internet: diz isso e que abre sozinho quando voltar", () => {
    render(<Carregando texto="Abrindo o canal…" offline onTentar={() => {}} />);
    expect(screen.getByText("Você está sem internet")).toBeTruthy();
    expect(screen.getByText(/abre sozinho/)).toBeTruthy();
  });
  it("carregando normal: o pontinho girando mostra que não travou", () => {
    const { container } = render(<Carregando texto="Abrindo o canal…" onTentar={() => {}} />);
    expect(container.querySelector("[data-girando]")).not.toBeNull();
  });
});
