import { describe, it, expect } from "vitest";
import { lerStreamAura } from "./auraClient";
import { serializarPrevia, serializarProgresso } from "@/lib/agent/progresso";

const stream = (pedacos: string[]) => new ReadableStream<Uint8Array>({ start(c) { const e = new TextEncoder(); for (const p of pedacos) c.enqueue(e.encode(p)); c.close(); } });

describe("lerStreamAura — a prévia da resposta", () => {
  it("entrega a prévia acumulada enquanto o turno roda, sem virar texto solto", async () => {
    const previas: string[] = [], fases: string[] = [];
    const fio = [serializarProgresso({ fase: "draft", rotulo: "Redigindo" }), serializarPrevia("A mitose "), serializarPrevia("divide a célula."), '@@STRUCTURED@@{"nucleo":"A mitose divide a célula."}'];
    const limpo = await lerStreamAura(stream(fio), { onPrevia: (t) => previas.push(t), onFase: (f) => fases.push(f) });
    expect(fases).toEqual(["Redigindo"]);
    expect(previas).toEqual(["A mitose ", "A mitose divide a célula."]);
    expect(limpo.startsWith("@@STRUCTURED@@")).toBe(true);   // o final estruturado segue intacto pro parser de sempre
  });
});
