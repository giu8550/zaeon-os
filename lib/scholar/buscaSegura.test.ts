import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import { enderecoBloqueado, ehInterno, lerTexto } from "./buscaSegura";

describe("buscaSegura (#414, revisão)", () => {
  it("enderecoBloqueado: string ruim, IP interno literal e nome sem ponto (serviço interno) não passam", () => {
    for (const u of ["ftp://x.org/a", "http://127.0.0.1/a", "http://10.0.0.5/a", "http://redis:6379/", "http://api.internal/x", "lixo"]) expect(enderecoBloqueado(u)).toBe(true);
    expect(enderecoBloqueado("https://arxiv.org/pdf/1")).toBe(false);
  });
  it("ehInterno reconhece a recusa do lookupSeguro", () => {
    expect(ehInterno(Object.assign(new Error("x"), { code: "EINTERNO" }))).toBe(true);
    expect(ehInterno(new Error("ECONNREFUSED"))).toBe(false);
  });
  it("lerTexto lê até o teto", async () => {
    expect(await lerTexto(Readable.from([Buffer.from("olá "), Buffer.from("mundo")]))).toBe("olá mundo");
    expect((await lerTexto(Readable.from([Buffer.alloc(10, 97), Buffer.alloc(10, 98)]), 10)).length).toBe(10);
  });
});
