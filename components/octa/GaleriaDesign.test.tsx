// @vitest-environment jsdom
/** Tarefa 7 · galeria de estilos DESIGN.md: um cartão por estilo, crédito visível, escolher = PATCH designId, prévia isolada. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import GaleriaDesign from "./GaleriaDesign";

const ESTILOS = [
  { id: "notion", nome: "Notion", resumo: "Calmo, tipográfico.", clima: ["claro", "minimalista"], escuro: false },
  { id: "vercel", nome: "Vercel", resumo: "Preto e branco, técnico.", clima: ["escuro", "tecnico"], escuro: true },
];
const PREVIA = (id: string) => `<!doctype html><html><head><style>:root{--z-fundo:#fff}</style></head><body class="z-pg"><h1>Seu negócio (${id === "notion" ? "a" : "b"})</h1></body></html>`;
const ID = "0123456789abcdef01234567";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/octa/design") return new Response(JSON.stringify(ESTILOS), { status: 200 });
    const m = url.match(/^\/api\/octa\/design\/([^/]+)\/previa$/);
    if (m) return new Response(PREVIA(m[1]), { status: 200, headers: { "content-type": "text/html" } });
    if (url === `/api/octa/projetos/${ID}` && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ projeto: { id: ID, designId: body.designId, arquivos: { "DESIGN.md": "x" } } }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("GaleriaDesign", () => {
  it("um cartão por estilo do índice e o crédito da coleção", async () => {
    render(<GaleriaDesign projetoId={ID} designId={null} />);
    expect(await screen.findByRole("button", { name: /Usar o estilo Notion/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Usar o estilo Vercel/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Usar o estilo/ })).toHaveLength(ESTILOS.length);
    expect(screen.getByText("Estilos: VoltAgent/awesome-design-md (MIT)")).toBeTruthy();
  });

  it("clicar num cartão chama PATCH /api/octa/projetos/<id> com o designId e avisa quem abriu a galeria", async () => {
    const onEscolhido = vi.fn();
    const antes = vi.fn(async () => undefined);
    render(<GaleriaDesign projetoId={ID} designId={null} onEscolhido={onEscolhido} antesDeEscolher={antes} />);
    fireEvent.click(await screen.findByRole("button", { name: /Usar o estilo Vercel/ }));
    await waitFor(() => expect(onEscolhido).toHaveBeenCalled());
    const patch = fetchMock.mock.calls.find(([u, i]) => u === `/api/octa/projetos/${ID}` && i?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1].body))).toEqual({ designId: "vercel" });
    expect(antes).toHaveBeenCalled();
    expect(onEscolhido.mock.calls[0][0]).toMatchObject({ id: ID, designId: "vercel" });
  });

  it("a prévia vem num iframe com sandbox vazio (sem scripts) e srcDoc com o HTML da rota de prévia", async () => {
    render(<GaleriaDesign projetoId={ID} designId="vercel" />);
    const iframe = (await screen.findByTitle(/Prévia do estilo Vercel/)) as HTMLIFrameElement;
    await waitFor(() => expect(iframe.getAttribute("srcdoc")).toBe(PREVIA("vercel")));
    expect(iframe.getAttribute("sandbox")).toBe("");
    expect(iframe.getAttribute("srcdoc")).not.toMatch(/Vercel/);
    expect(fetchMock).toHaveBeenCalledWith("/api/octa/design/vercel/previa");
  });

  it("passar o mouse (ou focar) num cartão troca a prévia para aquele estilo", async () => {
    render(<GaleriaDesign projetoId={ID} designId="vercel" />);
    fireEvent.mouseEnter(await screen.findByRole("button", { name: /Usar o estilo Notion/ }));
    const iframe = (await screen.findByTitle(/Prévia do estilo Notion/)) as HTMLIFrameElement;
    await waitFor(() => expect(iframe.getAttribute("srcdoc")).toBe(PREVIA("notion")));
  });

  it("o estilo em uso aparece marcado", async () => {
    render(<GaleriaDesign projetoId={ID} designId="notion" />);
    const card = await screen.findByRole("button", { name: /Usar o estilo Notion/ });
    expect(card.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Usar o estilo Vercel/ }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("GaleriaDesign · bloqueada (o Octa está escrevendo)", () => {
  it("mostra as prévias mas não troca o estilo", async () => {
    render(<GaleriaDesign projetoId={ID} designId={null} bloqueado />);
    const card = await screen.findByRole("button", { name: /Usar o estilo Vercel/ });
    fireEvent.click(card);
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === "PATCH")).toBe(false);
    expect(screen.getByText(/troque o estilo quando ele terminar/)).toBeTruthy();
  });
});
