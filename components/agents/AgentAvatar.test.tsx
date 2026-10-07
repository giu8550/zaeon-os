// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import AgentAvatar from "@/components/agents/AgentAvatar";
import { useSinalComSorriso, SORRISO_MS } from "@/components/agents/avatar/hooks";
import type { AvatarManifest, SinalAvatar } from "@/lib/avatars/estados";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

const manifest: AvatarManifest = {
  agentId: "aura", versao: "t", motor: "sprite", cor: "#6d28d9",
  estados: { idle: "/a/idle.webp", blink: "/a/blink.webp", think: "/a/think.webp", happy: "/a/happy.webp" },
  pequeno: { idle: "/a/idle.sm.webp", blink: "/a/blink.sm.webp", think: "/a/think.sm.webp", happy: "/a/happy.sm.webp" },
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

/** jsdom não tem IntersectionObserver: o avatar trata como "na tela" (monta os quadros). */
const visivel = (c: HTMLElement) => [...c.querySelectorAll("img")].find((i) => i.style.opacity === "1")?.getAttribute("src");

describe("AgentAvatar", () => {
  it("sem avatar vivo: a foto (ou a inicial) — o comportamento antigo", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ agentes: {} })));
    const { container, rerender } = render(<AgentAvatar src="/foto.png" nome="Nina" size={40} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/foto.png");
    rerender(<AgentAvatar nome="Nina" size={40} />);
    expect(screen.getByLabelText("Nina").textContent).toBe("N");
  });
  it("com manifesto: empilha os quadros e mostra o do estado (miniatura em avatar pequeno)", () => {
    const { container, rerender } = render(<AgentAvatar manifest={manifest} nome="Aura" size={40} />);
    expect(container.querySelectorAll("img")).toHaveLength(4);
    expect(visivel(container)).toBe("/a/idle.sm.webp");
    rerender(<AgentAvatar manifest={manifest} nome="Aura" size={200} estado="pensando" />);
    expect(visivel(container)).toBe("/a/think.webp");
    expect(screen.getByRole("img", { name: "Aura" })).toBeTruthy();
  });
});

describe("useSinalComSorriso", () => {
  it("pensando/falando → idle sorri por SORRISO_MS; erro não sorri", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ s }: { s: SinalAvatar }) => useSinalComSorriso(s), { initialProps: { s: "pensando" as SinalAvatar } });
    expect(result.current).toBe("pensando");
    rerender({ s: "idle" });
    expect(result.current).toBe("feliz");
    act(() => { vi.advanceTimersByTime(SORRISO_MS + 10); });
    expect(result.current).toBe("idle");
    rerender({ s: "erro" });
    rerender({ s: "idle" });
    expect(result.current).toBe("idle");
  });
});
