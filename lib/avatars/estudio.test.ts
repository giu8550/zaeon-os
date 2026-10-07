import { describe, it, expect, vi } from "vitest";

vi.mock("./pipeline", () => ({
  gerarBase: vi.fn(async () => ({ base: Buffer.from("B"), idle: { grande: Buffer.from("g"), pequeno: Buffer.from("p") } })),
  gerarQuadro: vi.fn(async () => ({ grande: Buffer.from("g2"), pequeno: Buffer.from("p2"), fracao: 0.01 })),
  idleDaBase: vi.fn(async () => ({ grande: Buffer.from("g"), pequeno: Buffer.from("p") })),
  normalizarBase: vi.fn(async (b: Buffer) => b),
}));
import { atenderEstudio, lerDataUrl, validarSalvar, dataUrl } from "./estudio";
import { gerarQuadro } from "./pipeline";

const d = (s: string) => dataUrl(Buffer.from(s));

describe("avatares · estúdio (servidor)", () => {
  it("lerDataUrl: só image/(webp|png|jpeg), com teto de tamanho", () => {
    expect(lerDataUrl(d("oi"), 10)?.toString()).toBe("oi");
    expect(lerDataUrl(d("oi"), 1)).toBeNull();
    expect(lerDataUrl("data:text/html;base64,PGI+", 99)).toBeNull();
    expect(lerDataUrl(42, 99)).toBeNull();
  });
  it("gera peça a peça: base → idle; estado com ajuste repassado", async () => {
    const b = await atenderEstudio({ acao: "base", personagem: "x".repeat(30), cor: ["#000000", "#ffffff"] });
    expect(b.status).toBe(200);
    expect(b.json.base).toBe(d("B"));
    const e = await atenderEstudio({ acao: "estado", base: d("B"), estado: "smile", ajuste: "mais discreto" });
    expect(e.status).toBe(200);
    expect(e.json.estado).toBe("smile");
    expect(vi.mocked(gerarQuadro)).toHaveBeenCalledWith(Buffer.from("B"), "smile", "mais discreto");
  });
  it("estado sem base / idle / desconhecido → 400; falha do modelo → 502", async () => {
    expect((await atenderEstudio({ acao: "estado", estado: "smile" })).status).toBe(400);
    expect((await atenderEstudio({ acao: "estado", base: d("B"), estado: "idle" })).status).toBe(400);
    expect((await atenderEstudio({ acao: "voar" })).status).toBe(400);
    vi.mocked(gerarQuadro).mockRejectedValueOnce(new Error("Vertex 429"));
    const r = await atenderEstudio({ acao: "estado", base: d("B"), estado: "think" });
    expect(r).toEqual({ status: 502, json: { error: "Vertex 429" } });
  });
  it("salvar exige idle+blink aprovados e quadros válidos", () => {
    const q = { grande: d("g"), pequeno: d("p") };
    expect(validarSalvar({ base: d("B"), quadros: { idle: q } })).toMatchObject({ ok: false });
    expect(validarSalvar({ base: d("B"), quadros: { idle: q, blink: { grande: "x", pequeno: "y" } } })).toMatchObject({ ok: false });
    expect(validarSalvar({ base: d("B"), quadros: { idle: q, blink: q, voar: q } })).toMatchObject({ ok: false });
    const ok = validarSalvar({ base: d("B"), quadros: { idle: q, blink: q }, cor: "#6d28d9" });
    expect(ok.ok && Object.keys(ok.set.quadros)).toEqual(["idle", "blink"]);
    expect(ok.ok && ok.set.cor).toBe("#6d28d9");
  });
});
