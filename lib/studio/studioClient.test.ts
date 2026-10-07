import { describe, it, expect, vi } from "vitest";
import { gerarArtefato, criarEstudo } from "@/lib/studio/studioClient";

const j = (b: any, status = 200) => new Response(JSON.stringify(b), { status });
const sem = { sleep: async () => {} };
const fseq = (...rs: any[]) => { const f = vi.fn(); rs.forEach((r) => (r instanceof Error ? f.mockRejectedValueOnce(r) : f.mockResolvedValueOnce(r))); return f as any; };

describe("studioClient", () => {
  it("texto: cache hit volta pronto na hora; senão polla até done (com force)", async () => {
    expect(await gerarArtefato("timeline", { ...sem, spaceId: "s", topic: "t", fetch: fseq(j({ id: "a", status: "done", meta: { m: 1 }, title: "T" })) }))
      .toEqual({ tipo: "pronto", bloco: { studioKind: "timeline", title: "T", data: { m: 1 } } });
    const f = fseq(j({ id: "a", status: "queued" }), j({ status: "running" }), j({ status: "done", meta: { x: 1 }, title: "G" }));
    expect((await gerarArtefato("guide", { ...sem, spaceId: "s", topic: "t", fetch: f })).tipo).toBe("pronto");
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ spaceId: "s", topic: "t", force: true });
    expect(f.mock.calls[1][0]).toBe("/api/studio/a");
  });
  it("texto: erro avisa (não silencioso); teto para CALADO (como o desktop sempre fez)", async () => {
    expect(await gerarArtefato("faq", { ...sem, spaceId: "s", topic: "t", fetch: fseq(j({ error: "quota" }, 429)) })).toEqual({ tipo: "erro", mensagem: "quota" });
    expect(await gerarArtefato("faq", { ...sem, spaceId: "s", topic: "t", fetch: fseq(j({ id: "a" }), j({ status: "error", error: "x" })) })).toEqual({ tipo: "erro", mensagem: "x", silencioso: false });
    let t = 0;
    const r = await gerarArtefato("faq", { sleep: async () => { t += 60_000; }, agora: () => t, spaceId: "s", topic: "t", fetch: vi.fn().mockImplementation(async () => j({ id: "a", status: "running" })) as any });
    expect(r).toMatchObject({ tipo: "erro", silencioso: true });
  });
  it("podcast/vídeo: falha é CALADA; polla com intervalo do tipo e guarda o artifactId", async () => {
    expect(await gerarArtefato("podcast", { ...sem, spaceId: "s", topic: "t", fetch: fseq(j({}, 500)) })).toEqual({ tipo: "erro", silencioso: true });
    const sleep = vi.fn(async (_ms: number) => {});
    const r = await gerarArtefato("video", { sleep, spaceId: "s", topic: "t", fetch: fseq(j({ id: "v", status: "queued" }), j({ id: "v", status: "done", meta: {}, title: "V" })) });
    expect(r).toEqual({ tipo: "pronto", bloco: { studioKind: "video", title: "V", data: {}, artifactId: "v" } });
    expect(sleep).toHaveBeenCalledWith(3000);
  });
  it("molécula exige sdf; imagem exige dataUrl", async () => {
    expect((await gerarArtefato("molecule", { ...sem, spaceId: "s", topic: "cafeína", fetch: fseq(j({ id: "m", meta: { sdf: "..." }, title: "C" })) })).tipo).toBe("pronto");
    expect(await gerarArtefato("molecule", { ...sem, spaceId: "s", topic: "x", fetch: fseq(j({ error: "não achei" }, 404)) })).toEqual({ tipo: "erro", mensagem: "não achei" });
    expect(await gerarArtefato("image", { ...sem, spaceId: "s", topic: "x", fetch: fseq(j({ dataUrl: "data:x", title: "" })) })).toMatchObject({ tipo: "pronto", bloco: { title: "Imagem", dataUrl: "data:x" } });
    expect((await gerarArtefato("image", { ...sem, spaceId: "s", topic: "x", fetch: fseq(j({}, 503)) })).tipo).toBe("erro");
  });
  it("rede caída = erro; cancelado para o polling", async () => {
    expect(await gerarArtefato("mindmap", { ...sem, spaceId: "s", topic: "t", fetch: fseq(new Error("offline")) })).toEqual({ tipo: "erro" });
    expect(await gerarArtefato("mindmap", { ...sem, cancelado: () => true, spaceId: "s", topic: "t", fetch: fseq(j({ id: "a" })) })).toEqual({ tipo: "cancelado" });
  });
  it("criarEstudo", async () => {
    expect(await criarEstudo("Luz", { fetch: fseq(j({ id: "e1", title: "Luz" })) })).toEqual({ id: "e1", title: "Luz" });
    expect(await criarEstudo("Luz", { fetch: fseq(j({}, 401)) })).toBeNull();
    expect(await criarEstudo("Luz", { fetch: fseq(new Error("x")) })).toBeNull();
  });
  it("diagrama: manda assunto + explicação + sala, polla e devolve o artifactId (o IR fica no servidor)", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const f = fseq(j({ id: "d", status: "queued" }), j({ id: "d", status: "done", title: "Como o DNS funciona", meta: { tipo: "sequence", ir: { grande: true } } }));
    const r = await gerarArtefato("diagram", { sleep, topic: "DNS", contexto: "o resolvedor…", sala: "pesquisa", fetch: f });
    expect(r).toEqual({ tipo: "pronto", bloco: { studioKind: "diagram", title: "Como o DNS funciona", data: { tipo: "sequence" }, artifactId: "d" } });
    expect(f.mock.calls[0][0]).toBe("/api/studio/diagram");
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ topic: "DNS", contexto: "o resolvedor…", sala: "pesquisa", formato: "auto" });
    expect(sleep).toHaveBeenCalledWith(2500);
  });
  it("mapa mental vira diagrama (formato mapa); se o diagrama falha, cai no mapa estático de antes", async () => {
    const ok = fseq(j({ id: "d", status: "done", title: "Mapa", meta: {} }));
    expect(await gerarArtefato("mindmap", { ...sem, spaceId: "s", topic: "t", fetch: ok })).toMatchObject({ tipo: "pronto", bloco: { studioKind: "diagram", artifactId: "d" } });
    expect(JSON.parse(ok.mock.calls[0][1].body).formato).toBe("mapa");
    const reserva = fseq(j({ error: "reprovado" }, 500), j({ id: "m", status: "done", meta: { root: 1 }, title: "Mapa velho" }));
    expect(await gerarArtefato("mindmap", { ...sem, spaceId: "s", topic: "t", fetch: reserva }))
      .toEqual({ tipo: "pronto", bloco: { studioKind: "mindmap", title: "Mapa velho", data: { root: 1 } } });
    expect(reserva.mock.calls[1][0]).toBe("/api/studio/mindmap");
  });
});
