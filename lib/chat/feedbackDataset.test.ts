import { describe, it, expect } from "vitest";
import { anonimizar, hashUsuario, lerEntrada, linhaDoDataset, MAX_RESPOSTA } from "./feedbackDataset";

describe("anonimizar — nada que identifique o aluno sai pro dataset", () => {
  it("e-mail, CPF, CNPJ, telefone, link com parâmetros e números longos viram marcadores", () => {
    const t = anonimizar("meu email é joao.silva+x@gmail.com, cpf 123.456.789-09, cnpj 12.345.678/0001-90, fone (85) 98765-4321, veja https://x.com/a?token=abc e o protocolo 2026102200123");
    expect(t).toBe("meu email é [email], cpf [cpf], cnpj [cnpj], fone [telefone], veja [link] e o protocolo [numero]");
  });
  it("texto de estudo comum passa intacto (anos, fórmulas, números curtos)", () => {
    const t = "Em 1789 a Revolução Francesa; ATP = 36-38 por glicose; $E=mc^2$; página 45";
    expect(anonimizar(t)).toBe(t);
  });
});

describe("hashUsuario", () => {
  it("estável por usuário, muda com o sal, não contém o id", () => {
    const a = hashUsuario("6ac127b83b516d64502607ba", "s1");
    expect(a).toBe(hashUsuario("6ac127b83b516d64502607ba", "s1"));
    expect(a).not.toBe(hashUsuario("6ac127b83b516d64502607ba", "s2"));
    expect(a).not.toContain("6ac127");
    expect(a).toHaveLength(24);
  });
});

describe("lerEntrada", () => {
  it("aceita up/down/null; recusa voto inválido ou sem msgId; corta textos longos", () => {
    expect(lerEntrada({ msgId: "m1", voto: "up", resposta: "x".repeat(MAX_RESPOSTA + 50) })?.resposta).toHaveLength(MAX_RESPOSTA);
    expect(lerEntrada({ msgId: "m1", voto: null })?.voto).toBeNull();
    expect(lerEntrada({ msgId: "m1", voto: "meh" })).toBeNull();
    expect(lerEntrada({ voto: "up" })).toBeNull();
    expect(lerEntrada({ msgId: "m1", voto: "down", sala: "qualquer" })?.sala).toBe("estudos");
  });
});

describe("linhaDoDataset", () => {
  it("só os campos de qualidade (sem hash do usuário nem msgId)", () => {
    const l = linhaDoDataset({ id: "f1", criadoEm: new Date("2026-10-22T10:00:00Z"), voto: "up", sala: "estudos", modelo: "Gemini 3.5 Flash", pergunta: "p", resposta: "r" });
    expect(l).toEqual({ id: "f1", data: "2026-10-22T10:00:00.000Z", voto: "up", sala: "estudos", modelo: "Gemini 3.5 Flash", pergunta: "p", resposta: "r" });
  });
});
