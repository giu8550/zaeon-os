import { describe, it, expect } from "vitest";
import { decidirFoco, PRAZO_MS, type EstadoFoco } from "./autofoco";

/** O caso feliz: sala em cena, input pintado, ninguém mexendo em nada. */
const base: EstadoFoco = {
  ativo: true, visivel: true, jaFocado: false, escrevendoEmOutro: false, expirou: false,
};
const com = (o: Partial<EstadoFoco>): EstadoFoco => ({ ...base, ...o });

describe("decidirFoco · o caso que o bug expôs", () => {
  it("invisível ainda não é 'não' — é 'espera'", () => {
    // ERA AQUI QUE MORRIA: focus() em elemento escondido é ignorado em silêncio, e o
    // chute de 60ms não tinha segunda chance. Agora invisível significa esperar pintar.
    expect(decidirFoco(com({ visivel: false }))).toBe("esperar");
  });

  it("visível e livre: foca", () => {
    expect(decidirFoco(base)).toBe("focar");
  });

  it("invisível até o prazo acabar: aí sim desiste", () => {
    expect(decidirFoco(com({ visivel: false, expirou: true }))).toBe("desistir");
  });

  it("o prazo é generoso o bastante pra uma pintura, curto pra não perseguir o aluno", () => {
    expect(PRAZO_MS).toBeGreaterThanOrEqual(1_000);
    expect(PRAZO_MS).toBeLessThanOrEqual(5_000);
  });
});

describe("decidirFoco · quando NÃO focar", () => {
  it("fora de cena não foca, nem que esteja visível", () => {
    expect(decidirFoco(com({ ativo: false }))).toBe("desistir");
  });

  it("fora de cena vence até o prazo cheio — sala escondida não rouba cursor", () => {
    expect(decidirFoco(com({ ativo: false, visivel: false, expirou: false }))).toBe("desistir");
  });

  it("já focado: não faz nada (nem re-foca, que moveria o cursor)", () => {
    expect(decidirFoco(com({ jaFocado: true }))).toBe("desistir");
  });

  it("alguém escrevendo em outro campo: NÃO rouba", () => {
    // Perder o que se digitou porque uma aba trocou é pior do que ter que clicar.
    expect(decidirFoco(com({ escrevendoEmOutro: true }))).toBe("desistir");
  });

  it("outro campo focado mas VAZIO não protege — trocar de aba move o cursor", () => {
    // `escrevendoEmOutro` é falso quando o campo alheio está vazio: é isso que deixa o
    // chat da aba nova receber o cursor sem atropelar ninguém.
    expect(decidirFoco(com({ escrevendoEmOutro: false }))).toBe("focar");
  });
});

describe("decidirFoco · precedência das regras", () => {
  it("fora de cena ganha de tudo", () => {
    expect(decidirFoco({ ativo: false, visivel: true, jaFocado: false, escrevendoEmOutro: false, expirou: false }))
      .toBe("desistir");
  });

  it("escrevendo em outro ganha da visibilidade", () => {
    expect(decidirFoco(com({ visivel: true, escrevendoEmOutro: true }))).toBe("desistir");
  });

  it("nunca devolve 'focar' com o elemento invisível", () => {
    const combinacoes: EstadoFoco[] = [];
    for (const jaFocado of [true, false])
      for (const escrevendoEmOutro of [true, false])
        for (const expirou of [true, false])
          combinacoes.push(com({ visivel: false, jaFocado, escrevendoEmOutro, expirou }));
    for (const c of combinacoes) expect(decidirFoco(c)).not.toBe("focar");
  });
});
