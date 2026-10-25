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
    expect(screen.getByText("Passo 1 de 5")).toBeTruthy();
    // passo de ação: sem botão de seguir, só o Pular
    expect(screen.queryByRole("button", { name: "Bora" })).toBeNull();
    disparar(EVT_PERGUNTA_CHAT, { prompt: "Quero estudar sobre: fotossíntese" });
    expect(cartao()?.textContent).toMatch(/caderno vivo/);
    fireEvent.click(ateBotao("Bora"));
    expect(cartao()?.textContent).toMatch(/diagrama interativo/);
    disparar(EVT_ABRIR_DOC, { studioKind: "quiz" });           // um documento que não é visual não conta
    expect(cartao()?.textContent).toMatch(/diagrama interativo/);
    disparar(EVT_ABRIR_DOC, { studioKind: "diagram" });
    expect(cartao()?.textContent).toMatch(/percurso/);
    disparar(EVT_PERCURSO_ABERTO);
    expect(screen.getByText("Passo 5 de 5")).toBeTruthy();
    fireEvent.click(ateBotao(/Boa jornada/));
    expect(cartao()).toBeNull();
    expect(localStorage.getItem("zaeon.tour.sala.v2")).toBe("1");
    expect(fetch).toHaveBeenCalledWith("/api/onboard/tour", { method: "POST" });
  });

  it("Esc pergunta antes; confirmando, pula e marca como visto; da próxima vez não aparece", () => {
    abrir(<TourSala noTutorial={false} />);
    expect(cartao()).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => { vi.advanceTimersByTime(1); });
    expect(cartao()?.textContent).toMatch(/Pular o tutorial\?/);
    fireEvent.click(screen.getByRole("button", { name: "Sim, pular" }));
    expect(cartao()).toBeNull();
    cleanup();
    abrir(<TourSala noTutorial={false} />);
    expect(cartao()).toBeNull();
  });

  it("#613: Esc digitando no chat não mexe no tutorial", () => {
    abrir(<TourSala noTutorial={false} />);
    const campo = document.createElement("textarea");
    document.body.appendChild(campo);
    fireEvent.keyDown(campo, { key: "Escape" });
    act(() => { vi.advanceTimersByTime(1); });
    expect(cartao()?.textContent).not.toMatch(/Pular o tutorial\?/);
    expect(localStorage.getItem("zaeon.tour.sala.v2")).toBeNull();
    campo.remove();
  });

  it("#613: Pular pede confirmação e dá pra voltar pro tutorial", () => {
    abrir(<TourSala noTutorial={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    expect(cartao()).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continuar tutorial" }));
    expect(cartao()?.textContent).not.toMatch(/Pular o tutorial\?/);
    expect(localStorage.getItem("zaeon.tour.sala.v2")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, pular" }));
    expect(cartao()).toBeNull();
    expect(localStorage.getItem("zaeon.tour.sala.v2")).toBe("1");
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

describe("#613 · ajustes rápidos do cartão", () => {
  it("terminou de falar: o retrato visível é o sorriso de BOCA FECHADA (idle)", () => {
    abrir(<TourSala noTutorial={false} />);
    act(() => { vi.advanceTimersByTime(10_000); });
    const img = [...cartao()!.querySelectorAll("img")].find((i) => i.style.opacity === "1");
    expect(img?.getAttribute("src")).toBe("/avatars/aura/idle.sm.webp");
  });
  it("o contorno do destaque é fixo no CSS (não depende da animação) — aparece com 'reduzir movimento'", () => {
    abrir(<TourSala noTutorial={false} />);
    expect(document.body.innerHTML).toMatch(/\.bt-anel \{ box-shadow: 0 0 0 2px/);
  });
  it("mostra 'Passo X de Y' escrito", () => {
    abrir(<TourSala noTutorial={false} />);
    expect(cartao()!.textContent).toMatch(/Passo 1 de 5/);
  });
});

describe("#613 · \"Sua vez\": a tarefa não some e o destaque vem na hora certa", () => {
  const paginaFinal = () => { for (let k = 0; k < 6 && screen.queryByRole("button", { name: "Continuar" }); k++) fireEvent.click(screen.getByRole("button", { name: "Continuar" })); };
  const suaVez = () => document.querySelector("[data-tour-sua-vez]") as HTMLElement | null;
  it("na saudação não tem 'Sua vez' nem destaque; na última caixa tem os dois", () => {
    const campo = document.createElement("div");
    campo.setAttribute("data-tour", "composer-estudos");
    campo.getBoundingClientRect = () => ({ x: 300, y: 600, left: 300, top: 600, width: 500, height: 60, right: 800, bottom: 660, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(campo);
    abrir(<TourSala noTutorial={false} />);
    act(() => { vi.advanceTimersByTime(500); });
    expect(suaVez()).toBeNull();
    expect(document.querySelector("[data-tour-anel]")).toBeNull();
    paginaFinal();
    act(() => { vi.advanceTimersByTime(500); });
    expect(suaVez()?.textContent).toMatch(/Escreve um tema no chat/);
    expect(document.querySelector("[data-tour-anel]")).not.toBeNull();
    campo.remove();
  });
  it("o exemplo escreve no chat (a pessoa é quem manda)", () => {
    abrir(<TourSala noTutorial={false} />);
    paginaFinal();
    const ouvir = vi.fn();
    window.addEventListener("zaeon:chat:preencher", ouvir);
    fireEvent.click(screen.getByRole("button", { name: /Quero estudar sobre fotossíntese/ }));
    expect((ouvir.mock.calls[0]![0] as CustomEvent).detail).toEqual({ texto: "Quero estudar sobre fotossíntese" });
    window.removeEventListener("zaeon:chat:preencher", ouvir);
    expect(cartao()).not.toBeNull(); // o passo só anda quando a pergunta for MANDADA
  });
});

describe("#613 · diagrama e percurso não travam o tour", () => {
  const paginaFinal = () => { for (let k = 0; k < 6 && screen.queryByRole("button", { name: "Continuar" }); k++) fireEvent.click(screen.getByRole("button", { name: "Continuar" })); };
  const ateDiagrama = () => {
    abrir(<TourSala noTutorial={false} />);
    disparar(EVT_PERGUNTA_CHAT, { prompt: "Quero estudar sobre: fotossíntese" });
    fireEvent.click(ateBotao("Bora"));
    paginaFinal();
  };
  it("a IA respondeu com uma aula: o passo do diagrama anda do mesmo jeito", () => {
    ateDiagrama();
    disparar(EVT_ABRIR_DOC, { studioKind: "aula" });
    expect(cartao()?.textContent).toMatch(/percurso/);
  });
  it("\"Já fiz ✓\" segue o passo do diagrama", () => {
    ateDiagrama();
    fireEvent.click(screen.getByRole("button", { name: "Já fiz ✓" }));
    expect(cartao()?.textContent).toMatch(/percurso/);
  });
  it("o percurso: gerando… e depois pronto, abre o mapa", () => {
    ateDiagrama();
    disparar(EVT_ABRIR_DOC, { studioKind: "diagram" });
    paginaFinal();
    const sv = () => document.querySelector("[data-tour-sua-vez]")?.textContent ?? "";
    expect(sv()).toMatch(/Clica no ✦/);
    expect(screen.queryByRole("button", { name: "Já fiz ✓" })).toBeNull();
    disparar("zaeon:percurso:estado", "gerando");
    expect(sv()).toMatch(/Gerando o teu percurso/);
    disparar("zaeon:percurso:estado", "ativa");
    expect(sv()).toMatch(/Pronto!.*abrir o mapa/);
  });
});

describe("#613 · minimizar o cartão", () => {
  it("minimiza numa pílula (sem escurecer a tela) e reabre no mesmo lugar", () => {
    abrir(<TourSala noTutorial={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Minimizar o tutorial" }));
    expect(cartao()).toBeNull();
    const pilula = document.querySelector("[data-tour-minimizado]") as HTMLElement;
    expect(pilula.textContent).toMatch(/Passo 1 de 5/);
    expect(localStorage.getItem("zaeon.tour.sala.v2")).toBeNull();   // minimizar não é pular
    fireEvent.click(pilula);
    expect(cartao()).not.toBeNull();
  });
  it("fez a ação minimizado: o próximo passo volta aberto", () => {
    abrir(<TourSala noTutorial={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Minimizar o tutorial" }));
    disparar(EVT_PERGUNTA_CHAT, { prompt: "Quero estudar sobre: fotossíntese" });
    expect(cartao()?.textContent).toMatch(/caderno vivo/);
  });
});

describe("#613 · rever o tutorial sem console", () => {
  it("depois de pular, \"Rever tutorial\" esquece os dois tours e o da sala recomeça do 1º passo", async () => {
    const { reverToursDoLab } = await import("@/lib/onboarding/reverTours");
    abrir(<TourSala noTutorial={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, pular" }));
    expect(cartao()).toBeNull();
    localStorage.setItem("zaeon.tour.escritorio.v1", "1");
    act(() => { reverToursDoLab(); });
    expect(localStorage.getItem("zaeon.tour.sala.v2")).toBeNull();
    expect(localStorage.getItem("zaeon.tour.escritorio.v1")).toBeNull();
    expect(screen.getByText("Passo 1 de 5")).toBeTruthy();
  });
});

describe("#613 · revisão (Sourcery)", () => {
  it("o Esc que fechou o mapa (preventDefault) não abre o \"Pular o tutorial?\"", () => {
    abrir(<TourSala noTutorial={false} />);
    const mapa = (e: KeyboardEvent) => { if (e.key === "Escape") e.preventDefault(); };
    window.addEventListener("keydown", mapa);
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => { vi.advanceTimersByTime(1); });
    expect(cartao()?.textContent).not.toMatch(/Pular o tutorial\?/);
    window.removeEventListener("keydown", mapa);
  });
  it("um tour começado antes do \"Rever tutorial\" (noutra aba) não marca como visto de novo", async () => {
    const { marcarTourSalaVisto } = await import("@/lib/onboarding/tourSala");
    const { marcarTourEscritorioVisto } = await import("@/lib/onboarding/tourEscritorio");
    const { geracaoDosTours } = await import("@/lib/onboarding/geracaoTour");
    const { reverToursDoLab } = await import("@/lib/onboarding/reverTours");
    const antes = geracaoDosTours();
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    reverToursDoLab();
    marcarTourSalaVisto(antes);
    marcarTourEscritorioVisto(antes);
    expect(localStorage.getItem("zaeon.tour.sala.v2")).toBeNull();
    expect(localStorage.getItem("zaeon.tour.escritorio.v1")).toBeNull();
    marcarTourSalaVisto(geracaoDosTours());
    expect(localStorage.getItem("zaeon.tour.sala.v2")).toBe("1");
  });
});

describe("#618 · o contorno anda junto com a pessoa", () => {
  const paginaFinal = () => { for (let k = 0; k < 6 && screen.queryByRole("button", { name: "Continuar" }); k++) fireEvent.click(screen.getByRole("button", { name: "Continuar" })); };
  const caixa = (el: HTMLElement, x: number, y: number, w: number, h: number) => {
    el.getBoundingClientRect = () => ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON: () => ({}) }) as DOMRect;
  };
  it("campo vazio → contorno no campo; com texto → no ➤ e \"Agora é só mandar\"; apagou → volta pro campo", () => {
    const campo = document.createElement("div");
    campo.setAttribute("data-tour", "composer-estudos");
    const enviar = document.createElement("button");
    enviar.setAttribute("data-tour", "enviar");
    campo.appendChild(enviar);
    document.body.appendChild(campo);
    caixa(campo, 160, 450, 850, 140); caixa(enviar, 960, 540, 40, 40);
    abrir(<TourSala noTutorial={false} />);
    paginaFinal();
    const anel = () => document.querySelector("[data-tour-anel]") as HTMLElement | null;
    const sv = () => document.querySelector("[data-tour-sua-vez]")?.textContent ?? "";
    act(() => { vi.advanceTimersByTime(100); });
    expect(anel()!.style.width).toBe("862px");          // o campo (+6 de cada lado)
    expect(sv()).toMatch(/Escreve um tema/);
    disparar("zaeon:chat:texto", true);
    act(() => { vi.advanceTimersByTime(100); });
    expect(anel()!.style.width).toBe("52px");           // o ➤
    expect(sv()).toMatch(/Agora é só mandar ➤/);
    disparar("zaeon:chat:texto", false);
    act(() => { vi.advanceTimersByTime(100); });
    expect(anel()!.style.width).toBe("862px");
    campo.remove();
  });
  it("o exemplo diz o que faz", () => {
    abrir(<TourSala noTutorial={false} />);
    paginaFinal();
    expect(screen.getByRole("button", { name: /Usar o exemplo: “Quero estudar sobre fotossíntese”/ })).toBeTruthy();
    expect(document.querySelector("[data-tour-sua-vez]")!.textContent).toMatch(/é só apertar ➤/);
  });
});

describe("#618 · minimizar visível", () => {
  it("tem o botão \"Minimizar\" escrito junto do Pular, e ele minimiza", () => {
    abrir(<TourSala noTutorial={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Minimizar" }));
    expect(cartao()).toBeNull();
    expect(document.querySelector("[data-tour-minimizado]")).not.toBeNull();
  });
});
