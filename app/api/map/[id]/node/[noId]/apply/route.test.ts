/** #661: a evidência do "Apliquei" é obrigatória — vazia não avança a etapa nem rende AURA. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const aplicarNo = vi.fn(async (..._a: unknown[]) => ({ ok: true, mapa: { id: "m1" }, validacao: null, estado: "aplicado" }));
vi.mock("@/lib/map/route-auth", async () => {
  const { NextResponse } = await import("next/server");
  return { entrar: async () => ({ userId: "u1" }), falha: (r: string) => NextResponse.json({ error: r }, { status: r === "not_found" ? 404 : 400 }) };
});
vi.mock("@/lib/map/store", () => ({ getMapaForUser: async () => ({ mapa: { id: "m1" }, papel: "dono" }) }));
vi.mock("@/lib/map/validacao", () => ({ aplicarNo: (...a: unknown[]) => aplicarNo(...a) }));
vi.mock("@/lib/map/validacao-server", () => ({ depsReais: () => ({}), OID: /^[a-f0-9]{24}$/ }));
vi.mock("@/lib/cartolina/scope", () => ({ sanitizeScopeId: (s: string) => s }));
import { POST } from "./route";

const aplicar = (corpo: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(corpo) }), { params: { id: "m1", noId: "n1" } });
beforeEach(() => aplicarNo.mockClear());

describe("apply · evidência obrigatória (#661)", () => {
  it("sem evidência, vazia ou só espaços → 400 e a etapa NÃO é aplicada", async () => {
    for (const corpo of [{}, { evidencia: "" }, { evidencia: "   " }, { evidencia: 3 }]) {
      const r = await aplicar(corpo);
      expect(r.status).toBe(400);
      expect((await r.json()).motivo).toBe("sem_evidencia");
    }
    expect(aplicarNo).not.toHaveBeenCalled();
  });
  it("com evidência: aplica, com o texto limpo", async () => {
    const r = await aplicar({ evidencia: "  fiz o script e rodou  " });
    expect(r.status).toBe(200);
    expect(aplicarNo.mock.calls[0]![3]).toBe("fiz o script e rodou");
  });
});
