// @vitest-environment jsdom
/** #631 · as medidas dos cards da prancha entram de UMA vez (antes, um redesenho por card). */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { juntarAlturas, useAlturas } from "./useAlturas";

describe("#631 · useAlturas", () => {
  it("dez cards medidos no mesmo quadro = UM redesenho", () => {
    vi.useFakeTimers();
    let renders = 0;
    const { result } = renderHook(() => { renders++; return useAlturas("bp1"); });
    const antes = renders;
    act(() => { for (let k = 0; k < 10; k++) result.current.guarda(`card:${k}`, 100 + k); });
    expect(renders).toBe(antes);                       // nada ainda: espera o quadro
    act(() => { vi.advanceTimersByTime(20); });        // o requestAnimationFrame
    expect(renders).toBe(antes + 1);
    expect(Object.keys(result.current.alturas)).toHaveLength(10);
    vi.useRealTimers();
  });
  it("trocar de blueprint zera as medidas", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ id }) => useAlturas(id), { initialProps: { id: "a" } });
    act(() => { result.current.guarda("passo:p1", 120); vi.advanceTimersByTime(20); });
    expect(result.current.alturas["passo:p1"]).toBe(120);
    rerender({ id: "b" });
    expect(result.current.alturas).toEqual({});
    vi.useRealTimers();
  });
  it("juntarAlturas: devolve o mesmo objeto se nada mudou mais de 1 px", () => {
    const a = { x: 100 };
    expect(juntarAlturas(a, { x: 100.5 })).toBe(a);
    expect(juntarAlturas(a, { x: 140 })).toEqual({ x: 140 });
    expect(juntarAlturas(a, { y: 50 })).toEqual({ x: 100, y: 50 });
  });
});
