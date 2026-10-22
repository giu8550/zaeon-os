// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen, renderHook, act } from "@testing-library/react";
import { SeletorModelo, SeloModelo, useModeloEscolhido } from "./SeletorModelo";
import { MODELOS_CHAT, CHAVE_MODELO } from "@/lib/chat/modelos";

afterEach(() => { cleanup(); localStorage.clear(); });

describe("SeletorModelo", () => {
  it("mostra símbolo + nome; abre a lista dos 4 e troca", () => {
    const onChange = vi.fn();
    render(<SeletorModelo valor={MODELOS_CHAT[0]} onChange={onChange} />);
    const pilula = screen.getByRole("button", { name: /Gemini 3\.5 Flash/ });
    expect(pilula.textContent).toContain("✦");
    fireEvent.click(pilula);
    const opcoes = screen.getAllByRole("option");
    expect(opcoes.map((o) => o.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("Qwen3 30B")]));
    expect(opcoes).toHaveLength(4);
    fireEvent.click(screen.getByText("Qwen3 30B"));
    expect(onChange).toHaveBeenCalledWith("zaeon-qwen30");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
  it("useModeloEscolhido lembra a escolha e ignora id fora do catálogo", () => {
    localStorage.setItem(CHAVE_MODELO, "gpt-4o");
    const { result } = renderHook(() => useModeloEscolhido());
    expect(result.current[0].id).toBe("gemini-3.5-flash");
    act(() => result.current[1]("zaeon-qwen30"));
    expect(result.current[0].id).toBe("zaeon-qwen30");
    expect(localStorage.getItem(CHAVE_MODELO)).toBe("zaeon-qwen30");
  });
  it("SeloModelo marca local e reserva", () => {
    const { container, rerender } = render(<SeloModelo nome="Qwen3 30B · local" />);
    expect(container.textContent).toContain("⬢");
    rerender(<SeloModelo nome="gpt-oss-120b · reserva" />);
    expect(container.textContent).toContain("↺");
  });
});
