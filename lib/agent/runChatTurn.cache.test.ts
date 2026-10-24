import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  traj: vi.fn(), resolve: vi.fn(), opts: null as any, consultar: vi.fn(), guardar: vi.fn(), fixar: vi.fn(), saveDone: vi.fn(),
}));
vi.mock("@/lib/agent/aura-harness", () => ({ buildHarnessDeps: (_c: any, o: any) => { h.opts = o; return {}; }, resolveHarnessOutput: h.resolve }));
vi.mock("@/lib/agent/trajectory", () => ({ runTrajectoryTraced: h.traj }));
vi.mock("@/lib/agent/memory-provider", () => ({ wakeUpContext: async () => "", writeTurnMemory: () => undefined }));
vi.mock("@/lib/agent/chat-turn-store", () => ({ markRunning: async () => undefined, saveDone: h.saveDone, saveError: async () => undefined }));
vi.mock("@/lib/map/memoria-turno", () => ({ bussolaParaTurno: async () => "", fixarTurno: h.fixar }));
vi.mock("@/lib/tcc/turno", () => ({ tccContextoParaTurno: async () => "", tccDoTurno: async () => null, trabalhosParaTurno: async () => null }));
vi.mock("@/lib/rag/turno", () => ({ baseParaTurno: async () => null }));
vi.mock("@/lib/canal/usage", () => ({ registrarUso: async () => true }));
vi.mock("@/src/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rag/pg", () => ({ ragPg: () => ({}), ehBancoIndisponivel: () => false }));
vi.mock("@/lib/rag/embed", () => ({ embedPerguntaCompartilhado: async () => [0.1, 0.2] }));
vi.mock("@/lib/rag/cacheRespostas", async (orig) => ({ ...(await orig<typeof import("@/lib/rag/cacheRespostas")>()), cacheLigado: () => true, consultarCache: h.consultar, guardarNoCache: h.guardar }));

import { runChatTurn } from "@/lib/agent/runChatTurn";
import { separarProgresso, modeloDoTurno } from "@/lib/agent/progresso";

const params = (x: any = {}) => ({ prompt: "o que é mitose?", surface: "sala-de-estudos", userId: "u1", history: [], agentContext: { cartolinaScopeId: "t1" }, ...x });
const fresca = { nucleo: "A mitose é a divisão celular que gera duas células-filhas idênticas." };

beforeEach(() => {
  Object.values(h).forEach((f: any) => f?.mockReset?.());
  h.traj.mockResolvedValue({ answer: fresca, state: { intent: "explicar_conceito" } });
  h.resolve.mockImplementation((_s: any, a: any) => ({ mode: "structured", answer: a }));
  h.guardar.mockResolvedValue(undefined); h.saveDone.mockResolvedValue(undefined);
});
const esperar = () => new Promise((r) => setTimeout(r, 0));

describe("runChatTurn × cache de respostas", () => {
  it("ACHOU: o motor não roda, a resposta guardada sai com o selo e segue o pós-processamento", async () => {
    const guardada = { nucleo: "Resposta guardada sobre a mitose, já aprovada antes." };
    h.consultar.mockResolvedValue({ id: "c1", answer: guardada, intent: "explicar_conceito", similaridade: 0.97 });
    let fio = "";
    const out: any = await runChatTurn("T1", params(), (c) => { fio += c; });
    expect(h.traj).not.toHaveBeenCalled();
    expect(out.answer).toEqual(guardada);
    expect(modeloDoTurno(separarProgresso(fio).eventos)).toBe("Aura · resposta guardada");
    expect(h.fixar).toHaveBeenCalled();          // a cartolina/memória do estudo continua recebendo o turno
    expect(h.guardar).not.toHaveBeenCalled();
  });
  it("NÃO achou: o motor roda e a resposta boa vai pro cache, no escopo da sala|mentor", async () => {
    h.consultar.mockResolvedValue(null);
    await runChatTurn(null, params(), () => {}); await esperar(); await esperar();
    expect(h.traj).toHaveBeenCalled();
    expect(h.guardar).toHaveBeenCalledWith({}, expect.objectContaining({ pergunta: "o que é mitose?", escopo: "estudos|aura", intent: "explicar_conceito", answer: fresca, vetor: [0.1, 0.2] }));
  });
  it("pergunta que depende da conversa nem consulta nem guarda", async () => {
    await runChatTurn(null, params({ prompt: "explica isso de novo" }), () => {}); await esperar();
    expect(h.consultar).not.toHaveBeenCalled(); expect(h.guardar).not.toHaveBeenCalled();
  });
  it("outro modelo escolhido no composer: sem cache", async () => {
    await runChatTurn(null, params({ modelo: "gemini-2.5-pro" }), () => {}); await esperar();
    expect(h.consultar).not.toHaveBeenCalled();
  });
  it("o cache falhou: o turno segue normal pelo motor", async () => {
    h.consultar.mockRejectedValue(new Error("tailnet fora"));
    const out: any = await runChatTurn(null, params(), () => {});
    expect(h.traj).toHaveBeenCalled(); expect(out.answer).toEqual(fresca);
  });
});
