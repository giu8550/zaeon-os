// @vitest-environment jsdom
/** #629 · o "já vi" dos tutoriais salvo na conta (User.toursVistos), não só no navegador. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { CHAVE_LOCAL, __reiniciarVistos, carregarVistosDaConta, limparItens, limparVistosDaConta, salvarVistoNaConta, vistosJaLidos } from "./vistosConta";

const resp = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
let chamadas: { url: string; init?: RequestInit }[] = [];
const conta = (vistos: string[] | null, status = 200) =>
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { chamadas.push({ url, init }); return resp(vistos ? { vistos } : { error: "x" }, status); }));

beforeEach(() => { localStorage.clear(); chamadas = []; __reiniciarVistos(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("#629 · vistosConta", () => {
  it("o que a conta já viu vira visto neste navegador (outro computador não mostra de novo)", async () => {
    conta(["sala", "dica:perfil"]);
    await carregarVistosDaConta();
    expect(localStorage.getItem(CHAVE_LOCAL.sala)).toBe("1");
    expect(localStorage.getItem(CHAVE_LOCAL["dica:perfil"])).toBe("1");
    expect(localStorage.getItem(CHAVE_LOCAL.escritorio)).toBeNull();
    expect(vistosJaLidos()).toBe(true);
  });
  it("o que só este navegador sabia sobe pra conta (quem já tinha visto antes da mudança)", async () => {
    localStorage.setItem(CHAVE_LOCAL.escritorio, "1");
    conta(["sala"]);
    await carregarVistosDaConta();
    await Promise.resolve();
    const post = chamadas.find((c) => c.init?.method === "POST");
    expect(JSON.parse(String(post!.init!.body))).toEqual({ itens: ["escritorio"] });
  });
  it("sem login (401): segue só com o navegador, sem quebrar", async () => {
    conta(null, 401);
    await carregarVistosDaConta();
    expect(localStorage.getItem(CHAVE_LOCAL.sala)).toBeNull();
    expect(vistosJaLidos()).toBe(true);
  });
  it("lê a conta uma vez só por página", async () => {
    conta([]);
    await carregarVistosDaConta(); await carregarVistosDaConta();
    expect(chamadas.filter((c) => !c.init?.method).length).toBe(1);
  });
  it("salvar e limpar (\"Rever tutorial\") falam com a conta", async () => {
    conta([]);
    salvarVistoNaConta("sala");
    limparVistosDaConta();
    await Promise.resolve();
    expect(chamadas.map((c) => c.init?.method)).toEqual(["POST", "DELETE"]);
    await carregarVistosDaConta();                       // depois de limpar, não relê (não remarca o que acabou de ser esquecido)
    expect(chamadas.length).toBe(2);
  });
  it("limparItens: só itens conhecidos, sem repetir", () => {
    expect(limparItens(["sala", "sala", "hack", 3, "dica:perfil"])).toEqual(["sala", "dica:perfil"]);
    expect(limparItens(null)).toEqual([]);
  });
  it("o tour da Sala ESPERA a conta: se ela já viu noutro navegador, não aparece", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_MAP_HARNESS", "1");
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
    conta(["sala"]);
    const { default: TourSala } = await import("@/components/onboard/TourSala");
    render(<TourSala noTutorial={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(document.querySelector("[data-tour-cartao]")).toBeNull();
    vi.unstubAllEnvs();
  });
});
