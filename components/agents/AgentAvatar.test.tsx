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

describe("AgentAvatar · falando (o caso do celular: 1 vaga, bolinha da aba presente)", () => {
  const comBoca: AvatarManifest = {
    ...manifest,
    estados: { ...manifest.estados, talk: "/a/talk.webp", talk_half: "/a/talk_half.webp" },
    pequeno: { ...manifest.pequeno, talk: "/a/talk.sm.webp", talk_half: "/a/talk_half.sm.webp" },
  };
  it("a resposta mais recente abre a boca enquanto fala, mesmo com a bolinha da aba pedindo vaga", async () => {
    vi.useFakeTimers();
    // tela estreita → modo lite → só 1 vivo por vez
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width"), addEventListener() {}, removeEventListener() {} }));
    const { container } = render(
      <>
        <AgentAvatar manifest={comBoca} nome="Aura" size={24} estado="falando" vivo={false} />
        <AgentAvatar manifest={comBoca} nome="Aura" size={36} estado="falando" destaque />
      </>,
    );
    const [aba, resposta] = [...container.querySelectorAll("span[role=img]")] as HTMLElement[];
    const vistos = new Set<string>();
    for (let k = 0; k < 40; k++) {
      act(() => { vi.advanceTimersByTime(60); });
      vistos.add(visivel(resposta) ?? "");
    }
    expect([...vistos].some((s) => s.includes("talk"))).toBe(true); // a boca abriu
    expect(visivel(aba)).toBe("/a/idle.sm.webp");                    // a bolinha não gastou a vaga
    vi.unstubAllGlobals();
  });
});
