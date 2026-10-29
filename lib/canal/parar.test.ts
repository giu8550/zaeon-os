import { describe, it, expect } from "vitest";
import { respostaCancelada, AUTOR_PARAR, textoParou } from "./parar";

const t = (s: number) => new Date(Date.UTC(2026, 9, 28, 12, 0, s));
const corte = t(10);

describe("respostaCancelada (#635)", () => {
  it("'■ Parar' depois da mensagem que convocou → parou (para todas as agentes)", () => {
    const depois = [{ autorTipo: "sistema", autorId: AUTOR_PARAR, texto: textoParou("Giulia"), createdAt: t(15) }];
    expect(respostaCancelada(depois, "teo", corte)).toBe("parou");
    expect(respostaCancelada(depois, "aura", corte)).toBe("parou");
  });
  it("um 'Parar' ANTES da mensagem que convocou não vale (era de outra resposta)", () => {
    expect(respostaCancelada([{ autorTipo: "sistema", autorId: AUTOR_PARAR, createdAt: t(5) }], "teo", corte)).toBeNull();
  });
  it("a agente saiu da conversa enquanto escrevia → saiu; a saída de OUTRA agente não cancela", () => {
    const saiuTeo = { autorTipo: "sistema", autorId: "teo", texto: "Téo saiu da conversa", createdAt: t(12) };
    expect(respostaCancelada([saiuTeo], "teo", corte)).toBe("saiu");
    expect(respostaCancelada([saiuTeo], "aura", corte)).toBeNull();
  });
  it("nada de novo (ou só mensagens comuns) → segue", () => {
    expect(respostaCancelada([{ autorTipo: "humano", autorId: "u1", texto: "e aí?", createdAt: t(20) }], "teo", corte)).toBeNull();
    expect(respostaCancelada([], "teo", corte)).toBeNull();
  });
  it("o texto da linha", () => {
    expect(textoParou("Giulia")).toBe("Giulia interrompeu a resposta");
    expect(textoParou("")).toBe("Alguém interrompeu a resposta");
  });
});

describe("mostraParar (#635)", () => {
  it("alguém escrevendo e caixa vazia → ■ Parar; escrevendo algo ou com anexo → ↑; ninguém escrevendo → ↑", async () => {
    const { mostraParar } = await import("./parar");
    expect(mostraParar(1, "", false)).toBe(true);
    expect(mostraParar(2, "   ", false)).toBe(true);
    expect(mostraParar(1, "e mais uma coisa", false)).toBe(false);
    expect(mostraParar(1, "", true)).toBe(false);
    expect(mostraParar(0, "", false)).toBe(false);
  });
});

describe("avisoDeQuemParou (#645)", () => {
  it("depois do ■: o 'escrevendo' atrasado é ignorado; o 'ocioso' do fim libera; quem não foi parado passa", async () => {
    const { avisoDeQuemParou } = await import("./parar");
    const parados = new Set(["teo"]);
    expect(avisoDeQuemParou(parados, "teo", true)).toBe(false);
    expect(avisoDeQuemParou(parados, "teo", true)).toBe(false);
    expect(avisoDeQuemParou(parados, "aura", true)).toBe(true);
    expect(avisoDeQuemParou(parados, "teo", false)).toBe(true);   // o turno parado acabou
    expect(parados.has("teo")).toBe(false);
    expect(avisoDeQuemParou(parados, "teo", true)).toBe(true);    // o próximo turno aparece normal
  });
});
