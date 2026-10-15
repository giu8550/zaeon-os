import { describe, it, expect } from "vitest";
import { proximoDaCadeia, podePassar, MAX_CADEIA } from "./encadear";
import { montarAliases } from "./mention";

const AL = montarAliases([
  { agentKey: "aura", nome: "Aura" }, { agentKey: "nina", nome: "Nina" },
  { agentKey: "medicina", nome: "Osler" }, { agentKey: "teo", nome: "Téo" },
]);
const base = { aliases: AL, permitidos: ["aura", "nina", "medicina", "teo"], eu: "aura", cadeia: 0 };

describe("encadear · quem responde em seguida", () => {
  it("a resposta marca um colega → ele é o próximo", () => {
    expect(proximoDaCadeia({ ...base, texto: "Essa parte é com o @Osler, ele explica melhor." })).toBe("medicina");
  });
  it("sem @ → ninguém", () => {
    expect(proximoDaCadeia({ ...base, texto: "Aqui está o resumo." })).toBeNull();
  });
  it("UM por vez: só o primeiro @ válido", () => {
    expect(proximoDaCadeia({ ...base, texto: "@nina e @teo, podem ajudar?" })).toBe("nina");
  });
  it("nunca chama a si mesmo nem quem já falou na cadeia (sem ping-pong)", () => {
    expect(proximoDaCadeia({ ...base, texto: "@aura de novo" })).toBeNull();
    expect(proximoDaCadeia({ ...base, eu: "nina", texto: "volta pra @aura", jaNaCadeia: ["aura"] })).toBeNull();
    expect(proximoDaCadeia({ ...base, eu: "nina", texto: "@aura ou @teo", jaNaCadeia: ["aura"] })).toBe("teo");
  });
  it("só agentes permitidos (no canal / da plataforma)", () => {
    expect(proximoDaCadeia({ ...base, permitidos: ["aura", "nina"], texto: "@Osler responde?" })).toBeNull();
  });
  it("vale com markdown em volta (**@Osler**, _@nina_)", () => {
    expect(proximoDaCadeia({ ...base, texto: "Isso é com o **@Osler**." })).toBe("medicina");
    expect(proximoDaCadeia({ ...base, texto: "Pergunta pra _@nina_" })).toBe("nina");
  });
  it("@desconhecido é ignorado", () => {
    expect(proximoDaCadeia({ ...base, texto: "@fulano sabe?" })).toBeNull();
  });
});

describe("encadear · limite de 2", () => {
  it(`MAX_CADEIA = ${MAX_CADEIA}: humano→A (0) → B (1) → C (2) e para`, () => {
    expect(MAX_CADEIA).toBe(2);
    expect(proximoDaCadeia({ ...base, cadeia: 0, texto: "@nina" })).toBe("nina");
    expect(proximoDaCadeia({ ...base, eu: "nina", cadeia: 1, texto: "@teo", jaNaCadeia: ["aura"] })).toBe("teo");
    expect(proximoDaCadeia({ ...base, eu: "teo", cadeia: 2, texto: "@Osler", jaNaCadeia: ["aura", "nina"] })).toBeNull();
  });
  it("cadeia inválida → não encadeia", () => {
    expect(proximoDaCadeia({ ...base, cadeia: -1, texto: "@nina" })).toBeNull();
    expect(proximoDaCadeia({ ...base, cadeia: 1.5, texto: "@nina" })).toBeNull();
  });
  it("podePassar acompanha o limite", () => {
    expect([0, 1, 2, 3].map(podePassar)).toEqual([true, true, false, false]);
  });
});
