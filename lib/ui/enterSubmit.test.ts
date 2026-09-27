import { describe, it, expect, vi } from "vitest";
import { isSubmitEnter, onEnterSubmit } from "./enterSubmit";

const ev = (o: Partial<{ key: string; shiftKey: boolean; isComposing: boolean }>) => ({
  key: "Enter", shiftKey: false, preventDefault: vi.fn(), nativeEvent: { isComposing: o.isComposing }, ...o,
});

describe("enterSubmit", () => {
  it("Enter envia", () => {
    const fn = vi.fn(); const e = ev({});
    onEnterSubmit(fn)(e);
    expect(fn).toHaveBeenCalledOnce();
    expect(e.preventDefault).toHaveBeenCalled();
  });
  it("Shift+Enter não envia", () => expect(isSubmitEnter(ev({ shiftKey: true }))).toBe(false));
  it("IME compondo não envia", () => expect(isSubmitEnter(ev({ isComposing: true }))).toBe(false));
  it("outras teclas não enviam", () => expect(isSubmitEnter(ev({ key: "a" }))).toBe(false));
});
