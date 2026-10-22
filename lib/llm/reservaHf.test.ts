import { describe, it, expect } from "vitest";
import { reservaHfLigada, modelosReservaHf, timeoutReservaHf, erroPedeReserva, modeloSemProvedor, HF_RESERVA_PADRAO } from "./reservaHf";
import { custoDoAlvoUsd } from "@/lib/ai/preco";

describe("reservaHf — config", () => {
  it("liga só com HF_TOKEN; HF_RESERVA=0/off desliga", () => {
    expect(reservaHfLigada({})).toBe(false);
    expect(reservaHfLigada({ HF_TOKEN: "hf_x" })).toBe(true);
    expect(reservaHfLigada({ HF_TOKEN: "hf_x", HF_RESERVA: "0" })).toBe(false);
    expect(reservaHfLigada({ HF_TOKEN: "hf_x", HF_RESERVA: "off" })).toBe(false);
  });
  it("modelos: Cerebras → Groq por padrão; HF_RESERVA_MODELOS troca a lista", () => {
    expect(modelosReservaHf({})).toEqual([...HF_RESERVA_PADRAO]);
    expect(modelosReservaHf({ HF_RESERVA_MODELOS: " a:x , b " })).toEqual(["a:x", "b"]);
  });
  it("timeout padrão 45 s, configurável", () => {
    expect(timeoutReservaHf({})).toBe(45_000);
    expect(timeoutReservaHf({ HF_RESERVA_TIMEOUT_MS: "20000" })).toBe(20_000);
  });
  it("só o teto de orçamento e o pool esgotado não pedem reserva", () => {
    for (const c of ["rate_limit", "cota_esgotada", "timeout", "provedor_fora", "auth", "modelo_inexistente", "outro"] as const) expect(erroPedeReserva(c)).toBe(true);
    expect(erroPedeReserva("teto")).toBe(false); expect(erroPedeReserva("pool_esgotado")).toBe(false);
  });
  it("modeloSemProvedor tira o :provedor", () => {
    expect(modeloSemProvedor("openai/gpt-oss-120b:cerebras")).toBe("openai/gpt-oss-120b");
    expect(modeloSemProvedor("openai/gpt-oss-120b")).toBe("openai/gpt-oss-120b");
  });
  it("a reserva é PAGA no ledger (alvo huggingface ≠ pool grátis); pool e Contabo seguem 0", () => {
    const u = { promptTokens: 1_000_000, completionTokens: 1_000_000, cachedTokens: 0 };
    expect(custoDoAlvoUsd("openai/gpt-oss-120b", u, "huggingface")).toBeCloseTo(1.0, 5);
    expect(custoDoAlvoUsd("openai/gpt-oss-20b", u, "groq")).toBe(0);
    expect(custoDoAlvoUsd("zaeon-local-mini", u, "contabo")).toBe(0);
  });
});
