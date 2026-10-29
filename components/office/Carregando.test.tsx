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
