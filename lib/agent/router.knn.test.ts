import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ voto: null as any, gemini: vi.fn(), info: vi.fn() }));
vi.mock("./roteadorKnn", async (orig) => ({ ...(await orig<typeof import("./roteadorKnn")>()), indiceSePronto: () => ({ versao: "t", itens: [] }), votar: () => h.voto }));
vi.mock("@/lib/rag/embed", () => ({ embedVertex: vi.fn(), embedPerguntaCompartilhado: async () => [1, 0] }));
vi.mock("@/lib/scholar/gemini", () => ({ geminiJson: h.gemini }));

import { classify } from "./router";
const ctx: any = { activeTab: "sala-de-estudos" };

beforeEach(() => { h.gemini.mockReset(); h.gemini.mockResolvedValue({ intent: "explicar_conceito" }); vi.spyOn(console, "info").mockImplementation(h.info); h.info.mockReset(); });

describe("classify × roteador kNN", () => {
  it("ON e confiante: decide SEM chamar o modelo", async () => {
    process.env.ROTEADOR_KNN = "on"; h.voto = { intent: "conversa", confianca: 0.93, margem: 0.9, vizinhos: [] };
    const r = await classify("oi aura", ctx);
    expect(r.intent).toBe("conversa"); expect(h.gemini).not.toHaveBeenCalled();
  });
  it("ON mas sem confiança: vai pelo modelo", async () => {
    process.env.ROTEADOR_KNN = "on"; h.voto = { intent: "conversa", confianca: 0.6, margem: 0.1, vizinhos: [] };
    const r = await classify("o que é mitose?", ctx);
    expect(h.gemini).toHaveBeenCalled(); expect(r.intent).toBe("explicar_conceito");
  });
  it("as regras determinísticas mandam em cima do kNN (pedido de livro)", async () => {
    process.env.ROTEADOR_KNN = "on"; h.voto = { intent: "explicar_conceito", confianca: 0.95, margem: 0.9, vizinhos: [] };
    const r = await classify("me manda o pdf do livro sapiens", ctx);
    expect(r.intent).toBe("buscar_livro");
  });
  it("SOMBRA: decide pelo modelo e só registra a concordância (sem o texto da pergunta)", async () => {
    process.env.ROTEADOR_KNN = "sombra"; h.voto = { intent: "explicar_conceito", confianca: 0.9, margem: 0.8, vizinhos: [] };
    const r = await classify("o que é mitose?", ctx);
    expect(h.gemini).toHaveBeenCalled(); expect(r.intent).toBe("explicar_conceito");
    const linha = String(h.info.mock.calls[0]?.[0] ?? "");
    expect(linha).toContain("sombra ="); expect(linha).not.toContain("mitose");
  });
  it("OFF: nem consulta o kNN", async () => {
    process.env.ROTEADOR_KNN = ""; h.voto = { intent: "conversa", confianca: 0.99, margem: 1, vizinhos: [] };
    const r = await classify("o que é mitose?", ctx);
    expect(h.gemini).toHaveBeenCalled(); expect(r.intent).toBe("explicar_conceito");
  });
});
