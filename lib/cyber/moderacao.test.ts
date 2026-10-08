import { describe, expect, it } from "vitest";
import { moderar } from "./moderacao";

describe("moderação (a 1ª defesa da conversa com a Zaeon)", () => {
  it("pega palavrão e ofensa óbvios — com acento, maiúscula, número no lugar de letra e letra repetida", () => {
    for (const t of ["vai se foder", "VAI TOMAR NO CU", "sua puta", "p0rra", "caraaalho", "filho da puta", "fdp!!", "você é um retardado", "fuck you"]) expect(moderar(t).abuso, t).toBe(true);
  });
  it("não pega palavra inocente que CONTÉM um pedaço (nem tema de estudo)", () => {
    for (const t of ["Estudo no curso de Direito", "computação", "sou cientista", "quero passar no concurso", "pesquiso sobre o nazismo e o estupro como crime", "trabalho com reciclagem de lixo", "Marina", "ainda não sei"]) expect(moderar(t).abuso, t).toBe(false);
  });
});
