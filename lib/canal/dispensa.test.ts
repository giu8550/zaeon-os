/** #438 · a agente entende quando é dispensada — e não confunde com tchau pra outra pessoa. */
import { describe, it, expect } from "vitest";
import { ehDispensa, normalizar, textoDespedida, textoSaiu } from "./dispensa";

const zenita = { nomesDaAgente: ["zenita", "Zenita"], mencionada: false, humanos: 2 };

describe("dispensa · frases fortes (sempre dispensam a agente da vez)", () => {
  it.each([
    "@zenita pode ir embora, vlw",          // o caso real do Martinez
    "pode ir",
    "pode ir, valeu",
    "pode sair",
    "já pode ir",
    "Pode parar!",
    "vai embora",
    "para de responder",
    "não precisa mais responder",
    "é só isso",
    "era só isso, obrigado",
    "só isso, obrigada",
    "por hoje é só",
    "está dispensada",
  ])("%s", (t) => {
    expect(ehDispensa(t, zenita)).toBe(true);
  });
});

describe("dispensa · NÃO é dispensa", () => {
  it.each([
    "pode ir pesquisando sobre python",      // "pode ir" + verbo = continuar
    "pode ir resumindo o artigo",
    "pode sair um resumo disso?",
    "só isso que você sabe?",
    "valeu!",                                  // agradecer não é mandar embora
    "obrigada pela ajuda, agora me explica X",
    "eu quero essa gata pra mim ><",
    "o que é tchaikovsky?",                    // "tchau" dentro de palavra
  ])("%s", (t) => {
    expect(ehDispensa(t, zenita)).toBe(false);
  });
});

describe("dispensa · tchau (fraca) depende de com quem se fala", () => {
  it("conversa com outra pessoa: 'tchau' sozinho é pra pessoa, a agente fica", () => {
    expect(ehDispensa("tchau, até amanhã", zenita)).toBe(false);
    expect(ehDispensa("falou, Giulia", zenita)).toBe(false);
  });
  it("com o nome ou o @ da agente, vale", () => {
    expect(ehDispensa("tchau zenita", zenita)).toBe(true);
    expect(ehDispensa("até mais, Zenita!", zenita)).toBe(true);
    expect(ehDispensa("@zenita tchau", { ...zenita, mencionada: true })).toBe(true);
  });
  it("conversa só com a agente: 'tchau' basta", () => {
    expect(ehDispensa("tchau", { ...zenita, humanos: 1 })).toBe(true);
    expect(ehDispensa("até logo", { ...zenita, humanos: 1 })).toBe(true);
  });
});

describe("dispensa · textos", () => {
  it("normaliza acento, maiúscula e @", () => {
    expect(normalizar("@Zenita  PODE   Sair, Obrigadão")).toBe("pode sair, obrigadao");
  });
  it("despedida ensina a chamar de volta; linha de sistema com o nome", () => {
    expect(textoDespedida("zenita")).toContain("@zenita");
    expect(textoSaiu("Zenita")).toBe("Zenita saiu da conversa");
  });
});
