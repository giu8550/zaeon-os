// @vitest-environment jsdom
/** #618 · dicas rápidas: um balão por vez, "Entendi", uma vez só, sem "Passo X de Y". */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import DicasRapidas from "@/components/onboard/DicasRapidas";
import { DICAS_PERFIL } from "@/lib/onboarding/dicas";
import { reverToursDoLab } from "@/lib/onboarding/reverTours";

const cartao = () => document.querySelector("[data-tour-cartao]") as HTMLElement | null;
const abrir = () => { render(<DicasRapidas lugar="perfil" dicas={DICAS_PERFIL} />); act(() => { vi.advanceTimersByTime(1300); }); };

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("#618 · DicasRapidas", () => {
  it("uma dica por vez com \"Entendi\"; a última fecha e marca como vista", () => {
    abrir();
    expect(cartao()!.textContent).toMatch(/habilidades/);
    expect(cartao()!.textContent).not.toMatch(/Passo|Pular|Minimizar/);
    fireEvent.click(screen.getByRole("button", { name: /Entendi/ }));
    expect(cartao()!.textContent).toMatch(/Editar/);
    fireEvent.click(screen.getByRole("button", { name: /Entendi/ }));
    expect(cartao()).toBeNull();
    expect(localStorage.getItem("zaeon.dica.perfil.v1")).toBe("1");
    cleanup(); abrir();
    expect(cartao()).toBeNull();
  });
  it("Esc fecha na hora (sem perguntar) e marca como vista", () => {
    abrir();
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => { vi.advanceTimersByTime(1); });
    expect(cartao()).toBeNull();
    expect(localStorage.getItem("zaeon.dica.perfil.v1")).toBe("1");
  });
  it("no celular não aparece", () => {
    Object.defineProperty(window, "innerWidth", { value: 500, configurable: true });
    abrir();
    expect(cartao()).toBeNull();
  });
  it("\"Rever tutorial\" com a tela aberta: as dicas aparecem de novo (sem sair e voltar)", () => {
    abrir();
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => { vi.advanceTimersByTime(1); });
    expect(cartao()).toBeNull();
    act(() => { reverToursDoLab(); });
    act(() => { vi.advanceTimersByTime(1300); });
    expect(cartao()!.textContent).toMatch(/habilidades/);
  });
  it("Esc fecha a dica mesmo com o cursor num campo de texto", () => {
    abrir();
    const campo = document.createElement("textarea"); document.body.appendChild(campo);
    fireEvent.keyDown(campo, { key: "Escape" });
    act(() => { vi.advanceTimersByTime(1); });
    expect(cartao()).toBeNull();
    campo.remove();
  });
  it("com uma dica na tela, o tour da sala espera (não abrem os dois juntos)", async () => {
    const { dicaAtiva } = await import("@/lib/onboarding/dicas");
    abrir();
    expect(dicaAtiva()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Entendi/ }));
    fireEvent.click(screen.getByRole("button", { name: /Entendi/ }));
    expect(dicaAtiva()).toBe(false);
  });
  it("fundador não tem botão de skin: a dica não fala dele", async () => {
    const { dicasDoPerfil } = await import("@/lib/onboarding/dicas");
    expect(dicasDoPerfil({ fundador: false })[1]!.texto).toMatch(/skin/);
    expect(dicasDoPerfil({ fundador: true })[1]!.texto).not.toMatch(/skin/);
    expect(dicasDoPerfil({ fundador: true })[1]!.texto).toMatch(/foto/);
  });
});

describe("#618 · dicas da Sala de Estudos (blueprint)", () => {
  it("falam das 4 fases, dos críticos e da prova; o \"Rever tutorial\" traz de volta", async () => {
    const { DICAS_SALA } = await import("@/lib/onboarding/dicas");
    render(<DicasRapidas lugar="sala-estudos" dicas={DICAS_SALA} />); act(() => { vi.advanceTimersByTime(1300); });
    expect(cartao()!.textContent).toMatch(/blueprint/);
    fireEvent.click(screen.getByRole("button", { name: /Entendi/ }));
    expect(cartao()!.textContent).toMatch(/4 fases.*críticos.*prova/s);
    fireEvent.click(screen.getByRole("button", { name: /Entendi/ }));
    expect(localStorage.getItem("zaeon.dica.sala-estudos.v1")).toBe("1");
    act(() => { reverToursDoLab(); });
    act(() => { vi.advanceTimersByTime(1300); });
    expect(cartao()!.textContent).toMatch(/blueprint/);   // reaparece com a tela aberta
  });
});

describe("#626 · Rever tutorial abre uma conversa nova", () => {
  it("pede uma conversa nova e vazia pra Sala de Estudos (o bilhete fica, se o chat ainda não abriu)", async () => {
    const { EVT_PEDIDO_CONVERSA } = await import("@/lib/chat/conversasNav");
    const ouvir = vi.fn();
    window.addEventListener(EVT_PEDIDO_CONVERSA, ouvir);
    reverToursDoLab();
    expect((ouvir.mock.calls[0]![0] as CustomEvent).detail).toEqual({ sala: "estudos", nova: true });
    expect(JSON.parse(localStorage.getItem("zaeon.conversa.pedido.estudos")!)).toEqual({ sala: "estudos", nova: true });
    window.removeEventListener(EVT_PEDIDO_CONVERSA, ouvir);
  });
});
