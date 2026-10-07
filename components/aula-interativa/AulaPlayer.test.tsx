// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import AulaPlayer from "./AulaPlayer";
import { normalizarAula } from "@/lib/aula-interativa/contrato";
import { temposDoBeat } from "@/lib/aula-interativa/tempo";
import { ROTEIRO_EXEMPLO } from "@/lib/aula-interativa/fixture";

const { aula } = normalizarAula(ROTEIRO_EXEMPLO);
const tempos = Object.fromEntries(aula.beats.map((b) => [b.id, temposDoBeat(b.narracao, 2)]));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"] });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

// em passos de 100 ms: o React só re-renderiza (e agenda a passagem de beat) entre um act e outro
const avancar = async (ms: number) => { for (let f = 0; f < ms; f += 100) await act(async () => { vi.advanceTimersByTime(100); }); };

describe("AulaPlayer", () => {
  it("começa parado na capa; tocar monta a cena e segue sozinho até a checagem", async () => {
    render(<AulaPlayer aula={aula} tempos={tempos} audioDe={() => null} />);
    expect(screen.getByRole("button", { name: "Começar a aula" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Começar a aula" }));
    await avancar(3000);                 // intro (2 s) + 0,7 s de passagem
    expect(screen.getByText("Entradas")).toBeTruthy();
    await avancar(5000);                 // fim da lição → beat da checagem (2 s de fala) → cartão
    expect(screen.getByRole("group", { name: "Checagem rápida" })).toBeTruthy();
  });

  it("checagem: erro explica e libera 'mostrar resposta'; acerto libera continuar; placar conta a 1ª tentativa", async () => {
    render(<AulaPlayer aula={aula} tempos={tempos} audioDe={() => null} />);
    fireEvent.click(screen.getByRole("button", { name: "Começar a aula" }));
    await avancar(8000);
    fireEvent.click(screen.getByRole("button", { name: /Água/ }));
    expect(screen.getByRole("status").textContent).toContain("A água entra");
    expect(screen.getByRole("button", { name: "Mostrar resposta" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Oxigênio/ }));
    expect(screen.getByRole("status").textContent).toContain("O oxigênio SAI");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    // pula até o placar pelas setas
    const prox = screen.getByRole("button", { name: "Próxima parte" });
    for (let i = 0; i < 3; i++) { fireEvent.click(prox); await avancar(50); }
    await avancar(2500);
    const lacuna = screen.getByLabelText("Sua resposta");
    fireEvent.change(lacuna, { target: { value: "agua" } });
    fireEvent.submit(lacuna.closest("form")!);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await avancar(2500);
    expect(screen.getByText(/Checagens: 0 de 1 de primeira/)).toBeTruthy();
    expect(screen.getByText(/Prática: 1 de 1 de primeira/)).toBeTruthy();
  });

  it("teclado: espaço começa, → avança, C liga/desliga a legenda", async () => {
    const { container } = render(<AulaPlayer aula={aula} tempos={tempos} audioDe={() => null} />);
    const raiz = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(raiz, { key: " " });
    await avancar(300);
    expect(screen.getByRole("button", { name: "Pausar" })).toBeTruthy();
    fireEvent.keyDown(raiz, { key: "ArrowRight" });
    await avancar(50);
    expect(screen.getByText("Entradas")).toBeTruthy();
    const cc = screen.getByRole("button", { name: "Legenda" });
    expect(cc.getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(raiz, { key: "c" });
    expect(cc.getAttribute("aria-pressed")).toBe("false");
  });
});
