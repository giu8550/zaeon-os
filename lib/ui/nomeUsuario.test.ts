import { describe, expect, it } from "vitest";
import { validarNome } from "./nomeUsuario";

describe("validarNome", () => {
  it("normaliza espaços e aceita acento", () => {
    expect(validarNome("  João   da  Silva ")).toEqual({ ok: true, nome: "João da Silva" });
  });
  it("rejeita curto, longo, símbolos e não-string", () => {
    expect(validarNome("ab").ok).toBe(false);
    expect(validarNome("a".repeat(31)).ok).toBe(false);
    expect(validarNome("<script>").ok).toBe(false);
    expect(validarNome(42).ok).toBe(false);
    expect(validarNome("   ").ok).toBe(false);
  });
  it("aceita ponto, hífen e sublinhado", () => {
    expect(validarNome("ana_luz-2.0").ok).toBe(true);
  });
});
