// @vitest-environment jsdom
/** #661: refazer o mapa — pede `force`, segue "gerando" até o mapa mudar de verdade e, se falhar, o mapa atual volta. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useCerebro } from "./useCerebro";

const mapa = (updatedAt: string) => ({ id: "m1", nos: [], arestas: [], backbone: ["a"], updatedAt });
const respostaMapa = (updatedAt: string) => new Response(JSON.stringify({ estudavel: true, mapa: mapa(updatedAt) }), { status: 200 });

let atual = "t1";
let aoGerar: () => Response;
let fetchMock: ReturnType<typeof vi.fn>;
const montar = async () => {
  const h = renderHook(() => useCerebro("s1"));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  return h;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("NEXT_PUBLIC_MAP_HARNESS", "1");
  vi.stubEnv("NEXT_PUBLIC_PUSHER_KEY", "");
  atual = "t1";
  aoGerar = () => new Response(JSON.stringify({ enfileirado: false }), { status: 202 });
  fetchMock = vi.fn(async (url: string) => (String(url).includes("/generate") ? aoGerar() : respostaMapa(atual)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("useCerebro.refazer (#661)", () => {
  it("manda force e segue gerando até o mapa mudar", async () => {
    const { result } = await montar();
    expect(result.current.estado).toBe("ativa");
    await act(async () => { await result.current.refazer(); });
    const gerou = fetchMock.mock.calls.find((c) => String(c[0]).includes("/generate"))!;
    expect(JSON.parse(gerou[1].body)).toEqual({ scopeId: "s1", force: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(result.current.estado).toBe("gerando");
    atual = "t2";
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(result.current.estado).toBe("ativa");
    expect(result.current.mapa?.updatedAt).toBe("t2");
    expect(result.current.erro).toBeNull();
  });
  it("sem resposta no tempo limite: o mapa volta com o aviso", async () => {
    const { result } = await montar();
    await act(async () => { await result.current.refazer(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(result.current.estado).toBe("ativa");
    expect(result.current.erro).toMatch(/o seu continua aqui/);
  });
  it("a rota recusou: o mapa volta com o erro, sem 'HTTP 500'", async () => {
    aoGerar = () => new Response("{}", { status: 500 });
    const { result } = await montar();
    await act(async () => { await result.current.refazer(); });
    expect(result.current.estado).toBe("ativa");
    expect(result.current.erro).toBe("Algo deu errado — o mapa não foi refeito.");
  });
});
