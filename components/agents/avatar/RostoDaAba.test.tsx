// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import RostoDaAba from "./RostoDaAba";
import { definirPresenca } from "@/lib/avatars/presenca";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
const manifest = { agentId: "aura", versao: "t", motor: "sprite", estados: { idle: "/i.webp", blink: "/b.webp" }, pequeno: {} };

afterEach(() => { cleanup(); vi.restoreAllMocks(); definirPresenca("aura", { sinal: "idle", boca: null }); });

describe("RostoDaAba", () => {
  it("respondeu com a aba fechada → anel 'respondeu' até voltar pro chat", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ agentes: { aura: manifest } })));
    const { rerender } = render(<RostoDaAba agentId="aura" nome="Aura" ativa={false}><span>⟁</span></RostoDaAba>);
    await waitFor(() => expect(screen.getByRole("img", { name: "Aura" })).toBeTruthy());
    act(() => definirPresenca("aura", { sinal: "pensando" }));
    act(() => definirPresenca("aura", { sinal: "falando" }));
    act(() => definirPresenca("aura", { sinal: "idle" }));
    expect(screen.getByText("Aura respondeu")).toBeTruthy();
    rerender(<RostoDaAba agentId="aura" nome="Aura" ativa><span>⟁</span></RostoDaAba>);
    expect(screen.queryByText("Aura respondeu")).toBeNull();
  });
  it("com o chat aberto não marca; sem avatar vivo mostra o ⟁", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ agentes: {} })));
    render(<RostoDaAba agentId="nina" nome="Nina" ativa={false}><span>⟁</span></RostoDaAba>);
    expect(screen.getByText("⟁")).toBeTruthy();
  });
});
