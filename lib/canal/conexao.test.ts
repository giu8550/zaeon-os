import { describe, it, expect } from "vitest";
import { ehErroDeRede, mensagemDeErro, vigiaAoVivo, estaEnviando, ehLocal } from "./conexao";

describe("conexao (#657)", () => {
  it("reconhece o erro de rede de cada navegador (Chrome, Firefox, Safari, Node)", () => {
    for (const m of ["Failed to fetch", "NetworkError when attempting to fetch resource.", "Load failed", "fetch failed"]) expect(ehErroDeRede(new TypeError(m))).toBe(true);
    expect(ehErroDeRede(new Error("Falhou (500)"))).toBe(false);
    expect(ehErroDeRede(new TypeError("x is not a function"))).toBe(false);
  });
  it("erro de rede vira frase em português; os outros mantêm a mensagem (as rotas já falam português)", () => {
    expect(mensagemDeErro(new TypeError("NetworkError when attempting to fetch resource."), "sua mensagem não foi enviada")).toBe("Sem conexão — sua mensagem não foi enviada. Tente de novo.");
    expect(mensagemDeErro(new Error("Mensagem vazia."), "x")).toBe("Mensagem vazia.");
    expect(mensagemDeErro(undefined, "não deu pra apagar")).toBe("Algo deu errado — não deu pra apagar.");
  });
  it("'Reconectando…' só quando cai DEPOIS de ter conectado; some ao conectar de novo", () => {
    const v = vigiaAoVivo();
    expect(v("connecting")).toBe(false);   // a primeira abertura
    expect(v("connected")).toBe(false);
    expect(v("unavailable")).toBe(true);   // caiu
    expect(v("connecting")).toBe(true);
    expect(v("connected")).toBe(false);    // voltou
  });
  it("mensagem local: a minha ainda enviando e a efêmera ficam fora das contas", () => {
    expect(estaEnviando("enviando-1")).toBe(true);
    expect(ehLocal("efemera-9")).toBe(true);
    expect(ehLocal("6721abc")).toBe(false);
  });
});

describe("mensagem enviando (#657)", () => {
  const minha = (id: string, texto = "oi") => ({ id, autorId: "eu", texto });
  it("a resposta do envio troca a 'enviando…' pela real (e não duplica se o ao vivo já trouxe)", async () => {
    const { confirmarEnviada } = await import("./conexao");
    expect(confirmarEnviada([minha("a"), minha("enviando-1")], "enviando-1", minha("m9")).map((x) => x.id)).toEqual(["a", "m9"]);
    expect(confirmarEnviada([minha("m9"), minha("enviando-1")], "enviando-1", minha("m9")).map((x) => x.id)).toEqual(["m9"]);
  });
  it("a minha chegando ao vivo tira a 'enviando…' de mesmo texto; a de outra pessoa não mexe", async () => {
    const { chegouAoVivo } = await import("./conexao");
    expect(chegouAoVivo([minha("enviando-1", "oi")], minha("m9", "oi"), "eu").map((x) => x.id)).toEqual(["m9"]);
    expect(chegouAoVivo([minha("enviando-1", "oi")], { id: "m8", autorId: "outra", texto: "oi" }, "eu").map((x) => x.id)).toEqual(["enviando-1", "m8"]);
    expect(chegouAoVivo([minha("m9")], minha("m9"), "eu")).toHaveLength(1);
  });
});

describe("mensagemDeErro · HTTP cru (#661)", () => {
  it("HTTP 500 vira frase; erro de verdade da rota fica", () => {
    expect(mensagemDeErro(new Error("HTTP 500"), "o mapa não foi gerado")).toBe("Algo deu errado — o mapa não foi gerado.");
    expect(mensagemDeErro(new Error("Sem tópico pra gerar o cérebro."), "x")).toBe("Sem tópico pra gerar o cérebro.");
  });
});
