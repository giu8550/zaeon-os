// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import TourSala from "@/components/onboard/TourSala";
import TourEscritorio from "@/components/onboard/TourEscritorio";
import { EVT_PERGUNTA_CHAT, EVT_PERCURSO_ABERTO } from "@/lib/onboarding/tourSala";
import { EVT_ABRIR_DOC } from "@/lib/chat/documentos";

const disparar = (tipo: string, detail?: unknown) => act(() => { window.dispatchEvent(new CustomEvent(tipo, { detail })); });
const cartao = () => document.querySelector("[data-tour-cartao]") as HTMLElement | null;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.stubEnv("NEXT_PUBLIC_MAP_HARNESS", "1");
  Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const abrir = (el: React.ReactElement) => { render(el); act(() => { vi.advanceTimersByTime(1600); }); };
/** #605: a fala vem em caixas curtas — "Continuar" até o botão do passo aparecer */
const ateBotao = (nome: string | RegExp) => {
  for (let k = 0; k < 6 && !screen.queryByRole("button", { name: nome }); k++) fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  return screen.getByRole("button", { name: nome });
};

describe("TourSala — o tour do laboratório", () => {
  it("anda pela AÇÃO: pedir estudo → (Bora) → diagrama → percurso → Boa jornada marca como visto", () => {
    abrir(<TourSala noTutorial={false} />);
    expect(cartao()?.textContent).toMatch(/Quero estudar sobre/);
    expect(screen.getByText("1 / 5")).toBeTruthy();
    // passo de ação: sem botão de seguir, só o Pular
    expect(screen.queryByRole("button", { name: "Bora" })).toBeNull();
    disparar(EVT_PERGUNTA_CHAT, { prompt: "Quero estudar sobre: fotossíntese" });
    expect(cartao()?.textContent).toMatch(/caderno vivo/);
    fireEvent.click(ateBotao("Bora"));
    expect(cartao()?.textContent).toMatch(/diagrama interativo/);
    disparar(EVT_ABRIR_DOC, { studioKind: "aula" });           // uma aula não conta
    expect(cartao()?.textContent).toMatch(/diagrama interativo/);
    disparar(EVT_ABRIR_DOC, { studioKind: "diagram" });
    expect(cartao()?.textContent).toMatch(/percurso/);
    disparar(EVT_PERCURSO_ABERTO);
    expect(screen.getByText("5 / 5")).toBeTruthy();
    fireEvent.click(ateBotao(/Boa jornada/));
    expect(cartao()).toBeNull();
    expect(localStorage.getItem("zaeon.tour.sala.v2")).toBe("1");
    expect(fetch).toHaveBeenCalledWith("/api/onboard/tour", { method: "POST" });
  });

  it("Esc pula e marca como visto; da próxima vez não aparece", () => {
    abrir(<TourSala noTutorial={false} />);
    expect(cartao()).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(cartao()).toBeNull();
    cleanup();
    abrir(<TourSala noTutorial={false} />);
    expect(cartao()).toBeNull();
  });

  it("nada de dourado: o cartão é vidro com acento ciano/roxo", () => {
    abrir(<TourSala noTutorial={false} />);
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/ffc46b|amber|yellow/i);
  });

  it("no tutorial do tablet, não aparece", () => {
    abrir(<TourSala noTutorial />);
    expect(cartao()).toBeNull();
  });
});

describe("TourEscritorio", () => {
  it("só abre na aba do Escritório e anda no botão até o fim", () => {
    const { rerender } = render(<TourEscritorio naAba={false} noTutorial={false} />);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(cartao()).toBeNull();
    rerender(<TourEscritorio naAba noTutorial={false} />);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(cartao()).not.toBeNull();
    // (sem a flag do coworking, é o roteiro do 3D: 2 passos)
    fireEvent.click(ateBotao("Próximo"));
    fireEvent.click(ateBotao(/Bora trabalhar/));
    expect(cartao()).toBeNull();
    expect(localStorage.getItem("zaeon.tour.escritorio.v1")).toBe("1");
  });
});

describe("#605 · o cartão novo (diálogo com a Aura)", () => {
  const visivel = () => cartao()?.querySelector("p[aria-hidden]")?.textContent ?? "";
  it("a fala longa vem em caixas: só a 1ª aparece; Continuar mostra a próxima", () => {
    abrir(<TourSala noTutorial={false} />);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(visivel()).toMatch(/Que bom te ver aqui/);
    expect(visivel()).not.toMatch(/Bora começar/);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(visivel()).toMatch(/Bora começar/);
  });
  it("o texto aparece letra por letra; clicar no cartão completa na hora", () => {
    abrir(<TourSala noTutorial={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    act(() => { vi.advanceTimersByTime(300); });
    const parcial = visivel();
    expect(parcial.length).toBeGreaterThan(0);
    expect(parcial).not.toMatch(/qualquer coisa/);
    fireEvent.click(cartao()!);
    expect(visivel()).toMatch(/qualquer coisa\./);
  });
  it("o leitor de tela recebe a fala inteira, não letra por letra", () => {
    abrir(<TourSala noTutorial={false} />);
    const live = cartao()!.querySelector("[aria-live]")!;
    expect(live.textContent).toMatch(/Que bom te ver aqui.*Pode mandar!/s);
  });
  it("com 'reduzir movimento', o texto vem inteiro na hora", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    abrir(<TourSala noTutorial={false} />);
    expect(visivel()).toMatch(/Que bom te ver aqui\. 💜/);
  });
  it("'reduzir movimento' ligado com o cartão aberto: o texto completa na hora", () => {
    let ouvinte: (() => void) | null = null;
    const mq = { matches: false, addEventListener: (_: string, f: () => void) => { ouvinte = f; }, removeEventListener() {} };
    vi.stubGlobal("matchMedia", () => mq);
    abrir(<TourSala noTutorial={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    act(() => { vi.advanceTimersByTime(300); });
    expect(visivel()).not.toMatch(/qualquer coisa/);
    mq.matches = true;
    act(() => { ouvinte?.(); });
    expect(visivel()).toMatch(/qualquer coisa\./);
  });
  it("tem o retrato da Aura e a etiqueta AURA; o Escritório é ciano", () => {
    abrir(<TourSala noTutorial={false} />);
    expect(cartao()!.querySelector('img[src*="/avatars/aura/"]')).not.toBeNull();
    expect(cartao()!.textContent).toMatch(/AURA/);
    cleanup();
    render(<TourEscritorio naAba noTutorial={false} />);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(document.body.innerHTML).toMatch(/34,211,238/);
  });
});
