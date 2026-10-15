// @vitest-environment jsdom
/**
 * AgendaBandeja (#396) na tela: abre e carrega, dois cliques na mesma coluna salvam o intervalo,
 * clique em outra coluna recomeça, Esc cancela, tocar na PRÓPRIA foto apaga (com confirmação) e a
 * foto de outra pessoa não apaga nada. fetch mockado; regras puras já testadas em lib/canal/agenda.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AgendaBandeja from "./AgendaBandeja";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

const CANAL = "d".repeat(24), EU = "a".repeat(24), OUTRA = "b".repeat(24);
let blocos: any[] = [];
let chamadas: { url: string; metodo: string; body?: any }[] = [];
let falharGet = false;

const resp = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  blocos = []; chamadas = []; falharGet = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? "GET";
    chamadas.push({ url: String(url), metodo, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (metodo === "GET") {
      if (falharGet) return resp(403, { error: "Forbidden" });
      return resp(200, { eu: EU, blocos, pessoas: [{ id: EU, nome: "Giulia", avatar: null }, { id: OUTRA, nome: "Martinez", avatar: null }] });
    }
    if (metodo === "POST") {
      const b = JSON.parse(String(init!.body));
      const novo = { id: "c".repeat(24), userId: EU, ...b };
      blocos = [...blocos, novo];
      return resp(201, { bloco: novo, removidos: [] });
    }
    if (metodo === "DELETE") { blocos = blocos.filter((b) => !String(url).includes(b.id)); return resp(200, { ok: true }); }
    return resp(404, {});
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const abrir = () => render(<AgendaBandeja canalId={CANAL} aberta onFechar={() => {}} versao={0} />);
const celula = (rotulo: string) => screen.getByRole("button", { name: rotulo });

describe("AgendaBandeja", () => {
  it("fechada não desenha nada nem busca", () => {
    const { container } = render(<AgendaBandeja canalId={CANAL} aberta={false} onFechar={() => {}} versao={0} />);
    expect(container.innerHTML).toBe("");
    expect(chamadas).toHaveLength(0);
  });

  it("aberta carrega a agenda do canal e mostra a grade (segunda a domingo)", async () => {
    abrir();
    await waitFor(() => expect(celula("Ter 9h: livre")).toBeTruthy());
    expect(chamadas[0]).toMatchObject({ url: `/api/canal/${CANAL}/agenda`, metodo: "GET" });
    expect(screen.getByText("Seg")).toBeTruthy();
    expect(screen.getByText("Dom")).toBeTruthy();
  });

  it("o exemplo do card: terça 9 + terça 15 salva das 9 às 15 e pinta o intervalo", async () => {
    abrir();
    await waitFor(() => expect(celula("Ter 9h: livre")).toBeTruthy());
    fireEvent.click(celula("Ter 9h: livre"));
    expect(screen.getByText(/toque no horário FINAL/i)).toBeTruthy();
    fireEvent.click(celula("Ter 15h: livre"));
    await waitFor(() => expect(chamadas.some((c) => c.metodo === "POST")).toBe(true));
    expect(chamadas.find((c) => c.metodo === "POST")!.body).toEqual({ dia: 2, inicio: 9, fim: 15 });
    // recarregou: os quadrados das 9h às 15h agora são da Giulia; 16h continua livre
    await waitFor(() => expect(celula("Ter 12h: Giulia")).toBeTruthy());
    expect(celula("Ter 9h: Giulia")).toBeTruthy();
    expect(celula("Ter 15h: Giulia")).toBeTruthy();
    expect(celula("Ter 16h: livre")).toBeTruthy();
  });

  it("2º clique em outro dia recomeça a seleção (não salva)", async () => {
    abrir();
    await waitFor(() => expect(celula("Ter 9h: livre")).toBeTruthy());
    fireEvent.click(celula("Ter 9h: livre"));
    fireEvent.click(celula("Qui 10h: livre"));
    expect(chamadas.some((c) => c.metodo === "POST")).toBe(false);
    expect(screen.getByText(/coluna de Qui/)).toBeTruthy();
  });

  it("Esc cancela a seleção em andamento", async () => {
    abrir();
    await waitFor(() => expect(celula("Ter 9h: livre")).toBeTruthy());
    fireEvent.click(celula("Ter 9h: livre"));
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.getByText(/Toque no horário inicial/)).toBeTruthy());
  });

  it("tocar na PRÓPRIA foto apaga, depois de confirmar", async () => {
    blocos = [{ id: "c".repeat(24), userId: EU, dia: 1, inicio: 8, fim: 10 }];
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
    abrir();
    await waitFor(() => expect(celula("Seg 8h: Giulia")).toBeTruthy());
    fireEvent.click(celula("Seg 8h: Giulia"));
    expect(confirmar).toHaveBeenCalledWith(expect.stringContaining("segunda, das 8h às 11h"));
    await waitFor(() => expect(chamadas.some((c) => c.metodo === "DELETE" && c.url.includes("c".repeat(24)))).toBe(true));
  });

  it("cancelar a confirmação não apaga", async () => {
    blocos = [{ id: "c".repeat(24), userId: EU, dia: 1, inicio: 8, fim: 10 }];
    vi.spyOn(window, "confirm").mockReturnValue(false);
    abrir();
    await waitFor(() => expect(celula("Seg 8h: Giulia")).toBeTruthy());
    fireEvent.click(celula("Seg 8h: Giulia"));
    expect(chamadas.some((c) => c.metodo === "DELETE")).toBe(false);
  });

  it("tocar na foto de OUTRA pessoa não apaga: começa uma seleção (dá pra dividir o horário)", async () => {
    blocos = [{ id: "f".repeat(24), userId: OUTRA, dia: 1, inicio: 8, fim: 10 }];
    const confirmar = vi.spyOn(window, "confirm");
    abrir();
    await waitFor(() => expect(celula("Seg 8h: Martinez")).toBeTruthy());
    fireEvent.click(celula("Seg 8h: Martinez"));
    expect(confirmar).not.toHaveBeenCalled();
    expect(chamadas.some((c) => c.metodo === "DELETE")).toBe(false);
    expect(screen.getByText(/toque no horário FINAL/i)).toBeTruthy();
  });

  it("legenda mostra quem tem horário, com '(você)'", async () => {
    blocos = [{ id: "c".repeat(24), userId: EU, dia: 1, inicio: 8, fim: 8 }, { id: "f".repeat(24), userId: OUTRA, dia: 2, inicio: 9, fim: 9 }];
    abrir();
    await waitFor(() => expect(screen.getByText("Giulia (você)")).toBeTruthy());
    expect(screen.getByText("Martinez")).toBeTruthy();
  });

  it("erro ao carregar aparece como alerta", async () => {
    falharGet = true;
    abrir();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Forbidden"));
  });
});
