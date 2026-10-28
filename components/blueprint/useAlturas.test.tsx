// @vitest-environment jsdom
/** #631 · as medidas dos cards da prancha entram de UMA vez (antes, um redesenho por card). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { StrictMode, createElement, type ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { juntarAlturas, useAlturas } from "./useAlturas";

afterEach(() => { vi.useRealTimers(); });

describe("#631 · useAlturas", () => {
  it("cards medidos em commits SEPARADOS: nenhum redesenho até o quadro, e aí UM só", () => {
    vi.useFakeTimers();
    let renders = 0;
    const { result } = renderHook(() => { renders++; return useAlturas("bp1"); });
    const antes = renders;
    // cada medida no seu próprio act (o React não junta nada por nós): se o hook fizesse setState por card, contaria aqui
    for (let k = 0; k < 10; k++) { act(() => { result.current.guarda(`card:${k}`, 100 + k); }); expect(renders).toBe(antes); }
    act(() => { vi.advanceTimersByTime(20); });        // o requestAnimationFrame
    expect(renders).toBe(antes + 1);
    expect(Object.keys(result.current.alturas)).toHaveLength(10);
  });
  it("trocou de blueprint: as alturas do anterior somem NO MESMO render (antes, num efeito depois)", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ id }) => useAlturas(id), { initialProps: { id: "a" } });
    act(() => { result.current.guarda("passo:p1", 120); vi.advanceTimersByTime(20); });
    expect(result.current.alturas["passo:p1"]).toBe(120);
    rerender({ id: "b" });
    expect(result.current.alturas).toEqual({});
  });
  it("medida do blueprint que saiu da tela não entra no novo (mesmo id de módulo)", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ id }) => useAlturas(id), { initialProps: { id: "a" } });
    act(() => { result.current.guarda("passo:p1", 300); });   // do "a", ainda na fila
    rerender({ id: "b" });
    act(() => { result.current.guarda("passo:p1", 80); vi.advanceTimersByTime(20); });   // do "b"
    expect(result.current.alturas).toEqual({ "passo:p1": 80 });
  });
  it("StrictMode (os efeitos remontam): as alturas continuam chegando", () => {
    vi.useFakeTimers();
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);
    const { result } = renderHook(() => useAlturas("a"), { wrapper });
    act(() => { result.current.guarda("passo:p1", 90); vi.advanceTimersByTime(20); });
    act(() => { result.current.guarda("passo:p2", 70); vi.advanceTimersByTime(20); });
    expect(result.current.alturas).toEqual({ "passo:p1": 90, "passo:p2": 70 });
  });
  it("juntarAlturas: devolve o mesmo objeto se nada mudou mais de 1 px", () => {
    const a = { x: 100 };
    expect(juntarAlturas(a, { x: 100.5 })).toBe(a);
    expect(juntarAlturas(a, { x: 140 })).toEqual({ x: 140 });
    expect(juntarAlturas(a, { y: 50 })).toEqual({ x: 100, y: 50 });
  });
});
