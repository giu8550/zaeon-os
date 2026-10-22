import { describe, it, expect, vi } from "vitest";
import { enviarLote, type EstadoEnvio, type Fetch } from "./enviarBase";
import { MAX_BYTES_PDF } from "@/lib/rag/minhaBase";

const pdf = (nome: string, bytes = 4) => new File([new Uint8Array(bytes)], nome, { type: "application/pdf" });
const resp = (status: number, corpo?: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
const okDe = (init: RequestInit) => {
  const f = (init.body as FormData).get("arquivos") as File;
  return resp(200, { resultados: [{ nomeArquivo: f.name, documentoId: `d-${f.name}`, status: "novo", trechos: 2, paginas: 3 }] });
};

describe("enviarLote", () => {
  it("um arquivo por requisição, no máximo 2 ao mesmo tempo, resultado na ordem dos arquivos", async () => {
    let ativos = 0, pico = 0;
    const http: Fetch = async (_u, init) => {
      ativos++; pico = Math.max(pico, ativos);
      await new Promise((r) => setTimeout(r, 5));
      ativos--;
      return okDe(init);
    };
    const estados: Record<number, EstadoEnvio[]> = {};
    const rs = await enviarLote([pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf"), pdf("d.pdf"), pdf("e.pdf")], {
      fetch: http, aoMudar: (i, e) => { (estados[i] ??= []).push(e); },
    });
    expect(pico).toBe(2);
    expect(rs).not.toBe("nao_logado");
    expect((rs as any[]).map((r) => r.documentoId)).toEqual(["d-a.pdf", "d-b.pdf", "d-c.pdf", "d-d.pdf", "d-e.pdf"]);
    expect(estados[0]).toEqual(["na_fila", "enviando", "guardado"]);
  });

  it("acima de 25 MB não sobe; resposta ruim e queda de rede viram erro só daquele arquivo", async () => {
    const http = vi.fn<Fetch>()
      .mockResolvedValueOnce(resp(500, { error: "x" }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementation(async (_u, init) => okDe(init));
    const grande = new File([new Uint8Array(1)], "g.pdf");
    Object.defineProperty(grande, "size", { value: MAX_BYTES_PDF + 1 });
    const rs = (await enviarLote([grande, pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")], { fetch: http, paralelo: 1 })) as any[];
    expect(rs.map((r) => r.erro ?? r.status)).toEqual(["grande_demais", "leitura_falhou", "rede", "novo"]);
    expect(http).toHaveBeenCalledTimes(3);
  });

  it("401 ⇒ 'nao_logado' e para de enviar", async () => {
    const http = vi.fn<Fetch>().mockResolvedValue(resp(401));
    expect(await enviarLote([pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")], { fetch: http, paralelo: 1 })).toBe("nao_logado");
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("503 ⇒ esse e os seguintes ficam banco_indisponivel sem novas requisições", async () => {
    const http = vi.fn<Fetch>().mockImplementationOnce(async (_u, init) => okDe(init)).mockResolvedValue(resp(503, { error: "banco_indisponivel" }));
    const rs = (await enviarLote([pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf"), pdf("d.pdf")], { fetch: http, paralelo: 1 })) as any[];
    expect(rs.map((r) => r.erro ?? r.status)).toEqual(["novo", "banco_indisponivel", "banco_indisponivel", "banco_indisponivel"]);
    expect(http).toHaveBeenCalledTimes(2);
  });
});
