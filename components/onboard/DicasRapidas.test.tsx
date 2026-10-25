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
  it("\"Rever tutorial\" traz as dicas de volta", () => {
    localStorage.setItem("zaeon.dica.perfil.v1", "1");
    reverToursDoLab();
    expect(localStorage.getItem("zaeon.dica.perfil.v1")).toBeNull();
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
    reverToursDoLab();
    expect(localStorage.getItem("zaeon.dica.sala-estudos.v1")).toBeNull();
  });
});
