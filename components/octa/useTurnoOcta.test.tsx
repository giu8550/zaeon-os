// @vitest-environment jsdom
/** Tarefa 7 · janela do agente: pedido → turno → polling de 1 s dos eventos; para em fim/erro/aprovação e retoma após aprovar. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useTurnoOcta } from "./useTurnoOcta";

type Resp = { status: string; eventos: { seq: number; tipo: string; dados: Record<string, unknown> }[]; pendente?: unknown; resposta?: string | null };
let filas: Resp[];
let fetchMock: ReturnType<typeof vi.fn>;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const chamadasEventos = () => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes("/eventos"));

beforeEach(() => {
  vi.useFakeTimers();
  filas = [];
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/octa/turnos" && init?.method === "POST") return json({ turnoId: "t1" }, 202);
    if (url.startsWith("/api/octa/turnos/t1/eventos")) return json(filas.shift() ?? { status: "rodando", eventos: [], pendente: null, resposta: null });
    if (url === "/api/octa/turnos/t1/aprovar") return json({ ok: true }, 202);
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("useTurnoOcta", () => {
  it("POST /api/octa/turnos e polling de 1 s pedindo só o que é novo (depois=<último seq>) até o fim", async () => {
    const onParou = vi.fn();
    filas = [
      { status: "rodando", eventos: [{ seq: 1, tipo: "pensando", dados: { passo: 1 } }] },
      { status: "rodando", eventos: [{ seq: 2, tipo: "tool", dados: { tool: "octa_design_escolher" } }, { seq: 3, tipo: "resultado", dados: { tool: "octa_design_escolher", ok: true } }] },
      { status: "pronto", eventos: [{ seq: 4, tipo: "fim", dados: { resposta: "Pronto" } }], resposta: "Pronto" },
    ];
    const { result } = renderHook(() => useTurnoOcta({ onParou }));
    await act(async () => { await result.current.iniciar("p1", "uma landing"); });
    const post = fetchMock.mock.calls.find(([u]) => u === "/api/octa/turnos")!;
    expect(JSON.parse(String(post[1].body))).toEqual({ projetoId: "p1", pedido: "uma landing" });

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(chamadasEventos()).toEqual(["/api/octa/turnos/t1/eventos?depois=0"]);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(chamadasEventos()).toEqual(["/api/octa/turnos/t1/eventos?depois=0", "/api/octa/turnos/t1/eventos?depois=1", "/api/octa/turnos/t1/eventos?depois=3"]);
    expect(result.current.turno?.eventos.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect(result.current.turno?.status).toBe("pronto");
    expect(onParou).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(chamadasEventos()).toHaveLength(3); // parou
  });

  it("evento de erro para o polling", async () => {
    filas = [{ status: "erro", eventos: [{ seq: 1, tipo: "erro", dados: { codigo: "falha_modelo" } }] }];
    const { result } = renderHook(() => useTurnoOcta());
    await act(async () => { await result.current.iniciar("p1", "x"); await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(chamadasEventos()).toHaveLength(1);
    expect(result.current.turno?.status).toBe("erro");
  });

  it("aprovação: para de perguntar enquanto espera o aluno; aprovar manda { aprovado } e retoma do último seq", async () => {
    const onParou = vi.fn();
    filas = [
      { status: "aguardando_aprovacao", eventos: [{ seq: 1, tipo: "aprovacao", dados: { tool: "octa_publicar" } }], pendente: { tool: "octa_publicar" } },
      { status: "pronto", eventos: [{ seq: 2, tipo: "tool", dados: { tool: "octa_publicar" } }, { seq: 3, tipo: "fim", dados: { resposta: "ok" } }] },
    ];
    const { result } = renderHook(() => useTurnoOcta({ onParou }));
    await act(async () => { await result.current.iniciar("p1", "publica"); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.turno?.pendente).toEqual({ tool: "octa_publicar" });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(chamadasEventos()).toHaveLength(1);
    expect(onParou).toHaveBeenCalledTimes(1);

    await act(async () => { await result.current.aprovar(true); await vi.advanceTimersByTimeAsync(0); });
    const ap = fetchMock.mock.calls.find(([u]) => u === "/api/octa/turnos/t1/aprovar")!;
    expect(JSON.parse(String(ap[1].body))).toEqual({ aprovado: true });
    expect(chamadasEventos()[1]).toBe("/api/octa/turnos/t1/eventos?depois=1");
    expect(result.current.turno?.status).toBe("pronto");
    expect(result.current.turno?.pendente).toBeNull();
  });

  it("evento de aprovação antes do status virar: continua perguntando até o servidor dizer aguardando_aprovacao", async () => {
    filas = [
      { status: "rodando", eventos: [{ seq: 1, tipo: "aprovacao", dados: { tool: "octa_escrever", path: "a.html" } }] },
      { status: "aguardando_aprovacao", eventos: [], pendente: { tool: "octa_escrever", path: "a.html" } },
    ];
    const { result } = renderHook(() => useTurnoOcta());
    await act(async () => { await result.current.iniciar("p1", "x"); await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(chamadasEventos()).toHaveLength(2);
    expect(result.current.turno?.pendente).toEqual({ tool: "octa_escrever", path: "a.html" });
  });

  it("409 turno_ativo: acompanha o turno que já está rodando no projeto", async () => {
    fetchMock.mockImplementationOnce(async () => json({ error: "turno_ativo", turnoId: "t1" }, 409));
    filas = [{ status: "pronto", eventos: [{ seq: 1, tipo: "fim", dados: { resposta: "ok" } }] }];
    const { result } = renderHook(() => useTurnoOcta());
    let r: any;
    await act(async () => { r = await result.current.iniciar("p1", "x"); await vi.advanceTimersByTimeAsync(0); });
    expect(r).toEqual({ ok: true, turnoId: "t1", jaAtivo: true });
    expect(result.current.turno?.turnoId).toBe("t1");
    expect(chamadasEventos()).toEqual(["/api/octa/turnos/t1/eventos?depois=0"]);
  });

  it("erro ao começar (503/401/429) volta o status sem começar polling", async () => {
    fetchMock.mockImplementationOnce(async () => json({ error: "gateway_off" }, 503));
    const { result } = renderHook(() => useTurnoOcta());
    let r: any;
    await act(async () => { r = await result.current.iniciar("p1", "x"); await vi.advanceTimersByTimeAsync(3000); });
    expect(r).toEqual({ ok: false, status: 503, erro: "gateway_off" });
    expect(chamadasEventos()).toHaveLength(0);
  });

  it("falha de rede no polling: tenta de novo e marca falhaRede; a próxima resposta boa limpa", async () => {
    let vez = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/octa/turnos" && init?.method === "POST") return json({ turnoId: "t1" }, 202);
      vez++;
      if (vez === 1) throw new TypeError("rede");
      return json({ status: "pronto", eventos: [{ seq: 1, tipo: "fim", dados: {} }] });
    });
    const { result } = renderHook(() => useTurnoOcta());
    await act(async () => { await result.current.iniciar("p1", "x"); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.turno?.falhaRede).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.turno?.falhaRede).toBe(false);
    expect(result.current.turno?.status).toBe("pronto");
  });

  it("sem evento novo por semNovidadeMs: para de perguntar, marca semNotícia e retomarPolling volta do último seq", async () => {
    const onParou = vi.fn();
    filas = [{ status: "rodando", eventos: [{ seq: 1, tipo: "pensando", dados: { passo: 1 } }] }];
    const { result } = renderHook(() => useTurnoOcta({ onParou, semNovidadeMs: 5000 }));
    await act(async () => { await result.current.iniciar("p1", "x"); await vi.advanceTimersByTimeAsync(0); });
    // 1 s depois do evento: ainda perguntando
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(result.current.turno?.semNoticia).toBeFalsy();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(result.current.turno?.semNoticia).toBe(true);
    const n = chamadasEventos().length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(chamadasEventos()).toHaveLength(n); // parou de verdade
    expect(onParou).not.toHaveBeenCalled(); // o turno não acabou: só a IDE parou de perguntar
    expect(result.current.turno?.status).toBe("rodando");

    filas = [{ status: "erro", eventos: [{ seq: 2, tipo: "erro", dados: { codigo: "tempo_esgotado" } }] }];
    await act(async () => { result.current.retomarPolling(); await vi.advanceTimersByTimeAsync(0); });
    expect(chamadasEventos().at(-1)).toBe("/api/octa/turnos/t1/eventos?depois=1");
    expect(result.current.turno?.status).toBe("erro");
    expect(result.current.turno?.semNoticia).toBeFalsy();
    expect(onParou).toHaveBeenCalledTimes(1);
  });
});
