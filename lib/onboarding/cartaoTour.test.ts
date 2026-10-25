/** #605 · o cartão novo dos tours: uma ideia por caixa e o texto letra por letra. */
import { describe, it, expect } from "vitest";
import { frases, paginasDaFala, letrasVisiveis, MAX_PAGINA } from "./cartaoTour";
import { PASSOS_SALA } from "./tourSala";
import { PASSOS_ESCRITORIO, PASSOS_ESCRITORIO_3D } from "./tourEscritorio";

describe("cartaoTour · frases", () => {
  it("corta no fim da frase e o emoji fica com a frase que ele fecha", () => {
    expect(frases("Oi! Que bom te ver aqui. 💜 Bora começar: clica ali.")).toEqual(["Oi!", "Que bom te ver aqui. 💜", "Bora começar: clica ali."]);
  });
  it("não corta dentro de aspas nem em abreviação colada", () => {
    expect(frases("Clica em “Quero estudar sobre…” e me diz um tema (ex.: “faz isso”). Pronto!")).toEqual([
      "Clica em “Quero estudar sobre…” e me diz um tema (ex.: “faz isso”).", "Pronto!",
    ]);
  });
});

describe("cartaoTour · páginas (uma ideia por caixa)", () => {
  const todas = [...PASSOS_SALA, ...PASSOS_ESCRITORIO, ...PASSOS_ESCRITORIO_3D];
  it.each(todas.map((p) => [p.id, p.fala] as const))("%s: as páginas juntas são a fala do roteiro, sem perder nada", (_id, fala) => {
    expect(paginasDaFala(fala).join(" ").replace(/\s+/g, " ")).toBe(fala.replace(/\s+/g, " ").trim());
  });
  it.each(todas.map((p) => [p.id, p.fala] as const))("%s: nenhuma página passa do limite (a não ser uma frase sozinha)", (_id, fala) => {
    for (const pg of paginasDaFala(fala)) expect(pg.length <= MAX_PAGINA || frases(pg).length === 1).toBe(true);
  });
  it("a fala longa do 1º passo vira mais de uma caixa; a curta fica numa só", () => {
    expect(paginasDaFala(PASSOS_SALA[0]!.fala).length).toBeGreaterThan(1);
    expect(paginasDaFala("É aqui que você escreve.")).toEqual(["É aqui que você escreve."]);
  });
});

describe("cartaoTour · letra por letra", () => {
  it("aparece aos poucos e para no fim", () => {
    expect(letrasVisiveis("abcdef", 0, 10)).toBe("");
    expect(letrasVisiveis("abcdef", 300, 10)).toBe("abc");
    expect(letrasVisiveis("abcdef", 9999, 10)).toBe("abcdef");
  });
  it("nunca corta um emoji ao meio", () => {
    expect(letrasVisiveis("oi 💜!", 400, 10)).toBe("oi 💜");
  });
  it("emoji composto (tom de pele, ZWJ, bandeira) conta como uma letra só e nunca aparece pela metade", () => {
    expect(letrasVisiveis("a👍🏽b", 200, 10)).toBe("a👍🏽");
    expect(letrasVisiveis("a👩‍💻b", 200, 10)).toBe("a👩‍💻");
    expect(letrasVisiveis("a🇧🇷b", 200, 10)).toBe("a🇧🇷");
  });
});

describe("#618 · o cartão fica parado dentro do passo", async () => {
  const { posicaoEstavel } = await import("./cartaoTour");
  const H = 643, campo = { x: 163, y: 447, w: 848, h: 138 };
  it("em cima do destaque: preso pela base, cresce pra cima sem mudar de lugar", () => {
    const a = posicaoEstavel(null, { left: 377, top: 288, w: 420 }, 143, H, campo);
    expect(a.ancora.lado).toBe("base");
    // a próxima caixa é mais alta: a conta nova mandaria pra outro canto, mas ele fica e cresce pra cima
    const b = posicaoEstavel(a.ancora, { left: 12, top: 12, w: 420 }, 265, H, campo);
    expect(b.pos.left).toBe(377);
    expect(b.pos.top + 265).toBe(288 + 143);
  });
  it("embaixo/ao lado: preso pelo topo, cresce pra baixo", () => {
    const a = posicaoEstavel(null, { left: 511, top: 228, w: 420 }, 143, H, { x: 285, y: 100, w: 210, h: 55 });
    const b = posicaoEstavel(a.ancora, { left: 180, top: 444, w: 420 }, 265, H, { x: 285, y: 100, w: 210, h: 55 });
    expect(b.pos).toEqual({ left: 511, top: 228, w: 420 });
  });
  it("muda de lugar só se, parado, passaria da tela ou cobriria o destaque", () => {
    const a = posicaoEstavel(null, { left: 12, top: 400, w: 420 }, 150, H, null);
    const b = posicaoEstavel(a.ancora, { left: 300, top: 100, w: 420 }, 300, H, null);   // 400+300 > 643-12
    expect(b.pos).toEqual({ left: 300, top: 100, w: 420 });
  });
});
