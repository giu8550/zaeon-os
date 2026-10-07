import { describe, it, expect } from "vitest";
import { chaveDoAgente, nomeEnvDaChave, gatewayLigado } from "./chaves";

describe("C6 via lib/llm/chaves", () => {
  it("nomeEnvDaChave('eng-computacao')", () => expect(nomeEnvDaChave("eng-computacao")).toBe("GATEWAY_KEY_ENG_COMPUTACAO"));
  it("agente > default > null", () => {
    expect(chaveDoAgente("aura", { GATEWAY_KEY_AURA: "a", GATEWAY_KEY_DEFAULT: "d" })).toBe("a");
    expect(chaveDoAgente("x", { GATEWAY_KEY_DEFAULT: "d" })).toBe("d");
    expect(chaveDoAgente("x", {})).toBeNull();
  });
  it("gatewayLigado", () => { expect(gatewayLigado({})).toBe(false); expect(gatewayLigado({ GATEWAY_URL: "http://g" })).toBe(true); });
});
