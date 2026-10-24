import { describe, it, expect, vi } from "vitest";
import { gerarJsonStreamRes, type RespostaBruta } from "./envelope";
import { USAGE_VAZIO } from "./usage";

const ctx = { agentKey: "aura", surface: "estudos" as const };
const env = {} as Record<string, string | undefined>;
const bruta = (texto: string): RespostaBruta => ({ texto, usage: USAGE_VAZIO, modelo: "gemini-3.5-flash" });

describe("gerarJsonStreamRes (a prévia do rascunho)", () => {
  it("entrega o JSON acumulado a cada pedaço e devolve o valor parseado", async () => {
    const vistos: string[] = [];
    const { valor, res } = await gerarJsonStreamRes<{ nucleo: string }>({ system: "s", user: "u", ctx }, (acc) => vistos.push(acc), {
      env, registrar: vi.fn().mockResolvedValue(undefined),
      vertexStream: async (_req, _m, onTexto) => { onTexto('{"nucleo":"A mi'); onTexto('{"nucleo":"A mitose"}'); return bruta('{"nucleo":"A mitose"}'); },
    });
    expect(vistos).toEqual(['{"nucleo":"A mi', '{"nucleo":"A mitose"}']);
    expect(valor.nucleo).toBe("A mitose");
    expect(res.provedor).toBe("vertex");
  });
  it("o stream falhou: a chamada normal responde (com a reserva de sempre)", async () => {
    const normal = vi.fn().mockResolvedValue(bruta('{"nucleo":"pela chamada normal"}'));
    const { valor } = await gerarJsonStreamRes<{ nucleo: string }>({ system: "s", user: "u", ctx }, () => {}, {
      env, registrar: vi.fn().mockResolvedValue(undefined), vertex: normal,
      vertexStream: async () => { throw Object.assign(new Error("Resource exhausted"), { status: 429 }); },
    });
    expect(normal).toHaveBeenCalledTimes(1);
    expect(valor.nucleo).toBe("pela chamada normal");
  });
  it("o stream voltou vazio: a chamada normal tenta", async () => {
    const normal = vi.fn().mockResolvedValue(bruta('{"nucleo":"ok"}'));
    await gerarJsonStreamRes({ system: "s", user: "u", ctx }, () => {}, { env, registrar: vi.fn().mockResolvedValue(undefined), vertex: normal, vertexStream: async () => bruta("") });
    expect(normal).toHaveBeenCalledTimes(1);
  });
  it("modelo do pool/Contabo nunca vai pelo stream do Vertex", async () => {
    const stream = vi.fn();
    await gerarJsonStreamRes({ system: "s", user: "u", ctx, model: "zaeon-local-lfm2" }, () => {}, { env, registrar: vi.fn().mockResolvedValue(undefined), vertexStream: stream }).catch(() => undefined);
    expect(stream).not.toHaveBeenCalled();
  });
});
