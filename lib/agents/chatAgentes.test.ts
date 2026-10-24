import { describe, it, expect } from "vitest";
import { agentesDisponiveis, agenteValido, agenteChat } from "./chatAgentes";

describe("agentes da aba de conversa", () => {
  it("Octa Code só aparece no seletor depois de adicionado no Marketplace", () => {
    expect(agentesDisponiveis([]).map((a) => a.id)).toEqual(["aura", "zenita", "nina"]);
    expect(agentesDisponiveis(["octa-code"]).map((a) => a.id)).toEqual(["aura", "zenita", "nina", "octa"]);
  });
  it("cada agente tem a sua tela: Aura/Zenita/Nina = chat, Octa = IDE", () => {
    expect(agenteChat("aura").tela).toBe("chat");
    expect(agenteChat("zenita").tela).toBe("chat");
    expect(agenteChat("nina").tela).toBe("chat");
    expect(agenteChat("octa").tela).toBe("ide");
  });
  it("agente salvo que saiu do Marketplace volta pra Aura", () => {
    expect(agenteValido("octa", [])).toBe("aura");
    expect(agenteValido("octa", ["octa-code"])).toBe("octa");
    expect(agenteValido("lixo", ["octa-code"])).toBe("aura");
    expect(agenteValido("nina", [])).toBe("nina");
  });
});
