import { describe, it, expect, vi } from "vitest";
import { enviarPorChip, pausaDigitando } from "./envio-chip";

const chip = { id: "c1", instanceId: 900001, nome: "Zaeon 1", estado: "conectado" } as any;
const base = () => ({ escolher: vi.fn(async () => chip), presenca: vi.fn(async () => ({})), enviar: vi.fn(async () => ({ ok: true, status: "sent" })), registrar: vi.fn(async () => undefined), dormir: vi.fn(async () => undefined), sorteio: () => 0.5 });

describe("enviarPorChip (lógica dos disparos do FlowShot)", () => {
  it("rodízio → digitando → pausa 1,2–2,8 s → send_text → conta no chip", async () => {
    const d = base();
    const r = await enviarPorChip({ phone: "+5585999998888", text: "oi", idemKey: "k1" }, d);
    expect(r).toMatchObject({ ok: true, chipId: "c1", instanceId: 900001 });
    expect(d.presenca).toHaveBeenCalledWith(900001, "+5585999998888");
    expect(d.dormir).toHaveBeenCalledWith(2000);
    expect(d.enviar).toHaveBeenCalledWith({ instanceId: 900001, phone: "+5585999998888", text: "oi", idemKey: "k1" });
    expect(d.registrar).toHaveBeenCalledWith("c1", { ok: true, erro: undefined });
  });
  it("sem chip apto: erro claro, nada sai", async () => {
    const d = { ...base(), escolher: vi.fn(async () => null) };
    expect(await enviarPorChip({ phone: "+55", text: "x" }, d)).toMatchObject({ ok: false });
    expect(d.enviar).not.toHaveBeenCalled();
  });
  it("'digitando' falhar não impede a mensagem; duplicado conta como enviado", async () => {
    const d = { ...base(), presenca: vi.fn(async () => { throw new Error("x"); }), enviar: vi.fn(async () => ({ ok: false, status: "ignored_duplicate" })) };
    expect((await enviarPorChip({ phone: "+55", text: "x" }, d)).ok).toBe(true);
  });
  it("falha do envio volta com o erro e registra no chip", async () => {
    const d = { ...base(), enviar: vi.fn(async () => ({ ok: false, status: "failed", error: "not on whatsapp" })) };
    expect(await enviarPorChip({ phone: "+55", text: "x" }, d)).toMatchObject({ ok: false, error: "not on whatsapp" });
    expect(d.registrar).toHaveBeenCalledWith("c1", { ok: false, erro: "not on whatsapp" });
  });
  it("pausa de digitação sempre em [1200, 2800] ms", () => {
    expect(pausaDigitando(() => 0)).toBe(1200);
    expect(pausaDigitando(() => 0.999999)).toBe(2800);
  });
});
