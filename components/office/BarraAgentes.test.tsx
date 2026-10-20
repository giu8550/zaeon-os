// @vitest-environment jsdom
/**
 * #443 · a barra de agentes: quem está na conversa vem destacado; a agente dispensada sai do destaque e volta
 * quando é chamada com @ (o servidor manda a lista nova em `agentesNoCanal` e a tela repassa pra cá).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import BarraAgentes, { type AgenteDaBarra } from "./BarraAgentes";
import { agentesDepois } from "@/lib/canal/dispensa";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
afterEach(() => cleanup());

const ag = (agentKey: string, nome: string): AgenteDaBarra => ({ agentKey, nome, emoji: "✨", curso: null, avatarUrl: null });
const TODOS = [ag("aura", "Aura"), ag("zenita", "Zenita"), ag("nina", "Nina")];
const destaque = () => Object.fromEntries(screen.getAllByRole("button").map((b) => [b.getAttribute("data-agente"), b.getAttribute("data-na-conversa")]));
const base = { agentes: TODOS, digitando: [] as string[], estado: {}, onChamar: () => {} };

describe("BarraAgentes", () => {
  it("quem está na conversa vem primeiro e destacado; os outros depois", () => {
    render(<BarraAgentes {...base} naConversa={["zenita"]} />);
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("data-agente"))).toEqual(["zenita", "aura", "nina"]);
    expect(destaque()).toEqual({ zenita: "sim", aura: "nao", nina: "nao" });
  });

  it("dispensada: sai do destaque; chamada com @: volta (a lista vem do servidor depois de cada mensagem)", () => {
    let naConversa = ["aura", "zenita"];
    const { rerender } = render(<BarraAgentes {...base} naConversa={naConversa} />);
    expect(destaque().zenita).toBe("sim");

    naConversa = agentesDepois(naConversa, ["zenita"], ["zenita"]);  // "pode sair @zenita"
    rerender(<BarraAgentes {...base} naConversa={naConversa} />);
    expect(destaque()).toEqual({ aura: "sim", zenita: "nao", nina: "nao" });

    naConversa = agentesDepois(naConversa, ["zenita"], []);          // "@zenita oi"
    rerender(<BarraAgentes {...base} naConversa={naConversa} />);
    expect(destaque()).toEqual({ aura: "sim", zenita: "sim", nina: "nao" });
  });

  it("tocar numa agente chama ela (põe o @ no campo)", () => {
    const onChamar = vi.fn();
    render(<BarraAgentes {...base} naConversa={[]} onChamar={onChamar} />);
    fireEvent.click(screen.getByRole("button", { name: /Nina/ }));
    expect(onChamar).toHaveBeenCalledWith("nina");
  });

  it("em descanso aparece marcado", () => {
    render(<BarraAgentes {...base} naConversa={["aura"]} estado={{ aura: "descanso" }} />);
    expect(screen.getByText("em descanso")).toBeTruthy();
  });

  it("sem agentes: não aparece", () => {
    const { container } = render(<BarraAgentes {...base} agentes={[]} naConversa={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
