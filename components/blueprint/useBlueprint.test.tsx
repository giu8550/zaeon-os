// @vitest-environment jsdom
/** #631 · trocar de blueprint: marca na hora, o já visto volta instantâneo e leitura igual não redesenha. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBlueprint, mudouBlueprint, type BlueprintCliente } from "./useBlueprint";

const bp = (id: string, rev = 1): BlueprintCliente => ({ id, scopeId: null, rev, papel: "dono", updatedAt: `2026-10-27T00:00:0${rev}Z`, doc: { titulo: id } as any });
const resumo = (id: string) => ({ id, titulo: id, area: "ciencia", fase: 1, aguardandoMentor: false, criticosAbertos: 0, fasesAprovadas: 0, updatedAt: "x" });

let pendentes: Record<string, (v: Response) => void> = {};
let rev: Record<string, number> = {};
beforeEach(() => {
  pendentes = {}; rev = { a: 1, b: 1 };
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/api/blueprint") return Promise.resolve(new Response(JSON.stringify({ blueprints: [resumo("a"), resumo("b")] })));
    const id = url.split("/").pop()!;
    // a resposta de cada blueprint fica PENDENTE até o teste soltar (simula o servidor lento)
    return new Promise<Response>((res) => { pendentes[id] = res; });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });
const soltar = async (id: string) => { await act(async () => { pendentes[id]!(new Response(JSON.stringify({ blueprint: bp(id, rev[id]) }))); await Promise.resolve(); }); };

describe("#631 · useBlueprint", () => {
  it("o clique marca NA HORA (carregando até o servidor responder)", async () => {
    const { result } = renderHook(() => useBlueprint());
    await waitFor(() => expect(pendentes.a).toBeTruthy());
    await soltar("a");
    await waitFor(() => expect(result.current.atual?.id).toBe("a"));
    act(() => { void result.current.abrir("b"); });
    expect(result.current.selecionado).toBe("b");          // marcado já
    expect(result.current.carregando).toBe(true);
    expect(result.current.atual?.id).toBe("a");            // a prancha de antes fica até a nova chegar
    await soltar("b");
    await waitFor(() => expect(result.current.atual?.id).toBe("b"));
    expect(result.current.carregando).toBe(false);
  });
  it("voltar num blueprint já visto é instantâneo (não espera o servidor)", async () => {
    const { result } = renderHook(() => useBlueprint());
    await waitFor(() => expect(pendentes.a).toBeTruthy());
    await soltar("a");
    act(() => { void result.current.abrir("b"); });
    await soltar("b");
    await waitFor(() => expect(result.current.atual?.id).toBe("b"));
    act(() => { void result.current.abrir("a"); });        // o servidor de "a" ainda nem respondeu de novo
    expect(result.current.atual?.id).toBe("a");
    expect(result.current.carregando).toBe(false);
  });
  it("leitura que não mudou nada (mesmo rev) não troca o objeto — a prancha não redesenha à toa", async () => {
    const { result } = renderHook(() => useBlueprint());
    await waitFor(() => expect(pendentes.a).toBeTruthy());
    await soltar("a");
    await waitFor(() => expect(result.current.atual?.id).toBe("a"));
    const antes = result.current.atual;
    act(() => { void result.current.abrir("a"); });
    await soltar("a");
    expect(result.current.atual).toBe(antes);               // mesmo objeto
    rev.a = 2;
    act(() => { void result.current.abrir("a"); });
    await soltar("a");
    await waitFor(() => expect(result.current.atual?.rev).toBe(2));   // mudou de verdade: troca
  });
  it("mudouBlueprint", () => {
    expect(mudouBlueprint(null, bp("a"))).toBe(true);
    expect(mudouBlueprint(bp("a"), bp("a"))).toBe(false);
    expect(mudouBlueprint(bp("a"), bp("a", 2))).toBe(true);
    expect(mudouBlueprint(bp("a"), bp("b"))).toBe(true);
  });
});
