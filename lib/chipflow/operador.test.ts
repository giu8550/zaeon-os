import { describe, it, expect, vi } from "vitest";
import { criarInstancia, editarPerfil, lerEstado, lerQr, numeroDoJid, operadorConfigurado } from "./operador";

const env = { WA_OPERATOR_URL: "http://wa-adapter:9091/", WA_OPERATOR_TOKEN: "tk" };
const resp = (corpo: BodyInit | null, status = 200, tipo = "application/json") => new Response(corpo, { status, headers: { "content-type": tipo } });

describe("operador do whatsapp-adapter", () => {
  it("sem env: 503 sem chamar a rede", async () => {
    const f = vi.fn();
    expect(operadorConfigurado({})).toBe(false);
    expect(await lerEstado(1, {}, f as any)).toMatchObject({ ok: false, status: 503 });
    expect(f).not.toHaveBeenCalled();
  });
  it("create manda token + instance_id NUMÉRICO + name, com Bearer", async () => {
    const f = vi.fn(async () => resp("{}", 201));
    await criarInstancia({ instanceId: 900001, token: "uuid", nome: "Zaeon 1" }, env, f as any);
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe("http://wa-adapter:9091/instance/create");
    expect(init.headers.Authorization).toBe("Bearer tk");
    expect(JSON.parse(init.body)).toEqual({ token: "uuid", instance_id: 900001, name: "Zaeon 1" });
  });
  it("QR: 202 = ainda gerando (null); PNG vira data-URI; 409 = já conectado", async () => {
    expect(await lerQr(1, env, (async () => resp(null, 202)) as any)).toEqual({ ok: true, valor: null });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const r = await lerQr(1, env, (async () => resp(png, 200, "image/png")) as any);
    expect(r.ok && r.valor).toBe(`data:image/png;base64,${png.toString("base64")}`);
    expect(await lerQr(1, env, (async () => resp(JSON.stringify({ error: "já conectado" }), 409)) as any)).toMatchObject({ ok: false, status: 409, erro: "já conectado" });
  });
  it("status e perfil (só os campos pedidos)", async () => {
    expect(await lerEstado(1, env, (async () => resp(JSON.stringify({ state: "open", jid: "5585999998888@s.whatsapp.net" }))) as any)).toEqual({ ok: true, valor: { state: "open", jid: "5585999998888@s.whatsapp.net" } });
    const f = vi.fn(async () => resp(JSON.stringify({ ok: true, picture_id: "P1" })));
    const r = await editarPerfil(1, { recado: "oi" }, env, f as any);
    expect(JSON.parse((f.mock.calls[0] as any)[1].body)).toEqual({ about: "oi" });
    expect(r.ok && r.valor.pictureId).toBe("P1");
  });
  it("adapter fora do ar vira erro legível (não exceção)", async () => {
    const r = await lerEstado(1, env, (async () => { throw new Error("ECONNREFUSED"); }) as any);
    expect(r).toMatchObject({ ok: false, status: 504 });
  });
  it("número do jid (com ou sem :device)", () => {
    expect(numeroDoJid("5585999998888@s.whatsapp.net")).toBe("5585999998888");
    expect(numeroDoJid("5585999998888:12@s.whatsapp.net")).toBe("5585999998888");
    expect(numeroDoJid("123@g.us")).toBeNull();
  });
});
