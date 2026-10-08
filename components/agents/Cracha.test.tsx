// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Cracha from "./Cracha";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const base = { agentId: "nina", nome: "Nina", curso: "Sala de Estudos", id: "ZA-N03", rotulo: "nativo" };

describe("Cracha", () => {
  it("mostra nome, área, selo e a ação (já incluso / contratar)", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ agentes: {} })));
    render(<Cracha d={{ ...base, artefatos: ["caderno", "resumos"] }} acao={<span>✓ já incluso</span>} />);
    expect(screen.getByRole("heading", { name: "Nina" })).toBeTruthy();
    expect(screen.getByText("Sala de Estudos")).toBeTruthy();
    expect(screen.getByText("nativo")).toBeTruthy();
    expect(screen.getByText("✓ já incluso")).toBeTruthy();
    expect(screen.getByText("ZA-N03")).toBeTruthy();
  });
  it("redes: só aparece o que foi preenchido no Modo CEO, com o link certo", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ agentes: {} })));
    const { rerender } = render(<Cracha d={base} />);
    expect(screen.queryByRole("link")).toBeNull();
    rerender(<Cracha d={{ ...base, redes: { whatsapp: "+5511999998888", instagram: "nina.zaeon", facebook: null } }} />);
    expect(screen.getByRole("link", { name: "WhatsApp de Nina" }).getAttribute("href")).toBe("https://wa.me/5511999998888");
    expect(screen.getByRole("link", { name: "Instagram de Nina" }).getAttribute("href")).toBe("https://instagram.com/nina.zaeon");
    expect(screen.queryByRole("link", { name: /Facebook/ })).toBeNull();
  });
});
