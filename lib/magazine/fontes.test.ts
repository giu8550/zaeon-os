import { describe, it, expect } from "vitest";
import { familiaDaVariavel, fonteCanvas, aplicarFonte, fonteValida, comQueda, QUEDA_CORPO, QUEDA_DISPLAY } from "./fontes";

/**
 * Canvas falso que imita a regra real: atribuição com sintaxe inválida é IGNORADA.
 * `var(...)` é o caso que nos custou o Modo Revista inteiro.
 */
const canvasFalso = () => {
  let atual = "10px sans-serif";
  return {
    get font() { return atual; },
    set font(v: string) {
      if (/var\(/.test(v)) return;                        // o canvas de verdade ignora
      if (!/\d+(\.\d+)?px\s+\S/.test(v)) return;          // sem <tamanho>px <família>: ignora
      atual = v;
    },
  };
};

describe("aplicarFonte · o canvas recusa em silêncio, aqui a recusa vira queda", () => {
  it("string com var() é recusada → cai na família de queda", () => {
    const ctx = canvasFalso();
    const valeu = aplicarFonte(ctx, '400 19px var(--font-revista-corpo), Georgia, serif', QUEDA_CORPO);
    expect(valeu).not.toContain("var(");
    expect(valeu).toContain("Georgia");
    expect(ctx.font).toBe(valeu);   // medir e desenhar usam a MESMA string
  });

  it("string resolvida passa intacta", () => {
    const ctx = canvasFalso();
    const f = fonteCanvas(400, 19, "'__Lora_abc', Georgia, serif");
    expect(aplicarFonte(ctx, f, QUEDA_CORPO)).toBe(f);
  });

  it("devolve SEMPRE o que de fato valeu, nunca o que se tentou", () => {
    const ctx = canvasFalso();
    const valeu = aplicarFonte(ctx, "lixo total", QUEDA_DISPLAY);
    expect(valeu).toBe(ctx.font);
  });

  it("a QUEDA sozinha é família sem tamanho — e também seria recusada", () => {
    // O bug da primeira versão desta função: ela caía num valor tão inválido quanto o
    // que estava consertando, e o canvas ficava na sentinela.
    const ctx = canvasFalso();
    ctx.font = QUEDA_CORPO;
    expect(ctx.font).not.toContain("Georgia");            // recusada, como no canvas real
    expect(comQueda("400 19px var(--x), serif", QUEDA_CORPO)).toBe(`400 19px ${QUEDA_CORPO}`);
    expect(comQueda("sem tamanho nenhum", QUEDA_DISPLAY)).toBe(`16px ${QUEDA_DISPLAY}`);
  });

  it("fonteValida separa o joio do trigo", () => {
    const ctx = canvasFalso();
    expect(fonteValida(ctx, '400 19px var(--x), Georgia')).toBe(false);
    expect(fonteValida(ctx, "400 19px Georgia, serif")).toBe(true);
  });
});

describe("familiaDaVariavel · resolve a custom property antes de chegar no canvas", () => {
  it("sem document/getComputedStyle (SSR) devolve a queda, sem explodir", () => {
    expect(familiaDaVariavel("--nao-existe", QUEDA_CORPO, null)).toBe(QUEDA_CORPO);
  });
});

describe("fonteCanvas · monta a string", () => {
  it("arredonda o tamanho (canvas não gosta de 92.15px em alguns motores)", () => {
    expect(fonteCanvas(600, 92.15, "Georgia, serif")).toBe("600 92px Georgia, serif");
  });
  it("nunca embute var()", () => {
    expect(fonteCanvas(400, 19, "'__Lora_x', Georgia, serif")).not.toContain("var(");
  });
});
